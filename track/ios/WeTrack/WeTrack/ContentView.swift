import SwiftUI
import WebKit
import AuthenticationServices

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
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "nativeAuth")

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeAuth")
        coordinator.authSession?.cancel()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        weak var webView: WKWebView?
        var authSession: ASWebAuthenticationSession?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "nativeAuth",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String,
                  action == "googleOAuth",
                  let urlString = body["url"] as? String,
                  let authURL = URL(string: urlString) else {
                return
            }
            startAuthentication(url: authURL)
        }

        private func startAuthentication(url: URL) {
            authSession?.cancel()
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "wetrack") { [weak self] callbackURL, error in
                DispatchQueue.main.async {
                    if let callbackURL {
                        self?.sendCallbackToWeb(callbackURL)
                    } else if let error {
                        let nsError = error as NSError
                        if nsError.code != ASWebAuthenticationSessionError.canceledLogin.rawValue {
                            self?.sendCancellationToWeb(error.localizedDescription)
                        }
                    }
                    self?.authSession = nil
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            authSession = session
            if !session.start() {
                sendCancellationToWeb("Google sign-in could not be opened.")
                authSession = nil
            }
        }

        private func sendCallbackToWeb(_ callbackURL: URL) {
            guard let webView else { return }
            let value = Self.javascriptString(callbackURL.absoluteString)
            let script = "window.WeTrackNativeAuth && window.WeTrackNativeAuth.handleCallback(\(value));"
            webView.evaluateJavaScript(script) { _, error in
                if let error { print("WeTrack auth callback injection failed: \(error)") }
            }
        }

        private func sendCancellationToWeb(_ message: String) {
            guard let webView else { return }
            let value = Self.javascriptString(message)
            webView.evaluateJavaScript("window.WeTrackNativeAuth && window.WeTrackNativeAuth.authCancelled(\(value));")
        }

        private static func javascriptString(_ value: String) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: [value]),
                  let json = String(data: data, encoding: .utf8),
                  json.count >= 2 else { return "\"\"" }
            return String(json.dropFirst().dropLast())
        }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            if let window = webView?.window { return window }
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let requestURL = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Safety fallback: older cached web builds may still redirect the WKWebView
            // directly to Supabase OAuth. Convert that attempt into a system auth session.
            if requestURL.host?.contains("supabase.co") == true,
               requestURL.path.contains("/auth/v1/authorize") {
                var components = URLComponents(url: requestURL, resolvingAgainstBaseURL: false)
                var queryItems = components?.queryItems ?? []
                queryItems.removeAll { $0.name == "redirect_to" }
                queryItems.append(URLQueryItem(name: "redirect_to", value: "wetrack://auth-callback"))
                components?.queryItems = queryItems
                if let externalURL = components?.url {
                    startAuthentication(url: externalURL)
                    decisionHandler(.cancel)
                    return
                }
            }

            if requestURL.scheme == "wetrack" {
                sendCallbackToWeb(requestURL)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }
}
