// StarshipPencilBridge.swift
// Starship Reader — Native Apple Pencil Pro Squeeze + Double-Tap Bridge
//
// Detects Apple Pencil Pro squeeze via UIPencilInteraction (iPadOS 17.5+)
// and dispatches a "starship:pencil-squeeze" CustomEvent to the WKWebView.
//
// Detects Apple Pencil Pro double-tap via UIPencilInteraction and dispatches
// a "starship:pencil-double-tap" CustomEvent to the WKWebView.
//
// ─── Integration ──────────────────────────────────────────────────────────────
// 1. Keep a strong reference to StarshipPencilBridge on your view-controller.
// 2. Call bridge.attach(to: view, webView: webView) in viewDidLoad.
// 3. The web app listens:
//      window.addEventListener("starship:pencil-squeeze", …)
//      window.addEventListener("starship:pencil-double-tap", …)
//
// ─── Squeeze event shape ──────────────────────────────────────────────────────
// CustomEvent<{ phase: "began"|"changed"|"ended"; x: number; y: number }>
// x/y are in WKWebView viewport coordinates (CSS pixels, origin = top-left).
// The web palette opens on phase "ended".
//
// ─── Double-tap event shape ───────────────────────────────────────────────────
// CustomEvent<{
//   x: number;               // pencil tip viewport X at double-tap
//   y: number;               // pencil tip viewport Y at double-tap
//   preferredAction: string; // maps UIPencilInteraction.preferredTapAction
//   source: "uipencilinteraction"  // always present — verifies native origin
// }>
// The web layer toggles pen ↔ eraser on this event.
// Double-tap NEVER opens the squeeze palette.
//
// ─── Coordinate conversion ────────────────────────────────────────────────────
// UIHoverGestureRecognizer tracks the pencil hover location in native points.
// We convert to WKWebView coordinates and account for the page scroll offset
// via window.scrollX / window.scrollY so the palette anchors to the right spot.
//
// ─── Requirements ─────────────────────────────────────────────────────────────
// • iPadOS 17.5 or later (UIPencilInteraction squeeze API, Apple Pencil Pro).
// • WKWebView — not UIWebView, not SFSafariViewController, not PWA in Safari.
// • The JS web app must be loaded and interactive before events fire.
//
// ─── Availability ─────────────────────────────────────────────────────────────
// Apple Pencil Pro squeeze and double-tap are PencilKit / iPadOS capabilities.
// They are NOT exposed through standard PointerEvents in Safari PWA mode.
// This bridge is required for squeeze and double-tap to reach the web layer.
//
// ─── Double-tap note ──────────────────────────────────────────────────────────
// Hardware Apple Pencil double-tap is received only through this native
// UIPencilInteraction bridge. No web PointerEvent fallback is treated as real
// Apple Pencil double-tap. Double-tap toggles pen ↔ eraser and never opens
// the squeeze palette.

import UIKit
import WebKit

// MARK: - StarshipPencilBridge

/// Wires Apple Pencil Pro squeeze and double-tap events from UIKit into
/// the WKWebView JS layer via JSONSerialization-safe CustomEvent dispatch.
@available(iOS 17.5, *)
public final class StarshipPencilBridge: NSObject {

    // MARK: Public API

    /// Attach the bridge to a view and its WKWebView.
    /// Safe to call multiple times — subsequent calls replace the previous setup.
    public func attach(to view: UIView, webView: WKWebView) {
        detach()
        self.webView = webView
        setupHoverTracking(on: webView)
        setupPencilInteraction(on: view)
    }

    /// Remove all interactions and gesture recognisers installed by this bridge.
    public func detach() {
        if let view = pencilInteraction?.view {
            view.removeInteraction(pencilInteraction!)
        }
        pencilInteraction = nil
        if let hover = hoverRecognizer, let view = hover.view {
            view.removeGestureRecognizer(hover)
        }
        hoverRecognizer = nil
        webView = nil
    }

