import SwiftUI
import UIKit
import TotemOSKit

/// Selector rápido anclado a la acción central. Solo decide la pestaña que
/// abrirá React; toda la validación y persistencia financiera sigue en web.
struct ShellTransactionMenuView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var availableTabs: [ShellTransactionTab] {
        shell.snapshot.user?.role == .admin
            ? [.expense, .income, .honorarios]
            : [.expense]
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(availableTabs, id: \.rawValue) { tab in
                Button {
                    UISelectionFeedbackGenerator().selectionChanged()
                    shell.closeMenus()
                    shell.send(.openTransaction(tab: tab))
                } label: {
                    Label(tab.label, systemImage: tab.icon)
                        .font(TotemTypography.medium(16, relativeTo: .body))
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 18)

                if tab != availableTabs.last {
                    Divider().opacity(0.3).padding(.horizontal, 14)
                }
            }
        }
        .frame(width: 224)
        .totemShellGlass(
            in: RoundedRectangle(cornerRadius: 24, style: .continuous),
            reduceTransparency: reduceTransparency
        )
        .shadow(color: .black.opacity(0.2), radius: 22, y: 10)
        .accessibilityAddTraits(.isModal)
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

    var icon: String {
        switch self {
        case .expense: "arrow.down.circle"
        case .income: "arrow.up.circle"
        case .honorarios: "person.crop.circle.badge.checkmark"
        }
    }
}
