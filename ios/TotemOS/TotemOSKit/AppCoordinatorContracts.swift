import Foundation

public enum AppRoute: Hashable, Sendable {
    case home, clients, content, contentDashboard, shoots
    case finance, personalFinance, financeTransactions, financeMonthlySummary
    case financeAlerts, financeSettlement, financeUtilities, invoicing
    case users, files, notifications, settings, integrations
    case legacy(String)

    public init?(path: String) {
        guard ShellContract.isValidRoute(path) else { return nil }
        self = Self.knownRoutes[path] ?? .legacy(path)
    }

    public var path: String {
        switch self {
        case .home: "/"
        case .clients: "/clients"
        case .content: "/content"
        case .contentDashboard: "/content/dashboard"
        case .shoots: "/content/shoots"
        case .finance: "/finance"
        case .personalFinance: "/finance/personal"
        case .financeTransactions: "/finance/transactions"
        case .financeMonthlySummary: "/finance/monthly-summary"
        case .financeAlerts: "/finance/alerts"
        case .financeSettlement: "/finance/settlement"
        case .financeUtilities: "/finance/utilidades"
        case .invoicing: "/admin/facturacion"
        case .users: "/admin/users"
        case .files: "/admin/files"
        case .notifications: "/admin/notifications"
        case .settings: "/admin/settings"
        case .integrations: "/admin/settings/integrations"
        case .legacy(let path): path
        }
    }

    public func contains(_ route: AppRoute) -> Bool {
        path == "/" ? route.path == "/" : route.path == path || route.path.hasPrefix(path + "/")
    }

    private static let knownRoutes: [String: AppRoute] = [
        "/": .home, "/clients": .clients, "/content": .content,
        "/content/dashboard": .contentDashboard, "/content/shoots": .shoots,
        "/finance": .finance, "/finance/personal": .personalFinance,
        "/finance/transactions": .financeTransactions,
        "/finance/monthly-summary": .financeMonthlySummary,
        "/finance/alerts": .financeAlerts, "/finance/settlement": .financeSettlement,
        "/finance/utilidades": .financeUtilities, "/admin/facturacion": .invoicing,
        "/admin/users": .users, "/admin/files": .files,
        "/admin/notifications": .notifications, "/admin/settings": .settings,
        "/admin/settings/integrations": .integrations,
    ]
}

public struct NativeShellState: Equatable {
    public var route: AppRoute
    public var theme: ShellThemeVariant
    public var accentColor: String
    public var themeId: String
    public var catppuccinAccent: String
    public var backgroundColor: String
    public var cardColor: String
    public var foregroundColor: String
    public var secondaryTextColor: String
    public var surfaceColor: String
    public var borderColor: String
    public var user: ShellUser?
    public var capabilities: Set<ShellCapability>
    public var logoLight: String?
    public var logoDark: String?
    public var navigation: [ShellNavItem]
    public var tabs: [ShellTabItem]
    public var taskCount: Int
    public var unreadNotificationCount: Int
    public var notifications: [ShellNotification]
    public var overlayHidden: Bool

    public static let empty = NativeShellState(
        route: .home, theme: .light, accentColor: "#3B82F6", user: nil,
        capabilities: [], logoLight: nil, logoDark: nil, navigation: [], tabs: [],
        taskCount: 0, unreadNotificationCount: 0, notifications: [], overlayHidden: false
    )

    /// Shell mínimo para una sesión con red temporalmente indisponible. No
    /// inventa datos de negocio: conserva únicamente navegación segura y deja
    /// que el siguiente refresh reemplace el estado por el bootstrap real.
    public static func offlineFallback(route: AppRoute) -> NativeShellState {
        let role = ShellRole.user
        return NativeShellState(
            route: route,
            theme: .light,
            accentColor: "#3B82F6",
            user: ShellUser(
                name: "Usuario",
                role: role,
                roleLabel: "Usuario",
                avatarUrl: nil,
                initials: "U"
            ),
            capabilities: role.capabilities,
            logoLight: nil,
            logoDark: nil,
            navigation: NativeShellCatalog.navigation(capabilities: role.capabilities),
            tabs: NativeShellCatalog.tabs(capabilities: role.capabilities),
            taskCount: 0,
            unreadNotificationCount: 0,
            notifications: [],
            overlayHidden: false
        )
    }

