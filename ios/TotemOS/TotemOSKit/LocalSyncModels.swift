import Foundation
import SwiftData

/// Operaciones que el ledger REST puede aplicar de forma idempotente.
public enum LocalSyncOperation: String, Codable, Sendable {
    case create
    case update
    case delete
}

/// Estados persistidos del outbox. `sending` se recupera como `queued` al
/// abrir la aplicación para no perder una mutación interrumpida.
public enum OutboxMutationState: String, Codable, Sendable {
    case queued
    case sending
    case applied
    case failed
    case conflict
}

/// DTO local independiente de `SyncMutation`. SwiftData guarda JSON opaco para
/// que los modelos de dominio no queden acoplados al contrato HTTP.
public struct LocalSyncMutation: Codable, Equatable {
    public let mutationId: String
    public let clientId: String
    public let ownerId: String
    public let entityType: String
    public let entityId: String
    public let operation: LocalSyncOperation
    public let baseVersion: Int?
    public let data: [String: APIJSONValue]?

    public init(
        mutationId: String,
        clientId: String,
        ownerId: String,
        entityType: String,
        entityId: String,
        operation: LocalSyncOperation,
        baseVersion: Int?,
        data: [String: APIJSONValue]?
    ) {
        self.mutationId = mutationId
        self.clientId = clientId
        self.ownerId = ownerId
        self.entityType = entityType
        self.entityId = entityId
        self.operation = operation
        self.baseVersion = baseVersion
        self.data = data
    }
}

public struct LocalEntitySnapshot: Codable, Equatable {
    public let ownerId: String
    public let entityType: String
    public let entityId: String
    public let serverVersion: Int
    public let base: [String: APIJSONValue]?
    public let local: [String: APIJSONValue]?
    public let isDirty: Bool
    public let isDeleted: Bool

    public init(
        ownerId: String,
        entityType: String,
        entityId: String,
        serverVersion: Int,
        base: [String: APIJSONValue]?,
        local: [String: APIJSONValue]?,
        isDirty: Bool,
        isDeleted: Bool
    ) {
        self.ownerId = ownerId
        self.entityType = entityType
        self.entityId = entityId
        self.serverVersion = serverVersion
        self.base = base
        self.local = local
        self.isDirty = isDirty
        self.isDeleted = isDeleted
    }
}

@Model
public final class LocalSyncEntityRecord {
    @Attribute(.unique) public var key: String
    public var ownerId: String
    public var entityType: String
    public var entityId: String
    public var serverVersion: Int
    public var basePayloadData: Data?
    public var localPayloadData: Data?
    public var isDirty: Bool
    public var isDeleted: Bool
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        key: String,
        ownerId: String,
        entityType: String,
        entityId: String,
        serverVersion: Int = 0,
        basePayloadData: Data? = nil,
        localPayloadData: Data? = nil,
        isDirty: Bool = false,
        isDeleted: Bool = false,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.key = key
        self.ownerId = ownerId
        self.entityType = entityType
        self.entityId = entityId
        self.serverVersion = serverVersion
        self.basePayloadData = basePayloadData
        self.localPayloadData = localPayloadData
        self.isDirty = isDirty
        self.isDeleted = isDeleted
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
public final class OutboxMutationRecord {
    @Attribute(.unique) public var mutationId: String
    public var clientId: String
    public var ownerId: String
    public var entityType: String
    public var entityId: String
    public var operation: String
    public var baseVersion: Int?
    public var payloadData: Data?
    public var state: String
    public var attemptCount: Int
    public var lastError: String?
    public var createdAt: Date
    public var updatedAt: Date

