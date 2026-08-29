import Combine
import Foundation

public protocol DashboardAPITransport {
    func dashboard() async throws -> DashboardResponse
}

extension TotemAPIClient: DashboardAPITransport {}

public enum DashboardLoadState: Equatable {
    case idle
    case loading
    case loaded
    case empty
    case offline
    case error
}

/// Small stale-while-revalidate store for the native command center. The
/// cached response is never treated as authoritative: it is displayed while
/// the API is requested again, and the state tells the view whether it is
/// fresh, offline or failed.
@MainActor
public final class DashboardStore: ObservableObject {
    @Published public private(set) var state: DashboardLoadState = .idle
    @Published public private(set) var data: DashboardData?
    @Published public private(set) var lastUpdatedAt: Date?
    @Published public private(set) var lastErrorMessage: String?
    @Published public private(set) var lastHTTPStatus: Int?

    private var transport: DashboardAPITransport
    private let cacheURL: URL?

    public init(transport: DashboardAPITransport, cacheURL: URL? = nil) {
        self.transport = transport
        self.cacheURL = cacheURL ?? Self.defaultCacheURL()
        loadCache()
    }

    public var hasCachedData: Bool { data != nil }

    /// Rebinds the API transport so callers can refresh authentication
    /// headers (the WKWebView cookie store may rotate between requests).
    public func updateTransport(_ transport: DashboardAPITransport) {
        self.transport = transport
    }

    public func load(forceRefresh: Bool = false) async {
        if data == nil || forceRefresh {
            state = .loading
        } else {
            // Keep cached content visible while revalidating it.
            state = .loading
        }
        lastErrorMessage = nil
        lastHTTPStatus = nil

        do {
            let response = try await transport.dashboard()
            data = response.data
            lastUpdatedAt = Self.date(from: response.data.generatedAt)
            state = response.data.isEmpty ? .empty : .loaded
            persist(response)
        } catch let TotemAPIError.http(status, problem) {
            lastHTTPStatus = status
            lastErrorMessage = problem?.detail ?? "La API respondió con HTTP \(status)."
            state = Self.isOfflineStatus(status) ? .offline : .error
        } catch {
            lastErrorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            if Self.isOffline(error) {
                state = .offline
            } else {
                state = .error
            }
        }
    }

    public func clearCache() {
        data = nil
        lastUpdatedAt = nil
        state = .idle
        guard let cacheURL else { return }
        try? FileManager.default.removeItem(at: cacheURL)
    }

    private func loadCache() {
        guard let cacheURL,
              let cached = try? Data(contentsOf: cacheURL),
              let response = try? JSONDecoder().decode(DashboardResponse.self, from: cached)
        else { return }
        data = response.data
        lastUpdatedAt = Self.date(from: response.data.generatedAt)
        state = response.data.isEmpty ? .empty : .loaded
    }

    private func persist(_ response: DashboardResponse) {
        guard let cacheURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: cacheURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try JSONEncoder().encode(response).write(to: cacheURL, options: .atomic)
        } catch {
            #if DEBUG
            print("Dashboard cache write failed: \(error.localizedDescription)")
            #endif
        }
    }

    private static func defaultCacheURL() -> URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("TotemOS", isDirectory: true)
            .appendingPathComponent("dashboard.json")
    }

    private static func date(from value: String) -> Date? {
        ISO8601DateFormatter().date(from: value)
    }

    private static func isOffline(_ error: Error) -> Bool {
        if case TotemAPIError.http(let status, _) = error, isOfflineStatus(status) { return true }
        if let urlError = error as? URLError {
            return [.notConnectedToInternet, .networkConnectionLost, .timedOut].contains(urlError.code)
        }
        return false
    }

    private static func isOfflineStatus(_ status: Int) -> Bool {
        status == 0
    }
}

private extension DashboardData {
    var isEmpty: Bool {
        summary.activeClients == 0
            && summary.assignedTasks == 0
            && pipeline.allSatisfy { $0.count == 0 }
            && agenda.isEmpty
            && priorityTasks.isEmpty
            && approvals.isEmpty
    }
}
