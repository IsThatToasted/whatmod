import SwiftUI
import WebKit

private let appURL = URL(string: "https://whatmod.com/life/")!

struct ContentView: View {
    @State private var isOffline = false
    var body: some View {
        ZStack(alignment: .top) {
            JustGlanceWebView(isOffline: $isOffline)
                .ignoresSafeArea(.container, edges: .bottom)
            if isOffline {
                Text("You’re offline. Saved changes will sync when your connection returns.")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
            }
        }
    }
}

struct JustGlanceWebView: UIViewRepresentable {
    @Binding var isOffline: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .automatic
        web.isOpaque = false
        web.backgroundColor = .clear
        web.customUserAgent = "JustGlance-iOS/1.0"
        context.coordinator.webView = web
        web.load(URLRequest(url: appURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 30))
        return web
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        var parent: JustGlanceWebView
        weak var webView: WKWebView?

        init(_ parent: JustGlanceWebView) {
            self.parent = parent
            super.init()
            NotificationCenter.default.addObserver(self, selector: #selector(handleAuthCallback(_:)), name: .justGlanceAuthCallback, object: nil)
        }

        deinit { NotificationCenter.default.removeObserver(self) }

        @objc private func handleAuthCallback(_ note: Notification) {
            guard let callback = note.object as? URL, callback.scheme == "justglance" else { return }
            var target = URLComponents(url: appURL, resolvingAgainstBaseURL: false)
            let callbackParts = URLComponents(url: callback, resolvingAgainstBaseURL: false)
            target?.queryItems = callbackParts?.queryItems
            target?.fragment = callbackParts?.fragment
            guard let url = target?.url else { return }
            DispatchQueue.main.async { [weak self] in self?.webView?.load(URLRequest(url: url)) }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { parent.isOffline = false }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { parent.isOffline = true }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { parent.isOffline = true }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.host == "whatmod.com" || url.host?.hasSuffix("supabase.co") == true || url.scheme == "about" {
                decisionHandler(.allow)
            } else if ["http","https","mailto","tel"].contains(url.scheme ?? "") {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
