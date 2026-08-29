import SwiftUI
import TotemOSKit

/// Shell SwiftUI superpuesto al `WKWebView`. Se oculta mientras la web muestra
/// el formulario de transacción para dejarle el viewport completo.
struct NativeShellOverlay: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        ZStack(alignment: .top) {
            if shell.isVisible {
                // The blur is a full-width layer, independent from the loose
                // controls. It extends into the unsafe area so its strongest
                // point starts at the physical top edge, including the island.
                ProgressiveHeaderBlurView(reduceTransparency: reduceTransparency)
                    .frame(height: 176)
                    .frame(maxWidth: .infinity)
                    .ignoresSafeArea(edges: .top)
                    .allowsHitTesting(false)

                VStack(spacing: 0) {
                    ShellHeaderView()
                        .padding(.top, 4)

                    Spacer(minLength: 0)

                    ShellTabBarView()
                        // El mismo margen que a izquierda y derecha hace que la
                        // cápsula siga visualmente el borde del iPhone.
                        .padding(.bottom, 16)
                }
                .transition(reduceMotion ? .identity : .opacity)

            }
        }
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

/// A single, untinted system material that feathers from the physical top edge
/// into the dashboard. This is intentionally not a capsule or a second glass
/// container; the header buttons remain visually free.
private struct ProgressiveHeaderBlurView: View {
    let reduceTransparency: Bool

    var body: some View {
        Group {
            if reduceTransparency {
                Rectangle().fill(Color.totemShellSolid)
            } else {
                Rectangle().fill(.regularMaterial)
            }
        }
        .mask(
            LinearGradient(
                stops: [
                    .init(color: .black, location: 0),
                    .init(color: .black.opacity(0.94), location: 0.16),
                    .init(color: .black.opacity(0.72), location: 0.42),
                    .init(color: .black.opacity(0.34), location: 0.72),
                    .init(color: .clear, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}
