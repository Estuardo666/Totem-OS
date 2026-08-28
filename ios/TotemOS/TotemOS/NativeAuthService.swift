import Foundation
import WebKit

enum NativeAuthenticationError: LocalizedError {
    case invalidCredentials
    case invalidResponse
    case unavailable

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "El correo o la contraseña no son correctos."
        case .invalidResponse:
            return "No se pudo validar la sesión. Inténtalo nuevamente."
        case .unavailable:
            return "No fue posible conectar con Totem OS. Revisa tu conexión."
        }
    }
}

final class NativeAuthService {
    private struct CSRFResponse: Decodable {
        let csrfToken: String
    }

    private struct CallbackResponse: Decodable {
        let url: String
    }

    private let cookieStorage: HTTPCookieStorage
    private let session: URLSession

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 30
        configuration.httpShouldSetCookies = true
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpCookieStorage = .shared

        cookieStorage = .shared
        session = URLSession(configuration: configuration)
    }

    static func clearURLSessionAuthCookies() {
        guard let host = AppEnvironment.baseURL.host else { return }
        for cookie in HTTPCookieStorage.shared.cookies ?? []
        where isTotemAuthCookie(cookie, host: host) {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }

    func signIn(email: String, password: String) async throws {
        do {
            let csrfToken = try await fetchCSRFToken()
            let callback = try await submitCredentials(
                email: email,
                password: password,
                csrfToken: csrfToken
            )

            if let authenticationError = authenticationError(from: callback) {
                throw authenticationError
            }

            guard try await hasAuthenticatedSession() else {
                throw NativeAuthenticationError.invalidCredentials
            }

            try await copyTotemCookiesToWebKit()
        } catch let error as NativeAuthenticationError {
            throw error
        } catch {
            throw NativeAuthenticationError.unavailable
        }
    }

    private func fetchCSRFToken() async throws -> String {
        let url = AppEnvironment.baseURL.appending(path: "api/auth/csrf")
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let token = try? JSONDecoder().decode(CSRFResponse.self, from: data).csrfToken,
              !token.isEmpty
        else {
            throw NativeAuthenticationError.invalidResponse
        }
        return token
    }

    private func submitCredentials(
        email: String,
        password: String,
        csrfToken: String
    ) async throws -> URL {
        let url = AppEnvironment.baseURL.appending(path: "api/auth/callback/credentials")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue(
            "application/x-www-form-urlencoded",
            forHTTPHeaderField: "Content-Type"
        )
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("1", forHTTPHeaderField: "X-Auth-Return-Redirect")
        request.httpBody = formBody([
            URLQueryItem(name: "email", value: email),
            URLQueryItem(name: "password", value: password),
            URLQueryItem(name: "csrfToken", value: csrfToken),
            URLQueryItem(name: "callbackUrl", value: AppEnvironment.baseURL.absoluteString),
        ])

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<400).contains(httpResponse.statusCode),
              let rawURL = try? JSONDecoder().decode(CallbackResponse.self, from: data).url,
              let callbackURL = URL(string: rawURL),
              callbackURL.scheme == "https",
              callbackURL.host == AppEnvironment.baseURL.host
        else {
            throw NativeAuthenticationError.invalidResponse
        }
        return callbackURL
    }

    private func hasAuthenticatedSession() async throws -> Bool {
        let url = AppEnvironment.baseURL.appending(path: "api/auth/session")
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            throw NativeAuthenticationError.invalidResponse
        }
        return json["user"] is [String: Any]
    }

    private func authenticationError(from url: URL) -> NativeAuthenticationError? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return .invalidResponse
        }
        guard let error = components.queryItems?.first(where: { $0.name == "error" })?.value
        else {
            return nil
        }
        return error == "CredentialsSignin" ? .invalidCredentials : .invalidResponse
    }

    private func formBody(_ items: [URLQueryItem]) -> Data? {
        var components = URLComponents()
        components.queryItems = items
        return components.percentEncodedQuery?.data(using: .utf8)
    }

    private func copyTotemCookiesToWebKit() async throws {
        guard let host = AppEnvironment.baseURL.host else {
            throw NativeAuthenticationError.invalidResponse
        }

        let cookies = (cookieStorage.cookies(for: AppEnvironment.baseURL) ?? []).filter {
            Self.isTotemAuthCookie($0, host: host)
        }

        guard cookies.contains(where: { $0.name.contains("session-token") }) else {
            throw NativeAuthenticationError.invalidResponse
        }

        let webKitStore = WKWebsiteDataStore.default().httpCookieStore
        for cookie in cookies {
            await withCheckedContinuation { continuation in
                webKitStore.setCookie(cookie) {
                    continuation.resume()
                }
            }
        }
    }

    private static func isTotemAuthCookie(_ cookie: HTTPCookie, host: String) -> Bool {
        let domain = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let isExpectedDomain = host == domain || host.hasSuffix(".\(domain)")
        return cookie.isSecure && isExpectedDomain && cookie.name.contains("authjs.")
    }
}
