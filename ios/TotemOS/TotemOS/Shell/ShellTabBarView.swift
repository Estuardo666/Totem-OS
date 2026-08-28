import SwiftUI
import TotemOSKit

/// Barra inferior: Inicio, Tareas, acción central, Finanzas, Clientes.
/// La acción central abre el formulario financiero web existente.
struct ShellTabBarView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        let tabs = snapshot.tabs
        let split = min(2, tabs.count)

        TotemGlassContainer(spacing: 16) {
            HStack(spacing: 4) {
                ForEach(tabs.prefix(split)) { tab in
                    tabButton(tab)
                }

                centerAction

                ForEach(tabs.dropFirst(split)) { tab in
                    tabButton(tab)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .totemShellGlass(
                in: Capsule(),
                reduceTransparency: reduceTransparency
            )
        }
        .padding(.horizontal, 16)
    }

    private func tabButton(_ tab: ShellTabItem) -> some View {
        let isActive = snapshot.isActive(route: tab.route)

        return Button {
            shell.navigate(to: tab.route)
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 17, weight: isActive ? .semibold : .regular))
                Text(tab.label)
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: shellMinimumTapTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(isActive ? Color.accentColor : Color.primary.opacity(0.75))
        .accessibilityLabel(tab.label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private var centerAction: some View {
        Button {
            shell.send(.openTransaction)
        } label: {
            Image(systemName: "receipt")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.white)
                .frame(width: 52, height: 52)
                .background(Color.accentColor, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Registrar transacción")
        .padding(.horizontal, 2)
    }
}