    public init(
        mutationId: String,
        clientId: String,
        ownerId: String,
        entityType: String,
        entityId: String,
        operation: String,
        baseVersion: Int?,
        payloadData: Data?,
        state: String = OutboxMutationState.queued.rawValue,
        attemptCount: Int = 0,
        lastError: String? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.mutationId = mutationId
        self.clientId = clientId
        self.ownerId = ownerId
        self.entityType = entityType
        self.entityId = entityId
        self.operation = operation
        self.baseVersion = baseVersion
        self.payloadData = payloadData
        self.state = state
        self.attemptCount = attemptCount
        self.lastError = lastError
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

@Model
public final class SyncMetadataRecord {
    @Attribute(.unique) public var ownerId: String
    public var cursor: String?
    public var updatedAt: Date

    public init(ownerId: String, cursor: String? = nil, updatedAt: Date = .now) {
        self.ownerId = ownerId
        self.cursor = cursor
        self.updatedAt = updatedAt
    }
}

/// Persistencia de sync. `ModelContext` se mantiene en MainActor porque es la
/// autoridad de SwiftData; el coordinador de sync también serializa su acceso.
@MainActor
public final class LocalSyncStore {
    public let container: ModelContainer
    private let context: ModelContext
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(inMemory: Bool = false) throws {
        let schema = Schema([
            LocalSyncEntityRecord.self,
            OutboxMutationRecord.self,
            SyncMetadataRecord.self,
        ])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
        container = try ModelContainer(for: schema, configurations: [configuration])
        context = ModelContext(container)
        try recoverInterruptedMutations()
    }

    public func enqueue(
        mutation: LocalSyncMutation,
        now: Date = .now
    ) throws -> OutboxMutationRecord {
        if let existing = try outboxRecord(mutationId: mutation.mutationId) {
            return existing
        }

        let key = Self.entityKey(ownerId: mutation.ownerId, entityType: mutation.entityType, entityId: mutation.entityId)
        let payloadData = try encode(mutation.data)
        let existingEntity = try entityRecord(key: key)
        let entity = existingEntity
            ?? LocalSyncEntityRecord(
                key: key,
                ownerId: mutation.ownerId,
                entityType: mutation.entityType,
                entityId: mutation.entityId,
                createdAt: now,
                updatedAt: now
            )

        if existingEntity == nil { context.insert(entity) }
        if mutation.operation == .delete {
            entity.localPayloadData = nil
            entity.isDeleted = true
        } else {
            entity.localPayloadData = payloadData
            entity.isDeleted = false
        }
        entity.isDirty = true
        entity.updatedAt = now

        let record = OutboxMutationRecord(
            mutationId: mutation.mutationId,
            clientId: mutation.clientId,
            ownerId: mutation.ownerId,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            operation: mutation.operation.rawValue,
            baseVersion: mutation.baseVersion,
            payloadData: payloadData,
            createdAt: now,
            updatedAt: now
        )
        context.insert(record)
        try save()
        return record
    }

    public func pendingMutations(limit: Int = 50, ownerId: String? = nil) throws -> [LocalSyncMutation] {
        let records = try context.fetch(FetchDescriptor<OutboxMutationRecord>())
            .filter {
                $0.state == OutboxMutationState.queued.rawValue
                    || $0.state == OutboxMutationState.failed.rawValue
            }
            .filter { ownerId == nil || $0.ownerId == ownerId }
            .sorted { $0.createdAt < $1.createdAt }
            .prefix(max(0, limit))
        return try records.map(localMutation(from:))
    }

    public func markSending(mutationId: String, now: Date = .now) throws {
        guard let record = try outboxRecord(mutationId: mutationId) else { return }
        record.state = OutboxMutationState.sending.rawValue
        record.attemptCount += 1
        record.updatedAt = now
        try save()
    }

    public func markApplied(
        mutationId: String,
        version: Int,
        data: [String: APIJSONValue]?,
        deleted: Bool,
        now: Date = .now
    ) throws {
        guard let record = try outboxRecord(mutationId: mutationId) else { return }
        let key = Self.entityKey(ownerId: record.ownerId, entityType: record.entityType, entityId: record.entityId)
        let existingEntity = try entityRecord(key: key)
        let entity = existingEntity
            ?? LocalSyncEntityRecord(key: key, ownerId: record.ownerId, entityType: record.entityType, entityId: record.entityId)
        if existingEntity == nil { context.insert(entity) }
        let payloadData = try encode(data)
        entity.serverVersion = version
        entity.basePayloadData = payloadData
        entity.localPayloadData = payloadData
        entity.isDirty = false
        entity.isDeleted = deleted
        entity.updatedAt = now
        record.state = OutboxMutationState.applied.rawValue
        record.lastError = nil
        record.updatedAt = now
        try save()
    }

    public func markFailed(mutationId: String, message: String, now: Date = .now) throws {
        guard let record = try outboxRecord(mutationId: mutationId) else { return }
        record.state = OutboxMutationState.failed.rawValue
        record.lastError = String(message.prefix(500))
        record.updatedAt = now
        try save()
    }

    public func markConflict(mutationId: String, message: String, now: Date = .now) throws {
        guard let record = try outboxRecord(mutationId: mutationId) else { return }
        record.state = OutboxMutationState.conflict.rawValue
        record.lastError = String(message.prefix(500))
        record.updatedAt = now
        try save()
    }

    public func applyRemoteChange(_ change: SyncChange, ownerId: String, now: Date = .now) throws {
        let key = Self.entityKey(ownerId: ownerId, entityType: change.entityType, entityId: change.entityId)
        let existingEntity = try entityRecord(key: key)
        let entity = existingEntity
            ?? LocalSyncEntityRecord(key: key, ownerId: ownerId, entityType: change.entityType, entityId: change.entityId)
        if existingEntity == nil { context.insert(entity) }
        let payloadData = try encode(change.data)
        entity.serverVersion = change.version
        entity.basePayloadData = payloadData
        if !entity.isDirty {
            entity.localPayloadData = payloadData
            entity.isDeleted = change.operation == "delete"
        }
        entity.updatedAt = now
        try save()
    }

    public func snapshot(ownerId: String, entityType: String, entityId: String) throws -> LocalEntitySnapshot? {
        let key = Self.entityKey(ownerId: ownerId, entityType: entityType, entityId: entityId)
        guard let entity = try entityRecord(key: key) else { return nil }
        return LocalEntitySnapshot(
            ownerId: entity.ownerId,
            entityType: entity.entityType,
            entityId: entity.entityId,
            serverVersion: entity.serverVersion,
            base: try decode(entity.basePayloadData),
            local: try decode(entity.localPayloadData),
            isDirty: entity.isDirty,
            isDeleted: entity.isDeleted
        )
    }

    public func cursor(ownerId: String) throws -> String? {
        try metadata(ownerId: ownerId)?.cursor
    }

    public func setCursor(ownerId: String, cursor: String?, now: Date = .now) throws {
        let existingRecord = try metadata(ownerId: ownerId)
        let record = existingRecord ?? SyncMetadataRecord(ownerId: ownerId)
        if existingRecord == nil { context.insert(record) }
        record.cursor = cursor
        record.updatedAt = now
        try save()
    }

    public func outboxState(mutationId: String) throws -> OutboxMutationState? {
        guard let raw = try outboxRecord(mutationId: mutationId)?.state else { return nil }
        return OutboxMutationState(rawValue: raw)
    }

    public func recoverInterruptedMutations() throws {
        let records = try context.fetch(FetchDescriptor<OutboxMutationRecord>())
        var changed = false
        for record in records where record.state == OutboxMutationState.sending.rawValue {
            record.state = OutboxMutationState.queued.rawValue
            record.updatedAt = .now
            changed = true
        }
        if changed { try save() }
    }

    public static func entityKey(ownerId: String, entityType: String, entityId: String) -> String {
        "\(ownerId)::\(entityType)::\(entityId)"
    }

    private func metadata(ownerId: String) throws -> SyncMetadataRecord? {
        try context.fetch(FetchDescriptor<SyncMetadataRecord>()).first { $0.ownerId == ownerId }
    }

    private func entityRecord(key: String) throws -> LocalSyncEntityRecord? {
        try context.fetch(FetchDescriptor<LocalSyncEntityRecord>()).first { $0.key == key }
    }

    private func outboxRecord(mutationId: String) throws -> OutboxMutationRecord? {
        try context.fetch(FetchDescriptor<OutboxMutationRecord>()).first { $0.mutationId == mutationId }
    }

    private func localMutation(from record: OutboxMutationRecord) throws -> LocalSyncMutation {
        guard
            let operation = LocalSyncOperation(rawValue: record.operation),
            record.mutationId.isEmpty == false,
            record.clientId.isEmpty == false,
            record.ownerId.isEmpty == false
        else { throw LocalSyncStoreError.invalidMutation }
        return LocalSyncMutation(
            mutationId: record.mutationId,
            clientId: record.clientId,
            ownerId: record.ownerId,
            entityType: record.entityType,
            entityId: record.entityId,
            operation: operation,
            baseVersion: record.baseVersion,
            data: try decode(record.payloadData)
        )
    }

    private func encode(_ value: [String: APIJSONValue]?) throws -> Data? {
        guard let value else { return nil }
        return try encoder.encode(value)
    }

    private func decode(_ data: Data?) throws -> [String: APIJSONValue]? {
        guard let data else { return nil }
        return try decoder.decode([String: APIJSONValue].self, from: data)
    }

    private func save() throws { try context.save() }
}

public enum LocalSyncStoreError: Error, Equatable {
    case invalidMutation
}

public extension SyncMutation {
    init(local mutation: LocalSyncMutation) {
        self.init(
            mutationId: mutation.mutationId,
            clientId: mutation.clientId,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            operation: mutation.operation.rawValue,
            baseVersion: mutation.baseVersion,
            data: mutation.data
        )
    }
}

public extension SyncPushBody {
    init(local mutations: [LocalSyncMutation]) {
        self.init(mutations: mutations.map(SyncMutation.init(local:)))
    }
}
