import XCTest
@testable import TotemOSKit

@MainActor
final class LocalSyncStoreTests: XCTestCase {
    private func mutation(
        id: String = "m-1",
        operation: LocalSyncOperation = .update,
        data: [String: APIJSONValue]? = ["amount": .number(12.5)]
    ) -> LocalSyncMutation {
        LocalSyncMutation(
            mutationId: id,
            clientId: "ios-test-client",
            ownerId: "owner-1",
            entityType: "expense",
            entityId: "expense-1",
            operation: operation,
            baseVersion: 3,
            data: data
        )
    }

    func testEnqueueIsIdempotentAndPersistsDirtySnapshot() throws {
        let store = try LocalSyncStore(inMemory: true)
        let first = try store.enqueue(mutation: mutation())
        let second = try store.enqueue(mutation: mutation())

        XCTAssertEqual(first.mutationId, second.mutationId)
        XCTAssertEqual(try store.pendingMutations().count, 1)
        XCTAssertEqual(try store.outboxState(mutationId: "m-1"), .queued)

        let snapshot = try XCTUnwrap(try store.snapshot(ownerId: "owner-1", entityType: "expense", entityId: "expense-1"))
        XCTAssertTrue(snapshot.isDirty)
        XCTAssertFalse(snapshot.isDeleted)
        XCTAssertEqual(snapshot.local?["amount"], .number(12.5))
    }

    func testInterruptedSendingMutationReturnsToQueue() throws {
        let store = try LocalSyncStore(inMemory: true)
        _ = try store.enqueue(mutation: mutation())
        try store.markSending(mutationId: "m-1")
        XCTAssertEqual(try store.outboxState(mutationId: "m-1"), .sending)

        try store.recoverInterruptedMutations()
        XCTAssertEqual(try store.outboxState(mutationId: "m-1"), .queued)
        XCTAssertEqual(try store.pendingMutations().map(\.mutationId), ["m-1"])
    }

    func testAppliedMutationClearsDirtyFlag() throws {
        let store = try LocalSyncStore(inMemory: true)
        _ = try store.enqueue(mutation: mutation())
        try store.markApplied(mutationId: "m-1", version: 4, data: ["amount": .number(12.5)], deleted: false)

        XCTAssertEqual(try store.outboxState(mutationId: "m-1"), .applied)
        let snapshot = try XCTUnwrap(try store.snapshot(ownerId: "owner-1", entityType: "expense", entityId: "expense-1"))
        XCTAssertFalse(snapshot.isDirty)
        XCTAssertEqual(snapshot.serverVersion, 4)
    }

    func testDeleteMutationStoresTombstoneWithoutPayload() throws {
        let store = try LocalSyncStore(inMemory: true)
        _ = try store.enqueue(mutation: mutation(operation: .delete, data: nil))

        let snapshot = try XCTUnwrap(try store.snapshot(ownerId: "owner-1", entityType: "expense", entityId: "expense-1"))
        XCTAssertTrue(snapshot.isDirty)
        XCTAssertTrue(snapshot.isDeleted)
        XCTAssertNil(snapshot.local)
    }
}
