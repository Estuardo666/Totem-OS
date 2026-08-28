import XCTest
import TotemOSKit

final class ShellContractTests: XCTestCase {
    private func snapshotJSON(
        version: Int = 1,
        route: String = "/finance/transactions",
        notificationId: String = "clx123abc",
        taskCount: Int = 3
    ) -> String {
        """
        {
          "version": \(version),
          "route": "\(route)",
          "theme": "dark",
          "accentColor": "#CBA6F7",
          "user": {
            "name": "Ana Pérez",
            "role": "ADMIN",
            "roleLabel": "Administrador",
            "avatarUrl": null,
            "initials": "AP"
          },
          "logoLight": "/logo-light.png",
          "logoDark": null,
          "navigation": [
            { "id": "home", "route": "/", "label": "Inicio", "icon": "house" },
            {
              "id": "finance",
              "route": "/finance",
              "label": "Finanzas",
              "icon": "wallet.bifold",
              "children": [
                {
                  "id": "finance-transactions",
                  "route": "/finance/transactions",
                  "label": "Transacciones",
                  "icon": "list.bullet.rectangle"
                }
              ]
            }
          ],
          "tabs": [
            { "id": "tab-home", "route": "/", "label": "Inicio", "icon": "house" },
            { "id": "tab-tasks", "route": "/content", "label": "Tareas", "icon": "checklist" }
          ],
          "taskCount": \(taskCount),
          "unreadNotificationCount": 2,
          "notifications": [
            {
              "id": "\(notificationId)",
              "message": "Nueva factura registrada",
              "createdAt": "2026-08-28T12:00:00.000Z",
              "authorName": "Totem",
              "avatarUrl": null,
              "read": false
            }
          ],
          "overlayHidden": false
        }
        """
    }

    func testDecodesValidSnapshot() throws {
        let snapshot = try ShellSnapshotDecoder.decode(snapshotJSON())

        XCTAssertEqual(snapshot.route, "/finance/transactions")
        XCTAssertEqual(snapshot.theme, .dark)
        XCTAssertEqual(snapshot.accentColor, "#CBA6F7")
        XCTAssertEqual(snapshot.user?.role, .admin)
        XCTAssertEqual(snapshot.taskCount, 3)
        XCTAssertEqual(snapshot.notifications.count, 1)
        XCTAssertNotNil(snapshot.notifications[0].createdAtDate)
    }

    func testRejectsUnsupportedVersion() {
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode(snapshotJSON(version: 99))) { error in
            XCTAssertEqual(error as? ShellSnapshotError, .unsupportedVersion(99))
        }
    }

    func testRejectsExternalRoute() {
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode(snapshotJSON(route: "//evil.example.com")))
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode(snapshotJSON(route: "/finance/../admin")))
    }

    func testRejectsInvalidNotificationIdentifier() {
        XCTAssertThrowsError(
            try ShellSnapshotDecoder.decode(snapshotJSON(notificationId: "../otra"))
        ) { error in
            XCTAssertEqual(error as? ShellSnapshotError, .invalidNotificationID("../otra"))
        }
    }

    func testRejectsOutOfRangeBadge() {
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode(snapshotJSON(taskCount: 5000))) { error in
            XCTAssertEqual(error as? ShellSnapshotError, .invalidBadgeCount(5000))
        }
    }

    func testRejectsMalformedPayload() {
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode("{ no-json"))
    }

    func testActiveRouteMatchesSubroutes() throws {
        let snapshot = try ShellSnapshotDecoder.decode(snapshotJSON())

        XCTAssertTrue(snapshot.isActive(route: "/finance"))
        XCTAssertTrue(snapshot.isActive(route: "/finance/transactions"))
        XCTAssertFalse(snapshot.isActive(route: "/"))
        XCTAssertFalse(snapshot.isActive(route: "/clients"))

        let finance = snapshot.navigation[1]
        XCTAssertTrue(snapshot.isActive(item: finance))
        XCTAssertFalse(snapshot.isActive(item: snapshot.navigation[0]))
    }

    func testCommandPayloadsRejectInvalidData() {
        XCTAssertNil(ShellCommand.navigate(route: "https://evil.example.com").payload)
        XCTAssertNil(ShellCommand.navigate(route: "/finance/../admin").payload)
        XCTAssertNil(ShellCommand.markNotificationRead(id: "id con espacios").payload)

        XCTAssertEqual(
            ShellCommand.navigate(route: "/clients").payload,
            ["type": "navigate", "route": "/clients"]
        )
        XCTAssertEqual(
            ShellCommand.setTheme(variant: .light).payload,
            ["type": "setTheme", "variant": "light"]
        )
        XCTAssertEqual(
            ShellCommand.openTransaction(tab: .expense).payload,
            ["type": "openTransaction", "tab": "expense"]
        )
    }

    func testRejectsInvalidAccentColor() {
        let invalid = snapshotJSON().replacingOccurrences(of: "#CBA6F7", with: "purple")
        XCTAssertThrowsError(try ShellSnapshotDecoder.decode(invalid))
    }
}
