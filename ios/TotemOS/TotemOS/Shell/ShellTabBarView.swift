import SwiftUI
import TotemOSKit

/// Navegación principal basada en el `TabView` del sistema. iOS 26 es el
/// único responsable de dibujar, animar y adaptar el Liquid Glass del tab bar.
struct ShellTabBarView: View {
    @EnvironmentObject private var shell: AppCoordinator

    private var snapshot: ShellSnapshot { shell.snapshot }

    private var selection: Binding<String> {
        Binding(
            get: {
                snapshot.tabs.first(where: { snapshot.isActive(route: $0.route) })?.id
                    ?? snapshot.tabs.first?.id
                    ?? ""
            },
            set: { tabID in
                guard let tab = snapshot.tabs.first(where: { $0.id == tabID }),
                      !snapshot.isActive(route: tab.route)
                else { return }
                shell.navigate(to: tab.route)
            }
        )
    }

    var body: some View {
        TabView(selection: selection) {
            ForEach(snapshot.tabs) { tab in
                Tab(tab.label, systemImage: tab.icon, value: tab.id) {
                    // El contenido real sigue perteneciendo al renderer híbrido
                    // situado debajo del shell. Esta vista transparente permite
                    // que el TabView posea exclusivamente el chrome del sistema.
                    Color.clear
                        .allowsHitTesting(false)
                }
                .badge(tab.route == "/content" ? snapshot.taskCount : 0)
            }
        }
        .tint(snapshot.accent)
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory {
            TransactionAccessory()
        }
    }
}

/// Acción contextual situada en la zona que iOS reserva encima del tab bar.
/// No forma parte ni recrea la barra; su vidrio también lo proporciona iOS.
private struct TransactionAccessory: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement
    @State private var presentsTransactions = false

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            Button {
                presentsTransactions = true
            } label: {
                if placement == .inline {
                    Image(systemName: "plus")
                        .frame(minWidth: 44, minHeight: 44)
                } else {
                    Label("Registrar transacción", systemImage: "plus")
                        .frame(minHeight: 44)
                }
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Registrar transacción")
        }
        .frame(maxWidth: .infinity)
        .confirmationDialog(
            "Registrar transacción",
            isPresented: $presentsTransactions,
            titleVisibility: .visible
        ) {
            ForEach(availableTransactionTabs, id: \.rawValue) { tab in
                Button(tab.label) {
                    shell.openTransaction(tab: tab)
                }
            }
        }
    }

    private var availableTransactionTabs: [ShellTransactionTab] {
        shell.snapshot.user?.role == .admin
            ? [.expense, .income, .honorarios]
            : [.expense]
    }
}

private extension ShellTransactionTab {
    var label: String {
        switch self {
        case .expense: "Gasto"
        case .income: "Ingreso"
        case .honorarios: "Honorario"
        }
    }
}
