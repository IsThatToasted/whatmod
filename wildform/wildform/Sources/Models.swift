import Foundation
import CoreLocation

struct PlayerState: Codable {
    var creatureName: String
    var species: String
    var level: Int
    var xp: Int
    var bioEnergy: Int
    var totalSteps: Int
    var battles: Int
    var wins: Int
    var generation: Int
    var affinities: [Affinity: Int]
    var inventory: [String: Int]
    var lastStepDate: String
    var lastRecordedSteps: Int

    // v0.2 progression
    var genomeSeed: Int
    var lumens: Int
    var prisms: Int
    var discoveries: Int
    var streakDays: Int
    var ownedCosmetics: Set<String>
    var equippedCosmetics: [CosmeticSlot: String]
    var soundEnabled: Bool

    init(
        creatureName: String = "Nova",
        species: String = "Origin",
        level: Int = 1,
        xp: Int = 0,
        bioEnergy: Int = 0,
        totalSteps: Int = 0,
        battles: Int = 0,
        wins: Int = 0,
        generation: Int = 1,
        affinities: [Affinity: Int] = Dictionary(uniqueKeysWithValues: Affinity.allCases.map { ($0, 0) }),
        inventory: [String: Int] = [:],
        lastStepDate: String = "",
        lastRecordedSteps: Int = 0,
        genomeSeed: Int = 731_921,
        lumens: Int = 350,
        prisms: Int = 0,
        discoveries: Int = 0,
        streakDays: Int = 1,
        ownedCosmetics: Set<String> = ["aura.none", "mark.none", "head.none"],
        equippedCosmetics: [CosmeticSlot: String] = [:],
        soundEnabled: Bool = true
    ) {
        self.creatureName = creatureName
        self.species = species
        self.level = level
        self.xp = xp
        self.bioEnergy = bioEnergy
        self.totalSteps = totalSteps
        self.battles = battles
        self.wins = wins
        self.generation = generation
        self.affinities = affinities
        self.inventory = inventory
        self.lastStepDate = lastStepDate
        self.lastRecordedSteps = lastRecordedSteps
        self.genomeSeed = genomeSeed
        self.lumens = lumens
        self.prisms = prisms
        self.discoveries = discoveries
        self.streakDays = streakDays
        self.ownedCosmetics = ownedCosmetics
        self.equippedCosmetics = equippedCosmetics
        self.soundEnabled = soundEnabled
    }

    enum CodingKeys: String, CodingKey {
        case creatureName, species, level, xp, bioEnergy, totalSteps, battles, wins, generation
        case affinities, inventory, lastStepDate, lastRecordedSteps
        case genomeSeed, lumens, prisms, discoveries, streakDays, ownedCosmetics, equippedCosmetics, soundEnabled
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        creatureName = try c.decodeIfPresent(String.self, forKey: .creatureName) ?? "Nova"
        species = try c.decodeIfPresent(String.self, forKey: .species) ?? "Origin"
        level = try c.decodeIfPresent(Int.self, forKey: .level) ?? 1
        xp = try c.decodeIfPresent(Int.self, forKey: .xp) ?? 0
        bioEnergy = try c.decodeIfPresent(Int.self, forKey: .bioEnergy) ?? 0
        totalSteps = try c.decodeIfPresent(Int.self, forKey: .totalSteps) ?? 0
        battles = try c.decodeIfPresent(Int.self, forKey: .battles) ?? 0
        wins = try c.decodeIfPresent(Int.self, forKey: .wins) ?? 0
        generation = try c.decodeIfPresent(Int.self, forKey: .generation) ?? 1
        affinities = try c.decodeIfPresent([Affinity: Int].self, forKey: .affinities)
            ?? Dictionary(uniqueKeysWithValues: Affinity.allCases.map { ($0, 0) })
        inventory = try c.decodeIfPresent([String: Int].self, forKey: .inventory) ?? [:]
        lastStepDate = try c.decodeIfPresent(String.self, forKey: .lastStepDate) ?? ""
        lastRecordedSteps = try c.decodeIfPresent(Int.self, forKey: .lastRecordedSteps) ?? 0
        genomeSeed = try c.decodeIfPresent(Int.self, forKey: .genomeSeed) ?? 731_921
        lumens = try c.decodeIfPresent(Int.self, forKey: .lumens) ?? 350
        prisms = try c.decodeIfPresent(Int.self, forKey: .prisms) ?? 0
        discoveries = try c.decodeIfPresent(Int.self, forKey: .discoveries) ?? 0
        streakDays = try c.decodeIfPresent(Int.self, forKey: .streakDays) ?? 1
        ownedCosmetics = try c.decodeIfPresent(Set<String>.self, forKey: .ownedCosmetics)
            ?? ["aura.none", "mark.none", "head.none"]
        equippedCosmetics = try c.decodeIfPresent([CosmeticSlot: String].self, forKey: .equippedCosmetics) ?? [:]
        soundEnabled = try c.decodeIfPresent(Bool.self, forKey: .soundEnabled) ?? true
    }

    var xpToNextLevel: Int { max(100, level * 100) }
    var winRate: Int { battles == 0 ? 0 : Int((Double(wins) / Double(battles)) * 100) }
    var distanceKilometers: Double { Double(totalSteps) * 0.000762 }
}

