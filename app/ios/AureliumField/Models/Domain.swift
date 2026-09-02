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

struct ScannerCorrectionSummary: Codable, Hashable {
    var rawDoorCount: Int
    var rawWindowCount: Int
    var confirmedDoorCount: Int
    var confirmedWindowCount: Int
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
    var scannerCorrections: ScannerCorrectionSummary? = nil
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

// MARK: - Smart Scanner v2 / Blueprint Estimate

enum SmartScanMode: String, Codable, CaseIterable, Hashable {
    case interior = "Interior"
    case exterior = "Exterior"
}

enum TaughtFeatureKind: String, Codable, CaseIterable, Hashable {
    case door = "Door"
    case window = "Window"
    case opening = "Opening"
    case roofSlope = "Roof slope"
    case wall = "Wall"

    var systemImage: String {
        switch self {
        case .door: return "door.left.hand.open"
        case .window: return "rectangle.split.3x1"
        case .opening: return "rectangle.dashed"
        case .roofSlope: return "angle"
        case .wall: return "square.split.2x1"
        }
    }
}

struct SmartOpening: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var kind: TaughtFeatureKind
    var widthFeet: Double
    var heightFeet: Double
    var confidence: Double
    var source: String
    var confirmedByUser: Bool
    var capturedAt: Date = .now

    var areaSquareFeet: Double { widthFeet * heightFeet }
}

struct SmartSurface: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var label: String
    var widthFeet: Double
    var heightFeet: Double
    var confidence: Double
    var source: String
    var slopeDegrees: Double? = nil

    var grossSquareFeet: Double { widthFeet * heightFeet }
}

struct ScannerLearningSample: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var projectID: UUID
    var walkthroughID: UUID?
    var mode: SmartScanMode
    var feature: TaughtFeatureKind
    var action: String
    var predictedCount: Int? = nil
    var correctedCount: Int? = nil
    var predictedWidthFeet: Double? = nil
    var predictedHeightFeet: Double? = nil
    var correctedWidthFeet: Double? = nil
    var correctedHeightFeet: Double? = nil
    var correctedSlopeDegrees: Double? = nil
    var confidence: Double? = nil
    var createdAt: Date = .now
}

enum BlueprintIssueSeverity: String, Codable, Hashable { case info, warning, blocking }

struct BlueprintIssue: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var pageNumber: Int
    var severity: BlueprintIssueSeverity
    var message: String
    var resolved: Bool = false
}

struct BlueprintQuantity: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var pageNumber: Int
    var sourceLabel: String
    var scope: EstimateScopeKind
    var quantity: Double
    var unit: String
    var confidence: Double
    var evidence: String
    var needsVerification: Bool
}

struct BlueprintRoomGeometry: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var label: String
    var lengthFeet: Double
    var widthFeet: Double
}

struct BlueprintPageAnalysis: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var pageNumber: Int
    var title: String
    var recognizedText: String
    var drawingScale: String?
    var roomNames: [String]
    var finishCodes: [String]
    var quantities: [BlueprintQuantity]
    var issues: [BlueprintIssue]
}


struct BlueprintAssumptions: Codable, Hashable {
    var wallHeightFeet: Double? = nil
    var coats: Int = 2
    var wastePercent: Double = 5
    var wallProductionRate: Double = 150
    var ceilingProductionRate: Double = 125
    var trimProductionRate: Double = 50
    var doorProductionRate: Double = 2
    var windowProductionRate: Double = 2
    var includeWalls: Bool = true
    var includeCeilings: Bool = true
    var includeTrim: Bool = true
    var includeDoors: Bool = true
    var includeWindows: Bool = true
}

struct BlueprintEstimateDraft: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var projectID: UUID
    var fileName: String
    var importedAt: Date = .now
    var pages: [BlueprintPageAnalysis]
    var issues: [BlueprintIssue]
    var proposalReady: Bool
    var totalPaintableSquareFeet: Double
    var totalLaborHours: Double
    var notes: String = ""
    var assumptions: BlueprintAssumptions? = nil
    var reviewedAt: Date? = nil
}
