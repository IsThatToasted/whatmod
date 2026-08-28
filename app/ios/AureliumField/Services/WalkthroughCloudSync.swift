import Foundation
import Supabase

@MainActor
final class WalkthroughCloudSync {
    static let shared = WalkthroughCloudSync()
    private init() {}

    func sync(_ scan: WalkthroughScan, project: ProjectSummary) async {
        let cloud = SupabaseService.shared
        guard let client = cloud.client, let org = cloud.organizationID, let user = cloud.userID else { return }
        do {
            // Ensure the project exists in the cloud first.
            await cloud.upsertProject(project)
            let root = "\(org.uuidString)/\(project.id.uuidString)/\(user.uuidString)/\(scan.id.uuidString)"
            var videoPath: String?, usdzPath: String?, roomJSONPath: String?

            if let name = scan.videoFileName { videoPath = try await upload(client: client, localName: name, path: "\(root)/scan.mp4", contentType: "video/mp4") }
            if let name = scan.usdzFileName { usdzPath = try await upload(client: client, localName: name, path: "\(root)/room.usdz", contentType: "application/octet-stream") }
            if let name = scan.roomPlanJSONFileName { roomJSONPath = try await upload(client: client, localName: name, path: "\(root)/room.json", contentType: "application/json") }

            let estimateID = UUID(), roomID = scan.room.id
            struct EstimateInsert: Encodable { let id:UUID;let organization_id:UUID;let project_id:UUID;let status:String;let title:String;let summary:String?;let created_by:UUID }
            try await client.from("estimates").insert(EstimateInsert(id: estimateID, organization_id: org, project_id: project.id, status: "draft", title: "\(project.name) · \(scan.room.name)", summary: scan.transcript.isEmpty ? nil : scan.transcript, created_by: user)).execute()

            struct RoomInsert: Encodable { let id:UUID;let estimate_id:UUID;let name:String;let height_ft:Double?;let capture_source:String;let confidence:Double? }
            try await client.from("estimate_rooms").insert(RoomInsert(id: roomID, estimate_id: estimateID, name: scan.room.name, height_ft: scan.measurements?.averageWallHeightFeet, capture_source: "roomplan", confidence: scan.autoEstimate?.measurementsConfirmed == true ? 0.95 : 0.75)).execute()

            if let m = scan.measurements {
                struct SurfaceInsert: Encodable { let room_id:UUID;let kind:String;let quantity:Double;let unit:String;let condition:String;let confidence:Double;let source:String;let verified_by:UUID?;let verified_at:Date? }
                try await client.from("estimate_surfaces").insert(SurfaceInsert(room_id: roomID, kind: "walls", quantity: m.paintableWallSquareFeet, unit: "sqft", condition: "good", confidence: scan.autoEstimate?.measurementsConfirmed == true ? 0.95 : 0.75, source: "roomplan", verified_by: scan.autoEstimate?.measurementsConfirmed == true ? user : nil, verified_at: scan.autoEstimate?.measurementsConfirmed == true ? .now : nil)).execute()
                if let auto = scan.autoEstimate {
                    struct LineInsert: Encodable { let estimate_id:UUID;let room_id:UUID;let name:String;let description:String;let quantity:Double;let unit:String;let unit_price_cents:Int;let labor_hours:Double }
                    let lines = auto.scopeLines ?? [ScopeEstimateLine(kind: .walls, enabled: true, quantity: m.paintableWallSquareFeet, unit: "sqft", productionRate: auto.productionSquareFeetPerHour, laborHours: auto.laborHours)]
                    for line in lines where line.enabled {
                        let description = "Spatially measured quantity at \(String(format: "%.1f", line.productionRate)) \(line.unit)/labor hr"
                        try await client.from("estimate_line_items").insert(LineInsert(estimate_id: estimateID, room_id: roomID, name: line.kind.rawValue, description: description, quantity: line.quantity, unit: line.unit, unit_price_cents: 0, labor_hours: line.laborHours)).execute()
                    }
                }
            }

            struct ScanInsert: Encodable {
                let id:UUID;let organization_id:UUID;let project_id:UUID;let estimate_id:UUID;let room_id:UUID;let captured_by:UUID;let transcript:String
                let video_storage_path:String?;let usdz_storage_path:String?;let roomplan_storage_path:String?;let wall_count:Int;let door_count:Int;let window_count:Int;let duration_seconds:Double?
                let wall_gross_sqft:Double?;let openings_sqft:Double?;let paintable_wall_sqft:Double?;let average_wall_height_ft:Double?;let wall_linear_ft:Double?;let measurements_confirmed:Bool;let production_units_per_hour:Double?
                let room_name:String?;let archived_at:Date?
            }
            let m = scan.measurements
            try await client.from("walkthrough_scans").insert(ScanInsert(id: scan.id, organization_id: org, project_id: project.id, estimate_id: estimateID, room_id: roomID, captured_by: user, transcript: scan.transcript, video_storage_path: videoPath, usdz_storage_path: usdzPath, roomplan_storage_path: roomJSONPath, wall_count: scan.room.wallCount, door_count: scan.room.doorCount, window_count: scan.room.windowCount, duration_seconds: scan.durationSeconds, wall_gross_sqft: m?.grossWallSquareFeet, openings_sqft: m?.openingsSquareFeet, paintable_wall_sqft: m?.paintableWallSquareFeet, average_wall_height_ft: m?.averageWallHeightFeet, wall_linear_ft: m?.wallLinearFeet, measurements_confirmed: scan.autoEstimate?.measurementsConfirmed ?? false, production_units_per_hour: scan.autoEstimate?.productionSquareFeetPerHour, room_name: scan.room.name, archived_at: scan.archivedAt)).execute()

            for capture in scan.captures {
                let path = try await upload(client: client, localName: capture.imageFileName, path: "\(root)/\(capture.id.uuidString).jpg", contentType: "image/jpeg")
                struct MediaInsert: Encodable { let organization_id:UUID;let project_id:UUID;let estimate_id:UUID;let room_id:UUID;let uploaded_by:UUID;let storage_path:String;let mime_type:String;let captured_at:Date;let walkthrough_id:UUID;let evidence_tag:String }
                try await client.from("project_media").insert(MediaInsert(organization_id: org, project_id: project.id, estimate_id: estimateID, room_id: roomID, uploaded_by: user, storage_path: path, mime_type: "image/jpeg", captured_at: capture.capturedAt, walkthrough_id: scan.id, evidence_tag: capture.tag.rawValue)).execute()
            }
        } catch {
            AFPublicError.capture(error, code: .walkthroughSync); SupabaseService.shared.errorMessage = AFPublicError.text(.walkthroughSync, "The walkthrough is saved on this device, but workspace sync is pending.")
        }
    }

    func completeProjectWalkthrough(projectID: UUID) async {
        let cloud = SupabaseService.shared
        guard let client = cloud.client else { return }
        do {
            struct Params: Encodable { let target_project_id: UUID }
            let _: Date = try await client.rpc("complete_project_walkthrough", params: Params(target_project_id: projectID)).execute().value
        } catch {
            AFPublicError.capture(error, code: .walkthroughArchive); cloud.errorMessage = AFPublicError.text(.walkthroughArchive, "The walkthrough is complete on this device, but workspace archiving is pending.")
        }
    }

    private func upload(client: SupabaseClient, localName: String, path: String, contentType: String) async throws -> String {
        let data = try Data(contentsOf: AppMediaStore.url(for: localName))
        try await client.storage.from("walkthrough-media").upload(path: path, file: data, options: FileOptions(cacheControl: "3600", contentType: contentType, upsert: false))
        return path
    }
}
