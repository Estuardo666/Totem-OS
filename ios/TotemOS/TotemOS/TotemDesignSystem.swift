import SwiftUI
import UIKit
import TotemOSKit

enum TotemTypography {
    static func regular(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }

    static func medium(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .system(size: size, weight: .bold, design: .default)
    }
}

struct TotemPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color(red: 0.08, green: 0.08, blue: 0.08))
            .background(
                Color.totemLime,
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? 0.08 : 0)
            .animation(
                .spring(response: 0.24, dampingFraction: 1),
                value: configuration.isPressed
            )
    }
}

extension View {
    @ViewBuilder
    func totemGlassSurface(
        cornerRadius: CGFloat,
        isFocused: Bool = false,
        reduceTransparency: Bool = false
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        if #available(iOS 26.0, *) {
            // Text fields are containers, not pressable glass controls. Keeping the
            // material passive prevents it from lifting away from a static base.
            glassEffect(.regular, in: shape)
                .shadow(
                    color: .white.opacity(isFocused ? 0.20 : 0),
                    radius: isFocused ? 8 : 0
                )
        } else if reduceTransparency {
            background(Color(red: 36 / 255, green: 31 / 255, blue: 53 / 255), in: shape)
                .overlay {
                    shape.stroke(.white.opacity(isFocused ? 0.42 : 0.14), lineWidth: 1)
                }
        } else {
            background(.ultraThinMaterial, in: shape)
                .overlay {
                    shape.stroke(.white.opacity(isFocused ? 0.42 : 0.14), lineWidth: 1)
                }
        }
    }
}

extension Color {
    static let totemLime = Color(red: 159 / 255, green: 232 / 255, blue: 66 / 255)
}

struct TotemThemePalette {
    let background: Color
    let card: Color
    let foreground: Color
    let secondaryText: Color
    let surface: Color
    let border: Color
    let accent: Color

    init(state: NativeShellState) {
        background = Color(shellHex: state.backgroundColor) ?? Color(uiColor: .systemGroupedBackground)
        card = Color(shellHex: state.cardColor) ?? Color(uiColor: .secondarySystemGroupedBackground)
        foreground = Color(shellHex: state.foregroundColor) ?? .primary
        secondaryText = Color(shellHex: state.secondaryTextColor) ?? .secondary
        surface = Color(shellHex: state.surfaceColor) ?? Color(uiColor: .tertiarySystemFill)
        border = Color(shellHex: state.borderColor) ?? Color(uiColor: .separator)
        accent = Color(shellHex: state.accentColor) ?? .accentColor
    }
}

extension AppCoordinator {
    var themePalette: TotemThemePalette { TotemThemePalette(state: state) }
}

extension View {
    /// Cards are content, so Apple recommends an adaptive solid/material
    /// surface rather than stacking Liquid Glass throughout the page.
    @ViewBuilder
    func totemDashboardCard(palette: TotemThemePalette, cornerRadius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        background(palette.card.opacity(0.92), in: shape)
            .overlay { shape.stroke(palette.border.opacity(0.72), lineWidth: 0.75) }
    }
}

// MARK: - Shell nativo

extension View {
    /// Superficie Liquid Glass pasiva para un contenedor del shell.
    ///
    /// No recibe el color Catppuccin: el material se adapta al fondo que hay
    /// detrás y conserva la jerarquía de iOS 26 sin teñir toda la navegación.
    @ViewBuilder
    func totemShellGlass(
        in shape: some InsettableShape,
        reduceTransparency: Bool = false
    ) -> some View {
        if reduceTransparency {
            background(Color.totemShellSolid, in: shape)
                .overlay { shape.stroke(.white.opacity(0.12), lineWidth: 1) }
        } else if #available(iOS 26.0, *) {
            glassEffect(.regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
                .overlay { shape.stroke(.white.opacity(0.12), lineWidth: 1) }
        }
    }

    /// Liquid Glass interactivo para una acción concreta de la barra.
    /// El tinte se limita a la cápsula pulsada/seleccionada, nunca al platter.
    @ViewBuilder
    func totemInteractiveShellGlass(
        in shape: some InsettableShape,
        tint: Color,
        reduceTransparency: Bool = false
    ) -> some View {
        if reduceTransparency {
            background(tint.opacity(0.24), in: shape)
                .overlay { shape.stroke(tint.opacity(0.58), lineWidth: 1) }
        } else if #available(iOS 26.0, *) {
            // `.tint` changes the specular response, while this very light
            // wash guarantees that the accent remains legible in both light
            // and dark appearances instead of collapsing to white/black.
            glassEffect(.regular.tint(tint).interactive(), in: shape)
                .overlay { shape.fill(tint.opacity(0.14)) }
        } else {
            background(.ultraThinMaterial, in: shape)
                .overlay { shape.fill(tint.opacity(0.14)) }
                .overlay { shape.stroke(tint.opacity(0.58), lineWidth: 1) }
        }
    }
}

/// `GlassEffectContainer` en iOS 26; en versiones previas no añade capas.
struct TotemGlassContainer<Content: View>: View {
    var spacing: CGFloat = 12
    @ViewBuilder var content: Content

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
    }
}

extension Color {
    /// Respaldo opaco para "Reducir transparencia".
    static let totemShellSolid = Color(
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 24 / 255, green: 22 / 255, blue: 36 / 255, alpha: 1)
                : UIColor(red: 246 / 255, green: 246 / 255, blue: 250 / 255, alpha: 1)
        }
    )
}
