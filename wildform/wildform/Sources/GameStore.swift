import Foundation

@MainActor
final class GameStore: ObservableObject {
    @Published private(set) var state: PlayerState
    @Published var lastRewardText: String?
    @Published var toastText: String?

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
            state.streakDays = max(1, state.streakDays + 1)
        }

        let safeSteps = max(0, todaySteps)
        let delta = max(0, safeSteps - state.lastRecordedSteps)
        guard delta > 0 else { return }

        state.lastRecordedSteps = safeSteps
        applyWalking(steps: delta)
    }

    func demoWalk(steps: Int = 1000) {
        applyWalking(steps: steps)
        lastRewardText = "+\(steps) steps • +\(steps / 5) Bio Energy • +\(max(1, steps / 250)) Lumens"
        toastText = "Movement converted into Wild energy."
    }

    private func applyWalking(steps: Int) {
        state.totalSteps += steps
        state.bioEnergy += max(1, steps / 5)
        state.lumens += max(1, steps / 250)
        addXP(max(1, steps / 20))

        if steps >= 500 {
            let rotating = Affinity.allCases[(state.totalSteps / 500) % Affinity.allCases.count]
            state.affinities[rotating, default: 0] += max(1, steps / 500)
        }
        save()
    }

    func recordScan() {
        state.discoveries += 1
        state.bioEnergy = max(0, state.bioEnergy - 2)
        save()
    }

    func recordBattle(victory: Bool, enemy: WildEnemy) -> String {
        state.battles += 1
        if victory {
            state.wins += 1
            let multiplier = enemy.rarity.rewardMultiplier
            let xp = (28 + enemy.level * 4) * multiplier
            let affinityGain = 3 + multiplier * 2
            let lumenGain = 10 + Int.random(in: 2...10) * multiplier
            addXP(xp)
            state.affinities[enemy.affinity, default: 0] += affinityGain
            state.lumens += lumenGain

            let resource = resourceName(for: enemy.affinity)
            let quantity = Int.random(in: 1...3) * multiplier
            state.inventory[resource, default: 0] += quantity
            state.bioEnergy += 18 + multiplier * 4

            if enemy.rarity == .rare || enemy.rarity == .aberrant {
                state.inventory["Mutation Dust", default: 0] += multiplier
            }
            save()

            let message = "+\(xp) XP • +\(affinityGain) \(enemy.affinity.rawValue) • +\(lumenGain) ◈ • \(quantity)x \(resource)"
            lastRewardText = message
            toastText = "Victory over \(enemy.name)!"
            return message
        } else {
            save()
            lastRewardText = "Battle logged. Recover and try again."
            toastText = "Your Wildform escaped safely."
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
        state.lumens += 75
        toastText = "\(state.creatureName) became \(option.name)."
        save()
        return true
    }

    func purchase(_ cosmetic: CosmeticItem) -> Bool {
        guard cosmetic.cost > 0,
              !state.ownedCosmetics.contains(cosmetic.id),
              state.lumens >= cosmetic.cost else { return false }
        state.lumens -= cosmetic.cost
        state.ownedCosmetics.insert(cosmetic.id)
        state.equippedCosmetics[cosmetic.slot] = cosmetic.id
        toastText = "\(cosmetic.name) unlocked and equipped."
        save()
        return true
    }

    func equip(_ cosmetic: CosmeticItem) {
        guard state.ownedCosmetics.contains(cosmetic.id) else { return }
        if cosmetic.id.hasSuffix(".none") {
            state.equippedCosmetics.removeValue(forKey: cosmetic.slot)
        } else {
            state.equippedCosmetics[cosmetic.slot] = cosmetic.id
        }
        toastText = "\(cosmetic.name) equipped."
        save()
    }

    func isOwned(_ item: CosmeticItem) -> Bool {
        state.ownedCosmetics.contains(item.id)
    }

    func isEquipped(_ item: CosmeticItem) -> Bool {
        if item.id.hasSuffix(".none") {
            return state.equippedCosmetics[item.slot] == nil
        }
        return state.equippedCosmetics[item.slot] == item.id
    }

    func toggleSound() {
        state.soundEnabled.toggle()
        toastText = state.soundEnabled ? "Sound effects on." : "Sound effects off."
        save()
    }

    func clearToast() {
        toastText = nil
    }

    func resetDemo() {
        state = PlayerState()
        lastRewardText = nil
        toastText = nil
        save()
    }

    private func addXP(_ amount: Int) {
        state.xp += amount
        while state.xp >= state.xpToNextLevel {
            let threshold = state.xpToNextLevel
            state.xp -= threshold
            state.level += 1
            state.bioEnergy += 50
            state.lumens += 25
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
