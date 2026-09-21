import Foundation
import CoreLocation

struct PlayerState: Codable {
    var creatureName = "Nova"
    var species = "Origin"
    var level = 1
    var xp = 0
    var bioEnergy = 0
    var totalSteps = 0
    var battles = 0
    var wins = 0
    var generation = 1
    var affinities: [Affinity: Int] = Dictionary(uniqueKeysWithValues: Affinity.allCases.map { ($0, 0) })
    var inventory: [String: Int] = [:]
    var lastStepDate = ""
    var lastRecordedSteps = 0

    var xpToNextLevel: Int { max(100, level * 100) }
    var winRate: Int { battles == 0 ? 0 : Int((Double(wins) / Double(battles)) * 100) }
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

struct WildEnemy: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let level: Int
    let affinity: Affinity
    let latitude: Double
    let longitude: Double
    let symbol: String
    let baseHP: Int

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
