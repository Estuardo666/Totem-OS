import SwiftUI
import UIKit

enum TotemTypography {
    static func regular(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .custom("GoogleSans-Regular", size: size, relativeTo: style)
    }

    static func medium(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .custom("GoogleSans-Medium", size: size, relativeTo: style)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
        .custom("GoogleSans-Bold", size: size, relativeTo: style)
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

// MARK: - Shell nativo

extension View {
    /// Una sola superficie de vidrio por contenedor del shell.
    ///
    /// - `interactive`: reservado para controles pulsables; los contenedores
    ///   (header, drawer) se mantienen pasivos para no apilar capas.
    @ViewBuilder
    func totemShellGlass(
        in shape: some InsettableShape,
        interactive: Bool = false,
        reduceTransparency: Bool = false
    ) -> some View {
        if reduceTransparency {
            background(Color.totemShellSolid, in: shape)
                .overlay { shape.stroke(.white.opacity(0.12), lineWidth: 1) }
        } else if #available(iOS 26.0, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
                .overlay { shape.stroke(.white.opacity(0.12), lineWidth: 1) }
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
