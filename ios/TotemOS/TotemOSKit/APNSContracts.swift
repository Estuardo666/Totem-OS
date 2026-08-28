import Foundation

public enum APNSEnvironment: String, Codable {
    case sandbox = "SANDBOX"
    case production = "PRODUCTION"
}

public struct APNSRegistrationPayload: Codable, Equatable {
    public let installationId: String
    public let deviceToken: String
    public let environment: APNSEnvironment
    public let bundleId: String
    public let appVersion: String
    public let appBuild: String?
    public let deviceModel: String?
    public let osVersion: String?
    public let locale: String?

    public init(
        installationId: String,
        deviceToken: String,
        environment: APNSEnvironment,
        bundleId: String,
        appVersion: String,
        appBuild: String?,
        deviceModel: String?,
        osVersion: String?,
        locale: String?
    ) {
        self.installationId = installationId
        self.deviceToken = deviceToken
        self.environment = environment
        self.bundleId = bundleId
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.deviceModel = deviceModel
        self.osVersion = osVersion
        self.locale = locale
    }
}

public struct APNSLogoutContext: Codable, Equatable {
    public let installationId: String
    public let environment: APNSEnvironment

    public init(installationId: String, environment: APNSEnvironment) {
        self.installationId = installationId
        self.environment = environment
    }
}
