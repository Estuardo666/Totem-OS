import SwiftUI
import TotemOSKit

/// Navegación principal basada en el `TabView` del sistema. iOS 26 es el
/// único responsable de dibujar, animar y adaptar el Liquid Glass del tab bar.
struct ShellTabBarView<Content: View>: View {
    @EnvironmentObject private var shell: AppCoordinator
    private let content: (ShellTabItem, Bool) -> Content

    init(@ViewBuilder content: @escaping (ShellTabItem, Bool) -> Content) {
        self.content = content
    }

    private var snapshot: ShellSnapshot { shell.snapshot }

    private var tabs: [ShellTabItem] {
        if snapshot.tabs.isEmpty {
            return [ShellTabItem(
                id: "tab-home",
                route: AppRoute.home.path,
                label: "Inicio",
                icon: "house"
            )]
        }
        return snapshot.tabs
    }

    private var selectedTabID: String {
        tabs.first(where: { snapshot.isActive(route: $0.route) })?.id
            ?? tabs[0].id
    }

    private var selection: Binding<String> {
        Binding(
            get: {
                selectedTabID
            },
            set: { tabID in
                guard let tab = tabs.first(where: { $0.id == tabID }),
                      !snapshot.isActive(route: tab.route)
                else { return }
                shell.navigate(to: tab.route)
            }
        )
    }

    var body: some View {
        TabView(selection: selection) {
            ForEach(tabs) { tab in
                Tab(tab.label, systemImage: tab.icon, value: tab.id) {
                    content(tab, selectedTabID == tab.id)
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

/// Acción contextual compacta situada a la derecha del accesorio nativo.
private struct TransactionAccessory: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement
    @State private var presentsTransactions = false

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            Button {
                presentsTransactions = true
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: placement == .inline ? 17 : 19, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.glass)
            .accessibilityLabel("Registrar transacción")
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .padding(.trailing, 8)
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
