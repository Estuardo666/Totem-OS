import SwiftUI
import TotemOSKit

/// Área táctil mínima recomendada por Apple.
let shellMinimumTapTarget: CGFloat = 44

struct ShellBadge: View {
    let count: Int
    var tint: Color = .red

    var body: some View {
        if count > 0 {
            Text(count > 9 ? "9+" : "\(count)")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white)
                .padding(.horizontal, count > 9 ? 5 : 0)
                .frame(minWidth: 18, minHeight: 18)
                .background(tint, in: Capsule())
                .accessibilityHidden(true)
        }
    }
}

/// Botón circular del header: la única capa interactiva sobre el vidrio pasivo.
struct ShellIconButton: View {
    let systemImage: String
    let label: String
    var badge: Int = 0
    var badgeTint: Color = .red
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .medium))
                .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                .contentShape(Rectangle())
                .overlay(alignment: .topTrailing) {
                    ShellBadge(count: badge, tint: badgeTint)
                        .offset(x: -4, y: 4)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(badge > 0 ? "\(label), \(badge) pendientes" : label)
    }
}

struct ShellAvatarView: View {
    let user: ShellUser
    var size: CGFloat = 34

    var body: some View {
        ZStack {
            Circle().fill(.secondary.opacity(0.25))
            Text(user.initials)
                .font(.caption.weight(.semibold))
            if let avatarUrl = user.avatarUrl, let url = ShellAsset.url(for: avatarUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.clear
                }
                .clipShape(Circle())
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel(user.name)
    }
}

enum ShellAsset {
    /// Resuelve rutas relativas contra el dominio configurado y descarta
    /// cualquier origen externo.
    static func url(for value: String) -> URL? {
        let resolved: URL? = value.hasPrefix("/")
            ? URL(string: value, relativeTo: AppEnvironment.baseURL)?.absoluteURL
            : URL(string: value)

        guard let resolved, resolved.scheme == "https" else { return nil }
        return resolved
    }
}

extension ShellNotification {
    var relativeDateText: String {
        guard let date = createdAtDate else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es")
        formatter.unitsStyle = .full
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

extension Color {
    init?(shellHex value: String?) {
        guard let value,
              ShellContract.isValidHexColor(value),
              let rgb = UInt64(value.dropFirst(), radix: 16)
        else { return nil }

        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

extension ShellSnapshot {
    var accent: Color {
        Color(shellHex: accentColor) ?? Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255)
    }
}
