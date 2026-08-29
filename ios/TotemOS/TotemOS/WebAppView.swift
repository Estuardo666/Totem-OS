import SwiftUI
import WebKit
import TotemOSKit

struct LegacyWebRouteView: UIViewRepresentable {
    @EnvironmentObject private var appModel: AppModel
    @EnvironmentObject private var appCoordinator: AppCoordinator
    let isVisible: Bool
    let onContentReady: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(appModel: appModel, appCoordinator: appCoordinator, onContentReady: onContentReady)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "TotemOS-iOS"

        let controller = WKUserContentController()
        controller.addUserScript(ShellUserScript.marker())
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
        webView.isHidden = !isVisible

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.refresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        appModel.attach(webView: webView)
        appCoordinator.attach(webView: webView)
        webView.load(URLRequest(url: AppEnvironment.baseURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.isHidden = !isVisible
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let appModel: AppModel
        private let appCoordinator: AppCoordinator
        private let onContentReady: () -> Void
        weak var webView: WKWebView?

        init(appModel: AppModel, appCoordinator: AppCoordinator, onContentReady: @escaping () -> Void) {
            self.appModel = appModel
            self.appCoordinator = appCoordinator
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
            appCoordinator.webViewDidFinish(url: webView.url)
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
            appCoordinator.reset()
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
