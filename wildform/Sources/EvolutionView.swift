import SwiftUI

struct EvolutionView: View {
    @EnvironmentObject private var game: GameStore
    @State private var message: String?

    private let options = [
        EvolutionOption(name: "Emberling", affinity: .ember, description: "A heat-fed form that converts aggression into explosive power.", requiredAffinity: 5, requiredLevel: 3, symbol: "flame.fill"),
        EvolutionOption(name: "Thornling", affinity: .flora, description: "A resilient adaptive form strengthened by natural environments.", requiredAffinity: 5, requiredLevel: 3, symbol: "leaf.fill"),
        EvolutionOption(name: "Stormling", affinity: .storm, description: "A kinetic form that channels movement into electrical bursts.", requiredAffinity: 5, requiredLevel: 3, symbol: "bolt.fill")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                CreatureView(species: game.state.species, size: 135)

                VStack(spacing: 3) {
                    Text(game.state.species)
                        .font(.title2.bold())
                    Text(game.state.species == "Origin" ? "Your biology is still unwritten." : "Your first evolution has awakened.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Adaptation profile")
                        .font(.headline)
                    ForEach(Affinity.allCases) { affinity in
                        HStack {
                            Image(systemName: affinity.symbol)
                                .frame(width: 26)
                                .foregroundStyle(.wfMint)
                            Text(affinity.rawValue)
                            Spacer()
                            Text("\(game.state.affinities[affinity, default: 0])")
                                .font(.headline.monospacedDigit())
                        }
                    }
                }
                .panel()

                VStack(alignment: .leading, spacing: 12) {
                    Text("Known evolution paths")
                        .font(.headline)

                    ForEach(options) { option in
                        let unlocked = game.state.level >= option.requiredLevel && game.state.affinities[option.affinity, default: 0] >= option.requiredAffinity && game.state.species == "Origin"
                        VStack(alignment: .leading, spacing: 9) {
                            HStack {
                                Image(systemName: option.symbol)
                                    .font(.title2)
                                    .foregroundStyle(.wfMint)
                                    .frame(width: 34)
                                VStack(alignment: .leading) {
                                    Text(option.name).font(.headline)
                                    Text("Level \(option.requiredLevel) • \(option.requiredAffinity) \(option.affinity.rawValue)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if game.state.species == option.name {
                                    Text("ACTIVE").font(.caption.bold()).foregroundStyle(.wfMint)
                                }
                            }
                            Text(option.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            if game.state.species == "Origin" {
                                Button(unlocked ? "Evolve into \(option.name)" : "Requirements not met") {
                                    if game.evolve(to: option) {
                                        message = "Evolution complete: \(option.name)!"
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(unlocked ? .wfPurple : .gray)
                                .disabled(!unlocked)
                            }
                        }
                        .padding()
                        .background(.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 18))
                    }
                }
                .panel()

                Text("More evolution branches, secret conditions, mutations, and Generations are intentionally reserved for the full game architecture.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            .padding()
        }
        .background(Color.wfBackground.ignoresSafeArea())
        .navigationTitle("Evolve")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Wildform Changed", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("Continue") { message = nil }
        } message: {
            Text(message ?? "")
        }
    }
}
