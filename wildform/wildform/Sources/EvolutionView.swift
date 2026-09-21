import SwiftUI

struct EvolutionView: View {
    @EnvironmentObject private var game: GameStore
    @State private var message: String?

    private let options: [EvolutionOption] = [
        EvolutionOption(name: "Emberling", affinity: .ember, description: "A heat-fed form that converts aggression into explosive power.", requiredAffinity: 5, requiredLevel: 3, symbol: "flame.fill"),
        EvolutionOption(name: "Thornling", affinity: .flora, description: "A resilient adaptive form strengthened by natural environments.", requiredAffinity: 5, requiredLevel: 3, symbol: "leaf.fill"),
        EvolutionOption(name: "Stormling", affinity: .storm, description: "A kinetic form that channels movement into electrical bursts.", requiredAffinity: 5, requiredLevel: 3, symbol: "bolt.fill"),
        EvolutionOption(name: "Tideling", affinity: .tide, description: "A fluid form with remarkable recovery and evasive instincts.", requiredAffinity: 5, requiredLevel: 3, symbol: "drop.fill"),
        EvolutionOption(name: "Shadeling", affinity: .shadow, description: "A quiet nocturnal form tuned to hidden signals and rare encounters.", requiredAffinity: 5, requiredLevel: 3, symbol: "moon.stars.fill"),
        EvolutionOption(name: "Fangling", affinity: .feral, description: "A fierce physical form that thrives through direct confrontation.", requiredAffinity: 5, requiredLevel: 3, symbol: "pawprint.fill")
    ]

    var body: some View {
        ZStack {
            WildBackground()
            ScrollView {
                VStack(spacing: 17) {
                    creatureHeader
                    genomeCard
                    adaptationPanel
                    evolutionPanel
                    footerNote
                }
                .padding()
            }
        }
        .navigationTitle("Adaptation")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Wildform Changed", isPresented: alertBinding) {
            Button("Continue") { message = nil }
        } message: {
            Text(message ?? "")
        }
    }

    private var creatureHeader: some View {
        VStack(spacing: 5) {
            CreatureView(state: game.state, size: 150)
            Text(game.state.species).font(.title2.bold())
            Text(speciesSubtitle).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
    }

    private var genomeCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "dna")
                .font(.title2)
                .foregroundStyle(Color.wfPurple)
                .frame(width: 46, height: 46)
                .background(Color.wfPurple.opacity(0.13), in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 2) {
                Text("Procedural genome").font(.headline)
                Text("Seed \(game.state.genomeSeed) • body, ears, horns, eyes, tail and markings are generated independently.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .panel()
    }

    private var adaptationPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Adaptation profile").font(.headline)
            ForEach(Affinity.allCases) { affinity in
                AffinityMeter(affinity: affinity, value: game.state.affinities[affinity, default: 0])
            }
        }
        .panel(emphasized: true)
    }

    private var evolutionPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Known evolution paths").font(.headline)
                Spacer()
                Text("6 DISCOVERED").font(.caption2.bold()).foregroundStyle(Color.wfMint)
            }
            ForEach(options) { option in
                EvolutionOptionCard(
                    option: option,
                    currentSpecies: game.state.species,
                    currentLevel: game.state.level,
                    affinityValue: game.state.affinities[option.affinity, default: 0]
                ) {
                    if game.evolve(to: option) {
                        FeedbackManager.shared.play(.evolve, enabled: game.state.soundEnabled)
                        message = "Evolution complete: \(option.name)! Your procedural anatomy has adapted to the new form."
                    }
                }
            }
        }
        .panel()
    }

    private var footerNote: some View {
        Text("Future branches can combine real-world conditions, hidden affinity thresholds, mutations, generations, weather, biome history and rare battle drops.")
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal)
    }

    private var speciesSubtitle: String {
        game.state.species == "Origin" ? "Your biology is still unwritten." : "Your first evolutionary branch is active."
    }

    private var alertBinding: Binding<Bool> {
        Binding(get: { message != nil }, set: { if !$0 { message = nil } })
    }
}

private struct AffinityMeter: View {
    let affinity: Affinity
    let value: Int

    var body: some View {
        VStack(spacing: 5) {
            HStack {
                Image(systemName: affinity.symbol).frame(width: 24).foregroundStyle(tint)
                Text(affinity.rawValue).font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(value)").font(.subheadline.bold().monospacedDigit())
            }
            ProgressView(value: Double(min(value, 50)), total: 50).tint(tint)
        }
    }

    private var tint: Color {
        switch affinity {
        case .flora: return .green
        case .ember: return .orange
        case .tide: return .blue
        case .storm: return .cyan
        case .shadow: return .purple
        case .feral: return .brown
        }
    }
}

private struct EvolutionOptionCard: View {
    let option: EvolutionOption
    let currentSpecies: String
    let currentLevel: Int
    let affinityValue: Int
    let onEvolve: () -> Void

    private var isOrigin: Bool { currentSpecies == "Origin" }
    private var isActive: Bool { currentSpecies == option.name }
    private var unlocked: Bool { isOrigin && currentLevel >= option.requiredLevel && affinityValue >= option.requiredAffinity }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Image(systemName: option.symbol)
                    .font(.title3)
                    .foregroundStyle(Color.wfMint)
                    .frame(width: 36, height: 36)
                    .background(Color.wfMint.opacity(0.10), in: RoundedRectangle(cornerRadius: 11))
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.name).font(.headline)
                    Text("Lv \(option.requiredLevel) • \(option.requiredAffinity) \(option.affinity.rawValue)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if isActive {
                    Text("ACTIVE").font(.caption.bold()).foregroundStyle(Color.wfMint)
                }
            }
            Text(option.description).font(.subheadline).foregroundStyle(.secondary)
            if isOrigin {
                Button(unlocked ? "Evolve into \(option.name)" : "Requirements not met", action: onEvolve)
                    .buttonStyle(.borderedProminent)
                    .tint(unlocked ? Color.wfPurple : Color.gray)
                    .disabled(!unlocked)
            }
        }
        .padding(12)
        .background(.black.opacity(0.16), in: RoundedRectangle(cornerRadius: 17))
    }
}
