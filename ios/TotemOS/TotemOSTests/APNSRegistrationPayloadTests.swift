import XCTest
@testable import TotemOS

final class APNSRegistrationPayloadTests: XCTestCase {
    func testPayloadMatchesBackendContract() throws {
        let payload = APNSRegistrationPayload(
            installationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            deviceToken: String(repeating: "ab", count: 32),
            environment: .sandbox,
            bundleId: "com.totemmassmedia.totemos",
            appVersion: "0.1.0",
            appBuild: "1",
            deviceModel: "iPhone",
            osVersion: "26.2",
            locale: "es_EC"
        )

        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]
        )

        XCTAssertEqual(object["installationId"] as? String, payload.installationId)
        XCTAssertEqual(object["deviceToken"] as? String, payload.deviceToken)
        XCTAssertEqual(object["environment"] as? String, "SANDBOX")
        XCTAssertEqual(object["bundleId"] as? String, "com.totemmassmedia.totemos")
    }

    func testLogoutContextMatchesBackendContract() throws {
        let context = APNSLogoutContext(
            installationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            environment: .production
        )
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(context)) as? [String: Any]
        )

        XCTAssertEqual(object["installationId"] as? String, context.installationId)
        XCTAssertEqual(object["environment"] as? String, "PRODUCTION")
    }
}
