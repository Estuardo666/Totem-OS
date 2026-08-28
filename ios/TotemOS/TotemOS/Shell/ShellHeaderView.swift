import SwiftUI
import TotemOSKit

/// Header flotante: menú, logo, tema, tareas, notificaciones y avatar.
struct ShellHeaderView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        HStack(spacing: 2) {
            ShellIconButton(systemImage: "line.3.horizontal", label: "Abrir menú") {
                shell.isDrawerOpen = true
            }

            logo
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 4)

            ShellIconButton(
                systemImage: snapshot.theme == .dark ? "sun.max" : "moon",
                label: snapshot.theme == .dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            ) {
                shell.send(.toggleTheme)
            }

            ShellIconButton(
                systemImage: "checkmark.square",
                label: "Tareas pendientes",
                badge: snapshot.taskCount,
                badgeTint: .orange
            ) {
                shell.navigate(to: "/content")
            }

            ShellIconButton(
                systemImage: "bell",
                label: "Notificaciones",
                badge: snapshot.unreadNotificationCount
            ) {
                shell.isNotificationListOpen = true
            }

            if let user = snapshot.user {
                Menu {
                    Section(user.name) {
                        Text(user.roleLabel)
                    }
                    Button {
                        shell.send(.openSettings)
                    } label: {
                        Label("Configuración", systemImage: "gearshape")
                    }
                    Button {
                        shell.send(.openIntegrations)
                    } label: {
                        Label("Integraciones", systemImage: "powerplug")
                    }
                    Divider()
                    Button(role: .destructive) {
                        shell.send(.signOut)
                    } label: {
                        Label("Cerrar Sesión", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    ShellAvatarView(user: user)
                        .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Mi cuenta")
            }
        }
        .padding(.horizontal, 6)
        .frame(minHeight: 56)
        // Una sola superficie pasiva para todo el header.
        .totemShellGlass(
            in: Capsule(),
            reduceTransparency: reduceTransparency
        )
        .padding(.horizontal, 12)
    }

    @ViewBuilder
    private var logo: some View {
        let logoValue = colorScheme == .dark ? snapshot.logoDark : snapshot.logoLight

        if let logoValue, let url = ShellAsset.url(for: logoValue) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFit()
            } placeholder: {
                Color.clear
            }
            .frame(maxHeight: 28)
            .accessibilityLabel("Totem OS")
        } else {
            Text("Totem OS")
                .font(TotemTypography.bold(17, relativeTo: .headline))
                .lineLimit(1)
        }
    }
}
