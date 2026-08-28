import Combine
import Foundation
import UIKit
import UserNotifications
import WebKit

@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()

    @Published private(set) var isOffline = false
    @Published private(set) var showsNativeLogin = false

    private weak var webView: WKWebView?
    private var deviceToken: String?
    private var isAuthenticated = false
    private var requestedNotificationAuthorization = false
    private var lastRegisteredToken: String?
    private var registrationInProgressToken: String?
    private var hasObservedAuthenticatedSession = false
    private let registrationService = PushRegistrationService()

    private init() {}

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func updateConnection(isOffline: Bool) {
        self.isOffline = isOffline
    }

    func presentNativeLogin() {
        isAuthenticated = false
        isOffline = false
        NativeAuthService.clearURLSessionAuthCookies()
        showsNativeLogin = true
    }

    func nativeLoginDidSucceed() {
        isOffline = false
        showsNativeLogin = false
    }

    func webViewDidFinish(url: URL?) {
        guard
            let url,
            url.host == AppEnvironment.baseURL.host,
            !url.path.hasPrefix("/sign-in"),
            !url.path.hasPrefix("/sign-up"),
            let webView
        else {
            if url?.host == AppEnvironment.baseURL.host,
               url?.path.hasPrefix("/sign-in") == true {
                handleSignedOutSession()
                presentNativeLogin()
            }
            isAuthenticated = false
            return
        }

        Task {
            isAuthenticated = await registrationService.hasAuthenticatedSession(using: webView)
            guard isAuthenticated else { return }
            hasObservedAuthenticatedSession = true
            requestNotificationAuthorizationIfNeeded()
            registerDeviceIfPossible()
        }
    }

    func receive(deviceToken: String) {
        self.deviceToken = deviceToken
        registerDeviceIfPossible()
    }

    func receivePushRegistration(error: Error) {
        #if DEBUG
        print("APNs registration failed: \(error.localizedDescription)")
        #endif
    }

    private func requestNotificationAuthorizationIfNeeded() {
#if TOTEM_NO_PUSH
        // Sin entitlement de APNs no se puede registrar el dispositivo.
        return
#else
        guard !requestedNotificationAuthorization else { return }
        requestedNotificationAuthorization = true

        Task {
            do {
                let granted = try await UNUserNotificationCenter.current()
                    .requestAuthorization(options: [.alert, .badge, .sound])
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } catch {
                receivePushRegistration(error: error)
            }
        }
#endif
    }

    private func registerDeviceIfPossible() {
        guard
            isAuthenticated,
            let webView,
            let deviceToken,
            deviceToken != lastRegisteredToken,
            deviceToken != registrationInProgressToken
        else { return }

        registrationInProgressToken = deviceToken
        Task {
            defer { registrationInProgressToken = nil }
            do {
                let logoutContext = try await registrationService.register(
                    deviceToken: deviceToken,
                    using: webView
                )
                try await registrationService.storeLogoutContext(logoutContext, using: webView)
                lastRegisteredToken = deviceToken
            } catch {
                #if DEBUG
                print("APNs backend registration failed: \(error.localizedDescription)")
                #endif
            }
        }
    }

    private func handleSignedOutSession() {
        guard hasObservedAuthenticatedSession else { return }
#if !TOTEM_NO_PUSH
        UIApplication.shared.unregisterForRemoteNotifications()
#endif
        hasObservedAuthenticatedSession = false
        requestedNotificationAuthorization = false
        deviceToken = nil
        lastRegisteredToken = nil
        registrationInProgressToken = nil
    }
}
