import SwiftUI
import TotemOSKit

/// Shell SwiftUI superpuesto al `WKWebView`. Se oculta mientras la web muestra
/// el formulario de transacción para dejarle el viewport completo.
struct NativeShellOverlay: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            // Keep a conservative minimum even if a hosting controller reports
            // zero safe-area insets while it is transitioning from the web
            // view. This keeps controls below the island on the first frame.
            let topInset = max(proxy.safeAreaInsets.top, 44)

            ZStack(alignment: .top) {
                if shell.isVisible {
                    VStack(spacing: 0) {
                        ShellScrollEdgeHeader(shell: shell)
                            .frame(height: 56)
                            // UIKit derives the edge effect from this header's
                            // real bounds and the WebView's scrolling content.
                            .padding(.top, topInset + 4)

                        Spacer(minLength: 0)

                        ShellTabBarView()
                            // Margen desde el borde físico, sin sumar el área
                            // segura que elevaba la cápsula sobre el contenido.
                            .padding(.bottom, 16)
                    }
                    .transition(reduceMotion ? .identity : .opacity)
                }
            }
        }
        // Header controls remain below the island; UIKit owns the edge effect.
        .ignoresSafeArea(edges: .top)
        // La cápsula administra su propio margen inferior. El indicador del
        // sistema está oculto por ContentView.
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
