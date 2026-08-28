import SwiftUI
import TotemOSKit

/// Drawer izquierdo con las mismas rutas y permisos que el sidebar web.
/// Se abre desde el header y se cierra arrastrando el propio panel, de modo
/// que el gesto del borde sigue perteneciendo al `WKWebView`.
struct ShellDrawerView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    @State private var expandedItems: Set<String> = []
    @State private var dragOffset: CGFloat = 0

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        GeometryReader { proxy in
            let width = min(proxy.size.width * 0.82, 400)

            ZStack(alignment: .leading) {
                backdrop

                panel(width: width)
                    .frame(width: width)
                    .offset(x: shell.isDrawerOpen ? dragOffset : -width)
                    .gesture(closeDrag(width: width))
            }
            .animation(motion, value: shell.isDrawerOpen)
        }
        .ignoresSafeArea()
        .onChange(of: shell.isDrawerOpen) { _, isOpen in
            if isOpen {
                dragOffset = 0
                expandedItems = defaultExpandedItems()
            }
        }
    }

    private var motion: Animation? {
        reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.9)
    }

    private var backdrop: some View {
        Color.black
            .opacity(shell.isDrawerOpen ? 0.35 : 0)
            .ignoresSafeArea()
            .allowsHitTesting(shell.isDrawerOpen)
            .onTapGesture { shell.isDrawerOpen = false }
            .accessibilityLabel("Cerrar menú")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { shell.isDrawerOpen = false }
    }

    private func panel(width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, 18)
                .padding(.top, 16)
                .padding(.bottom, 12)

            Divider().opacity(0.4)

            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(snapshot.navigation) { item in
                        navigationRow(for: item)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
            }

            if let user = snapshot.user {
                Divider().opacity(0.4)
                footer(user: user)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
            }
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .safeAreaPadding(.vertical)
        .totemShellGlass(
            in: RoundedRectangle(cornerRadius: 28, style: .continuous),
            reduceTransparency: reduceTransparency
        )
        .accessibilityAddTraits(.isModal)
    }

    @ViewBuilder
    private var header: some View {
        let logoValue = colorScheme == .dark ? snapshot.logoDark : snapshot.logoLight

        HStack {
            if let logoValue, let url = ShellAsset.url(for: logoValue) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Color.clear
                }
                .frame(maxHeight: 40)
            } else {
                Text("Totem OS")
                    .font(TotemTypography.bold(18, relativeTo: .title3))
            }

            Spacer()

            Button {
                shell.isDrawerOpen = false
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cerrar menú")
        }
    }

    @ViewBuilder
    private func navigationRow(for item: ShellNavItem) -> some View {
        let isActive = snapshot.isActive(item: item)

        if let children = item.children, !children.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 0) {
                    Button {
                        shell.navigate(to: item.route)
                    } label: {
                        Label(item.label, systemImage: item.icon)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: shellMinimumTapTarget, alignment: .leading)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Button {
                        toggleExpanded(item.id)
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .rotationEffect(.degrees(expandedItems.contains(item.id) ? 90 : 0))
                            .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(
                        expandedItems.contains(item.id)
                            ? "Contraer \(item.label)"
                            : "Expandir \(item.label)"
                    )
                }
                .foregroundStyle(isActive ? Color.accentColor : Color.primary)

                if expandedItems.contains(item.id) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(children) { child in
                            Button {
                                shell.navigate(to: child.route)
                            } label: {
                                Text(child.label)
                                    .font(.footnote)
                                    .frame(maxWidth: .infinity, minHeight: shellMinimumTapTarget, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(
                                snapshot.isActive(route: child.route) ? Color.accentColor : Color.secondary
                            )
                        }
                    }
                    .padding(.leading, 28)
                    .transition(reduceMotion ? .identity : .opacity)
                }
            }
            .animation(motion, value: expandedItems)
        } else {
            Button {
                shell.navigate(to: item.route)
            } label: {
                Label(item.label, systemImage: item.icon)
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity, minHeight: shellMinimumTapTarget, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(isActive ? Color.accentColor : Color.primary)
        }
    }

    private func footer(user: ShellUser) -> some View {
        HStack(spacing: 12) {
            ShellAvatarView(user: user, size: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(user.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(user.roleLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            Menu {
                Button {
                    shell.isDrawerOpen = false
                    shell.send(.openSettings)
                } label: {
                    Label("Configuración", systemImage: "gearshape")
                }
                Button {
                    shell.isDrawerOpen = false
                    shell.send(.openIntegrations)
                } label: {
                    Label("Integraciones", systemImage: "powerplug")
                }
                Divider()
                Button(role: .destructive) {
                    shell.isDrawerOpen = false
                    shell.send(.signOut)
                } label: {
                    Label("Cerrar Sesión", systemImage: "rectangle.portrait.and.arrow.right")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Opciones de cuenta")
        }
    }

    private func closeDrag(width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                dragOffset = min(0, value.translation.width)
            }
            .onEnded { value in
                if value.translation.width < -width * 0.28 || value.predictedEndTranslation.width < -width {
                    shell.isDrawerOpen = false
                }
                dragOffset = 0
            }
    }

    private func toggleExpanded(_ id: String) {
        if expandedItems.contains(id) {
            expandedItems.remove(id)
        } else {
            expandedItems.insert(id)
        }
    }

    /// Igual que la web: los grupos con una ruta activa arrancan desplegados.
    private func defaultExpandedItems() -> Set<String> {
        Set(
            snapshot.navigation
                .filter { item in
                    guard let children = item.children, !children.isEmpty else { return false }
                    return children.contains { snapshot.isActive(route: $0.route) }
                }
                .map(\.id)
        )
    }
}
