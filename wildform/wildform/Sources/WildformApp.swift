import SwiftUI

@main
struct WildformApp: App {
    @StateObject private var game = GameStore()
    @StateObject private var location = LocationManager()
    @StateObject private var pedometer = PedometerManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(game)
                .environmentObject(location)
                .environmentObject(pedometer)
                .task {
                    location.requestPermission()
                    pedometer.start()
                }
                .onReceive(pedometer.$steps) { steps in
                    game.syncSteps(steps)
                }
        }
    }
}
