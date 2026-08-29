import XCTest
@testable import TotemOSKit

private final class FakeDashboardTransport: DashboardAPITransport {
    var response: DashboardResponse?
    var error: Error?

    func dashboard() async throws -> DashboardResponse {
        if let error { throw error }
        return response!
    }
}

@MainActor
final class DashboardStoreTests: XCTestCase {
    func testLoadsAndPersistsFreshDashboard() async throws {
        let cacheURL = temporaryCacheURL()
        defer { try? FileManager.default.removeItem(at: cacheURL) }
        let transport = FakeDashboardTransport()
        transport.response = response()
        let store = DashboardStore(transport: transport, cacheURL: cacheURL)

        await store.load()

        XCTAssertEqual(store.state, .loaded)
        XCTAssertEqual(store.data?.user.name, "Ada Lovelace")
        XCTAssertTrue(FileManager.default.fileExists(atPath: cacheURL.path))
    }

    func testShowsCachedDashboardWhenNetworkIsOffline() async throws {
        let cacheURL = temporaryCacheURL()
        defer { try? FileManager.default.removeItem(at: cacheURL) }
        let firstTransport = FakeDashboardTransport()
        firstTransport.response = response()
        let firstStore = DashboardStore(transport: firstTransport, cacheURL: cacheURL)
        await firstStore.load()

        let offlineTransport = FakeDashboardTransport()
        offlineTransport.error = TotemAPIError.http(status: 0, problem: nil)
        let cachedStore = DashboardStore(transport: offlineTransport, cacheURL: cacheURL)
        XCTAssertEqual(cachedStore.state, .loaded)
        await cachedStore.load()

        XCTAssertEqual(cachedStore.state, .offline)
        XCTAssertEqual(cachedStore.data, firstStore.data)
    }

    func testEmptyAndServerErrorStatesAreExplicit() async {
        let emptyTransport = FakeDashboardTransport()
        emptyTransport.response = response(empty: true)
        let emptyStore = DashboardStore(transport: emptyTransport, cacheURL: temporaryCacheURL())
        await emptyStore.load()
        XCTAssertEqual(emptyStore.state, .empty)

        let errorTransport = FakeDashboardTransport()
        errorTransport.error = TotemAPIError.http(status: 500, problem: nil)
        let errorStore = DashboardStore(transport: errorTransport, cacheURL: temporaryCacheURL())
        await errorStore.load()
        XCTAssertEqual(errorStore.state, .error)
    }

    func testCanRefreshTransportWithoutDroppingTheStore() async {
        let firstTransport = FakeDashboardTransport()
        firstTransport.response = response()
        let secondTransport = FakeDashboardTransport()
        secondTransport.response = response(empty: true)
        let store = DashboardStore(transport: firstTransport, cacheURL: temporaryCacheURL())

        await store.load()
        store.updateTransport(secondTransport)
        await store.load(forceRefresh: true)

        XCTAssertEqual(store.state, .empty)
        XCTAssertEqual(store.data?.summary.activeClients, 0)
    }

    private func temporaryCacheURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("totem-dashboard-\(UUID().uuidString).json")
    }

    private func response(empty: Bool = false) -> DashboardResponse {
        let summary = DashboardSummary(
            activeClients: empty ? 0 : 2,
            assignedTasks: empty ? 0 : 3,
            overdueEditingTasks: 0,
            overduePublicationTasks: 0,
            publishedThisMonth: empty ? 0 : 1,
            pendingApprovals: 0,
            scheduledToday: 0,
            priorityTasks: 0,
            totalIncome: nil,
            totalReceivable: nil
        )
        let data = DashboardData(
            generatedAt: "2026-08-28T12:00:00.000Z",
            user: DashboardUser(id: "user-1", name: "Ada Lovelace", role: "ADMIN", specialty: nil),
            summary: summary,
            pipeline: [DashboardPipelineStage(key: "IDEA", label: "Idea", count: empty ? 0 : 3)],
            agenda: [],
            priorityTasks: [],
            approvals: [],
            workloads: [],
            recentTransactions: []
        )
        return DashboardResponse(data: data, meta: SyncResponseMeta(requestId: "dashboard-test"))
    }
}