    public init(
        route: AppRoute, theme: ShellThemeVariant, accentColor: String, user: ShellUser?,
        capabilities: Set<ShellCapability>, logoLight: String?, logoDark: String?,
        navigation: [ShellNavItem], tabs: [ShellTabItem], taskCount: Int,
        unreadNotificationCount: Int, notifications: [ShellNotification], overlayHidden: Bool,
        themeId: String = "default", catppuccinAccent: String = "mauve",
        backgroundColor: String = "#F7F7FA", cardColor: String = "#FFFFFF",
        foregroundColor: String = "#27221F", secondaryTextColor: String = "#686371",
        surfaceColor: String = "#EEEFF4", borderColor: String = "#DADBE2"
    ) {
        self.route = route
        self.theme = theme
        self.accentColor = accentColor
        self.themeId = themeId
        self.catppuccinAccent = catppuccinAccent
        self.backgroundColor = backgroundColor
        self.cardColor = cardColor
        self.foregroundColor = foregroundColor
        self.secondaryTextColor = secondaryTextColor
        self.surfaceColor = surfaceColor
        self.borderColor = borderColor
        self.user = user
        self.capabilities = capabilities
        self.logoLight = logoLight
        self.logoDark = logoDark
        self.navigation = navigation
        self.tabs = tabs
        self.taskCount = taskCount
        self.unreadNotificationCount = unreadNotificationCount
        self.notifications = notifications
        self.overlayHidden = overlayHidden
    }

    public init(bootstrap: ShellBootstrapData, route: AppRoute = .home) {
        let role = ShellRole(rawValue: bootstrap.user.role) ?? .user
        let capabilities = Set(bootstrap.capabilities.compactMap(ShellCapability.init(rawValue:)))
        self.init(
            route: route,
            theme: ShellThemeVariant(rawValue: bootstrap.preferences.theme) ?? .light,
            accentColor: ShellContract.isValidHexColor(bootstrap.preferences.accentColor)
                ? bootstrap.preferences.accentColor : "#3B82F6",
            user: ShellUser(name: bootstrap.user.name, role: role,
                roleLabel: bootstrap.user.roleLabel, avatarUrl: bootstrap.user.avatarUrl,
                initials: bootstrap.user.initials),
            capabilities: capabilities,
            logoLight: bootstrap.brand.logoLight,
            logoDark: bootstrap.brand.logoDark,
            navigation: NativeShellCatalog.navigation(capabilities: capabilities),
            tabs: NativeShellCatalog.tabs(capabilities: capabilities),
            taskCount: min(max(bootstrap.counters.pendingTasks, 0), ShellContract.maxBadgeCount),
            unreadNotificationCount: min(max(bootstrap.counters.unreadNotifications, 0), ShellContract.maxBadgeCount),
            notifications: bootstrap.notifications.map {
                ShellNotification(id: $0.id, message: $0.message, createdAt: $0.createdAt,
                    authorName: $0.authorName, avatarUrl: $0.avatarUrl, read: $0.read)
            },
            overlayHidden: false,
            themeId: bootstrap.preferences.themeId,
            catppuccinAccent: bootstrap.preferences.catppuccinAccent,
            backgroundColor: bootstrap.preferences.backgroundColor,
            cardColor: bootstrap.preferences.cardColor,
            foregroundColor: bootstrap.preferences.foregroundColor,
            secondaryTextColor: bootstrap.preferences.secondaryTextColor,
            surfaceColor: bootstrap.preferences.surfaceColor,
            borderColor: bootstrap.preferences.borderColor
        )
    }

