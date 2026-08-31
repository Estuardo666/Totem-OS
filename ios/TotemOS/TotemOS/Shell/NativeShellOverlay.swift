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
                        .frame(height: topInset + 210)
                        .frame(maxWidth: .infinity)
                        .offset(y: -topInset)
                        .allowsHitTesting(false)

                    VStack(spacing: 0) {
                        ShellHeaderView()
                            // The blur owns the unsafe area, while controls
                            // remain below the Dynamic Island/notch.
                            .padding(.top, topInset + 4)

                        Spacer(minLength: 0)
                    }
                    .transition(reduceMotion ? .identity : .opacity)
                }
            }
        }
        // Let only the background layer reach the physical top. The header's
        // explicit safe-area padding above keeps its controls below the island.
        .ignoresSafeArea(edges: .top)
        // El borde inferior queda bajo control de TabView para que UIKit
        // resuelva la safe area y la geometría flotante de iOS 26.
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
        content
            // The variable-radius filter is resolved through the Objective-C
            // runtime and is allowed to fail: when it does, the view stays a
            // uniform UIBlurEffect and ends on a hard line. This mask makes
            // the fade-out a property of the layer itself, so the bottom edge
            // is soft whether or not the filter was installed.
            .mask(
                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 0.42),
                        .init(color: .black.opacity(0.55), location: 0.66),
                        .init(color: .black.opacity(0.18), location: 0.85),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
    }

    @ViewBuilder
    private var content: some View {
        if reduceTransparency {
            Color.totemShellSolid
        } else {
            TotemVariableBlurView(
                maxBlurRadius: 28,
                direction: .blurredTopClearBottom,
                // The gradient has to reach fully clear inside the layer.
                // A negative offset left ~11% of the mask still opaque at the
                // bottom edge, which is what made the blur end on a hard line.
                startOffset: 0
            )
        }
    }
}
