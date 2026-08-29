import SwiftUI
import TotemOSKit

/// Shell SwiftUI superpuesto al `WKWebView`. Se oculta mientras la web muestra
/// el formulario de transacción para dejarle el viewport completo.
struct NativeShellOverlay: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        GeometryReader { proxy in
            // Keep a conservative minimum even if a hosting controller reports
            // zero safe-area insets while it is transitioning from the web
            // view. This keeps controls below the island on the first frame.
            let topInset = max(proxy.safeAreaInsets.top, 44)

            ZStack(alignment: .top) {
                if shell.isVisible {
                    // UIKit's visual-effect view blurs the WKWebView even when
                    // it is a sibling in the hosting ZStack. The layer starts
                    // at the physical top edge (above the safe-area inset) and
                    // feathers out below the island instead of forming a bar.
                    ProgressiveHeaderBlurView(reduceTransparency: reduceTransparency)
                        .frame(height: topInset + 176)
                        .frame(maxWidth: .infinity)
                        .offset(y: -topInset)
                        .allowsHitTesting(false)

                    VStack(spacing: 0) {
                        ShellHeaderView()
                            // The blur owns the unsafe area, while controls
                            // remain below the Dynamic Island/notch.
                            .padding(.top, topInset + 4)

                        Spacer(minLength: 0)

                        ShellTabBarView()
                            // El mismo margen que a izquierda y derecha hace que la
                            // cápsula siga visualmente el borde del iPhone.
                            .padding(.bottom, 16)
                    }
                    .transition(reduceMotion ? .identity : .opacity)
                }
            }
        }
        // Let only the background layer reach the physical top. The header's
        // explicit safe-area padding above keeps its controls below the island.
        .ignoresSafeArea(edges: .top)
        // La barra inferior se mide desde el borde físico; el header conserva
        // su margen seguro debajo de la isla del dispositivo.
        .ignoresSafeArea(edges: .bottom)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: shell.isVisible)
        .preferredColorScheme(shell.snapshot.theme == .dark ? .dark : .light)
        .sheet(isPresented: $shell.isNotificationListOpen) {
            ShellNotificationsView()
                .environmentObject(shell)
                .presentationDetents([.medium, .large])
        }
    }
}

/// A variable-radius, untinted backdrop that feathers from the physical top
/// edge into the dashboard. This is intentionally not a capsule or a second
/// glass container; the header buttons remain visually free.
private struct ProgressiveHeaderBlurView: View {
    let reduceTransparency: Bool

    var body: some View {
        if reduceTransparency {
            Color.totemShellSolid
        } else {
            TotemVariableBlurView(
                maxBlurRadius: 28,
                direction: .blurredTopClearBottom,
                // Start with a non-zero radius at the Dynamic Island so the
                // top never reads as a flat translucent gradient.
                startOffset: -0.12
            )
        }
    }
}
