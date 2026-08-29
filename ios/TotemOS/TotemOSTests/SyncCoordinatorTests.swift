import XCTest
@testable import TotemOSKit

private final class FakeSyncTransport: SyncAPITransport {
    var bootstrapResponse: SyncBootstrapResponse
    var pullResponses: [SyncPullResponse] = []
    var pushError: Error?
    private(set) var pushedMutationIds: [String] = []

    init(bootstrapResponse: SyncBootstrapResponse) {
        self.bootstrapResponse = bootstrapResponse
    }

    func syncBootstrap() async throws -> SyncBootstrapResponse { bootstrapResponse }

    func syncPull(query: SyncPullQuery) async throws -> SyncPullResponse {
        if pullResponses.isEmpty {
            return SyncPullResponse(
                data: SyncPullData(changes: [], hasMore: false, nextCursor: query.cursor, retentionDays: 90),
                meta: SyncResponseMeta(requestId: "pull")
            )
        }
        return pullResponses.removeFirst()
    }

    func syncPush(_ body: SyncPushBody) async throws -> SyncPushResponse {
        if let pushError { throw pushError }
        pushedMutationIds.append(contentsOf: body.mutations.map(\.mutationId))
        let results = body.mutations.map {
            SyncMutationResult(
                mutationId: $0.mutationId,
                duplicate: false,
                entityType: $0.entityType,
                entityId: $0.entityId,
                operation: $0.operation,
                version: ($0.baseVersion ?? 0) + 1,
                deleted: $0.operation == "delete",
                data: $0.data,
                changedAt: "2026-08-28T00:00:00.000Z"
            )
        }
        return SyncPushResponse(
            data: SyncPushData(results: results),
            meta: SyncResponseMeta(requestId: "push")
        )
    }
}

@MainActor
final class SyncCoordinatorTests: XCTestCase {
    private func bootstrap() -> SyncBootstrapResponse {
        let change = SyncChange(
            sequence: "seq-1",
            entityType: "expense",
            entityId: "expense-1",
            operation: "create",
            version: 1,
            data: ["amount": .number(10)],
            deletedAt: nil,
            changedAt: "2026-08-28T00:00:00.000Z"
        )
        return SyncBootstrapResponse(
            data: SyncBootstrapData(entities: [change], latestCursor: "cursor-1", retentionDays: 90),
            meta: SyncResponseMeta(requestId: "bootstrap")
        )
    }

    private func mutation(id: String, entityId: String) -> LocalSyncMutation {
        LocalSyncMutation(
            mutationId: id,
            clientId: "client",
            ownerId: "owner",
            entityType: "expense",
            entityId: entityId,
            operation: .update,
            baseVersion: 1,
            data: ["amount": .number(20)]
        )
    }

    func testBootstrapAndOutboxConvergeInOrder() async throws {
        let store = try LocalSyncStore(inMemory: true)
        _ = try store.enqueue(mutation: mutation(id: "m-1", entityId: "expense-1"))
        _ = try store.enqueue(mutation: mutation(id: "m-2", entityId: "expense-2"))
        let transport = FakeSyncTransport(bootstrapResponse: bootstrap())
        let coordinator = SyncCoordinator(store: store, transport: transport, ownerId: "owner")

        await coordinator.synchronize()

        XCTAssertEqual(coordinator.state, .idle)
        XCTAssertEqual(transport.pushedMutationIds, ["m-1", "m-2"])
        XCTAssertEqual(try store.outboxState(mutationId: "m-1"), .applied)
        XCTAssertEqual(try store.outboxState(mutationId: "m-2"), .applied)
        XCTAssertEqual(try store.cursor(ownerId: "owner"), "cursor-1")
    }

    func testUnauthorizedResponsePausesSyncUntilAuthentication() async throws {
        let store = try LocalSyncStore(inMemory: true)
        let transport = FakeSyncTransport(bootstrapResponse: bootstrap())
        transport.pushError = TotemAPIError.http(status: 401, problem: nil)
        let coordinator = SyncCoordinator(store: store, transport: transport, ownerId: "owner")

        await coordinator.synchronize()

        // Bootstrap succeeds, so 401 is exercised by a pending push.
        _ = try store.enqueue(mutation: mutation(id: "m-401", entityId: "expense-401"))
        await coordinator.synchronize()
        XCTAssertEqual(coordinator.state, .pausedUnauthorized)
    }

    func testConnectivityEventDoesNotDiscardQueuedMutations() async throws {
        let store = try LocalSyncStore(inMemory: true)
        _ = try store.enqueue(mutation: mutation(id: "m-offline", entityId: "expense-offline"))
        let transport = FakeSyncTransport(bootstrapResponse: bootstrap())
        let coordinator = SyncCoordinator(store: store, transport: transport, ownerId: "owner")

        await coordinator.syncOnConnectivityChanged(isReachable: false)
        XCTAssertEqual(coordinator.state, .offline)
        XCTAssertEqual(try store.pendingMutations().map(\.mutationId), ["m-offline"])
    }
}
