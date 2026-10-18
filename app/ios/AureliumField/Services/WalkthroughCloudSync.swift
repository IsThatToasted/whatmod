import Foundation

@MainActor
final class WalkthroughCloudSync {
    static let shared = WalkthroughCloudSync()
    private init() {}

    func sync(_ scan: WalkthroughScan, project: ProjectSummary) async {
        let cloud = WorkspaceService.shared
        guard let org = cloud.organizationID, let user = cloud.userID else { return }
        do {
            // Ensure the project exists in the cloud first.
            await cloud.upsertProject(project)
            let root = "\(org.uuidString)/\(project.id.uuidString)/\(user.uuidString)/\(scan.id.uuidString)"
            var videoPath: String?, usdzPath: String?, roomJSONPath: String?

            if let name = scan.videoFileName { videoPath = try await upload(cloud: cloud, localName: name, path: "\(root)/scan.mp4", contentType: "video/mp4") }
            if let name = scan.usdzFileName { usdzPath = try await upload(cloud: cloud, localName: name, path: "\(root)/room.usdz", contentType: "application/octet-stream") }
            if let name = scan.roomPlanJSONFileName { roomJSONPath = try await upload(cloud: cloud, localName: name, path: "\(root)/room.json", contentType: "application/json") }

            let estimateID = UUID(), roomID = scan.room.id
            struct EstimateInsert: Encodable { let id:UUID;let organization_id:UUID;let project_id:UUID;let status:String;let title:String;let summary:String?;let created_by:UUID }
            try await cloud.insertRecord(table: "estimates", payload: EstimateInsert(id: estimateID, organization_id: org, project_id: project.id, status: "draft", title: "\(project.name) · \(scan.room.name)", summary: scan.transcript.isEmpty ? nil : scan.transcript, created_by: user))

            struct RoomInsert: Encodable { let id:UUID;let estimate_id:UUID;let name:String;let height_ft:Double?;let capture_source:String;let confidence:Double? }
            try await cloud.insertRecord(table: "estimate_rooms", payload: RoomInsert(id: roomID, estimate_id: estimateID, name: scan.room.name, height_ft: scan.measurements?.averageWallHeightFeet, capture_source: "roomplan", confidence: scan.autoEstimate?.measurementsConfirmed == true ? 0.95 : 0.75))

            if let m = scan.measurements {
                struct SurfaceInsert: Encodable { let room_id:UUID;let kind:String;let quantity:Double;let unit:String;let condition:String;let confidence:Double;let source:String;let verified_by:UUID?;let verified_at:Date? }
                try await cloud.insertRecord(table: "estimate_surfaces", payload: SurfaceInsert(room_id: roomID, kind: "walls", quantity: m.paintableWallSquareFeet, unit: "sqft", condition: "good", confidence: scan.autoEstimate?.measurementsConfirmed == true ? 0.95 : 0.75, source: "roomplan", verified_by: scan.autoEstimate?.measurementsConfirmed == true ? user : nil, verified_at: scan.autoEstimate?.measurementsConfirmed == true ? .now : nil))
                if let auto = scan.autoEstimate {
                    struct LineInsert: Encodable { let estimate_id:UUID;let room_id:UUID;let name:String;let description:String;let quantity:Double;let unit:String;let unit_price_cents:Int;let labor_hours:Double }
                    let lines = auto.scopeLines ?? [ScopeEstimateLine(kind: .walls, enabled: true, quantity: m.paintableWallSquareFeet, unit: "sqft", productionRate: auto.productionSquareFeetPerHour, laborHours: auto.laborHours)]
                    for line in lines where line.enabled {
                        let description = "RoomPlan-assisted quantity at \(String(format: "%.1f", line.productionRate)) \(line.unit)/labor hr"
                        try await cloud.insertRecord(table: "estimate_line_items", payload: LineInsert(estimate_id: estimateID, room_id: roomID, name: line.kind.rawValue, description: description, quantity: line.quantity, unit: line.unit, unit_price_cents: 0, labor_hours: line.laborHours))
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
            try await cloud.insertRecord(table: "walkthrough_scans", payload: ScanInsert(id: scan.id, organization_id: org, project_id: project.id, estimate_id: estimateID, room_id: roomID, captured_by: user, transcript: scan.transcript, video_storage_path: videoPath, usdz_storage_path: usdzPath, roomplan_storage_path: roomJSONPath, wall_count: scan.room.wallCount, door_count: scan.room.doorCount, window_count: scan.room.windowCount, duration_seconds: scan.durationSeconds, wall_gross_sqft: m?.grossWallSquareFeet, openings_sqft: m?.openingsSquareFeet, paintable_wall_sqft: m?.paintableWallSquareFeet, average_wall_height_ft: m?.averageWallHeightFeet, wall_linear_ft: m?.wallLinearFeet, measurements_confirmed: scan.autoEstimate?.measurementsConfirmed ?? false, production_units_per_hour: scan.autoEstimate?.productionSquareFeetPerHour, room_name: scan.room.name, archived_at: scan.archivedAt))

            for capture in scan.captures {
                let path = try await upload(cloud: cloud, localName: capture.imageFileName, path: "\(root)/\(capture.id.uuidString).jpg", contentType: "image/jpeg")
                struct MediaInsert: Encodable { let organization_id:UUID;let project_id:UUID;let estimate_id:UUID;let room_id:UUID;let uploaded_by:UUID;let storage_path:String;let mime_type:String;let captured_at:Date;let walkthrough_id:UUID;let evidence_tag:String }
                try await cloud.insertRecord(table: "project_media", payload: MediaInsert(organization_id: org, project_id: project.id, estimate_id: estimateID, room_id: roomID, uploaded_by: user, storage_path: path, mime_type: "image/jpeg", captured_at: capture.capturedAt, walkthrough_id: scan.id, evidence_tag: capture.tag.rawValue))
            }
        } catch {
            WorkspaceService.shared.errorMessage = "Walkthrough saved on device, but cloud sync failed: \(error.localizedDescription)"
        }
    }

    func completeProjectWalkthrough(projectID: UUID) async {
        let cloud = WorkspaceService.shared
        do {
            struct Params: Encodable { let target_project_id: UUID }
            let _: Date = try await cloud.rpcValue("complete_project_walkthrough", params: Params(target_project_id: projectID), as: Date.self)
        } catch {
            cloud.errorMessage = "Walkthroughs were completed on this device, but cloud archive failed: \(error.localizedDescription)"
        }
    }

    private func upload(cloud: WorkspaceService, localName: String, path: String, contentType: String) async throws -> String {
        let data = try Data(contentsOf: AppMediaStore.url(for: localName))
        return try await cloud.uploadStorage(bucket: "walkthrough-media", path: path, data: data, contentType: contentType)
    }
}
