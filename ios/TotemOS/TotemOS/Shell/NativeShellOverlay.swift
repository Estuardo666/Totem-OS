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
                        .padding(.bottom, 4)
                }
                .transition(reduceMotion ? .identity : .opacity)

                if shell.isDrawerOpen {
                    ShellDrawerView()
                        .transition(.identity)
                }
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: shell.isVisible)
        .sheet(isPresented: $shell.isNotificationListOpen) {
            ShellNotificationsView()
                .environmentObject(shell)
                .presentationDetents([.medium, .large])
        }
    }
}
