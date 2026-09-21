import SwiftUI

struct InventoryView: View {
    @EnvironmentObject private var game: GameStore
    @State private var showReset = false

    var body: some View {
        ZStack {
            WildBackground()
            ScrollView {
                VStack(spacing: 16) {
                    summarySection
                    currencyPanel
                    inventoryPanel
                    wardrobePanel
                    savePanel
                }
                .padding()
            }
        }
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
        HStack(spacing: 10) {
            SummaryCard(title: "Battles", value: "\(game.state.battles)", icon: "shield.lefthalf.filled", tint: .cyan)
            SummaryCard(title: "Wins", value: "\(game.state.wins)", icon: "trophy.fill", tint: .wfGold)
            SummaryCard(title: "Win rate", value: "\(game.state.winRate)%", icon: "chart.line.uptrend.xyaxis", tint: .wfMint)
        }
    }

    private var currencyPanel: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("LUMENS").font(.caption2.bold()).tracking(1.3).foregroundStyle(Color.wfGold)
                Text(game.state.lumens.formatted()).font(.title2.bold().monospacedDigit())
                Text("Earned through movement & battles").font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "diamond.fill")
                .font(.system(size: 34))
                .foregroundStyle(Color.wfGold)
                .shadow(color: Color.wfGold.opacity(0.35), radius: 8)
        }
        .panel(emphasized: true)
    }

    private var inventoryPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Wild resources").font(.headline)
                Spacer()
                Text("\(inventoryCount) items").font(.caption).foregroundStyle(.secondary)
            }

            if game.state.inventory.isEmpty {
                ContentUnavailableView(
                    "Your pack is empty",
                    systemImage: "backpack",
                    description: Text("Win wild encounters to collect resources and evolution materials.")
                )
                .frame(minHeight: 190)
            } else {
                ForEach(game.state.inventory.keys.sorted(), id: \.self) { key in
                    InventoryRow(name: key, count: game.state.inventory[key, default: 0], icon: icon(for: key))
                }
            }
        }
        .panel()
    }

    private var wardrobePanel: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack {
                Text("Equipped cosmetics").font(.headline)
                Spacer()
                Text("\(game.state.ownedCosmetics.count) owned").font(.caption).foregroundStyle(.secondary)
            }
            ForEach(CosmeticSlot.allCases) { slot in
                HStack {
                    Text(slot.rawValue).foregroundStyle(.secondary)
                    Spacer()
                    Text(equippedName(for: slot)).font(.subheadline.weight(.semibold))
                }
                if slot != CosmeticSlot.allCases.last { Divider().opacity(0.18) }
            }
        }
        .panel()
    }

    private var savePanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Prototype save").font(.headline)
            Text("Progress, procedural genome, currency, purchases, and equipped cosmetics are stored locally. A later production milestone can migrate this model to Supabase cloud save without changing the gameplay-facing API.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Reset demo progress", role: .destructive) { showReset = true }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panel()
    }

    private var inventoryCount: Int { game.state.inventory.values.reduce(0, +) }

    private func equippedName(for slot: CosmeticSlot) -> String {
        guard let id = game.state.equippedCosmetics[slot],
              let item = CosmeticItem.catalog.first(where: { $0.id == id }) else { return "Natural" }
        return item.name
    }

    private func icon(for item: String) -> String {
        if item.contains("Ember") { return "flame.fill" }
        if item.contains("Verdant") { return "leaf.fill" }
        if item.contains("Tide") { return "drop.fill" }
        if item.contains("Charged") { return "bolt.fill" }
        if item.contains("Night") { return "moon.fill" }
        if item.contains("Fang") { return "pawprint.fill" }
        if item.contains("Mutation") { return "dna" }
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
                Image(systemName: icon).foregroundStyle(Color.wfMint).frame(width: 28)
                Text(name)
                Spacer()
                Text("×\(count)").font(.headline.monospacedDigit())
            }
            .padding(.vertical, 4)
            Divider().opacity(0.16)
        }
    }
}

private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(spacing: 7) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(value).font(.title3.bold()).minimumScaleFactor(0.75)
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Color.wfPanel.opacity(0.92), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.06)))
    }
}
