import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var game: GameStore
    @EnvironmentObject private var pedometer: PedometerManager
    @State private var editingName = false
    @State private var nameDraft = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(spacing: 2) {
                    Text("WILDFORM")
                        .font(.system(size: 13, weight: .black, design: .rounded))
                        .tracking(4)
                        .foregroundStyle(Color.wfMint)
                    Text("Walk. Adapt. Evolve.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 6)

                CreatureView(species: game.state.species, size: 185)

                VStack(spacing: 4) {
                    Button {
                        nameDraft = game.state.creatureName
                        editingName = true
                    } label: {
                        HStack(spacing: 6) {
                            Text(game.state.creatureName)
                                .font(.title2.bold())
                            Image(systemName: "pencil")
                                .font(.caption)
                        }
                    }
                    .buttonStyle(.plain)

                    Text("\(game.state.species) • Generation \(game.state.generation)")
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 12) {
                    StatPill(title: "LEVEL", value: "\(game.state.level)", icon: "star.fill")
                    StatPill(title: "ENERGY", value: "\(game.state.bioEnergy)", icon: "bolt.heart.fill")
                    StatPill(title: "STEPS", value: formatted(game.state.totalSteps), icon: "figure.walk")
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("Evolution progress", systemImage: "sparkles")
                            .font(.headline)
                        Spacer()
                        Text("\(game.state.xp) / \(game.state.xpToNextLevel) XP")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    ProgressView(value: Double(game.state.xp), total: Double(game.state.xpToNextLevel))
                        .tint(Color.wfMint)
                }
                .panel()

                VStack(alignment: .leading, spacing: 12) {
                    Text("Today's movement")
                        .font(.headline)
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(pedometer.steps) steps detected")
                                .font(.title3.bold())
                            Text(pedometer.isAvailable ? "CoreMotion is active on supported devices." : "Step counting is unavailable on this device.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "figure.walk.motion")
                            .font(.title)
                            .foregroundStyle(Color.wfMint)
                    }
                }
                .panel()

                if let reward = game.lastRewardText {
                    Label(reward, systemImage: "gift.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.wfMint)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .panel()
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Demo controls")
                        .font(.headline)
                    Text("Use these while testing in Simulator. Real builds earn progress from CoreMotion steps.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Button {
                        game.demoWalk()
                    } label: {
                        Label("Simulate 1,000 steps", systemImage: "figure.walk.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.wfPurple)
                }
                .panel()
            }
            .padding()
        }
        .background(Color.wfBackground.ignoresSafeArea())
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Name your Wildform", isPresented: $editingName) {
            TextField("Name", text: $nameDraft)
            Button("Save") { game.renameCreature(nameDraft) }
            Button("Cancel", role: .cancel) { }
        }
    }

    private func formatted(_ value: Int) -> String {
        value.formatted(.number.notation(.compactName))
    }
}

private struct StatPill: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: icon)
                .foregroundStyle(Color.wfMint)
            Text(value)
                .font(.headline.monospacedDigit())
            Text(title)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.wfPanel, in: RoundedRectangle(cornerRadius: 18))
    }
}
