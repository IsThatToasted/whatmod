import SwiftUI

struct BattleView: View {
    @EnvironmentObject private var game: GameStore
    let enemy: WildEnemy
    let onFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var enemyHP: Int
    @State private var playerHP = 100
    @State private var energy = 0
    @State private var status = "A wild encounter begins."
    @State private var finished = false
    @State private var reward = ""

    init(enemy: WildEnemy, onFinished: @escaping () -> Void) {
        self.enemy = enemy
        self.onFinished = onFinished
        _enemyHP = State(initialValue: enemy.baseHP)
        _status = State(initialValue: "\(enemy.name) blocks your path.")
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color.wfBackground, Color.wfPanel], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 22) {
                Capsule()
                    .fill(.white.opacity(0.15))
                    .frame(width: 44, height: 5)
                    .padding(.top, 8)

                Text("WILD ENCOUNTER")
                    .font(.caption.bold())
                    .tracking(3)
                    .foregroundStyle(Color.wfMint)

                VStack(spacing: 5) {
                    Image(systemName: enemy.symbol)
                        .font(.system(size: 72, weight: .bold))
                        .foregroundStyle(Color.wfMint)
                        .frame(width: 130, height: 130)
                        .background(.black.opacity(0.28), in: Circle())
                    Text(enemy.name)
                        .font(.title.bold())
                    Text("Level \(enemy.level) • \(enemy.affinity.rawValue)")
                        .foregroundStyle(.secondary)
                }

                HPBar(label: enemy.name.uppercased(), current: enemyHP, max: enemy.baseHP)
                HPBar(label: game.state.creatureName.uppercased(), current: playerHP, max: 100)

                Text(finished ? reward : status)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .frame(minHeight: 48)
                    .foregroundStyle(finished ? Color.wfMint : Color.primary)

                if finished {
                    Button("Return to the Wild") {
                        onFinished()
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.wfPurple)
                    .controlSize(.large)
                } else {
                    HStack(spacing: 12) {
                        BattleButton(title: "Claw", icon: "burst.fill") { attack(base: 16, gain: 20) }
                        BattleButton(title: "Dodge", icon: "figure.run") { dodge() }
                        BattleButton(title: energy >= 60 ? "SURGE" : "Surge \(energy)%", icon: "bolt.fill") {
                            guard energy >= 60 else { return }
                            energy = 0
                            attack(base: 42, gain: 0)
                        }
                        .opacity(energy >= 60 ? 1 : 0.55)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 20)
        }
    }

    private func attack(base: Int, gain: Int) {
        let damage = base + Int.random(in: 0...10) + game.state.level
        enemyHP = max(0, enemyHP - damage)
        energy = min(100, energy + gain)
        status = "You hit \(enemy.name) for \(damage)."

        if enemyHP == 0 {
            finish(victory: true)
        } else {
            enemyTurn(dodgeBonus: false)
        }
    }

    private func dodge() {
        energy = min(100, energy + 28)
        if Bool.random() {
            status = "Perfect dodge! Surge energy increased."
        } else {
            status = "You moved late and took a glancing hit."
            enemyTurn(dodgeBonus: true)
        }
    }

    private func enemyTurn(dodgeBonus: Bool) {
        let upper = dodgeBonus ? 8 : 16
        let damage = Int.random(in: 4...upper) + max(0, enemy.level - game.state.level)
        playerHP = max(0, playerHP - damage)
        if playerHP == 0 {
            finish(victory: false)
        }
    }

    private func finish(victory: Bool) {
        finished = true
        reward = game.recordBattle(victory: victory, enemy: enemy)
    }
}

private struct HPBar: View {
    let label: String
    let current: Int
    let max: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label).font(.caption.bold())
                Spacer()
                Text("\(current)/\(max)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(current), total: Double(max))
                .tint(current > max / 3 ? Color.wfMint : Color.orange)
        }
        .panel()
    }
}

private struct BattleButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 7) {
                Image(systemName: icon).font(.title2)
                Text(title).font(.caption.bold()).lineLimit(1).minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 74)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color.wfPurple)
    }
}
