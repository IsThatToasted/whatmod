import SwiftUI

@main
struct AureliumFieldApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            AuthGateView()
                .environment(model)
                .onOpenURL { url in
                    _ = AFNativeGoogleAuth.handleOpenURL(url)
                }
        }
    }
}
