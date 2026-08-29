import SwiftUI
import UIKit
import TotemOSKit

/// Barra inferior: Inicio, Tareas, acción central, Finanzas, Clientes.
/// La acción central abre el formulario financiero web existente.
struct ShellTabBarView: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
            // El platter es una capa pasiva independiente. Los botones
            // seleccionados tienen su propio tinte Liquid Glass encima.
            .background {
                Color.clear
                    .totemShellGlass(
                        in: Capsule(),
                        reduceTransparency: reduceTransparency
                    )
            }
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
        .onAppear { ShellHaptics.prepare() }
    }

    private func tabButton(_ tab: ShellTabItem) -> some View {
        let isActive = selectedTabID == tab.id

        return Button {
            select(tab)
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 17, weight: isActive ? .semibold : .regular))
                    .overlay(alignment: .topTrailing) {
                        if tab.route == "/content" {
                            ShellBadge(count: snapshot.taskCount, tint: .orange)
                                .offset(x: 12, y: -9)
                        }
                    }
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
                        .totemInteractiveShellGlass(
                            in: Capsule(),
                            tint: snapshot.accent,
                            reduceTransparency: reduceTransparency
                        )
                }
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.primary.opacity(isActive ? 0.95 : 0.65))
        .accessibilityLabel(
            tab.route == "/content" && snapshot.taskCount > 0
                ? "\(tab.label), \(snapshot.taskCount) pendientes"
                : tab.label
        )
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    private var selectedTabID: String? {
        previewTabID
            ?? snapshot.tabs.first(where: { snapshot.isActive(route: $0.route) })?.id
    }

    private var centerAction: some View {
        Menu {
            ForEach(availableTransactionTabs, id: \.rawValue) { tab in
                Button {
                    ShellHaptics.tap()
                    shell.openTransaction(tab: tab)
                } label: {
                    Label(tab.label, systemImage: tab.icon)
                }
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.white)
                .frame(width: 52, height: 52)
                .background {
                    Color.clear
                        .totemInteractiveShellGlass(
                            in: Circle(),
                            tint: snapshot.accent,
                            reduceTransparency: reduceTransparency
                        )
                }
                .shadow(color: snapshot.accent.opacity(0.36), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .menuOrder(.fixed)
        .simultaneousGesture(
            TapGesture().onEnded { ShellHaptics.tap() }
        )
        .accessibilityLabel("Registrar transacción")
        .padding(.horizontal, 2)
    }

    private var availableTransactionTabs: [ShellTransactionTab] {
        snapshot.user?.role == .admin
            ? [.expense, .income, .honorarios]
            : [.expense]
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
                    ShellHaptics.selectionChanged()
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
        ShellHaptics.tap()
        withAnimation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 1)) {
            previewTabID = tab.id
        }
        shell.navigate(to: tab.route)
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