    public var snapshot: ShellSnapshot {
        ShellSnapshot(version: ShellContract.version, route: route.path, theme: theme,
            accentColor: accentColor, user: user, logoLight: logoLight, logoDark: logoDark,
            navigation: navigation, tabs: tabs, taskCount: taskCount,
            unreadNotificationCount: unreadNotificationCount, notifications: notifications,
            overlayHidden: overlayHidden)
    }

    public mutating func applyThemeVariant(_ variant: ShellThemeVariant) {
        theme = variant
        if themeId == "catppuccin" {
            // React changes both the semantic surfaces and the selected
            // Catppuccin accent when the appearance toggles. Keep the native
            // lens on the same palette so its text contrast matches the web
            // bottom bar in both light and dark modes.
            accentColor = Self.catppuccinAccentHex(catppuccinAccent, variant: variant) ?? accentColor
            if variant == .dark {
                backgroundColor = "#1E1E2E"; cardColor = "#181825"; foregroundColor = "#CDD6F4"
                secondaryTextColor = "#A6ADC8"; surfaceColor = "#313244"; borderColor = "#45475A"
            } else {
                backgroundColor = "#EFF1F5"; cardColor = "#E6E9EF"; foregroundColor = "#4C4F69"
                secondaryTextColor = "#6C6F85"; surfaceColor = "#CCD0DA"; borderColor = "#BCC0CC"
            }
        } else if variant == .dark {
            backgroundColor = "#141220"; cardColor = "#1E1B2B"; foregroundColor = "#F5F3FA"
            secondaryTextColor = "#B5B0C3"; surfaceColor = "#2A2638"; borderColor = "#3A3549"
        } else {
            backgroundColor = "#F7F7FA"; cardColor = "#FFFFFF"; foregroundColor = "#27221F"
            secondaryTextColor = "#686371"; surfaceColor = "#EEEFF4"; borderColor = "#DADBE2"
        }
    }

    private static func catppuccinAccentHex(_ accent: String, variant: ShellThemeVariant) -> String? {
        switch variant {
        case .light:
            switch accent.lowercased() {
            case "rosewater": return "#DC8A78"
            case "flamingo": return "#DD7878"
            case "pink": return "#EA76CB"
            case "mauve": return "#8839EF"
            case "red": return "#D20F39"
            case "maroon": return "#E64553"
            case "peach": return "#FE640B"
            case "yellow": return "#DF8E1D"
            case "green": return "#40A02B"
            case "teal": return "#179299"
            case "sky": return "#04A5E5"
            case "sapphire": return "#209FB5"
            case "blue": return "#1E66F5"
            case "lavender": return "#7287FD"
            default: return nil
            }
        case .dark:
            switch accent.lowercased() {
            case "rosewater": return "#F5E0DC"
            case "flamingo": return "#F2CDCD"
            case "pink": return "#F5C2E7"
            case "mauve": return "#CBA6F7"
            case "red": return "#F38BA8"
            case "maroon": return "#EBA0AC"
            case "peach": return "#FAB387"
            case "yellow": return "#F9E2AF"
            case "green": return "#A6E3A1"
            case "teal": return "#94E2D5"
            case "sky": return "#89DCEB"
            case "sapphire": return "#74C7EC"
            case "blue": return "#89B4FA"
            case "lavender": return "#B4BEFE"
            default: return nil
            }
        }
    }
}

