import Foundation

/// Contrato del puente `totemShell`. Refleja `src/lib/totem-shell-contract.ts`
/// y valida cada payload antes de que llegue a la interfaz nativa.
public enum ShellContract {
    public static let bridgeName = "totemShell"
    public static let version = 1
    public static let dispatchFunction = "__totemShellDispatch"
    public static let maxNotifications = 5
    public static let maxLabelLength = 64
    public static let maxMessageLength = 280
    public static let maxBadgeCount = 999

    /// Rutas internas: sin host, sin esquema y sin salto de directorio.
    public static func isValidRoute(_ route: String) -> Bool {
        guard route.hasPrefix("/"),
              !route.hasPrefix("//"),
              route.count <= 256,
              !route.contains("..")
        else { return false }

        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-/")
        guard route.unicodeScalars.allSatisfy(allowed.contains) else { return false }

        if route == "/" { return true }
        let segments = route.dropFirst().split(separator: "/", omittingEmptySubsequences: false)
        return segments.allSatisfy { !$0.isEmpty }
    }

    public static func isValidNotificationID(_ value: String) -> Bool {
        guard !value.isEmpty, value.count <= 64 else { return false }
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
        return value.unicodeScalars.allSatisfy(allowed.contains)
    }

    public static func isValidHexColor(_ value: String) -> Bool {
        guard value.count == 7, value.first == "#" else { return false }
        return value.dropFirst().allSatisfy { $0.isHexDigit }
    }
}

public enum ShellRole: String, Codable, Equatable {
    case admin = "ADMIN"
    case editor = "EDITOR"
    case user = "USER"
}

public enum ShellThemeVariant: String, Codable, Equatable {
    case light
    case dark
}

public enum ShellTransactionTab: String, Codable, Equatable {
    case expense
    case income
    case honorarios
}

public struct ShellNavItem: Codable, Equatable, Identifiable {
    public let id: String
    public let route: String
    public let label: String
    /// Nombre de SF Symbol.
    public let icon: String
    public let children: [ShellNavItem]?

    public init(id: String, route: String, label: String, icon: String, children: [ShellNavItem]? = nil) {
        self.id = id
        self.route = route
        self.label = label
        self.icon = icon
        self.children = children
    }
}

public struct ShellTabItem: Codable, Equatable, Identifiable {
    public let id: String
    public let route: String
    public let label: String
    public let icon: String

    public init(id: String, route: String, label: String, icon: String) {
        self.id = id
        self.route = route
        self.label = label
        self.icon = icon
    }
}

public struct ShellNotification: Codable, Equatable, Identifiable {
    public let id: String
    public let message: String
    public let createdAt: String
    public let authorName: String?
    public let avatarUrl: String?
    public let read: Bool

    public init(
        id: String,
        message: String,
        createdAt: String,
        authorName: String?,
        avatarUrl: String?,
        read: Bool
    ) {
        self.id = id
        self.message = message
        self.createdAt = createdAt
        self.authorName = authorName
        self.avatarUrl = avatarUrl
        self.read = read
    }

    public var createdAtDate: Date? {
        ISO8601DateFormatter.shellFormatter.date(from: createdAt)
    }
}

public struct ShellUser: Codable, Equatable {
    public let name: String
    public let role: ShellRole
    public let roleLabel: String
    public let avatarUrl: String?
    public let initials: String

    public init(name: String, role: ShellRole, roleLabel: String, avatarUrl: String?, initials: String) {
        self.name = name
        self.role = role
        self.roleLabel = roleLabel
        self.avatarUrl = avatarUrl
        self.initials = initials
    }
}

public struct ShellSnapshot: Codable, Equatable {
    public let version: Int
    public let route: String
    public let theme: ShellThemeVariant
    public let accentColor: String?
    public let user: ShellUser?
    public let logoLight: String?
    public let logoDark: String?
    public let navigation: [ShellNavItem]
    public let tabs: [ShellTabItem]
    public let taskCount: Int
    public let unreadNotificationCount: Int
    public let notifications: [ShellNotification]
    public let overlayHidden: Bool

    public init(
        version: Int,
        route: String,
        theme: ShellThemeVariant,
        accentColor: String? = nil,
        user: ShellUser?,
        logoLight: String?,
        logoDark: String?,
        navigation: [ShellNavItem],
        tabs: [ShellTabItem],
        taskCount: Int,
        unreadNotificationCount: Int,
        notifications: [ShellNotification],
        overlayHidden: Bool
    ) {
        self.version = version
        self.route = route
        self.theme = theme
        self.accentColor = accentColor
        self.user = user
        self.logoLight = logoLight
        self.logoDark = logoDark
        self.navigation = navigation
        self.tabs = tabs
        self.taskCount = taskCount
        self.unreadNotificationCount = unreadNotificationCount
        self.notifications = notifications
        self.overlayHidden = overlayHidden
    }
}

