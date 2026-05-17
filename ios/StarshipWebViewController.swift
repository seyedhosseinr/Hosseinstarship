// StarshipWebViewController.swift
// Starship Reader — WKWebView host with Pencil Pro bridge wired in
//
// Drop this view-controller into your iOS app target.
// Set `appURL` to your deployed Next.js URL (or localhost during dev).
// The pencil bridge is attached automatically on iOS 17.5+.

import UIKit
import WebKit

// MARK: - StarshipWebViewController

final class StarshipWebViewController: UIViewController {

    // ── Configuration ─────────────────────────────────────────────────────────

    /// The URL loaded into the WKWebView.
    /// Override in a subclass or set after init for flexibility.
    var appURL: URL = URL(string: "https://your-starship-app.com")! {
        didSet { loadApp() }
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private var webView: WKWebView!
    private var pencilBridge: AnyObject?   // type-erased; conditional on iOS 17.5

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        buildWebView()
        attachPencilBridge()
        loadApp()
    }

    // ── WKWebView setup ───────────────────────────────────────────────────────

    private func buildWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback  = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Allow the page to query device capabilities
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        // Disable the long-press link-preview that interferes with drawing
        webView.allowsLinkPreview = false

        view.addSubview(webView)
    }

    // ── Apple Pencil Pro bridge ───────────────────────────────────────────────

    private func attachPencilBridge() {
        if #available(iOS 17.5, *) {
            let bridge = StarshipPencilBridge()
            bridge.attach(to: view, webView: webView)
            // Keep a strong reference so the bridge is not deallocated.
            pencilBridge = bridge
        }
        // On older iOS: squeeze events are simply never fired → palette never opens.
        // The web app gracefully handles the absence of "starship:pencil-squeeze".
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    private func loadApp() {
        guard isViewLoaded, let wv = webView else { return }
        var request = URLRequest(url: appURL)
        request.cachePolicy = .useProtocolCachePolicy
        wv.load(request)
    }
}

// MARK: - WKNavigationDelegate

extension StarshipWebViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject a small JS flag so the web app knows it's inside a native shell
        // and that the pencil bridge is available on iOS 17.5+.
        let available = pencilBridge != nil
        webView.evaluateJavaScript(
            "window.__starshipNativeBridge = { pencilSqueezeAvailable: \(available) };",
            completionHandler: nil
        )
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // Allow navigation within the app domain; open external links in Safari.
        if let host = navigationAction.request.url?.host,
           host == appURL.host {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated,
                  let url = navigationAction.request.url {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
}
