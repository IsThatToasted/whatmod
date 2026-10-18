import Foundation

struct AdminEstimateWalkthroughSnapshot: Codable, Identifiable, Hashable {
    var id: UUID
    var roomName: String?
    var capturedAt: Date?
    var wallCount: Int?
    var doorCount: Int?
    var windowCount: Int?
    var wallGrossSqft: Double?
    var openingsSqft: Double?
    var paintableWallSqft: Double?
    var averageWallHeightFt: Double?
    var wallLinearFt: Double?
    var measurementsConfirmed: Bool?
    var scopeLines: [ScopeEstimateLine]?
    var estimateNotes: String?
    var transcript: String?
    var videoStoragePath: String?
    var usdzStoragePath: String?
    var roomplanStoragePath: String?

    enum CodingKeys: String, CodingKey {
        case id, transcript
        case roomName = "room_name"
        case capturedAt = "captured_at"
        case wallCount = "wall_count"
        case doorCount = "door_count"
        case windowCount = "window_count"
        case wallGrossSqft = "wall_gross_sqft"
        case openingsSqft = "openings_sqft"
        case paintableWallSqft = "paintable_wall_sqft"
        case averageWallHeightFt = "average_wall_height_ft"
        case wallLinearFt = "wall_linear_ft"
        case measurementsConfirmed = "measurements_confirmed"
        case scopeLines = "scope_lines"
        case estimateNotes = "estimate_notes"
        case videoStoragePath = "video_storage_path"
        case usdzStoragePath = "usdz_storage_path"
        case roomplanStoragePath = "roomplan_storage_path"
    }
}

struct AdminEstimateLineSnapshot: Codable, Identifiable, Hashable {
    var estimateID: UUID?
    var roomID: UUID?
    var name: String
    var description: String?
    var quantity: Double
    var unit: String
    var unitPriceCents: Int
    var laborHours: Double?
    var materialCostCents: Int?
    var optional: Bool
    var id: String { "\(estimateID?.uuidString ?? "estimate")-\(roomID?.uuidString ?? "room")-\(name)-\(quantity)" }

    enum CodingKeys: String, CodingKey {
        case name, description, quantity, unit, optional
        case estimateID = "estimate_id"
        case roomID = "room_id"
        case unitPriceCents = "unit_price_cents"
        case laborHours = "labor_hours"
        case materialCostCents = "material_cost_cents"
    }
}

struct AdminEstimateEvidence: Codable, Identifiable, Hashable {
    var id: UUID
    var walkthroughID: UUID?
    var roomID: UUID?
    var storagePath: String
    var mimeType: String
    var capturedAt: Date
    var evidenceTag: String?

    enum CodingKeys: String, CodingKey {
        case id
        case walkthroughID = "walkthrough_id"
        case roomID = "room_id"
        case storagePath = "storage_path"
        case mimeType = "mime_type"
        case capturedAt = "captured_at"
        case evidenceTag = "evidence_tag"
    }
}

struct AdminEstimatePacket: Codable, Identifiable, Hashable {
    var id: UUID
    var organizationID: UUID
    var projectID: UUID
    var revision: Int
    var status: String
    var title: String
    var customerName: String?
    var customerEmail: String?
    var scopeSummary: String?
    var customerNotes: String?
    var internalNotes: String?
    var terms: String?
    var subtotalCents: Int
    var taxCents: Int
    var totalCents: Int
    var totalLaborHours: Double
    var walkthroughCount: Int
    var walkthroughSnapshot: [AdminEstimateWalkthroughSnapshot]
    var lineItemSnapshot: [AdminEstimateLineSnapshot]
    var evidenceSnapshot: [AdminEstimateEvidence]
    var submittedAt: Date
    var reviewedAt: Date?
    var approvedAt: Date?
    var rejectedAt: Date?
    var rejectionReason: String?
    var finalizedAt: Date?
    var sentAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, revision, status, title, terms
        case organizationID = "organization_id"
        case projectID = "project_id"
        case customerName = "customer_name"
        case customerEmail = "customer_email"
        case scopeSummary = "scope_summary"
        case customerNotes = "customer_notes"
        case internalNotes = "internal_notes"
        case subtotalCents = "subtotal_cents"
        case taxCents = "tax_cents"
        case totalCents = "total_cents"
        case totalLaborHours = "total_labor_hours"
        case walkthroughCount = "walkthrough_count"
        case walkthroughSnapshot = "walkthrough_snapshot"
        case lineItemSnapshot = "line_item_snapshot"
        case evidenceSnapshot = "evidence_snapshot"
        case submittedAt = "submitted_at"
        case reviewedAt = "reviewed_at"
        case approvedAt = "approved_at"
        case rejectedAt = "rejected_at"
        case rejectionReason = "rejection_reason"
        case finalizedAt = "finalized_at"
        case sentAt = "sent_at"
    }
}

@MainActor
final class EstimateAdminService {
    static let shared = EstimateAdminService()
    private init() {}

    func fetchPackets() async throws -> [AdminEstimatePacket] {
        let cloud = WorkspaceService.shared
        guard cloud.isAdmin, let organizationID = cloud.organizationID else { return [] }
        return try await cloud.selectRows(
            table: "estimate_review_packets",
            columns: "id,organization_id,project_id,revision,status,title,customer_name,customer_email,scope_summary,customer_notes,internal_notes,terms,subtotal_cents,tax_cents,total_cents,total_labor_hours,walkthrough_count,walkthrough_snapshot,line_item_snapshot,evidence_snapshot,submitted_at,reviewed_at,approved_at,rejected_at,rejection_reason,finalized_at,sent_at",
            filters: [CloudFilter("organization_id", organizationID.uuidString)],
            order: "submitted_at.desc",
            limit: 100
        )
    }

    func setReviewState(id: UUID, status: String, note: String?) async throws {
        struct Params: Encodable { let packet_id: UUID; let new_status: String; let review_note: String? }
        try await WorkspaceService.shared.rpcVoid("admin_set_estimate_review_state", params: Params(packet_id: id, new_status: status, review_note: note))
    }

    func finalize(id: UUID, title: String, customerName: String, customerEmail: String?, scopeSummary: String?, customerNotes: String?, terms: String?, subtotalCents: Int, taxCents: Int) async throws {
        struct Params: Encodable {
            let packet_id: UUID
            let proposal_title: String
            let proposal_customer_name: String
            let proposal_customer_email: String?
            let proposal_scope_summary: String?
            let proposal_customer_notes: String?
            let proposal_terms: String?
            let proposal_subtotal_cents: Int
            let proposal_tax_cents: Int
        }
        try await WorkspaceService.shared.rpcVoid("admin_finalize_estimate_packet", params: Params(packet_id: id, proposal_title: title, proposal_customer_name: customerName, proposal_customer_email: customerEmail, proposal_scope_summary: scopeSummary, proposal_customer_notes: customerNotes, proposal_terms: terms, proposal_subtotal_cents: max(0, subtotalCents), proposal_tax_cents: max(0, taxCents)))
    }
}