enum Affinity: String, Codable, CaseIterable, Identifiable {
    case flora = "Flora"
    case ember = "Ember"
    case tide = "Tide"
    case storm = "Storm"
    case shadow = "Shadow"
    case feral = "Feral"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .flora: return "leaf.fill"
        case .ember: return "flame.fill"
        case .tide: return "drop.fill"
        case .storm: return "bolt.fill"
        case .shadow: return "moon.stars.fill"
        case .feral: return "pawprint.fill"
        }
    }
}

enum EncounterRarity: String, Codable, CaseIterable {
    case common = "Common"
    case uncommon = "Uncommon"
    case rare = "Rare"
    case aberrant = "Aberrant"

    var rewardMultiplier: Int {
        switch self {
        case .common: return 1
        case .uncommon: return 2
        case .rare: return 3
        case .aberrant: return 5
        }
    }
}

struct WildEnemy: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let level: Int
    let affinity: Affinity
    let latitude: Double
    let longitude: Double
    let symbol: String
    let baseHP: Int
    let seed: Int
    let rarity: EncounterRarity

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct EvolutionOption: Identifiable {
    let id = UUID()
    let name: String
    let affinity: Affinity
    let description: String
    let requiredAffinity: Int
    let requiredLevel: Int
    let symbol: String
}

enum CosmeticSlot: String, Codable, CaseIterable, Identifiable {
    case head = "Head"
    case marking = "Marking"
    case aura = "Aura"
    case trail = "Trail"

    var id: String { rawValue }
}

enum CosmeticRarity: String, Codable {
    case common = "Common"
    case rare = "Rare"
    case mythic = "Mythic"
}

struct CosmeticItem: Identifiable, Hashable {
    let id: String
    let name: String
    let slot: CosmeticSlot
    let rarity: CosmeticRarity
    let cost: Int
    let icon: String
    let description: String

    static let catalog: [CosmeticItem] = [
        CosmeticItem(id: "head.none", name: "Natural", slot: .head, rarity: .common, cost: 0, icon: "pawprint.fill", description: "Let your Wildform's natural features show."),
        CosmeticItem(id: "head.crownleaf", name: "Crownleaf", slot: .head, rarity: .common, cost: 120, icon: "leaf.fill", description: "A living crown woven from bright wild leaves."),
        CosmeticItem(id: "head.stargoggles", name: "Star Goggles", slot: .head, rarity: .rare, cost: 420, icon: "eyeglasses", description: "Oversized explorer lenses with a faint cosmic glow."),
        CosmeticItem(id: "head.crystalcrest", name: "Crystal Crest", slot: .head, rarity: .mythic, cost: 900, icon: "diamond.fill", description: "A prismatic crest that refracts nearby Wild energy."),
        CosmeticItem(id: "mark.none", name: "Unmarked", slot: .marking, rarity: .common, cost: 0, icon: "circle", description: "Your natural coat pattern."),
        CosmeticItem(id: "mark.speckles", name: "Glow Speckles", slot: .marking, rarity: .common, cost: 90, icon: "sparkles", description: "Soft bioluminescent freckles across the face and body."),
        CosmeticItem(id: "mark.runes", name: "Ancient Runes", slot: .marking, rarity: .rare, cost: 360, icon: "scribble.variable", description: "Mysterious markings that pulse when your energy rises."),
        CosmeticItem(id: "aura.none", name: "Quiet Field", slot: .aura, rarity: .common, cost: 0, icon: "circle.dotted", description: "No additional aura effect."),
        CosmeticItem(id: "aura.fireflies", name: "Firefly Drift", slot: .aura, rarity: .common, cost: 160, icon: "sparkle", description: "Tiny lights orbit your Wildform while it rests."),
        CosmeticItem(id: "aura.storm", name: "Static Halo", slot: .aura, rarity: .rare, cost: 500, icon: "bolt.circle.fill", description: "A crackling field of harmless static arcs."),
        CosmeticItem(id: "aura.cosmic", name: "Cosmic Wake", slot: .aura, rarity: .mythic, cost: 1_100, icon: "moon.stars.fill", description: "A deep-space shimmer surrounds every movement."),
        CosmeticItem(id: "trail.mint", name: "Mint Trail", slot: .trail, rarity: .common, cost: 140, icon: "wind", description: "Leave a soft mint wake during movement."),
        CosmeticItem(id: "trail.embers", name: "Ember Steps", slot: .trail, rarity: .rare, cost: 480, icon: "flame.fill", description: "Tiny embers scatter behind energetic movements.")
    ]
}

struct CreatureGenome: Hashable {
    let seed: Int
    let bodyVariant: Int
    let earVariant: Int
    let hornVariant: Int
    let eyeVariant: Int
    let tailVariant: Int
    let markingVariant: Int

    init(seed: Int, species: String) {
        let speciesValue = species.unicodeScalars.reduce(0) { ($0 &* 31) &+ Int($1.value) }
        var value = UInt64(bitPattern: Int64(seed &+ speciesValue))
        func next(_ modulus: Int) -> Int {
            value = value &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
            return Int((value >> 33) % UInt64(modulus))
        }
        bodyVariant = next(3)
        earVariant = next(4)
        hornVariant = next(4)
        eyeVariant = next(3)
        tailVariant = next(4)
        markingVariant = next(3)
        self.seed = seed
    }
}
