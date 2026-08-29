import XCTest
@testable import TotemOSKit

final class ConflictResolverTests: XCTestCase {
    func testNonOverlappingFieldsMergeAutomatically() {
        let conflict = SyncConflict(
            base: ["name": .string("Ana"), "amount": .number(10)],
            local: ["name": .string("Ana María"), "amount": .number(10)],
            server: ["name": .string("Ana"), "amount": .number(12)]
        )

        let result = SyncConflictResolver.merge(conflict)

        XCTAssertTrue(result.isResolved)
        XCTAssertEqual(result.merged?["name"], .string("Ana María"))
        XCTAssertEqual(result.merged?["amount"], .number(12))
    }

    func testOverlappingFieldRequiresExplicitChoice() {
        let conflict = SyncConflict(
            base: ["status": .string("draft")],
            local: ["status": .string("approved")],
            server: ["status": .string("rejected")]
        )

        let pending = SyncConflictResolver.merge(conflict)
        XCTAssertEqual(pending.unresolvedFields, ["status"])

        let resolved = SyncConflictResolver.resolve(conflict, choices: ["status": .server])
        XCTAssertTrue(resolved.isResolved)
        XCTAssertEqual(resolved.merged?["status"], .string("rejected"))
    }

    func testDeleteVsEditIsVisibleAndCanChooseEdit() {
        let conflict = SyncConflict(
            base: ["title": .string("Original")],
            local: nil,
            server: ["title": .string("Edited")],
            localDeleted: true,
            serverDeleted: false
        )

        let pending = SyncConflictResolver.merge(conflict)
        XCTAssertEqual(pending.unresolvedFields, ["title", SyncConflictResolver.deleteField])

        let resolved = SyncConflictResolver.resolve(
            conflict,
            choices: ["title": .server, SyncConflictResolver.deleteField: .server]
        )
        XCTAssertTrue(resolved.isResolved)
        XCTAssertFalse(resolved.mergedDeleted)
        XCTAssertEqual(resolved.merged?["title"], .string("Edited"))
    }

    func testSameValueOnBothSidesDoesNotConflict() {
        let conflict = SyncConflict(
            base: ["status": .string("draft")],
            local: ["status": .string("approved")],
            server: ["status": .string("approved")]
        )

        let result = SyncConflictResolver.merge(conflict)

        XCTAssertTrue(result.isResolved)
        XCTAssertEqual(result.merged?["status"], .string("approved"))
    }
}
