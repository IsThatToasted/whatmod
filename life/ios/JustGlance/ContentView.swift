import SwiftUI
import WebKit
import UserNotifications

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
        config.userContentController.add(context.coordinator, name: "justglanceNative")
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__JUSTGLANCE_NATIVE__={platform:'ios',localNotifications:true,version:'2.0'};",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .automatic
        web.isOpaque = false
        web.backgroundColor = .clear
        web.customUserAgent = "JustGlance-iOS/2.0"
        context.coordinator.webView = web
        web.load(URLRequest(url: appURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 30))
        return web
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "justglanceNative")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
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

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "justglanceNative", let payload = message.body as? [String: Any], let type = payload["type"] as? String else { return }
            switch type {
            case "scheduleReminder": scheduleReminder(payload)
            case "cancelReminder":
                if let id = payload["id"] as? String {
                    UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
                    UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [id])
                }
            case "requestNotificationPermission": requestNotificationPermission()
            default: break
            }
        }

        private func requestNotificationPermission(_ completion: ((Bool) -> Void)? = nil) {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in completion?(granted) }
        }

        private func scheduleReminder(_ payload: [String: Any]) {
            guard let id = payload["id"] as? String,
                  let title = payload["title"] as? String,
                  let fireAt = payload["fireAt"] as? String else { return }

            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let fallback = ISO8601DateFormatter()
            guard let date = formatter.date(from: fireAt) ?? fallback.date(from: fireAt) else { return }

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = (payload["body"] as? String) ?? "Open JustGlance for the details."
            content.sound = .default
            content.userInfo = ["justglanceReminderId": id]

            let interval = max(1, date.timeIntervalSinceNow)
            let request = UNNotificationRequest(identifier: id, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false))

            requestNotificationPermission { granted in
                guard granted else { return }
                UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
                UNUserNotificationCenter.current().add(request)
            }
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