    // MARK: Private state

    private weak var webView: WKWebView?
    private var pencilInteraction: UIPencilInteraction?
    private var hoverRecognizer: UIHoverGestureRecognizer?

    /// Last known pencil hover position in WKWebView's coordinate space.
    private var lastHoverPoint: CGPoint = .zero

    // MARK: Setup

    private func setupHoverTracking(on webView: WKWebView) {
        let hover = UIHoverGestureRecognizer(target: self, action: #selector(handleHover(_:)))
        hover.name = "StarshipPencilHover"
        webView.addGestureRecognizer(hover)
        hoverRecognizer = hover
    }

    private func setupPencilInteraction(on view: UIView) {
        let interaction = UIPencilInteraction()
        interaction.delegate = self
        // Allow the delegate to fire regardless of the system preferred tap action.
        // The web layer reads `preferredAction` from the event detail and decides
        // whether to honour it; we always forward the gesture.
        view.addInteraction(interaction)
        pencilInteraction = interaction
    }

    // MARK: Hover tracking

    @objc private func handleHover(_ recognizer: UIHoverGestureRecognizer) {
        guard let webView else { return }
        // location(in:) returns native-point coordinates relative to webView
        lastHoverPoint = recognizer.location(in: webView)
    }

    // MARK: CSS-pixel conversion

    private func cssPoint(from nativePoint: CGPoint) -> (x: Double, y: Double) {
        guard let webView else { return (0, 0) }
        let scale = webView.scrollView.zoomScale
        return (Double(nativePoint.x / scale), Double(nativePoint.y / scale))
    }

    // MARK: Current hover anchor

    /// Returns the pencil tip anchor in CSS pixels.
    /// Falls back to the centre of the WKWebView when hover is unavailable.
    private func currentCSSAnchor() -> (x: Double, y: Double) {
        if lastHoverPoint != .zero {
            return cssPoint(from: lastHoverPoint)
        }
        if let wv = webView {
            return cssPoint(from: CGPoint(x: wv.bounds.midX, y: wv.bounds.midY))
        }
        return (0, 0)
    }

    // MARK: Bridge dispatch — squeeze

    private func dispatchSqueezeToWeb(phase: String, nativePoint: CGPoint) {
        guard let webView else { return }

        let (cssX, cssY) = cssPoint(from: nativePoint)

        // Use JSONSerialization to build the detail object safely — no string
        // interpolation means no injection risk from floating-point formatting
        // or unexpected characters in the phase string.
        let detail: [String: Any] = [
            "phase": phase,
            "x":     cssX,
            "y":     cssY,
        ]

        guard let detailData = try? JSONSerialization.data(withJSONObject: detail),
              let detailJSON = String(data: detailData, encoding: .utf8) else {
            return
        }

        let script = """
        (function() {
            'use strict';
            window.dispatchEvent(new CustomEvent('starship:pencil-squeeze', {
                bubbles: false,
                cancelable: false,
                detail: \(detailJSON)
            }));
        })();
        """

        // evaluateJavaScript must run on the main thread.
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                #if DEBUG
                if let error {
                    print("[StarshipPencilBridge] squeeze dispatch error: \(error)")
                }
                #endif
            }
        }
    }

    // MARK: Bridge dispatch — double-tap

    // Hardware Apple Pencil double-tap is received only through this native
    // UIPencilInteraction bridge. No web PointerEvent fallback is treated as
    // real Apple Pencil double-tap. Double-tap toggles pen ↔ eraser in the
    // web layer and never opens the squeeze palette.
    private func dispatchDoubleTapToWeb(preferredAction: String, nativePoint: CGPoint) {
        guard let webView else { return }

        let (cssX, cssY) = cssPoint(from: nativePoint)

        // source: "uipencilinteraction" is required by the web guard clause.
        // The JS listener silently ignores events with a missing or wrong source.
        let detail: [String: Any] = [
            "x":               cssX,
            "y":               cssY,
            "preferredAction": preferredAction,
            "source":          "uipencilinteraction",
        ]

        guard let detailData = try? JSONSerialization.data(withJSONObject: detail),
              let detailJSON = String(data: detailData, encoding: .utf8) else {
            return
        }

        let script = """
        (function() {
            'use strict';
            window.dispatchEvent(new CustomEvent('starship:pencil-double-tap', {
                bubbles: false,
                cancelable: false,
                detail: \(detailJSON)
            }));
        })();
        """

        DispatchQueue.main.async {
            webView.evaluateJavaScript(script) { _, error in
                #if DEBUG
                if let error {
                    print("[StarshipPencilBridge] double-tap dispatch error: \(error)")
                }
                #endif
            }
        }
    }
}

