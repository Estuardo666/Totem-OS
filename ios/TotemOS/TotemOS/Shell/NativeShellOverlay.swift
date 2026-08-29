import SwiftUI
import UIKit
import TotemOSKit

/// Shell SwiftUI superpuesto al `WKWebView`. Se oculta mientras la web muestra
/// el formulario de transacción para dejarle el viewport completo.
struct NativeShellOverlay: View {
    @EnvironmentObject private var shell: AppCoordinator
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                if shell.isVisible {
                    // UIKit's visual-effect view blurs the WKWebView even when
                    // it is a sibling in the hosting ZStack. The layer starts
                    // at the physical top edge (above the safe-area inset) and
                    // feathers out below the island instead of forming a bar.
                    ProgressiveHeaderBlurView(reduceTransparency: reduceTransparency)
                        .frame(height: proxy.safeAreaInsets.top + 176)
                        .frame(maxWidth: .infinity)
                        .offset(y: -proxy.safeAreaInsets.top)
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
private struct ProgressiveHeaderBlurView: UIViewRepresentable {
    let reduceTransparency: Bool

    func makeUIView(context: Context) -> ProgressiveHeaderBlurUIKitView {
        ProgressiveHeaderBlurUIKitView(reduceTransparency: reduceTransparency)
    }

    func updateUIView(_ view: ProgressiveHeaderBlurUIKitView, context: Context) {
        view.setReduceTransparency(reduceTransparency)
    }
}

private final class ProgressiveHeaderBlurUIKitView: UIView {
    private let effectView = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
    private let maskLayer = CAGradientLayer()

    init(reduceTransparency: Bool) {
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        backgroundColor = .clear
        clipsToBounds = false

        effectView.isUserInteractionEnabled = false
        effectView.clipsToBounds = false
        addSubview(effectView)

        // Opaque at the physical top, transparent below the header: this is
        // the progressive fade visible in Apple's system apps.
        maskLayer.colors = [
            UIColor.black.cgColor,
            UIColor.black.withAlphaComponent(0.94).cgColor,
            UIColor.black.withAlphaComponent(0.72).cgColor,
            UIColor.black.withAlphaComponent(0.34).cgColor,
            UIColor.clear.cgColor,
        ]
        maskLayer.locations = [0, 0.16, 0.42, 0.72, 1]
        maskLayer.startPoint = CGPoint(x: 0.5, y: 0)
        maskLayer.endPoint = CGPoint(x: 0.5, y: 1)
        effectView.layer.mask = maskLayer
        setReduceTransparency(reduceTransparency)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        effectView.frame = bounds
        maskLayer.frame = effectView.bounds
    }

    func setReduceTransparency(_ value: Bool) {
        effectView.effect = value ? nil : UIBlurEffect(style: .systemMaterial)
        backgroundColor = value ? UIColor.secondarySystemBackground : .clear
    }
}
