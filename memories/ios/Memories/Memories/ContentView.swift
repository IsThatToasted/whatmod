import SwiftUI
import Network

struct ContentView: View {
    @StateObject private var network = NetworkMonitor()
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var reloadToken = 0
    @State private var showLaunch = true

    private let appURL = URL(string: "https://whatmod.com/memories/")!

    var body: some View {
        ZStack {
            Color(red: 0.035, green: 0.043, blue: 0.086)
                .ignoresSafeArea()

            MemoriesWebView(
                url: appURL,
                isLoading: $isLoading,
                loadFailed: $loadFailed,
                reloadToken: reloadToken
            )
            .ignoresSafeArea(.container, edges: .bottom)
            .opacity(showLaunch ? 0 : 1)

            if showLaunch {
                LaunchView()
                    .transition(.opacity)
            }

            if !network.isConnected || loadFailed {
                OfflineView(
                    hasConnection: network.isConnected,
                    retry: {
                        loadFailed = false
                        isLoading = true
                        reloadToken += 1
                    }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.97)))
            }

            if isLoading && !showLaunch && network.isConnected && !loadFailed {
                VStack {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.08)
                    Text("Opening your archive…")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.66))
                        .padding(.top, 10)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.05) {
                withAnimation(.easeOut(duration: 0.45)) {
                    showLaunch = false
                }
            }
        }
    }
}

private struct LaunchView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.035, green: 0.043, blue: 0.086),
                    Color(red: 0.11, green: 0.09, blue: 0.20)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            Circle()
                .fill(Color(red: 0.49, green: 0.34, blue: 0.93).opacity(0.22))
                .frame(width: 330, height: 330)
                .blur(radius: 48)
                .offset(x: -130, y: -260)

            Circle()
                .fill(Color(red: 0.95, green: 0.45, blue: 0.67).opacity(0.15))
                .frame(width: 300, height: 300)
                .blur(radius: 55)
                .offset(x: 150, y: 290)

            VStack(spacing: 22) {
                MemoryMark()
                    .frame(width: 108, height: 108)

                VStack(spacing: 7) {
                    Text("Memories")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .tracking(-1.2)
                    Text("Every memory leads somewhere.")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.58))
                }
            }
            .foregroundStyle(.white)
        }
    }
}

private struct MemoryMark: View {
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(red: 0.62, green: 0.49, blue: 1.0), lineWidth: 7)
                .frame(width: 48, height: 48)
                .offset(x: -18, y: -12)
            Circle()
                .stroke(Color(red: 1.0, green: 0.55, blue: 0.72), lineWidth: 7)
                .frame(width: 48, height: 48)
                .offset(x: 18, y: -12)
            Circle()
                .stroke(Color(red: 0.43, green: 0.89, blue: 0.81), lineWidth: 7)
                .frame(width: 48, height: 48)
                .offset(y: 23)
        }
        .shadow(color: Color(red: 0.58, green: 0.40, blue: 1.0).opacity(0.35), radius: 22)
    }
}

private struct OfflineView: View {
    let hasConnection: Bool
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 76, height: 76)
                Image(systemName: hasConnection ? "arrow.clockwise" : "wifi.slash")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(Color(red: 0.65, green: 0.53, blue: 1.0))
            }

            VStack(spacing: 8) {
                Text(hasConnection ? "The archive did not open" : "You are offline")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                Text(hasConnection
                     ? "Memories could not reach the web app. Try again after the site is deployed."
                     : "Reconnect to continue syncing and exploring your private archive.")
                    .font(.system(size: 13, weight: .regular, design: .rounded))
                    .foregroundStyle(.white.opacity(0.62))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }

            Button(action: retry) {
                Label("Try again", systemImage: "arrow.clockwise")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.63, green: 0.50, blue: 1.0), Color(red: 0.46, green: 0.34, blue: 0.90)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: Capsule()
                    )
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(28)
        .frame(maxWidth: 350)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 1)
        )
        .padding(24)
    }
}

@MainActor
final class NetworkMonitor: ObservableObject {
    @Published private(set) var isConnected = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "Memories.NetworkMonitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
