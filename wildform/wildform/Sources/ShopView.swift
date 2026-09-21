import SwiftUI

struct ShopView: View {
    @EnvironmentObject private var game: GameStore
    @State private var selectedSlot: CosmeticSlot = .head
    @State private var selectedItem: CosmeticItem?

    var body: some View {
        ZStack {
            WildBackground()
            ScrollView {
                VStack(spacing: 16) {
                    header
                    preview
                    categoryPicker
                    catalog
                    economyNote
                }
                .padding()
            }
        }
        .navigationTitle("Wild Shop")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedItem) { item in
            CosmeticDetailSheet(item: item)
                .environmentObject(game)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("MAKE IT YOURS")
                        .font(.caption.bold())
                        .tracking(2)
                        .foregroundStyle(Color.wfMint)
                    Text("Cosmetics never change combat power.")
                        .font(.subheadline.weight(.semibold))
                }
                Spacer()
                CurrencyChip(icon: "diamond.fill", value: game.state.lumens)
            }
            Text("Earn Lumens by walking and winning encounters. Cosmetic layers are equipped independently from your creature's species and procedural biology.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panel(emphasized: true)
    }

    private var preview: some View {
        VStack(spacing: 4) {
            CreatureView(state: game.state, size: 176)
            Text(game.state.creatureName)
                .font(.title3.bold())
            Text("Current look")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CosmeticSlot.allCases) { slot in
                    Button {
                        selectedSlot = slot
                        FeedbackManager.shared.play(.tap, enabled: game.state.soundEnabled)
                    } label: {
                        Text(slot.rawValue)
                            .font(.subheadline.bold())
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(selectedSlot == slot ? Color.wfPurple : Color.wfPanel, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var catalog: some View {
        LazyVStack(spacing: 10) {
            ForEach(CosmeticItem.catalog.filter { $0.slot == selectedSlot }) { item in
                CosmeticRow(item: item, owned: game.isOwned(item), equipped: game.isEquipped(item)) {
                    selectedItem = item
                }
            }
        }
    }

    private var economyNote: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Shop foundation", systemImage: "wand.and.stars")
                .font(.headline)
            Text("This demo uses earned Lumens only. The data model already separates cosmetics from biology so later we can support seasonal cosmetics, drops, achievements, and an optional premium currency without selling combat power.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panel()
    }
}

private struct CosmeticRow: View {
    let item: CosmeticItem
    let owned: Bool
    let equipped: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(rarityTint.opacity(0.15))
                        .frame(width: 52, height: 52)
                    Image(systemName: item.icon)
                        .font(.title3)
                        .foregroundStyle(rarityTint)
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(item.name).font(.headline)
                        Text(item.rarity.rawValue.uppercased())
                            .font(.system(size: 8, weight: .black))
                            .foregroundStyle(rarityTint)
                    }
                    Text(item.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
                if equipped {
                    Text("EQUIPPED")
                        .font(.caption2.bold())
                        .foregroundStyle(Color.wfMint)
                } else if owned {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.wfMint)
                } else {
                    CurrencyChip(icon: "diamond.fill", value: item.cost)
                }
            }
            .padding(12)
            .background(Color.wfPanel.opacity(0.88), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(rarityTint.opacity(0.16)))
        }
        .buttonStyle(.plain)
    }

    private var rarityTint: Color {
        switch item.rarity {
        case .common: return .wfMint
        case .rare: return .cyan
        case .mythic: return .wfPink
        }
    }
}

private struct CosmeticDetailSheet: View {
    @EnvironmentObject private var game: GameStore
    @Environment(\.dismiss) private var dismiss
    let item: CosmeticItem

    var body: some View {
        ZStack {
            Color.wfBackground.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: item.icon)
                    .font(.system(size: 42, weight: .bold))
                    .foregroundStyle(Color.wfMint)
                    .frame(width: 84, height: 84)
                    .background(Color.wfPanel, in: RoundedRectangle(cornerRadius: 24))

                VStack(spacing: 4) {
                    Text(item.name).font(.title2.bold())
                    Text("\(item.rarity.rawValue) • \(item.slot.rawValue)")
                        .foregroundStyle(.secondary)
                }

                Text(item.description)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                actionButton
            }
            .padding(24)
        }
    }

    @ViewBuilder private var actionButton: some View {
        if game.isEquipped(item) {
            Label("Currently equipped", systemImage: "checkmark.circle.fill")
                .foregroundStyle(Color.wfMint)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.wfPanel, in: RoundedRectangle(cornerRadius: 16))
        } else if game.isOwned(item) {
            Button("Equip \(item.name)") {
                game.equip(item)
                FeedbackManager.shared.play(.purchase, enabled: game.state.soundEnabled)
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.wfPurple)
            .controlSize(.large)
        } else {
            Button {
                if game.purchase(item) {
                    FeedbackManager.shared.play(.purchase, enabled: game.state.soundEnabled)
                    dismiss()
                }
            } label: {
                HStack {
                    Text("Unlock")
                    Spacer()
                    CurrencyChip(icon: "diamond.fill", value: item.cost)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(game.state.lumens >= item.cost ? Color.wfPurple : Color.gray)
            .controlSize(.large)
            .disabled(game.state.lumens < item.cost)
        }
    }
}
