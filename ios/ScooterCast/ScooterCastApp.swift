import SwiftUI

@main
struct ScooterCastApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                RiderHomeView()
                    .tabItem {
                        Label("Ride", systemImage: "scooter")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gearshape.fill")
                    }
            }
            .preferredColorScheme(.dark)
        }
    }
}
