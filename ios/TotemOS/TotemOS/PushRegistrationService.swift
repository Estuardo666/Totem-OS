import Foundation
import UIKit
import WebKit

struct APNSRegistrationPayload: Codable, Equatable {
    let installationId: String
    let deviceToken: String
    let environment: APNSEnvironment
    let bundleId: String
    let appVersion: String
    let appBuild: String?
    let deviceModel: String?
    let osVersion: String?
    let locale: String?
}

struct APNSLogoutContext: Codable, Equatable {
    let installationId: String
    let environment: APNSEnvironment
}

enum PushRegistrationError: LocalizedError {
    case invalidEndpoint
    case unexpectedResponse
    case rejected(status: Int)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "La URL de Totem OS no es válida."
        case .unexpectedResponse:
            return "El servidor devolvió una respuesta APNs inesperada."
        case .rejected(let status):
            return "El servidor rechazó el registro APNs (HTTP \(status))."
        }
    }
}

@MainActor
final class PushRegistrationService {
    private static let installationIdKey = "totem.apns.installation-id"

    func hasAuthenticatedSession(using webView: WKWebView) async -> Bool {
        do {
            let (data, response) = try await request(
                path: "api/auth/session",
                method: "GET",
                body: nil,
                using: webView
            )
            guard (200..<300).contains(response.statusCode),
                  let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let user = object["user"] as? [String: Any],
                  let userId = user["id"] as? String,
                  !userId.isEmpty
            else {
                return false
            }
            return true
        } catch {
            return false
        }
    }

    func register(deviceToken: String, using webView: WKWebView) async throws -> APNSLogoutContext {
        let logoutContext = APNSLogoutContext(
            installationId: installationId(),
            environment: AppEnvironment.apnsEnvironment
        )
        let payload = APNSRegistrationPayload(
            installationId: logoutContext.installationId,
            deviceToken: deviceToken,
            environment: AppEnvironment.apnsEnvironment,
            bundleId: Bundle.main.bundleIdentifier ?? AppEnvironment.bundleIdentifier,
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
            appBuild: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String,
            deviceModel: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion,
            locale: Locale.current.identifier
        )

        let data = try JSONEncoder().encode(payload)
        let (_, response) = try await request(
            path: "api/push/apns",
            method: "POST",
            body: data,
            using: webView
        )
        guard (200..<300).contains(response.statusCode) else {
            throw PushRegistrationError.rejected(status: response.statusCode)
        }
        return logoutContext
    }

    func storeLogoutContext(_ context: APNSLogoutContext, using webView: WKWebView) async throws {
        guard webView.url?.host == AppEnvironment.baseURL.host else {
            throw PushRegistrationError.invalidEndpoint
        }
        let data = try JSONEncoder().encode(context)
        guard let json = String(data: data, encoding: .utf8) else {
            throw PushRegistrationError.unexpectedResponse
        }
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            webView.callAsyncJavaScript(
                "localStorage.setItem('totem-ios-apns-context', context);",
                arguments: ["context": json],
                in: nil,
                in: .page
            ) { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func request(
        path: String,
        method: String,
        body: Data?,
        using webView: WKWebView
    ) async throws -> (Data, HTTPURLResponse) {
        guard let endpoint = URL(string: path, relativeTo: AppEnvironment.baseURL)?.absoluteURL,
              endpoint.scheme == "https",
              endpoint.host == AppEnvironment.baseURL.host
        else {
            throw PushRegistrationError.invalidEndpoint
        }

        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
        let allCookies = await withCheckedContinuation { (continuation: CheckedContinuation<[HTTPCookie], Never>) in
            cookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }
        let cookies = allCookies.filter { cookieApplies($0, to: endpoint) }
        let cookieHeaders = HTTPCookie.requestHeaderFields(with: cookies)

        var request = URLRequest(
            url: endpoint,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 30
        )
        request.httpMethod = method
        request.httpBody = body
        request.httpShouldHandleCookies = false
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        for (name, value) in cookieHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PushRegistrationError.unexpectedResponse
        }
        return (data, httpResponse)
    }

    private func cookieApplies(_ cookie: HTTPCookie, to url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        let domain = cookie.domain
            .lowercased()
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let domainMatches = host == domain || host.hasSuffix(".\(domain)")
        let pathMatches = url.path.hasPrefix(cookie.path)
        let isUnexpired = cookie.expiresDate.map { $0 > Date() } ?? true
        let transportMatches = !cookie.isSecure || url.scheme == "https"
        return domainMatches && pathMatches && isUnexpired && transportMatches
    }

    private func installationId() -> String {
        let defaults = UserDefaults.standard
        if let existing = defaults.string(forKey: Self.installationIdKey),
           UUID(uuidString: existing) != nil {
            return existing
        }

        let value = UUID().uuidString.lowercased()
        defaults.set(value, forKey: Self.installationIdKey)
        return value
    }
}