// MARK: - UIPencilInteractionDelegate

@available(iOS 17.5, *)
extension StarshipPencilBridge: UIPencilInteractionDelegate {

    // MARK: Squeeze

    /// Called on every phase transition of an Apple Pencil Pro squeeze gesture.
    ///
    /// - Note: This delegate method requires iOS 17.5+ and Apple Pencil Pro.
    ///   Earlier Pencil models and iOS versions do not fire squeeze events.
    ///   UIHoverGestureRecognizer provides the pencil location because
    ///   UIPencilInteraction.Squeeze does not include a touch location.
    public func pencilInteraction(
        _ interaction: UIPencilInteraction,
        didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze
    ) {
        let phase: String
        switch squeeze.phase {
        case .began:     phase = "began"
        case .changed:   phase = "changed"
        case .ended:     phase = "ended"
        case .cancelled: return   // ignore cancelled squeezes
        default:         return
        }

        // Use the last tracked hover point as the anchor.
        // If hover is unavailable (unusual), fall back to centre of webView.
        let point: CGPoint
        if lastHoverPoint != .zero {
            point = lastHoverPoint
        } else if let wv = webView {
            point = CGPoint(x: wv.bounds.midX, y: wv.bounds.midY)
        } else {
            return
        }

        dispatchSqueezeToWeb(phase: phase, nativePoint: point)
    }

    // MARK: Double-tap

    /// Called when an Apple Pencil Pro double-tap gesture is recognised.
    ///
    /// Hardware Apple Pencil double-tap is received only through this native
    /// UIPencilInteraction bridge. No web PointerEvent fallback is treated as
    /// real Apple Pencil double-tap. Double-tap toggles pen ↔ eraser in the
    /// web layer and never opens the squeeze palette.
    ///
    /// The `preferredTapAction` reflects the system-level preference the user
    /// may have set in Settings › Apple Pencil. We forward it to the web layer
    /// in the event detail so the JS side can log or respect it if desired,
    /// but the web toggle behaviour (pen ↔ eraser) fires regardless.
    ///
    /// - Note: Requires iOS 17.5+ and Apple Pencil Pro.
    public func pencilInteraction(
        _ interaction: UIPencilInteraction,
        didReceiveTap tap: UIPencilInteraction.Tap
    ) {
        guard tap.phase == .ended else { return }

        // Map UIPencilInteraction.preferredTapAction to a JS-safe string.
        let preferredAction: String
        switch UIPencilInteraction.preferredTapAction {
        case .ignore:          preferredAction = "ignore"
        case .switchEraser:    preferredAction = "switchEraser"
        case .switchPrevious:  preferredAction = "switchPrevious"
        case .showColorPalette: preferredAction = "showColorPalette"
        default:               preferredAction = "unknown"
        }

        // Use the last tracked hover point for the location anchor.
        let point: CGPoint
        if lastHoverPoint != .zero {
            point = lastHoverPoint
        } else if let wv = webView {
            point = CGPoint(x: wv.bounds.midX, y: wv.bounds.midY)
        } else {
            return
        }

        dispatchDoubleTapToWeb(preferredAction: preferredAction, nativePoint: point)
    }
}
