import SwiftUI

@main
struct ScooterCastApp: App {
    var body: some Scene {
        WindowGroup {
            RiderHomeView()
                .preferredColorScheme(.dark)
        }
    }
}
