import SwiftUI
import UIKit

struct ContentView: View {
    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.wfBackground)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Wildform", systemImage: "pawprint.fill") }

            NavigationStack { ExploreView() }
                .tabItem { Label("Explore", systemImage: "map.fill") }

            NavigationStack { EvolutionView() }
                .tabItem { Label("Evolve", systemImage: "sparkles") }

            NavigationStack { InventoryView() }
                .tabItem { Label("Pack", systemImage: "backpack.fill") }
        }
        .tint(.wfMint)
        .preferredColorScheme(.dark)
    }
}
