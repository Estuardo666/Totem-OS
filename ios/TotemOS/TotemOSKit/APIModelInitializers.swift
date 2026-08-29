import Foundation

// Los DTO generados conservan sus propiedades públicas; estas inicializaciones
// explícitas permiten construir respuestas en pruebas y adaptadores sin editar
// el archivo generado.
public extension SyncChange {
    init(
        sequence: String,
        entityType: String,
        entityId: String,
        operation: String,
        version: Int,
        data: [String: APIJSONValue]?,
        deletedAt: String?,
        changedAt: String
    ) {
        self.sequence = sequence
        self.entityType = entityType
        self.entityId = entityId
        self.operation = operation
        self.version = version
        self.data = data
        self.deletedAt = deletedAt
        self.changedAt = changedAt
    }
}

public extension SyncMutationResult {
    init(
        mutationId: String,
        duplicate: Bool,
        entityType: String,
        entityId: String,
        operation: String,
        version: Int,
        deleted: Bool,
        data: [String: APIJSONValue]?,
        changedAt: String
    ) {
        self.mutationId = mutationId
        self.duplicate = duplicate
        self.entityType = entityType
        self.entityId = entityId
        self.operation = operation
        self.version = version
        self.deleted = deleted
        self.data = data
        self.changedAt = changedAt
    }
}

public extension SyncPullData {
    init(changes: [SyncChange], hasMore: Bool, nextCursor: String?, retentionDays: Int) {
        self.changes = changes
        self.hasMore = hasMore
        self.nextCursor = nextCursor
        self.retentionDays = retentionDays
    }
}

public extension SyncPullResponse {
    init(data: SyncPullData, meta: SyncResponseMeta) {
        self.data = data
        self.meta = meta
    }
}

public extension SyncPushData {
    init(results: [SyncMutationResult]) { self.results = results }
}

public extension SyncPushResponse {
    init(data: SyncPushData, meta: SyncResponseMeta) {
        self.data = data
        self.meta = meta
    }
}

public extension SyncBootstrapData {
    init(entities: [SyncChange], latestCursor: String?, retentionDays: Int) {
        self.entities = entities
        self.latestCursor = latestCursor
        self.retentionDays = retentionDays
    }
}

public extension SyncResponseMeta {
    init(requestId: String) { self.requestId = requestId }
}

public extension SyncBootstrapResponse {
    init(data: SyncBootstrapData, meta: SyncResponseMeta) {
        self.data = data
        self.meta = meta
    }
}
