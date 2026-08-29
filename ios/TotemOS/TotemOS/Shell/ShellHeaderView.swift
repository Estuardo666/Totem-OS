import SwiftUI
import TotemOSKit

/// Header flotante: menús nativos, logo, tema y notificaciones.
struct ShellHeaderView: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            // Los controles quedan sueltos bajo la isla del dispositivo: no
            // hay una cápsula que los encierre ni un color de superficie.
            leftControls
            Spacer(minLength: 8)
            rightControls
        }
        .padding(.horizontal, 12)
        .background(alignment: .top) {
            ProgressiveHeaderBlur(reduceTransparency: reduceTransparency)
                .offset(y: -28)
        }
    }

    private var leftControls: some View {
        HStack(spacing: 2) {
            navigationMenu
            logo
                .padding(.leading, 4)
        }
        .padding(.horizontal, 6)
        .frame(minHeight: 56)
    }

    private var rightControls: some View {
        HStack(spacing: 2) {
            ShellIconButton(
                systemImage: snapshot.theme == .dark ? "sun.max" : "moon",
                label: snapshot.theme == .dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            ) {
                shell.send(.toggleTheme)
            }

            ShellIconButton(
                systemImage: "bell",
                label: "Notificaciones",
                badge: snapshot.unreadNotificationCount
            ) {
                shell.isNotificationListOpen = true
            }

            if let user = snapshot.user {
                accountMenu(user: user)
            }
        }
        .padding(.horizontal, 6)
        .frame(minHeight: 56)
    }

    private func accountMenu(user: ShellUser) -> some View {
        Menu(
            content: {
                Section {
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
                } header: {
                    Text("\(user.name) · \(user.roleLabel)")
                }

                Button(role: .destructive) {
                    shell.send(.signOut)
                } label: {
                    Label("Cerrar Sesión", systemImage: "rectangle.portrait.and.arrow.right")
                }
            },
            label: {
                ShellAvatarView(user: user)
                    .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                    .contentShape(Rectangle())
            }
        )
        .buttonStyle(.plain)
        .menuOrder(.fixed)
        .accessibilityLabel("Mi cuenta")
    }

    /// A progressive, untinted blur gives the loose controls legibility while
    /// allowing the dashboard to remain visible underneath them.
    private struct ProgressiveHeaderBlur: View {
        let reduceTransparency: Bool

        var body: some View {
            Group {
                if reduceTransparency {
                    Rectangle().fill(Color.clear)
                } else if #available(iOS 26.0, *) {
                    Rectangle()
                        .fill(.regularMaterial)
                        .backgroundExtensionEffect()
                } else {
                    Rectangle().fill(.ultraThinMaterial)
                }
            }
            .mask(
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black.opacity(0.9), location: 0.30),
                        .init(color: .black.opacity(0.72), location: 0.68),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(height: 112)
            .frame(maxWidth: .infinity)
            .allowsHitTesting(false)
        }
    }

    private var navigationMenu: some View {
        Menu {
            ForEach(snapshot.navigation) { item in
                navigationMenuItem(item)
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 17, weight: .medium))
                .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .menuOrder(.fixed)
        .accessibilityLabel("Abrir menú")
    }

    @ViewBuilder
    private func navigationMenuItem(_ item: ShellNavItem) -> some View {
        if let children = item.children, !children.isEmpty {
            Menu {
                Button {
                    shell.navigate(to: item.route)
                } label: {
                    Label("Abrir \(item.label)", systemImage: item.icon)
                }

                Divider()

                ForEach(children) { child in
                    Button {
                        shell.navigate(to: child.route)
                    } label: {
                        Label(child.label, systemImage: child.icon)
                    }
                }
            } label: {
                Label(item.label, systemImage: item.icon)
            }
        } else {
            Button {
                shell.navigate(to: item.route)
            } label: {
                Label(item.label, systemImage: item.icon)
            }
        }
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
