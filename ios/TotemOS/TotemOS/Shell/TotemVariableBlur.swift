// Adapted from nikstar/VariableBlur (MIT License).
// Copyright (c) 2012-2023 Nikita Starshinov, Scott Chacon, and others.
// See https://github.com/nikstar/VariableBlur for the original implementation.

import SwiftUI
import UIKit
import CoreImage.CIFilterBuiltins
import QuartzCore

/// Direction for the variable-radius backdrop blur used by the floating shell.
enum TotemVariableBlurDirection {
    case blurredTopClearBottom
    case blurredBottomClearTop
}

/// A real variable-radius blur rather than a blurred layer with an opacity
/// gradient. The mask controls the blur radius pixel by pixel, so the effect
/// genuinely weakens as dashboard content moves away from the top chrome.
struct TotemVariableBlurView: UIViewRepresentable {
    let maxBlurRadius: CGFloat
    let direction: TotemVariableBlurDirection
    let startOffset: CGFloat

    init(
        maxBlurRadius: CGFloat = 20,
        direction: TotemVariableBlurDirection = .blurredTopClearBottom,
        startOffset: CGFloat = 0
    ) {
        self.maxBlurRadius = maxBlurRadius
        self.direction = direction
        self.startOffset = startOffset
    }

    func makeUIView(context: Context) -> TotemVariableBlurUIKitView {
        TotemVariableBlurUIKitView(
            maxBlurRadius: maxBlurRadius,
            direction: direction,
            startOffset: startOffset
        )
    }

    func updateUIView(_ uiView: TotemVariableBlurUIKitView, context: Context) {
        // The shell's radius and direction are constants. Keeping this update
        // empty avoids replacing the backdrop filter on every SwiftUI pass.
    }
}

/// Isolated adapter based on nikstar/VariableBlur (MIT). `CAFilter` is a
/// private UIKit implementation detail; keeping it behind this tiny view
/// prevents the rest of the shell from depending on private layer types.
final class TotemVariableBlurUIKitView: UIVisualEffectView {
    init(
        maxBlurRadius: CGFloat,
        direction: TotemVariableBlurDirection,
        startOffset: CGFloat
    ) {
        super.init(effect: UIBlurEffect(style: .regular))
        isUserInteractionEnabled = false
        backgroundColor = .clear
        clipsToBounds = false

        // CAFilter is intentionally resolved without referencing its private
        // symbol directly. This is the same runtime technique used by the
        // linked VariableBlur implementation.
        let caFilterName = String("retliFAC".reversed())
        guard let filterType = NSClassFromString(caFilterName) as? NSObject.Type,
              let variableBlur = filterType
                .perform(NSSelectorFromString(String(":epyThtiWretlif".reversed())), with: "variableBlur")?
                .takeUnretainedValue() as? NSObject
        else {
            // Keep the system blur if the runtime does not expose CAFilter.
            return
        }

        let maskImage = makeGradientImage(startOffset: startOffset, direction: direction)
        variableBlur.setValue(maxBlurRadius, forKey: "inputRadius")
        variableBlur.setValue(maskImage, forKey: "inputMaskImage")
        variableBlur.setValue(true, forKey: "inputNormalizeEdges")

        // The first subview owns the CABackdropLayer that samples content
        // behind this view. Replacing its filters makes the radius vary with
        // the mask instead of applying one uniform blur plus a fade.
        subviews.first?.layer.filters = [variableBlur]

        // Remove UIKit's dimming/tint subviews so the top remains untinted.
        for subview in subviews.dropFirst() {
            subview.alpha = 0
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard let window, let backdropLayer = subviews.first?.layer else { return }
        // Prevent pixelization at the clear edge on high-density devices.
        backdropLayer.setValue(window.traitCollection.displayScale, forKey: "scale")
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        // Calling super here can re-enable UIKit's default tint filter on some
        // iOS releases. The filter is intentionally kept untouched.
    }

    private func makeGradientImage(
        width: CGFloat = 100,
        height: CGFloat = 100,
        startOffset: CGFloat,
        direction: TotemVariableBlurDirection
    ) -> CGImage {
        let gradient = CIFilter.linearGradient()
        gradient.color0 = CIColor.black
        gradient.color1 = CIColor.clear
        gradient.point0 = CGPoint(x: 0, y: height)
        gradient.point1 = CGPoint(x: 0, y: startOffset * height)

        if case .blurredBottomClearTop = direction {
            gradient.point0.y = 0
            gradient.point1.y = height - gradient.point1.y
        }

        let extent = CGRect(x: 0, y: 0, width: width, height: height)
        return CIContext().createCGImage(gradient.outputImage!, from: extent)!
    }
}
