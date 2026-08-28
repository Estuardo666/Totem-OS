import SwiftUI
import TotemOSKit

/// Shell SwiftUI superpuesto al `WKWebView`. Se oculta mientras la web muestra
/// el formulario de transacción para dejarle el viewport completo.
struct NativeShellOverlay: View {
    @EnvironmentObject private var shell: ShellModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .top) {
            if shell.isVisible {
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
        // El margen inferior se mide desde el borde físico, no encima del
        // safe area. El header conserva su safe area superior.
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
