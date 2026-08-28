import SwiftUI
import UIKit
import TotemOSKit

/// Barra inferior: Inicio, Tareas, acción central, Finanzas, Clientes.
/// La acción central abre el formulario financiero web existente.
struct ShellTabBarView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Namespace private var selectionNamespace
    @State private var previewTabID: String?
    @State private var dragOriginIndex: Int?

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        let tabs = snapshot.tabs
        let split = min(2, tabs.count)

        GeometryReader { proxy in
            HStack(spacing: 4) {
                ForEach(tabs.prefix(split)) { tab in tabButton(tab) }

                centerAction

                ForEach(tabs.dropFirst(split)) { tab in tabButton(tab) }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .contentShape(Capsule())
            .totemShellGlass(
                in: Capsule(),
                reduceTransparency: reduceTransparency
            )
            .simultaneousGesture(selectionDrag(tabs: tabs, width: proxy.size.width))
        }
        .frame(height: 64)
        .padding(.horizontal, 16)
        .onChange(of: snapshot.route) { _, _ in
            guard let previewTabID,
                  let selected = tabs.first(where: { $0.id == previewTabID }),
                  snapshot.isActive(route: selected.route)
            else { return }
            self.previewTabID = nil
        }
    }

    private func tabButton(_ tab: ShellTabItem) -> some View {
        let isActive = selectedTabID == tab.id

        return Button {
            select(tab)
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
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
            .background {
                if isActive {
                    Capsule()
                        .fill(Color.accentColor.opacity(0.18))
                        .matchedGeometryEffect(id: "shell-tab-selection", in: selectionNamespace)
                }
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(isActive ? Color.accentColor : Color.primary.opacity(0.75))
        .accessibilityLabel(tab.label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private var selectedTabID: String? {
        previewTabID
            ?? snapshot.tabs.first(where: { snapshot.isActive(route: $0.route) })?.id
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

    /// Selección directa: la cápsula sigue el dedo entre los cuatro destinos.
    /// El botón central queda fuera de la secuencia para evitar abrir una
    /// transacción accidental durante el deslizamiento.
    private func selectionDrag(tabs: [ShellTabItem], width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                guard !tabs.isEmpty else { return }
                let origin = dragOriginIndex ?? activeIndex(in: tabs)
                if dragOriginIndex == nil { dragOriginIndex = origin }

                let physicalSlots = [0, 1, 3, 4]
                let slotWidth = max(width / 5, 1)
                let originSlot = physicalSlots[min(origin, physicalSlots.count - 1)]
                let projectedSlot = CGFloat(originSlot) + value.translation.width / slotWidth
                let target = physicalSlots.enumerated().min {
                    abs(CGFloat($0.element) - projectedSlot) < abs(CGFloat($1.element) - projectedSlot)
                }?.offset ?? origin
                let clamped = min(max(target, 0), tabs.count - 1)
                let nextID = tabs[clamped].id

                if previewTabID != nextID {
                    UISelectionFeedbackGenerator().selectionChanged()
                    withAnimation(reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 1)) {
                        previewTabID = nextID
                    }
                }
            }
            .onEnded { _ in
                defer { dragOriginIndex = nil }
                guard let previewTabID,
                      let tab = tabs.first(where: { $0.id == previewTabID })
                else { return }
                shell.navigate(to: tab.route)
            }
    }

    private func activeIndex(in tabs: [ShellTabItem]) -> Int {
        tabs.firstIndex(where: { snapshot.isActive(route: $0.route) }) ?? 0
    }

    private func select(_ tab: ShellTabItem) {
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 1)) {
            previewTabID = tab.id
        }
        shell.navigate(to: tab.route)
    }
}
