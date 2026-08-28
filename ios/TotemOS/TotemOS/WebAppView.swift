import SwiftUI
import WebKit
import TotemOSKit

struct WebAppView: UIViewRepresentable {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var shellModel: ShellModel
    let onContentReady: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(appModel: appModel, shellModel: shellModel, onContentReady: onContentReady)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "TotemOS-iOS"

        // Canal `totemShell`: solo frame principal y solo el dominio configurado.
        let controller = WKUserContentController()
        controller.addUserScript(ShellUserScript.marker())
        controller.add(context.coordinator.shellMessageHandler, name: ShellContract.bridgeName)
        configuration.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 20 / 255, green: 18 / 255, blue: 32 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.webView = webView
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.refresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        appModel.attach(webView: webView)
        shellModel.attach(webView: webView)
        webView.load(URLRequest(url: AppEnvironment.baseURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let appModel: AppModel
        private let shellModel: ShellModel
        private let onContentReady: () -> Void
        let shellMessageHandler: ShellMessageHandler
        weak var webView: WKWebView?

        init(appModel: AppModel, shellModel: ShellModel, onContentReady: @escaping () -> Void) {
            self.appModel = appModel
            self.shellModel = shellModel
            self.shellMessageHandler = ShellMessageHandler(model: shellModel)
            self.onContentReady = onContentReady
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            guard let webView else {
                sender.endRefreshing()
                return
            }
            webView.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
            webView.scrollView.refreshControl?.endRefreshing()
            appModel.updateConnection(isOffline: false)
            appModel.webViewDidFinish(url: webView.url)
            onContentReady()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  url.host == AppEnvironment.baseURL.host,
                  url.path.hasPrefix("/sign-in")
            else {
                decisionHandler(.allow)
                return
            }

            // Al salir de la sesión el shell nativo se vacía junto con la web.
            shellModel.reset()
            appModel.webViewDidFinish(url: url)
            onContentReady()
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation?,
            withError error: Error
        ) {
            webView.scrollView.refreshControl?.endRefreshing()
            appModel.updateConnection(isOffline: true)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            webView.scrollView.refreshControl?.endRefreshing()
            appModel.updateConnection(isOffline: true)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }
    }
}
