import Foundation

public protocol SyncAPITransport {
    func syncBootstrap() async throws -> SyncBootstrapResponse
    func syncPull(query: SyncPullQuery) async throws -> SyncPullResponse
    func syncPush(_ body: SyncPushBody) async throws -> SyncPushResponse
}

public final class TotemSyncAPITransport: SyncAPITransport {
    private let client: TotemAPIClient

    public init(client: TotemAPIClient) { self.client = client }

    public func syncBootstrap() async throws -> SyncBootstrapResponse {
        try await client.syncBootstrap()
    }

    public func syncPull(query: SyncPullQuery) async throws -> SyncPullResponse {
        try await client.syncPull(query: query)
    }

    public func syncPush(_ body: SyncPushBody) async throws -> SyncPushResponse {
        try await client.syncPush(body)
    }
}

public enum SyncCoordinatorState: Equatable {
    case idle
    case syncing
    case pausedUnauthorized
    case offline
    case failed(String)
}

public enum SyncCoordinatorError: Error, Equatable {
    case missingMutationResult(String)
    case conflict(String)
}

/// Orquestador único de sync. Todas las operaciones se ejecutan en el MainActor
/// para que SwiftData y las transiciones observables sean deterministas.
@MainActor
public final class SyncCoordinator {
    public let store: LocalSyncStore
    public let transport: SyncAPITransport
    public let ownerId: String
    public private(set) var state: SyncCoordinatorState = .idle

    private var isRunning = false

    public init(store: LocalSyncStore, transport: SyncAPITransport, ownerId: String) {
        self.store = store
        self.transport = transport
        self.ownerId = ownerId
    }

    public func synchronize() async {
        guard !isRunning else { return }
        isRunning = true
        state = .syncing
        defer { isRunning = false }

        do {
            try await pullChanges()
            try await flushOutbox()
            // El push puede producir cambios de servidor para otras entidades;
            // avanzar el cursor aquí mantiene el snapshot local convergente.
            try await pullChanges()
            state = .idle
        } catch let error as TotemAPIError {
            switch error {
            case .http(let status, _):
                if status == 401 {
                    state = .pausedUnauthorized
                } else if status == 0 {
                    state = .offline
                } else {
                    state = .failed("HTTP \(status)")
                }
            default:
                state = .failed(String(describing: error))
            }
        } catch let error as SyncCoordinatorError {
            switch error {
            case .conflict(let mutationId): state = .failed("conflict:\(mutationId)")
            case .missingMutationResult(let mutationId): state = .failed("missing-result:\(mutationId)")
            }
        } catch {
            state = .failed(String(describing: error))
        }
    }

    public func syncOnLaunch() async { await synchronize() }
    public func syncOnForeground() async { await synchronize() }
    public func syncAfterLocalEdit() async { await synchronize() }

    public func syncOnConnectivityChanged(isReachable: Bool) async {
        guard isReachable else {
            state = .offline
            return
        }
        await synchronize()
    }

    public func resumeAfterAuthentication() async {
        guard state == .pausedUnauthorized else { return }
        await synchronize()
    }

    private func pullChanges() async throws {
        if try store.cursor(ownerId: ownerId) == nil {
            let bootstrap = try await transport.syncBootstrap()
            for change in bootstrap.data.entities {
                try store.applyRemoteChange(change, ownerId: ownerId)
            }
            try store.setCursor(ownerId: ownerId, cursor: bootstrap.data.latestCursor)
            return
        }

        var cursor = try store.cursor(ownerId: ownerId)
        var hasMore = true
        while hasMore {
            let response = try await transport.syncPull(query: SyncPullQuery(cursor: cursor, limit: 100))
            for change in response.data.changes {
                try store.applyRemoteChange(change, ownerId: ownerId)
            }
            if let nextCursor = response.data.nextCursor {
                cursor = nextCursor
                try store.setCursor(ownerId: ownerId, cursor: nextCursor)
            }
            hasMore = response.data.hasMore
            if hasMore && response.data.nextCursor == nil { break }
        }
    }

    /// Envío secuencial: conserva FIFO por recurso y mantiene una concurrencia
    /// global de uno, evitando carreras de versiones en el ledger.
    private func flushOutbox() async throws {
        while let mutation = try store.pendingMutations(limit: 1, ownerId: ownerId).first {
            try store.markSending(mutationId: mutation.mutationId)
            do {
                let response = try await transport.syncPush(SyncPushBody(local: [mutation]))
                guard let result = response.data.results.first(where: { $0.mutationId == mutation.mutationId }) else {
                    try store.markFailed(mutationId: mutation.mutationId, message: "Respuesta sin resultado")
                    throw SyncCoordinatorError.missingMutationResult(mutation.mutationId)
                }
                try store.markApplied(
                    mutationId: result.mutationId,
                    version: result.version,
                    data: result.data,
                    deleted: result.deleted
                )
            } catch let error as TotemAPIError {
                if case .http(let status, _) = error, status == 409 {
                    try store.markConflict(mutationId: mutation.mutationId, message: "Conflicto de versión")
                    throw SyncCoordinatorError.conflict(mutation.mutationId)
                }
                if case .http(let status, _) = error, status == 401 { throw error }
                try store.markFailed(mutationId: mutation.mutationId, message: String(describing: error))
                throw error
            }
        }
    }
}
