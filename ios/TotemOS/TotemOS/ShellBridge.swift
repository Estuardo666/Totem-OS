import Combine
import Foundation
import WebKit
import TotemOSKit

@MainActor
final class AppCoordinator: ObservableObject {
    @Published private(set) var state: NativeShellState = .empty
    @Published private(set) var routeConfiguration = HybridRouteConfiguration.fallback
    @Published private(set) var hasLoadedState = false
    @Published var isNotificationListOpen = false

    private weak var webView: WKWebView?
    private var refreshTask: Task<Void, Never>?
    private var localLegacyRollbackRoutes = Set<String>()

    var snapshot: ShellSnapshot { state.snapshot }
    var isVisible: Bool { hasLoadedState && state.user != nil && !state.overlayHidden }

    func mode(for route: AppRoute) -> AppRouteMode {
        if localLegacyRollbackRoutes.contains(route.path) { return .web }
        return routeConfiguration.mode(for: route.path)
    }

    var shouldUseNativeRoute: Bool { mode(for: state.route) == .native }

    func rollbackToLegacyWeb(for route: AppRoute) {
        localLegacyRollbackRoutes.insert(route.path)
        objectWillChange.send()
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func reset() {
        refreshTask?.cancel()
        refreshTask = nil
        state = .empty
        routeConfiguration = .fallback
        localLegacyRollbackRoutes.removeAll()
        hasLoadedState = false
        isNotificationListOpen = false
        setWebChromeReplacementActive(false)
    }

    func webViewDidFinish(url: URL?) {
        guard let url, url.host == AppEnvironment.baseURL.host,
              let route = AppRoute(path: url.path) else { return }
        state.route = route
        if isVisible {
            setWebChromeReplacementActive(true)
        }
        scheduleRefresh()
    }

    func refresh() async {
        guard let webView else { return }
        let headers = await cookieHeaders(from: webView.configuration.websiteDataStore.httpCookieStore)
        do {
            let client = TotemAPIClient(baseURL: AppEnvironment.baseURL, additionalHeaders: headers)
            async let bootstrapResponse = client.shellBootstrap()
            async let appConfigResponse = client.appConfig()
            let response = try await bootstrapResponse
            if let config = try? await appConfigResponse {
                routeConfiguration = HybridRouteConfiguration(data: config.data)
            }
            let currentRoute = state.route
            state = NativeShellState(bootstrap: response.data, route: currentRoute)
            hasLoadedState = true
            setWebChromeReplacementActive(true)
        } catch TotemAPIError.http(let status, _) where status == 401 {
            reset()
            AppModel.shared.presentNativeLogin()
        } catch {
            // `refresh()` solo se agenda después de que WKWebView terminó una
            // ruta protegida válida. Si el bootstrap falla, esa navegación ya
            // confirmó la sesión y podemos conservar un shell de mínimo
            // privilegio mientras la API se recupera.
            if state.user == nil {
                state = .offlineFallback(route: state.route)
                hasLoadedState = true
            }
            if isVisible {
                setWebChromeReplacementActive(true)
            }
            #if DEBUG
            print("Native shell bootstrap failed: \(error.localizedDescription)")
            #endif
        }
    }

    func send(_ command: ShellCommand) {
        guard let webView, let payload = command.payload else { return }
        applyOptimistic(command)
        Task {
            _ = try? await webView.callAsyncJavaScript(
                """
                if (typeof window.\(ShellContract.dispatchFunction) !== "function") { return false; }
                return await window.\(ShellContract.dispatchFunction)(command);
                """,
                arguments: ["command": payload], in: nil, contentWorld: .page
            )
            await refresh()
        }
    }

    func navigate(to route: AppRoute) {
        isNotificationListOpen = false
        state.route = route
        guard mode(for: route) == .web else { return }
        send(.navigate(route: route.path))
    }

    func navigate(to path: String) {
        guard let route = AppRoute(path: path) else { return }
        navigate(to: route)
    }

    private func scheduleRefresh() {
        refreshTask?.cancel()
        refreshTask = Task {
            await refresh()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                guard !Task.isCancelled else { return }
                await refresh()
            }
        }
    }

    private func applyOptimistic(_ command: ShellCommand) {
        switch command {
        case .toggleTheme:
            state.theme = state.theme == .dark ? .light : .dark
        case .setTheme(let theme):
            state.theme = theme
        case .markNotificationRead(let id):
            state.notifications.removeAll { $0.id == id }
            state.unreadNotificationCount = max(0, state.unreadNotificationCount - 1)
        case .signOut:
            reset()
        default:
            break
        }
    }

    private func cookieHeaders(from store: WKHTTPCookieStore) async -> [String: String] {
        let cookies = await withCheckedContinuation { continuation in
            store.getAllCookies { continuation.resume(returning: $0) }
        }
        let validCookies = cookies.filter { cookie in
            let domain = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))
            guard let host = AppEnvironment.baseURL.host else { return false }
            return host == domain || host.hasSuffix(".\(domain)")
        }
        guard !validCookies.isEmpty,
              let header = HTTPCookie.requestHeaderFields(with: validCookies)["Cookie"]
        else { return [:] }
        return ["Cookie": header]
    }

    private func setWebChromeReplacementActive(_ active: Bool) {
        let script = active
            ? "document.documentElement.setAttribute('data-totem-native-shell-ready', '1');"
            : "document.documentElement.removeAttribute('data-totem-native-shell-ready');"
        webView?.evaluateJavaScript(script)
    }
}

enum ShellUserScript {
    static func marker() -> WKUserScript {
        WKUserScript(
            source: """
            (function () {
              window.__TOTEM_NATIVE_SHELL__ = true;
              var root = document.documentElement;
              if (root) { root.setAttribute("data-totem-native-shell", "1"); }
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
    }
}
