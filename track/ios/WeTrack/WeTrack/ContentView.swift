import SwiftUI
import WebKit
import AuthenticationServices
import UserNotifications

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
        config.userContentController.add(context.coordinator, name: "nativeNotifications")

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        UNUserNotificationCenter.current().delegate = context.coordinator
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
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeNotifications")
        coordinator.authSession?.cancel()
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding, UNUserNotificationCenterDelegate {
        weak var webView: WKWebView?
        var authSession: ASWebAuthenticationSession?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }

            if message.name == "nativeAuth",
               action == "googleOAuth",
               let urlString = body["url"] as? String,
               let authURL = URL(string: urlString) {
                startAuthentication(url: authURL)
                return
            }

            if message.name == "nativeNotifications" {
                switch action {
                case "requestPermission":
                    requestNotificationPermission()
                case "replaceSchedule":
                    let reminders = body["reminders"] as? [[String: Any]] ?? []
                    replaceNotificationSchedule(reminders)
                default:
                    break
                }
            }
        }

        private func requestNotificationPermission() {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, _ in
                DispatchQueue.main.async {
                    self?.sendNotificationPermission(granted ? "authorized" : "denied")
                }
            }
        }

        private func replaceNotificationSchedule(_ reminders: [[String: Any]]) {
            let center = UNUserNotificationCenter.current()
            let identifiers = reminders.compactMap { $0["id"] as? String }
            center.getPendingNotificationRequests { [weak self] pending in
                let weTrackIds = pending.map(\.identifier).filter { $0.hasPrefix("wetrack:") }
                center.removePendingNotificationRequests(withIdentifiers: weTrackIds)

                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                let fallbackFormatter = ISO8601DateFormatter()
                fallbackFormatter.formatOptions = [.withInternetDateTime]
                let calendar = Calendar.current
                let group = DispatchGroup()

                for reminder in reminders.prefix(96) {
                    guard let rawId = reminder["id"] as? String,
                          let fireDateString = reminder["fireDate"] as? String,
                          let fireDate = formatter.date(from: fireDateString) ?? fallbackFormatter.date(from: fireDateString),
                          fireDate.timeIntervalSinceNow > 1 else { continue }

                    let content = UNMutableNotificationContent()
                    content.title = reminder["title"] as? String ?? "Upcoming trip event"
                    content.body = reminder["body"] as? String ?? "An event is coming up soon."
                    content.sound = .default
                    content.userInfo = [
                        "tripId": reminder["tripId"] as? String ?? "",
                        "itemId": reminder["itemId"] as? String ?? ""
                    ]
                    let components = calendar.dateComponents([.year,.month,.day,.hour,.minute,.second], from: fireDate)
                    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                    let request = UNNotificationRequest(identifier: "wetrack:\(rawId)", content: content, trigger: trigger)
                    group.enter()
                    center.add(request) { _ in group.leave() }
                }

                group.notify(queue: .main) {
                    self?.webView?.evaluateJavaScript("window.WeTrackNativeNotifications && window.WeTrackNativeNotifications.scheduleUpdated();")
                }
                _ = identifiers
            }
        }

        private func sendNotificationPermission(_ status: String) {
            guard let webView else { return }
            let value = Self.javascriptString(status)
            webView.evaluateJavaScript("window.WeTrackNativeNotifications && window.WeTrackNativeNotifications.permissionChanged(\(value));")
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


        func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
            completionHandler([.banner, .sound, .badge])
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
