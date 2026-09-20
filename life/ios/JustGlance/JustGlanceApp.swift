import SwiftUI

extension Notification.Name {
    static let justGlanceAuthCallback = Notification.Name("JustGlanceAuthCallback")
}

@main
struct JustGlanceApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(nil)
                .onOpenURL { url in
                    NotificationCenter.default.post(name: .justGlanceAuthCallback, object: url)
                }
        }
    }
}
