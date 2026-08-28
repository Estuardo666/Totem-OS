import Combine
import Foundation
import WebKit
import TotemOSKit

/// Estado del shell nativo alimentado por el canal `totemShell`.
@MainActor
final class ShellModel: ObservableObject {
    @Published private(set) var snapshot: ShellSnapshot = .empty
    @Published private(set) var hasSnapshot = false
    @Published var isNavigationMenuOpen = false
    @Published var isAccountMenuOpen = false
    @Published var isNotificationListOpen = false

    private weak var webView: WKWebView?

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    /// Descarta el snapshot al salir de la sesión para no filtrar datos.
    func reset() {
        snapshot = .empty
        hasSnapshot = false
        isNavigationMenuOpen = false
        isAccountMenuOpen = false
        isNotificationListOpen = false
    }

    var isVisible: Bool {
        hasSnapshot && snapshot.user != nil && !snapshot.overlayHidden
    }

    func receive(rawMessage: Any) {
        let data: Data?
        switch rawMessage {
        case let text as String:
            data = text.data(using: .utf8)
        case let dictionary as [String: Any]:
            data = try? JSONSerialization.data(withJSONObject: dictionary)
        default:
            data = nil
        }

        guard let data, let decoded = try? ShellSnapshotDecoder.decode(data) else {
            #if DEBUG
            print("totemShell: snapshot inválido, se conserva el anterior.")
            #endif
            return
        }

        snapshot = decoded
        hasSnapshot = true
        if decoded.overlayHidden {
            closeMenus()
            isNotificationListOpen = false
        }
    }

    func send(_ command: ShellCommand) {
        guard let webView, let payload = command.payload else { return }

        Task {
            _ = try? await webView.callAsyncJavaScript(
                """
                if (typeof window.\(ShellContract.dispatchFunction) !== "function") { return false; }
                return await window.\(ShellContract.dispatchFunction)(command);
                """,
                arguments: ["command": payload],
                in: nil,
                contentWorld: .page
            )
        }
    }

    func navigate(to route: String) {
        closeMenus()
        isNotificationListOpen = false
        send(.navigate(route: route))
    }

    func toggleNavigationMenu() {
        isAccountMenuOpen = false
        isNavigationMenuOpen.toggle()
    }

    func toggleAccountMenu() {
        isNavigationMenuOpen = false
        isAccountMenuOpen.toggle()
    }

    func closeMenus() {
        isNavigationMenuOpen = false
        isAccountMenuOpen = false
    }
}

/// Recibe los snapshots publicados por React, limitado al frame principal y al
/// dominio configurado en `TOTEM_BASE_URL`.
final class ShellMessageHandler: NSObject, WKScriptMessageHandler {
    private let model: ShellModel

    init(model: ShellModel) {
        self.model = model
        super.init()
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == ShellContract.bridgeName,
              message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == AppEnvironment.baseURL.host,
              message.frameInfo.securityOrigin.`protocol` == "https"
        else { return }

        let body = message.body
        Task { @MainActor in
            model.receive(rawMessage: body)
        }
    }
}

enum ShellUserScript {
    /// Marca el documento antes de renderizar para que React oculte el chrome
    /// web sin parpadeo. Sin esta marca la web se comporta como siempre.
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
