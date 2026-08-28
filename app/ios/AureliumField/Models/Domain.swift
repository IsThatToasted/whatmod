import Foundation

struct ProjectSummary: Identifiable, Hashable {
    let id: UUID
    var name: String
    var client: String
    var location: String
    var status: String
    var progress: Double

    static let samples: [ProjectSummary] = [
        .init(id: UUID(), name: "Hamilton Residence", client: "Maya Hamilton", location: "Lancaster, PA", status: "Estimating", progress: 0.18),
        .init(id: UUID(), name: "North Queen Retail Fit-Out", client: "North Queen Retail", location: "Lancaster, PA", status: "Active", progress: 0.67),
        .init(id: UUID(), name: "York Medical Offices", client: "Keystone Medical", location: "York, PA", status: "Scheduled", progress: 0)
    ]
}

struct EstimateDraft: Identifiable {
    let id: UUID
    var title: String
    var customer: String
    var rooms: [CapturedRoomSummary]
    var notes: [WalkthroughNote]

    static let sample = EstimateDraft(id: UUID(), title: "Hamilton Residence", customer: "Maya Hamilton", rooms: [], notes: [])
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
