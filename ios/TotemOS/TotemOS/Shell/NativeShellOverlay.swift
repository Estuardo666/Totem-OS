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

                if shell.isNavigationMenuOpen || shell.isAccountMenuOpen {
                    Color.clear
                        .contentShape(Rectangle())
                        .ignoresSafeArea()
                        .onTapGesture { shell.closeMenus() }

                    if shell.isNavigationMenuOpen {
                        ShellNavigationMenuView()
                            .padding(.top, 64)
                            .padding(.leading, 12)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    : .scale(scale: 0.92, anchor: .topLeading).combined(with: .opacity)
                            )
                    }

                    if shell.isAccountMenuOpen {
                        ShellAccountMenuView()
                            .padding(.top, 64)
                            .padding(.trailing, 12)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    : .scale(scale: 0.92, anchor: .topTrailing).combined(with: .opacity)
                            )
                    }
                }
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: shell.isVisible)
        .animation(
            reduceMotion ? nil : .spring(response: 0.26, dampingFraction: 1),
            value: shell.isNavigationMenuOpen
        )
        .animation(
            reduceMotion ? nil : .spring(response: 0.26, dampingFraction: 1),
            value: shell.isAccountMenuOpen
        )
        .preferredColorScheme(shell.snapshot.theme == .dark ? .dark : .light)
        .sheet(isPresented: $shell.isNotificationListOpen) {
            ShellNotificationsView()
                .environmentObject(shell)
                .presentationDetents([.medium, .large])
        }
    }
}
