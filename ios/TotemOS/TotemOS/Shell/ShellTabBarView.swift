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
    @State private var hoveredTabID: String?

    private var snapshot: ShellSnapshot { shell.snapshot }

    var body: some View {
        let tabs = snapshot.tabs
        let split = min(2, tabs.count)

        GeometryReader { proxy in
            TotemGlassContainer(spacing: 8) {
                HStack(spacing: 4) {
                    ForEach(tabs.prefix(split)) { tab in tabButton(tab) }

                    centerAction

                    ForEach(tabs.dropFirst(split)) { tab in tabButton(tab) }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .contentShape(Capsule())
                .simultaneousGesture(selectionDrag(tabs: tabs, width: proxy.size.width))
            }
            // Only the outer platter uses glass; labels and selected backgrounds
            // stay in ordinary SwiftUI layers for predictable contrast.
            .background {
                Color.clear
                    .totemShellGlass(
                        in: Capsule(),
                        reduceTransparency: reduceTransparency
                    )
            }
        }
        .frame(height: 72)
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
        // There is exactly one lens in the bar. A pointer hover temporarily
        // owns it; when the pointer leaves, it returns to the selected item.
        // This prevents a second selected-looking item from appearing below
        // the enlarged hover lens.
        let ownsLens = activeLensID == tab.id

        return Button {
            select(tab)
        } label: {
            VStack(spacing: 3) {
                Image(systemName: tab.icon)
                    .font(.system(size: 20, weight: isActive ? .semibold : .regular))
                    .frame(height: 24)
                    .overlay(alignment: .topTrailing) {
                        if tab.route == "/content" {
                            ShellBadge(count: snapshot.taskCount, tint: .orange)
                                .offset(x: 12, y: -9)
                        }
                    }
                Text(tab.label)
                    .font(.system(size: 11, weight: isActive ? .semibold : .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundStyle(Color.primary)
            .frame(maxWidth: .infinity, minHeight: 54)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(
            ShellTabButtonStyle(
                isSelected: isActive,
                isLensOwner: ownsLens,
                tint: snapshot.accent,
                reduceMotion: reduceMotion
            )
        )
        .onHover { hovering in
            if hovering {
                hoveredTabID = tab.id
            } else if hoveredTabID == tab.id {
                hoveredTabID = nil
            }
        }
        .accessibilityLabel(
            tab.route == "/content" && snapshot.taskCount > 0
                ? "\(tab.label), \(snapshot.taskCount) pendientes"
                : tab.label
        )
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }

    /// Keep selected backgrounds outside the Liquid Glass compositor. Text and
    /// SF Symbols are always normal foreground content, including on iOS 26.
    private struct ShellTabButtonStyle: ButtonStyle {
        let isSelected: Bool
        let isLensOwner: Bool
        let tint: Color
        let reduceMotion: Bool

        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .background {
                    Capsule()
                        .fill(tint.opacity(isLensOwner ? 0.20 : 0))
                        .overlay {
                            Capsule().strokeBorder(tint.opacity(isSelected ? 0.45 : 0), lineWidth: 1)
                        }
                        .allowsHitTesting(false)
                }
                .opacity(configuration.isPressed ? 0.7 : 1)
                .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: configuration.isPressed)
        }
    }

    private var selectedTabID: String? {
        previewTabID
            ?? snapshot.tabs.first(where: { snapshot.isActive(route: $0.route) })?.id
    }

    private var activeLensID: String? {
        hoveredTabID ?? selectedTabID
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
            VStack(spacing: 3) {
                Image(systemName: "plus")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Color.contrastForeground(on: snapshot.accentColor))
                    .frame(width: 34, height: 34)
                    .background(snapshot.accent, in: Circle())
                Text("Nuevo")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.primary)
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .contentShape(Rectangle())
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

                let physicalSlots = tabs.indices.map { $0 < min(2, tabs.count) ? $0 : $0 + 1 }
                let slotWidth = max(width / CGFloat(tabs.count + 1), 1)
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
