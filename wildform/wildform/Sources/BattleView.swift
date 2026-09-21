import SwiftUI

struct BattleView: View {
    @EnvironmentObject private var game: GameStore
    let enemy: WildEnemy
    let onFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var enemyHP: Int
    @State private var playerHP = 100
    @State private var energy = 0
    @State private var status: String
    @State private var finished = false
    @State private var reward = ""
    @State private var enemyHit = false
    @State private var playerHit = false

    init(enemy: WildEnemy, onFinished: @escaping () -> Void) {
        self.enemy = enemy
        self.onFinished = onFinished
        _enemyHP = State(initialValue: enemy.baseHP)
        _status = State(initialValue: "\(enemy.name) blocks your path.")
    }

    var body: some View {
        ZStack {
            battleBackground
            VStack(spacing: 14) {
                handle
                encounterLabel
                enemyArea
                healthArea
                statusArea
                Spacer(minLength: 4)
                playerArea
                controls
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 22)
        }
    }

    private var battleBackground: some View {
        ZStack {
            LinearGradient(colors: [Color.wfBackground, affinityColor.opacity(0.25), Color.wfBackground], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            Circle()
                .fill(affinityColor.opacity(0.14))
                .frame(width: 330)
                .blur(radius: 45)
                .offset(y: -170)
        }
    }

    private var handle: some View {
        Capsule().fill(.white.opacity(0.15)).frame(width: 44, height: 5).padding(.top, 8)
    }

    private var encounterLabel: some View {
        HStack {
            Text(enemy.rarity.rawValue.uppercased())
                .font(.caption2.weight(.black))
                .tracking(1.5)
                .foregroundStyle(rarityColor)
            Text("WILD ENCOUNTER")
                .font(.caption.bold())
                .tracking(2.3)
                .foregroundStyle(Color.wfMint)
        }
    }

    private var enemyArea: some View {
        VStack(spacing: 2) {
            CreatureView(species: enemySpecies, size: 122, seed: enemy.seed)
                .scaleEffect(enemyHit ? 0.88 : 1)
                .offset(x: enemyHit ? 14 : 0)
                .animation(.spring(response: 0.22, dampingFraction: 0.45), value: enemyHit)
            Text(enemy.name)
                .font(.title2.bold())
            Text("Level \(enemy.level) • \(enemy.affinity.rawValue)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var healthArea: some View {
        VStack(spacing: 9) {
            HPBar(label: enemy.name.uppercased(), current: enemyHP, max: enemy.baseHP, tint: affinityColor)
            HPBar(label: game.state.creatureName.uppercased(), current: playerHP, max: 100, tint: Color.wfMint)
        }
    }

    private var statusArea: some View {
        Text(finished ? reward : status)
            .font(.subheadline.weight(.semibold))
            .multilineTextAlignment(.center)
            .frame(minHeight: 42)
            .foregroundStyle(finished ? Color.wfMint : Color.primary)
            .padding(.horizontal)
    }

    private var playerArea: some View {
        HStack {
            CreatureView(state: game.state, size: 92)
                .scaleEffect(playerHit ? 0.88 : 1)
                .offset(x: playerHit ? -12 : 0)
                .animation(.spring(response: 0.22, dampingFraction: 0.45), value: playerHit)
            VStack(alignment: .leading, spacing: 6) {
                Text("SURGE")
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                ProgressView(value: Double(energy), total: 100)
                    .tint(Color.wfPurple)
                Text("\(energy)%")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Color.wfPurple)
            }
        }
        .padding(.horizontal, 8)
    }

    @ViewBuilder private var controls: some View {
        if finished {
            Button("Return to the Wild") {
                onFinished()
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.wfPurple)
            .controlSize(.large)
        } else {
            HStack(spacing: 10) {
                BattleButton(title: "Claw", icon: "burst.fill", tint: .wfPurple) { attack(base: 16, gain: 20) }
                BattleButton(title: "Dodge", icon: "figure.run", tint: .cyan) { dodge() }
                BattleButton(title: energy >= 60 ? "SURGE" : "\(energy)%", icon: "bolt.fill", tint: energy >= 60 ? .wfGold : .gray) {
                    guard energy >= 60 else { return }
                    energy = 0
                    attack(base: 42, gain: 0)
                }
                .opacity(energy >= 60 ? 1 : 0.58)
            }
        }
    }

    private var enemySpecies: String {
        switch enemy.affinity {
        case .ember: return "Emberling"
        case .flora: return "Thornling"
        case .storm: return "Stormling"
        case .tide: return "Tideling"
        case .shadow: return "Shadeling"
        case .feral: return "Fangling"
        }
    }

    private var affinityColor: Color {
        switch enemy.affinity {
        case .flora: return .green
        case .ember: return .orange
        case .tide: return .blue
        case .storm: return .cyan
        case .shadow: return .purple
        case .feral: return .brown
        }
    }

    private var rarityColor: Color {
        switch enemy.rarity {
        case .common: return .secondary
        case .uncommon: return .wfMint
        case .rare: return .cyan
        case .aberrant: return .wfPink
        }
    }

    private func attack(base: Int, gain: Int) {
        FeedbackManager.shared.play(.attack, enabled: game.state.soundEnabled)
        let damage = base + Int.random(in: 0...10) + game.state.level
        enemyHP = max(0, enemyHP - damage)
        energy = min(100, energy + gain)
        status = "\(game.state.creatureName) hit \(enemy.name) for \(damage)."
        hitEnemyAnimation()

        if enemyHP == 0 {
            finish(victory: true)
        } else {
            enemyTurn(dodgeBonus: false)
        }
    }

    private func dodge() {
        FeedbackManager.shared.play(.dodge, enabled: game.state.soundEnabled)
        energy = min(100, energy + 28)
        if Bool.random() {
            status = "Perfect dodge! Surge energy jumped."
        } else {
            status = "Late dodge — a glancing hit got through."
            enemyTurn(dodgeBonus: true)
        }
    }

    private func enemyTurn(dodgeBonus: Bool) {
        let upper = dodgeBonus ? 8 : 16
        let damage = Int.random(in: 4...upper) + max(0, enemy.level - game.state.level)
        playerHP = max(0, playerHP - damage)
        hitPlayerAnimation()
        if playerHP == 0 { finish(victory: false) }
    }

    private func finish(victory: Bool) {
        finished = true
        reward = game.recordBattle(victory: victory, enemy: enemy)
        if victory { FeedbackManager.shared.play(.victory, enabled: game.state.soundEnabled) }
    }

    private func hitEnemyAnimation() {
        enemyHit = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000)
            enemyHit = false
        }
    }

    private func hitPlayerAnimation() {
        playerHit = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000)
            playerHit = false
        }
    }
}

private struct HPBar: View {
    let label: String
    let current: Int
    let max: Int
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(label).font(.caption2.bold())
                Spacer()
                Text("\(current)/\(max)").font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(current), total: Double(max))
                .tint(current > max / 3 ? tint : Color.orange)
        }
        .padding(10)
        .background(.black.opacity(0.22), in: RoundedRectangle(cornerRadius: 14))
    }
}

private struct BattleButton: View {
    let title: String
    let icon: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.title3)
                Text(title).font(.caption.bold()).lineLimit(1).minimumScaleFactor(0.68)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 68)
        }
        .buttonStyle(.borderedProminent)
        .tint(tint)
    }
}
