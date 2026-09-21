import SwiftUI

struct InventoryView: View {
    @EnvironmentObject private var game: GameStore
    @State private var showReset = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                summarySection
                inventoryPanel
                savePanel
            }
            .padding()
        }
        .background(Color.wfBackground.ignoresSafeArea())
        .navigationTitle("Pack")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Reset Wildform demo?", isPresented: $showReset) {
            Button("Reset", role: .destructive) { game.resetDemo() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This removes the local prototype progression on this device.")
        }
    }

    private var summarySection: some View {
        HStack(spacing: 12) {
            SummaryCard(title: "Battles", value: "\(game.state.battles)", icon: "shield.lefthalf.filled")
            SummaryCard(title: "Wins", value: "\(game.state.wins)", icon: "trophy.fill")
            SummaryCard(title: "Win rate", value: "\(game.state.winRate)%", icon: "chart.line.uptrend.xyaxis")
        }
    }

    private var inventoryPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Pack inventory")
                    .font(.headline)
                Spacer()
                Text("\(inventoryCount) items")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if game.state.inventory.isEmpty {
                ContentUnavailableView(
                    "Your pack is empty",
                    systemImage: "backpack",
                    description: Text("Win wild encounters to collect resources and evolution materials.")
                )
                .frame(minHeight: 220)
            } else {
                ForEach(game.state.inventory.keys.sorted(), id: \.self) { key in
                    InventoryRow(
                        name: key,
                        count: game.state.inventory[key, default: 0],
                        icon: icon(for: key)
                    )
                }
            }
        }
        .panel()
    }

    private var savePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Prototype save")
                .font(.headline)
            Text("Progress is stored locally with UserDefaults in this demo. The production build can migrate this state into Supabase accounts and cloud saves.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Reset demo progress", role: .destructive) {
                showReset = true
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panel()
    }

    private var inventoryCount: Int {
        game.state.inventory.values.reduce(0, +)
    }

    private func icon(for item: String) -> String {
        if item.contains("Ember") { return "flame.fill" }
        if item.contains("Verdant") { return "leaf.fill" }
        if item.contains("Tide") { return "drop.fill" }
        if item.contains("Charged") { return "bolt.fill" }
        if item.contains("Night") { return "moon.fill" }
        if item.contains("Fang") { return "pawprint.fill" }
        return "diamond.fill"
    }
}

private struct InventoryRow: View {
    let name: String
    let count: Int
    let icon: String

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(Color.wfMint)
                    .frame(width: 28)
                Text(name)
                Spacer()
                Text("×\(count)")
                    .font(.headline.monospacedDigit())
            }
            .padding(.vertical, 4)

            Divider().opacity(0.2)
        }
    }
}

private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 7) {
            Image(systemName: icon)
                .foregroundStyle(Color.wfMint)
            Text(value)
                .font(.title3.bold())
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.wfPanel, in: RoundedRectangle(cornerRadius: 18))
    }
}
