import Foundation

struct ProjectSummary: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var client: String
    var location: String
    var status: String
    var progress: Double
    var trade: String
    var notes: String
    var updatedAt: Date

    static let samples: [ProjectSummary] = [
        .init(id: UUID(), name: "Hamilton Residence", client: "Maya Hamilton", location: "Lancaster, PA", status: "Estimating", progress: 0.18, trade: "Painting", notes: "Interior repaint and trim package", updatedAt: .now),
        .init(id: UUID(), name: "North Queen Retail Fit-Out", client: "North Queen Retail", location: "Lancaster, PA", status: "Active", progress: 0.67, trade: "Painting", notes: "Retail fit-out", updatedAt: .now),
        .init(id: UUID(), name: "York Medical Offices", client: "Keystone Medical", location: "York, PA", status: "Scheduled", progress: 0, trade: "General", notes: "Office refresh", updatedAt: .now)
    ]
}

struct EstimateDraft: Identifiable, Codable {
    let id: UUID
    var projectID: UUID?
    var title: String
    var customer: String
    var rooms: [CapturedRoomSummary]
    var notes: [WalkthroughNote]

    static let sample = EstimateDraft(id: UUID(), projectID: nil, title: "Smart Estimate", customer: "", rooms: [], notes: [])
}

struct CapturedRoomSummary: Identifiable, Codable, Hashable {
    let id: UUID
    var name: String
    var wallCount: Int
    var doorCount: Int
    var windowCount: Int
    var source: CaptureSource
    var verificationRequired: Bool

    enum CaptureSource: String, Codable { case roomPlan, manual }
}

struct WalkthroughNote: Identifiable, Codable, Hashable {
    let id: UUID
    var timestamp: Date
    var transcript: String
}

enum EvidenceTag: String, CaseIterable, Codable, Hashable {
    case damage = "DAMAGE"
    case remove = "REMOVE"
    case doNotDisturb = "DO NOT DISTURB"
    case cover = "COVER"
    case paint = "PAINT"

    var icon: String {
        switch self {
        case .damage: return "exclamationmark.triangle.fill"
        case .remove: return "arrow.up.right.square"
        case .doNotDisturb: return "hand.raised.fill"
        case .cover: return "square.on.square"
        case .paint: return "paintbrush.fill"
        }
    }
}

struct TaggedCapture: Identifiable, Codable, Hashable {
    let id: UUID
    var tag: EvidenceTag
    var capturedAt: Date
    var imageFileName: String
    var note: String?
}

struct MeasuredWall: Identifiable, Codable, Hashable {
    var id: UUID
    var lengthFeet: Double
    var heightFeet: Double
    var grossSquareFeet: Double
}

struct RoomMeasurementSummary: Codable, Hashable {
    var wallLinearFeet: Double
    var averageWallHeightFeet: Double
    var grossWallSquareFeet: Double
    var openingsSquareFeet: Double
    var paintableWallSquareFeet: Double
    // Added in v0.3.1. Optional so walkthroughs saved by older builds still decode.
    var ceilingSquareFeet: Double?
    var detectedDoorCount: Int?
    var detectedWindowCount: Int?
    var estimatedTrimLinearFeet: Double?
}

enum EstimateScopeKind: String, Codable, Hashable, CaseIterable {
    case walls = "Paint Walls"
    case doors = "Paint Doors"
    case windows = "Paint Windows"
    case trim = "Paint Trim"
    case ceiling = "Paint Ceiling"
}

struct ScopeEstimateLine: Codable, Hashable, Identifiable {
    var kind: EstimateScopeKind
    var enabled: Bool
    var quantity: Double
    var unit: String
    var productionRate: Double
    var laborHours: Double
    var id: String { kind.rawValue }
}

struct AutoEstimateResult: Codable, Hashable {
    var productionSquareFeetPerHour: Double
    var laborHours: Double
    var measurementsConfirmed: Bool
    // v0.3.1 multi-scope estimate detail. Optional for backwards-compatible decoding.
    var scopeLines: [ScopeEstimateLine]?
    var totalLaborHours: Double?
}

struct WalkthroughScan: Identifiable, Codable, Hashable {
    let id: UUID
    var projectID: UUID
    var createdAt: Date
    var room: CapturedRoomSummary
    var transcript: String
    var captures: [TaggedCapture]
    var videoFileName: String?
    var durationSeconds: Double?
    var usdzFileName: String?
    var roomPlanJSONFileName: String?
    var measurements: RoomMeasurementSummary?
    var autoEstimate: AutoEstimateResult?
    var measuredWalls: [MeasuredWall]?
    var archivedAt: Date? = nil
}

enum AppMediaStore {
    static var directory: URL {
        let base = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let url = base.appendingPathComponent("AureliumWalkthroughMedia", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    static func url(for fileName: String) -> URL { directory.appendingPathComponent(fileName) }
}
