import Foundation

/// Stores a queryable summary of an exterior scan in `exterior_scan_details` (migration 015).
///
/// Deliberately best-effort and isolated from WalkthroughCloudSync:
///  - If migration 015 has not been applied yet, the insert fails silently and nothing else is affected.
///  - The authoritative scan, estimate rows, photos and the full detail JSON still sync through the existing path.
///  - Runs only after the existing walkthrough sync has finished so the walkthrough_scans row exists.
@MainActor
final class ExteriorDetailCloudSync {
    static let shared = ExteriorDetailCloudSync()
    private init() {}

    private struct Payload: Encodable {
        let walkthrough_id: UUID
        let project_id: UUID
        let wall_count: Int
        let stories: Int
        let surface: String
        let condition: String
        let perimeter_ft: Double
        let gross_sqft: Double
        let gable_sqft: Double
        let openings_deducted_sqft: Double
        let net_sqft: Double
        let trim_lf: Double
        let labor_hours: Double
        let roof_slope_degrees: Double?
        let loop_closed: Bool
        let closure_error_ft: Double?
        let confidence_score: Double
        let confidence_label: String
        let heights_measured: Int
        let detail: ExteriorScanDetail
    }

    func sync(_ scan: WalkthroughScan, detail: ExteriorScanDetail) async {
        let cloud = WorkspaceService.shared
        guard cloud.organizationID != nil, cloud.userID != nil else { return }
        let take = ExteriorEstimator.compute(walls: detail.walls, inputs: detail.inputs)
        let report = ExteriorConfidence.evaluate(detail: detail)
        let payload = Payload(
            walkthrough_id: scan.id,
            project_id: scan.projectID,
            wall_count: detail.walls.count,
            stories: detail.inputs.stories,
            surface: detail.inputs.surface.rawValue,
            condition: detail.inputs.condition.rawValue,
            perimeter_ft: take.perimeterFeet,
            gross_sqft: take.grossSquareFeet,
            gable_sqft: take.gableSquareFeet,
            openings_deducted_sqft: take.deductedSquareFeet,
            net_sqft: take.netSquareFeet,
            trim_lf: take.trimLinearFeet,
            labor_hours: take.totalLaborHours,
            roof_slope_degrees: take.maxSlopeDegrees,
            loop_closed: detail.loopClosed,
            closure_error_ft: detail.closureErrorFeet,
            confidence_score: report.score,
            confidence_label: report.label,
            heights_measured: detail.walls.filter { $0.heightMeasured }.count,
            detail: detail
        )
        do { try await cloud.insertRecord(table: "exterior_scan_details", payload: payload) } catch { }
    }
}