public enum NativeShellCatalog {
    public static func navigation(capabilities: Set<ShellCapability>) -> [ShellNavItem] {
        var items = [item("home", .home, "Inicio", "house")]
        if capabilities.contains(.clientsRead) { items.append(item("clients", .clients, "Clientes", "person.2")) }
        if capabilities.contains(.contentRead) {
            items.append(item("content", .contentDashboard, "Content Factory", "film", children: [
                item("content-dashboard", .contentDashboard, "Dashboard", "square.grid.2x2"),
                item("content-tasks", .content, "Tareas", "checklist"),
                item("content-shoots", .shoots, "Rodajes", "video"),
            ]))
        }
        if capabilities.contains(.financePersonalRead) || capabilities.contains(.financeStrategicRead) {
            var children = [
                item("finance-personal", .personalFinance, "Dashboard personal", "person.crop.circle"),
                item("finance-transactions", .financeTransactions, "Transacciones", "list.bullet.rectangle"),
            ]
            if capabilities.contains(.financeStrategicRead) {
                children.insert(item("finance-dashboard", .finance, "Dashboard", "chart.pie"), at: 0)
                children.append(contentsOf: [
                    item("finance-monthly", .financeMonthlySummary, "Resumen del Mes", "calendar"),
                    item("finance-alerts", .financeAlerts, "Alertas", "bell.badge"),
                    item("finance-settlement", .financeSettlement, "Liquidación Interna", "arrow.left.arrow.right"),
                    item("finance-utilities", .financeUtilities, "Utilidades acumuladas", "chart.line.uptrend.xyaxis"),
                    item("finance-invoicing", .invoicing, "Facturación Electrónica", "doc.text"),
                ])
            }
            let route: AppRoute = capabilities.contains(.financeStrategicRead) ? .finance : .personalFinance
            items.append(item("finance", route, "Finanzas", "wallet.bifold", children: children))
        }
        if capabilities.contains(.adminUsers) { items.append(item("admin-users", .users, "Gestión de Usuarios", "person.3")) }
        if capabilities.contains(.adminSettings) { items.append(item("admin-files", .files, "Gestión de Archivos", "folder")) }
        return items
    }

    public static func tabs(capabilities: Set<ShellCapability>) -> [ShellTabItem] {
        var tabs = [ShellTabItem(id: "tab-home", route: AppRoute.home.path, label: "Inicio", icon: "house")]
        if capabilities.contains(.contentRead) { tabs.append(ShellTabItem(id: "tab-tasks", route: AppRoute.content.path, label: "Tareas", icon: "checklist")) }
        if capabilities.contains(.financeStrategicRead) || capabilities.contains(.financePersonalRead) {
            let route: AppRoute = capabilities.contains(.financeStrategicRead) ? .finance : .personalFinance
            tabs.append(ShellTabItem(id: "tab-finance", route: route.path, label: "Finanzas", icon: "wallet.bifold"))
        }
        if capabilities.contains(.clientsRead) { tabs.append(ShellTabItem(id: "tab-clients", route: AppRoute.clients.path, label: "Clientes", icon: "person.2")) }
        return tabs
    }

    private static func item(_ id: String, _ route: AppRoute, _ label: String, _ icon: String,
                             children: [ShellNavItem]? = nil) -> ShellNavItem {
        ShellNavItem(id: id, route: route.path, label: label, icon: icon, children: children)
    }
}

/// Configuración remota que decide si una ruta se presenta de forma nativa o
/// mediante la pantalla React heredada. Las rutas más específicas ganan.
public struct HybridRouteConfiguration: Equatable, Sendable {
    public let version: Int
    public let defaultMode: AppRouteMode
    public let routes: [AppRouteRule]

    public init(data: AppConfigData) {
        self.version = data.version
        self.defaultMode = data.defaultMode
        self.routes = data.routes
    }

    public static let fallback = HybridRouteConfiguration(
        version: 1,
        defaultMode: .web,
        routes: []
    )

    private init(version: Int, defaultMode: AppRouteMode, routes: [AppRouteRule]) {
        self.version = version
        self.defaultMode = defaultMode
        self.routes = routes
    }

    public func mode(for path: String) -> AppRouteMode {
        if let exact = routes.first(where: { $0.path == path }) {
            return exact.mode
        }
        return routes
            .filter { path.hasPrefix($0.path + "/") }
            .max { $0.path.count < $1.path.count }?
            .mode ?? defaultMode
    }
}
