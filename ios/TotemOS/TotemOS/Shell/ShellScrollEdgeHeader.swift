import SwiftUI
import UIKit

/// Register the actual floating controls with iOS 26's scroll-edge system.
/// UIKit owns blur, contrast, appearance and accessibility adaptation instead
/// of blending a second, translucent copy of the web content over itself.
struct ShellScrollEdgeHeader: UIViewControllerRepresentable {
    let shell: AppCoordinator

    func makeUIViewController(context: Context) -> ShellScrollEdgeHeaderController {
        let controller = ShellScrollEdgeHeaderController(
            rootView: AnyView(ShellHeaderView().environmentObject(shell))
        )
        controller.loadViewIfNeeded()
        controller.bind(to: shell.shellScrollView)
        return controller
    }

    func updateUIViewController(_ controller: ShellScrollEdgeHeaderController, context: Context) {
        controller.rootView = AnyView(ShellHeaderView().environmentObject(shell))
        controller.bind(to: shell.shellScrollView)
    }

    static func dismantleUIViewController(_ controller: ShellScrollEdgeHeaderController, coordinator: ()) {
        // Removing this header's contribution leaves transactions unobscured.
        // Never hide the shared edge effect: a replacement header may already
        // be mounted while this controller finishes its removal transition.
        controller.bind(to: nil)
    }
}

final class ShellScrollEdgeHeaderController: UIHostingController<AnyView> {
    private let edgeInteraction = UIScrollEdgeElementContainerInteraction()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        // NativeShellOverlay already positions the controls below the island.
        safeAreaRegions = []
        edgeInteraction.edge = .top
        view.addInteraction(edgeInteraction)
    }

    func bind(to scrollView: UIScrollView?) {
        if edgeInteraction.scrollView !== scrollView {
            edgeInteraction.scrollView = scrollView
        }
        scrollView?.topEdgeEffect.style = .soft
    }
}