public enum ShellSnapshotError: Error, Equatable {
    case invalidPayload
    case unsupportedVersion(Int)
    case invalidRoute(String)
    case invalidNotificationID(String)
    case tooManyNotifications(Int)
    case invalidBadgeCount(Int)
}

public enum ShellSnapshotDecoder {
    /// Decodifica y valida un snapshot recibido desde la web.
    public static func decode(_ data: Data) throws -> ShellSnapshot {
        let snapshot = try JSONDecoder().decode(ShellSnapshot.self, from: data)
        try validate(snapshot)
        return snapshot
    }

    public static func decode(_ json: String) throws -> ShellSnapshot {
        guard let data = json.data(using: .utf8) else {
            throw ShellSnapshotError.invalidPayload
        }
        return try decode(data)
    }

    public static func validate(_ snapshot: ShellSnapshot) throws {
        guard snapshot.version == ShellContract.version else {
            throw ShellSnapshotError.unsupportedVersion(snapshot.version)
        }
        guard ShellContract.isValidRoute(snapshot.route) else {
            throw ShellSnapshotError.invalidRoute(snapshot.route)
        }
        if let accentColor = snapshot.accentColor,
           !ShellContract.isValidHexColor(accentColor) {
            throw ShellSnapshotError.invalidPayload
        }
        for item in snapshot.tabs where !ShellContract.isValidRoute(item.route) {
            throw ShellSnapshotError.invalidRoute(item.route)
        }
        try validateRoutes(snapshot.navigation)
        guard snapshot.notifications.count <= ShellContract.maxNotifications else {
            throw ShellSnapshotError.tooManyNotifications(snapshot.notifications.count)
        }
        for notification in snapshot.notifications {
            guard ShellContract.isValidNotificationID(notification.id) else {
                throw ShellSnapshotError.invalidNotificationID(notification.id)
            }
        }
        for count in [snapshot.taskCount, snapshot.unreadNotificationCount] {
            guard (0...ShellContract.maxBadgeCount).contains(count) else {
                throw ShellSnapshotError.invalidBadgeCount(count)
            }
        }
    }

    private static func validateRoutes(_ items: [ShellNavItem]) throws {
        for item in items {
            guard ShellContract.isValidRoute(item.route) else {
                throw ShellSnapshotError.invalidRoute(item.route)
            }
            if let children = item.children {
                try validateRoutes(children)
            }
        }
    }
}

/// Comandos que la interfaz nativa envía hacia React.
public enum ShellCommand: Equatable {
    case navigate(route: String)
    case toggleTheme
    case setTheme(variant: ShellThemeVariant)
    case markNotificationRead(id: String)
    case openNotifications
    case openSettings
    case openIntegrations
    case openTransaction(tab: ShellTransactionTab)
    case signOut

    /// Diccionario JSON serializable. `nil` si el comando lleva datos inválidos.
    public var payload: [String: String]? {
        switch self {
        case .navigate(let route):
            guard ShellContract.isValidRoute(route) else { return nil }
            return ["type": "navigate", "route": route]
        case .toggleTheme:
            return ["type": "toggleTheme"]
        case .setTheme(let variant):
            return ["type": "setTheme", "variant": variant.rawValue]
        case .markNotificationRead(let id):
            guard ShellContract.isValidNotificationID(id) else { return nil }
            return ["type": "markNotificationRead", "notificationId": id]
        case .openNotifications:
            return ["type": "openNotifications"]
        case .openSettings:
            return ["type": "openSettings"]
        case .openIntegrations:
            return ["type": "openIntegrations"]
        case .openTransaction(let tab):
            return ["type": "openTransaction", "tab": tab.rawValue]
        case .signOut:
            return ["type": "signOut"]
        }
    }
}

extension ISO8601DateFormatter {
    static let shellFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

public extension ShellSnapshot {
    /// Ruta activa considerando subrutas, igual que `isItemActive` en la web.
    func isActive(route: String) -> Bool {
        if route == "/" { return self.route == "/" }
        return self.route == route || self.route.hasPrefix(route + "/")
    }

    func isActive(item: ShellNavItem) -> Bool {
        if let children = item.children, !children.isEmpty {
            return children.contains { isActive(route: $0.route) }
        }
        return isActive(route: item.route)
    }

    static let empty = ShellSnapshot(
        version: ShellContract.version,
        route: "/",
        theme: .light,
        accentColor: nil,
        user: nil,
        logoLight: nil,
        logoDark: nil,
        navigation: [],
        tabs: [],
        taskCount: 0,
        unreadNotificationCount: 0,
        notifications: [],
        overlayHidden: false
    )
}
