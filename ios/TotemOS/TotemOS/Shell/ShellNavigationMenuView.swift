import SwiftUI
import UIKit
import TotemOSKit

/// Menú compacto anclado a los tres puntos del header, inspirado en el
/// patrón de WhatsApp. No ocupa toda la altura ni desplaza el contenido.
struct ShellNavigationMenuView: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var expandedItems: Set<String> = []

    private var snapshot: ShellSnapshot { shell.snapshot }
    private var menuWidth: CGFloat { min(UIScreen.main.bounds.width - 24, 330) }
    private var menuHeight: CGFloat { min(UIScreen.main.bounds.height * 0.68, 590) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Menú")
                    .font(TotemTypography.bold(18, relativeTo: .headline))
                Spacer()
                Button {
                    shell.closeMenus()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: shellMinimumTapTarget, height: shellMinimumTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cerrar menú")
            }
            .padding(.leading, 18)
            .padding(.trailing, 8)
            .padding(.top, 8)

            Divider().opacity(0.35)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(snapshot.navigation) { item in
                        navigationRow(for: item)
                    }
                }
                .padding(10)
            }
            .scrollIndicators(.hidden)
        }
        .frame(width: menuWidth)
        .frame(maxHeight: menuHeight, alignment: .top)
        .totemShellGlass(
            in: RoundedRectangle(cornerRadius: 26, style: .continuous),
            reduceTransparency: reduceTransparency
        )
        .shadow(color: .black.opacity(0.18), radius: 24, y: 12)
        .onAppear { expandedItems = defaultExpandedItems() }
        .accessibilityAddTraits(.isModal)
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
                .font(TotemTypography.medium(15, relativeTo: .subheadline))
                .foregroundStyle(isActive ? Color.accentColor : Color.primary)
                .background(activeBackground(isActive), in: RoundedRectangle(cornerRadius: 14))

                if expandedItems.contains(item.id) {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(children) { child in
                            Button {
                                shell.navigate(to: child.route)
                            } label: {
                                Text(child.label)
                                    .font(TotemTypography.regular(14, relativeTo: .footnote))
                                    .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(
                                snapshot.isActive(route: child.route) ? Color.accentColor : Color.secondary
                            )
                        }
                    }
                    .padding(.leading, 34)
                    .transition(reduceMotion ? .identity : .opacity)
                }
            }
        } else {
            Button {
                shell.navigate(to: item.route)
            } label: {
                Label(item.label, systemImage: item.icon)
                    .font(TotemTypography.medium(15, relativeTo: .subheadline))
                    .frame(maxWidth: .infinity, minHeight: shellMinimumTapTarget, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(isActive ? Color.accentColor : Color.primary)
            .padding(.horizontal, 10)
            .background(activeBackground(isActive), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private func activeBackground(_ isActive: Bool) -> Color {
        isActive ? Color.accentColor.opacity(0.14) : .clear
    }

    private func toggleExpanded(_ id: String) {
        withAnimation(reduceMotion ? nil : .spring(response: 0.24, dampingFraction: 1)) {
            if expandedItems.contains(id) {
                expandedItems.remove(id)
            } else {
                expandedItems.insert(id)
            }
        }
    }

    private func defaultExpandedItems() -> Set<String> {
        Set(
            snapshot.navigation
                .filter { item in
                    guard let children = item.children else { return false }
                    return children.contains { snapshot.isActive(route: $0.route) }
                }
                .map(\.id)
        )
    }
}
