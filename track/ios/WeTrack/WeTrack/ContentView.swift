import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WeTrackWebView(url: URL(string: "https://whatmod.com/track/")!)
            .ignoresSafeArea(edges: .bottom)
    }
}

struct WeTrackWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let host = navigationAction.request.url?.host,
               host.contains("whatmod.com") || host.contains("supabase.co") || host.contains("google") || host.contains("apple") {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.allow)
        }
    }
}
