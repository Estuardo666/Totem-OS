import SwiftUI
import TotemOSKit

/// Header flotante: menú, logo, tema, tareas, notificaciones y avatar.
struct ShellHeaderView: View {
    @EnvironmentObject private var shell: ShellModel

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        HStack(spacing: 2) {
            ShellIconButton(systemImage: "ellipsis", label: "Abrir menú") {
                shell.toggleNavigationMenu()
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
                Button {
                    shell.toggleAccountMenu()
                } label: {
                    ShellAvatarView(user: user)
                        .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Mi cuenta")
            }
        }
        .padding(.horizontal, 6)
        .frame(minHeight: 56)
        // La barra no dibuja material propio: evita el flash negro al abrir
        // menús y mantiene el fondo cien por ciento transparente.
        .padding(.horizontal, 12)
    }

    @ViewBuilder
    private var logo: some View {
        let logoValue = snapshot.theme == .dark ? snapshot.logoDark : snapshot.logoLight

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
