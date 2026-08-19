import SwiftUI
import WebKit
import AuthenticationServices
import UserNotifications
import StoreKit

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
        config.userContentController.add(context.coordinator, name: "nativeStoreKit")

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
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeStoreKit")
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

            if message.name == "nativeStoreKit" {
                switch action {
                case "listProducts":
                    let ids = body["productIds"] as? [String] ?? []
                    Task { await listStoreProducts(ids) }
                case "purchase":
                    if let productId = body["productId"] as? String { Task { await purchaseStoreProduct(productId) } }
                case "restore":
                    // Explicit user action only. AppStore.sync() may ask for Apple credentials.
                    Task { await restoreStorePurchases() }
                case "refreshEntitlements":
                    // Passive startup/foreground refresh. Never calls AppStore.sync().
                    Task { await refreshStoreEntitlements() }
                default:
                    break
                }
            }
        }

        @MainActor
        private func listStoreProducts(_ ids: [String]) async {
            do {
                let loaded = try await Product.products(for: ids)
                let rows: [[String: Any]] = loaded.map { p in
                    ["id": p.id, "displayName": p.displayName, "description": p.description, "displayPrice": p.displayPrice]
                }
                sendStoreKitJS("productsLoaded", payload: rows)
            } catch {
                sendStoreKitJS("purchaseFailed", payload: error.localizedDescription)
            }
        }

        @MainActor
        private func purchaseStoreProduct(_ productId: String) async {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    sendStoreKitJS("purchaseFailed", payload: "This purchase is not available in the current App Store configuration.")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        sendStoreTransaction(transaction, callback: "purchaseCompleted")
                        await transaction.finish()
                    case .unverified(_, let error):
                        sendStoreKitJS("purchaseFailed", payload: "Apple could not verify this purchase: \(error.localizedDescription)")
                    }
                case .pending:
                    sendStoreKitJS("purchasePending", payload: NSNull())
                case .userCancelled:
                    sendStoreKitJS("purchaseCancelled", payload: NSNull())
                @unknown default:
                    sendStoreKitJS("purchaseFailed", payload: "Unknown purchase result.")
                }
            } catch {
                sendStoreKitJS("purchaseFailed", payload: error.localizedDescription)
            }
        }

        @MainActor
        private func currentStoreEntitlementRows() async -> [[String: Any]] {
            var rows: [[String: Any]] = []
            for await result in StoreKit.Transaction.currentEntitlements {
                if case .verified(let transaction) = result {
                    rows.append(storeTransactionPayload(transaction))
                }
            }
            return rows
        }

        @MainActor
        private func refreshStoreEntitlements() async {
            // Apple documents currentEntitlements as available without forcing an
            // App Store credential prompt. Use this for launch/foreground refresh.
            let rows = await currentStoreEntitlementRows()
            sendStoreKitJS("entitlementsLoaded", payload: rows)
        }

        @MainActor
        private func restoreStorePurchases() async {
            // AppStore.sync() can display Apple's sign-in sheet, therefore this
            // method is called ONLY after the user taps Restore Purchases.
            do { try await AppStore.sync() } catch { /* still read local entitlements */ }
            let rows = await currentStoreEntitlementRows()
            sendStoreKitJS("entitlementsLoaded", payload: rows)
        }

        private func storeTransactionPayload(_ transaction: StoreKit.Transaction) -> [String: Any] {
            let iso = ISO8601DateFormatter()
            var row: [String: Any] = [
                "productId": transaction.productID,
                "transactionId": String(transaction.id),
                "originalTransactionId": String(transaction.originalID)
            ]
            if let expirationDate = transaction.expirationDate { row["expirationDate"] = iso.string(from: expirationDate) }
            return row
        }

        @MainActor
        private func sendStoreTransaction(_ transaction: StoreKit.Transaction, callback: String) {
            sendStoreKitJS(callback, payload: storeTransactionPayload(transaction))
        }

        @MainActor
        private func sendStoreKitJS(_ callback: String, payload: Any) {
            guard let webView,
                  let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.WeTrackStoreKit && window.WeTrackStoreKit.\(callback)(\(json));")
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


        // WKWebView does not present JavaScript alert/confirm dialogs unless the
        // host app implements WKUIDelegate. These are used by destructive actions
        // such as deleting a memory or trip.
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "WeTrack", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(alert)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "Please confirm", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "Delete", style: .destructive) { _ in completionHandler(true) })
            present(alert)
        }

        private func present(_ controller: UIViewController) {
            guard let root = webView?.window?.rootViewController else { return }
            var presenter = root
            while let shown = presenter.presentedViewController { presenter = shown }
            presenter.present(controller, animated: true)
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

            // V3.1: explicit event-card map buttons should open the native/external
            // mapping app instead of navigating the embedded WeTrack web view.
            let host = requestURL.host?.lowercased() ?? ""
            if host == "maps.apple.com" ||
               host == "www.google.com" && requestURL.path.hasPrefix("/maps/") ||
               host == "google.com" && requestURL.path.hasPrefix("/maps/") ||
               host == "waze.com" || host == "www.waze.com" {
                UIApplication.shared.open(requestURL, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }

            // target=_blank links have no separate browser inside this wrapper.
            // Open external links with the system instead.
            if navigationAction.targetFrame == nil,
               let scheme = requestURL.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                UIApplication.shared.open(requestURL, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }
    }
}
