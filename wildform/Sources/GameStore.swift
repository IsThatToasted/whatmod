import Foundation

@MainActor
final class GameStore: ObservableObject {
    @Published private(set) var state: PlayerState
    @Published var lastRewardText: String?

    private let saveKey = "wildform.player.state.v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: saveKey),
           let decoded = try? JSONDecoder().decode(PlayerState.self, from: data) {
            state = decoded
        } else {
            state = PlayerState()
        }
    }

    func renameCreature(_ name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        state.creatureName = String(clean.prefix(18))
        save()
    }

    func syncSteps(_ todaySteps: Int) {
        let today = Self.dayKey()
        if state.lastStepDate != today {
            state.lastStepDate = today
            state.lastRecordedSteps = 0
        }

        let safeSteps = max(0, todaySteps)
        let delta = max(0, safeSteps - state.lastRecordedSteps)
        guard delta > 0 else { return }

        state.lastRecordedSteps = safeSteps
        applyWalking(steps: delta)
    }

    func demoWalk(steps: Int = 1000) {
        applyWalking(steps: steps)
        lastRewardText = "+\(steps) demo steps • +\(steps / 5) Bio Energy"
    }

    private func applyWalking(steps: Int) {
        state.totalSteps += steps
        state.bioEnergy += max(1, steps / 5)
        addXP(max(1, steps / 20))

        if steps >= 500 {
            let rotating = Affinity.allCases[(state.totalSteps / 500) % Affinity.allCases.count]
            state.affinities[rotating, default: 0] += max(1, steps / 500)
        }
        save()
    }

    func recordBattle(victory: Bool, enemy: WildEnemy) -> String {
        state.battles += 1
        if victory {
            state.wins += 1
            let xp = 28 + (enemy.level * 4)
            addXP(xp)
            state.affinities[enemy.affinity, default: 0] += 5

            let resource = resourceName(for: enemy.affinity)
            let quantity = Int.random(in: 1...3)
            state.inventory[resource, default: 0] += quantity
            state.bioEnergy += 20
            save()

            let message = "+\(xp) XP • +5 \(enemy.affinity.rawValue) • \(quantity)x \(resource)"
            lastRewardText = message
            return message
        } else {
            save()
            lastRewardText = "Battle logged. Recover and try again."
            return "No loot this time."
        }
    }

    func evolve(to option: EvolutionOption) -> Bool {
        guard state.level >= option.requiredLevel,
              state.affinities[option.affinity, default: 0] >= option.requiredAffinity,
              state.species == "Origin" else { return false }

        state.species = option.name
        state.bioEnergy += 100
        state.inventory["Evolution Shard", default: 0] += 1
        save()
        return true
    }

    func resetDemo() {
        state = PlayerState()
        lastRewardText = nil
        save()
    }

    private func addXP(_ amount: Int) {
        state.xp += amount
        while state.xp >= state.xpToNextLevel {
            let threshold = state.xpToNextLevel
            state.xp -= threshold
            state.level += 1
            state.bioEnergy += 50
        }
    }

    private func resourceName(for affinity: Affinity) -> String {
        switch affinity {
        case .flora: return "Verdant Fiber"
        case .ember: return "Ember Core"
        case .tide: return "Tide Pearl"
        case .storm: return "Charged Fragment"
        case .shadow: return "Night Essence"
        case .feral: return "Wild Fang"
        }
    }

    private func save() {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: saveKey)
        }
    }

    private static func dayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
