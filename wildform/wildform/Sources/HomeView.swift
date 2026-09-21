import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var game: GameStore
    @EnvironmentObject private var pedometer: PedometerManager
    @State private var editingName = false
    @State private var nameDraft = ""

    var body: some View {
        ZStack {
            WildBackground()
            ScrollView {
                VStack(spacing: 16) {
                    topBar
                    hero
                    quickStats
                    movementCard
                    instinctCard
                    rewardCard
                    demoCard
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
        }
        .navigationBarHidden(true)
        .alert("Name your Wildform", isPresented: $editingName) {
            TextField("Name", text: $nameDraft)
            Button("Save") { game.renameCreature(nameDraft) }
            Button("Cancel", role: .cancel) { }
        }
    }

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text("WILDFORM")
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .tracking(3.5)
                    .foregroundStyle(Color.wfMint)
                Text("Walk. Adapt. Evolve.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            CurrencyChip(icon: "diamond.fill", value: game.state.lumens)
            Button {
                game.toggleSound()
                FeedbackManager.shared.play(.tap, enabled: game.state.soundEnabled)
            } label: {
                Image(systemName: game.state.soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    .frame(width: 34, height: 34)
                    .background(.black.opacity(0.22), in: Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 8)
    }

    private var hero: some View {
        VStack(spacing: 2) {
            ZStack(alignment: .bottom) {
                CreatureView(state: game.state, size: 190)
                Text("GEN \(game.state.generation)")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(1.5)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(.black.opacity(0.42), in: Capsule())
                    .overlay(Capsule().stroke(.white.opacity(0.10)))
                    .offset(y: -5)
            }

            Button {
                nameDraft = game.state.creatureName
                editingName = true
                FeedbackManager.shared.play(.tap, enabled: game.state.soundEnabled)
            } label: {
                HStack(spacing: 6) {
                    Text(game.state.creatureName)
                        .font(.title.bold())
                    Image(systemName: "pencil.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.wfMint)
                }
            }
            .buttonStyle(.plain)

            Text("\(game.state.species) • Level \(game.state.level)")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

            VStack(spacing: 6) {
                ProgressView(value: Double(game.state.xp), total: Double(game.state.xpToNextLevel))
                    .tint(Color.wfMint)
                HStack {
                    Text("Evolution energy")
                    Spacer()
                    Text("\(game.state.xp) / \(game.state.xpToNextLevel) XP")
                        .monospacedDigit()
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
        }
        .padding(.vertical, 6)
    }

    private var quickStats: some View {
        HStack(spacing: 10) {
            MiniStat(title: "ENERGY", value: game.state.bioEnergy.formatted(), icon: "bolt.heart.fill", tint: .wfMint)
            MiniStat(title: "STEPS", value: compact(game.state.totalSteps), icon: "figure.walk", tint: .cyan)
            MiniStat(title: "FOUND", value: game.state.discoveries.formatted(), icon: "scope", tint: .wfPurple)
        }
    }

    private var movementCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Today's movement", systemImage: "figure.walk.motion")
                    .font(.headline)
                Spacer()
                Text("\(game.state.streakDays) DAY STREAK")
                    .font(.caption2.bold())
                    .foregroundStyle(Color.wfGold)
            }

            HStack(alignment: .lastTextBaseline) {
                Text(pedometer.steps.formatted())
                    .font(.system(size: 34, weight: .black, design: .rounded))
                Text("steps")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.1f km", game.state.distanceKilometers))
                        .font(.headline.monospacedDigit())
                    Text("lifetime travel")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Text(pedometer.isAvailable ? "Your movement quietly feeds XP, Bio Energy, affinity, and Lumens." : "CoreMotion isn't available here; use the demo walk control while testing.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .panel(emphasized: true)
    }

    private var instinctCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(Color.wfPurple.opacity(0.18)).frame(width: 50, height: 50)
                Image(systemName: "location.north.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Color.wfPurple)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("CURRENT INSTINCT")
                    .font(.caption2.bold())
                    .tracking(1.4)
                    .foregroundStyle(Color.wfMint)
                Text("Explore somewhere unfamiliar")
                    .font(.headline)
                Text("Discovering new lifeforms increases adaptation variety.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .panel()
    }

    @ViewBuilder private var rewardCard: some View {
        if let reward = game.lastRewardText {
            HStack(spacing: 12) {
                Image(systemName: "gift.fill")
                    .font(.title2)
                    .foregroundStyle(Color.wfGold)
                Text(reward)
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
            }
            .panel()
        }
    }

    private var demoCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Developer field test")
                .font(.headline)
            Text("Simulates movement so progression, evolutions, and shop currency can be tested without carrying the phone around.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button {
                game.demoWalk()
                FeedbackManager.shared.play(.scan, enabled: game.state.soundEnabled)
            } label: {
                Label("Simulate 1,000 steps", systemImage: "figure.walk.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.wfPurple)
        }
        .panel()
    }

    private func compact(_ value: Int) -> String {
        value.formatted(.number.notation(.compactName))
    }
}

private struct MiniStat: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon).foregroundStyle(tint)
            Text(value).font(.headline.monospacedDigit()).minimumScaleFactor(0.7)
            Text(title).font(.system(size: 9, weight: .black)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.06)))
    }
}
