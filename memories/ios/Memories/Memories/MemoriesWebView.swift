import SwiftUI
import WebKit

struct MemoriesWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var loadFailed: Bool
    let reloadToken: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.applicationNameForUserAgent = "Memories-iOS/1.0"
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.scrollView.keyboardDismissMode = .interactive
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.035, green: 0.043, blue: 0.086, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = UIColor(red: 0.62, green: 0.49, blue: 1.0, alpha: 1)
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        context.coordinator.webView = webView
        context.coordinator.lastReloadToken = reloadToken
        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: MemoriesWebView
        weak var webView: WKWebView?
        var lastReloadToken = 0

        init(_ parent: MemoriesWebView) {
            self.parent = parent
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            webView?.reload()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                sender.endRefreshing()
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = true
                self.parent.loadFailed = false
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadFailed = false
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        private func handleFailure(_ error: Error) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            webView?.scrollView.refreshControl?.endRefreshing()
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.loadFailed = true
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let destination = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            if let scheme = destination.scheme?.lowercased(), ["tel", "mailto", "sms"].contains(scheme) {
                UIApplication.shared.open(destination)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            guard let controller = webView.closestViewController else {
                completionHandler()
                return
            }
            let alert = UIAlertController(title: "Memories", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            controller.present(alert, animated: true)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            guard let controller = webView.closestViewController else {
                completionHandler(false)
                return
            }
            let alert = UIAlertController(title: "Memories", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) })
            controller.present(alert, animated: true)
        }
    }
}

private extension UIView {
    var closestViewController: UIViewController? {
        var responder: UIResponder? = self
        while let current = responder {
            if let controller = current as? UIViewController { return controller }
            responder = current.next
        }
        return nil
    }
}
