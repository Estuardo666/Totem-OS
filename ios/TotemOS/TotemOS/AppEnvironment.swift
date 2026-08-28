import Foundation
import TotemOSKit

enum AppEnvironment {
    static let bundleIdentifier = "com.totemmassmedia.totemos"

    static let baseURL: URL = {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "TOTEM_BASE_URL") as? String,
            let url = URL(string: rawValue),
            url.scheme == "https",
            url.host != nil
        else {
            preconditionFailure("TOTEM_BASE_URL must be a valid HTTPS URL")
        }
        return url
    }()

    static var apnsEnvironment: APNSEnvironment {
#if DEBUG
        return .sandbox
#else
        return .production
#endif
    }
}
