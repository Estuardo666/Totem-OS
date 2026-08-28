import SwiftUI
import UIKit

/// Menú de cuenta propio. Evita el fondo temporal que `Menu` aplica sobre
/// vistas con Liquid Glass al presentar su interfaz del sistema.
struct ShellAccountMenuView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var menuWidth: CGFloat { min(UIScreen.main.bounds.width - 24, 320) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let user = shell.snapshot.user {
                HStack(spacing: 12) {
                    ShellAvatarView(user: user, size: 42)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(user.name)
                            .font(TotemTypography.medium(16, relativeTo: .body))
                            .lineLimit(1)
                        Text(user.roleLabel)
                            .font(TotemTypography.regular(13, relativeTo: .caption))
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(18)
            }

            Divider().opacity(0.35)
                .padding(.horizontal, 16)

            accountButton("Configuración", systemImage: "gearshape") {
                shell.closeMenus()
                shell.send(.openSettings)
            }

            accountButton("Integraciones", systemImage: "powerplug") {
                shell.closeMenus()
                shell.send(.openIntegrations)
            }

            Divider().opacity(0.35)
                .padding(.horizontal, 16)

            Button(role: .destructive) {
                shell.closeMenus()
                shell.send(.signOut)
            } label: {
                Label("Cerrar Sesión", systemImage: "rectangle.portrait.and.arrow.right")
                    .font(TotemTypography.medium(16, relativeTo: .body))
                    .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 18)
            .padding(.bottom, 8)
        }
        .frame(width: menuWidth)
        .totemShellGlass(
            in: RoundedRectangle(cornerRadius: 26, style: .continuous),
            reduceTransparency: reduceTransparency
        )
        .shadow(color: .black.opacity(0.18), radius: 24, y: 12)
        .accessibilityAddTraits(.isModal)
    }

    private func accountButton(
        _ title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(TotemTypography.medium(16, relativeTo: .body))
                .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 18)
    }
}
