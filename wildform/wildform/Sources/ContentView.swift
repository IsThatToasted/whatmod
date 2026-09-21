import SwiftUI
import UIKit

struct ContentView: View {
    @EnvironmentObject private var game: GameStore

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Color.wfBackground)
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor.secondaryLabel
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

            NavigationStack { ShopView() }
                .tabItem { Label("Shop", systemImage: "bag.fill") }
        }
        .tint(Color.wfMint)
        .preferredColorScheme(.dark)
        .overlay(alignment: .top) {
            if let toast = game.toastText {
                ToastBanner(text: toast)
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { game.clearToast() }
                    .task(id: toast) {
                        try? await Task.sleep(nanoseconds: 2_200_000_000)
                        if game.toastText == toast { game.clearToast() }
                    }
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.78), value: game.toastText)
    }
}

private struct ToastBanner: View {
    let text: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "sparkles")
                .foregroundStyle(Color.wfMint)
            Text(text)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.12)))
        .shadow(color: .black.opacity(0.3), radius: 14, y: 6)
    }
}
