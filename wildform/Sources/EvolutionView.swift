import SwiftUI

struct EvolutionView: View {
    @EnvironmentObject private var game: GameStore
    @State private var message: String?

    private let options: [EvolutionOption] = [
        EvolutionOption(name: "Emberling", affinity: .ember, description: "A heat-fed form that converts aggression into explosive power.", requiredAffinity: 5, requiredLevel: 3, symbol: "flame.fill"),
        EvolutionOption(name: "Thornling", affinity: .flora, description: "A resilient adaptive form strengthened by natural environments.", requiredAffinity: 5, requiredLevel: 3, symbol: "leaf.fill"),
        EvolutionOption(name: "Stormling", affinity: .storm, description: "A kinetic form that channels movement into electrical bursts.", requiredAffinity: 5, requiredLevel: 3, symbol: "bolt.fill")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                creatureHeader
                adaptationPanel
                evolutionPanel
                footerNote
            }
            .padding()
        }
        .background(Color.wfBackground.ignoresSafeArea())
        .navigationTitle("Evolve")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Wildform Changed", isPresented: alertBinding) {
            Button("Continue") { message = nil }
        } message: {
            Text(message ?? "")
        }
    }

    private var creatureHeader: some View {
        VStack(spacing: 10) {
            CreatureView(species: game.state.species, size: 135)

            VStack(spacing: 3) {
                Text(game.state.species)
                    .font(.title2.bold())
                Text(speciesSubtitle)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var adaptationPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Adaptation profile")
                .font(.headline)

            ForEach(Affinity.allCases) { affinity in
                AffinityRow(
                    affinity: affinity,
                    value: game.state.affinities[affinity, default: 0]
                )
            }
        }
        .panel()
    }

    private var evolutionPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Known evolution paths")
                .font(.headline)

            ForEach(options) { option in
                EvolutionOptionCard(
                    option: option,
                    currentSpecies: game.state.species,
                    currentLevel: game.state.level,
                    affinityValue: game.state.affinities[option.affinity, default: 0]
                ) {
                    if game.evolve(to: option) {
                        message = "Evolution complete: \(option.name)!"
                    }
                }
            }
        }
        .panel()
    }

    private var footerNote: some View {
        Text("More evolution branches, secret conditions, mutations, and Generations are intentionally reserved for the full game architecture.")
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal)
    }

    private var speciesSubtitle: String {
        game.state.species == "Origin"
            ? "Your biology is still unwritten."
            : "Your first evolution has awakened."
    }

    private var alertBinding: Binding<Bool> {
        Binding(
            get: { message != nil },
            set: { isPresented in
                if !isPresented { message = nil }
            }
        )
    }
}

private struct AffinityRow: View {
    let affinity: Affinity
    let value: Int

    var body: some View {
        HStack {
            Image(systemName: affinity.symbol)
                .frame(width: 26)
                .foregroundStyle(Color.wfMint)
            Text(affinity.rawValue)
            Spacer()
            Text("\(value)")
                .font(.headline.monospacedDigit())
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
    private var unlocked: Bool {
        isOrigin && currentLevel >= option.requiredLevel && affinityValue >= option.requiredAffinity
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Image(systemName: option.symbol)
                    .font(.title2)
                    .foregroundStyle(Color.wfMint)
                    .frame(width: 34)

                VStack(alignment: .leading) {
                    Text(option.name)
                        .font(.headline)
                    Text("Level \(option.requiredLevel) • \(option.requiredAffinity) \(option.affinity.rawValue)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if isActive {
                    Text("ACTIVE")
                        .font(.caption.bold())
                        .foregroundStyle(Color.wfMint)
                }
            }

            Text(option.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if isOrigin {
                Button(unlocked ? "Evolve into \(option.name)" : "Requirements not met", action: onEvolve)
                    .buttonStyle(.borderedProminent)
                    .tint(unlocked ? Color.wfPurple : Color.gray)
                    .disabled(!unlocked)
            }
        }
        .padding()
        .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 18))
    }
}
