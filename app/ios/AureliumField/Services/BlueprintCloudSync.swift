import Foundation

@MainActor
final class BlueprintCloudSync {
    static let shared = BlueprintCloudSync()
    private init() {}

    func sync(_ draft: BlueprintEstimateDraft) async {
        let payload = BlueprintDraftPayload(draft)
        try? await WorkspaceService.shared.insertRecord(table: "blueprint_estimates", payload: payload)
        for page in draft.pages {
            try? await WorkspaceService.shared.insertRecord(table: "blueprint_pages", payload: BlueprintPagePayload(draftID: draft.id, page: page))
        }
    }
}

private struct BlueprintDraftPayload: Encodable {
    var id: UUID; var project_id: UUID; var file_name: String; var proposal_ready: Bool; var paintable_square_feet: Double; var labor_hours: Double; var notes: String
    init(_ d: BlueprintEstimateDraft){id=d.id;project_id=d.projectID;file_name=d.fileName;proposal_ready=d.proposalReady;paintable_square_feet=d.totalPaintableSquareFeet;labor_hours=d.totalLaborHours;notes=d.notes}
}
private struct BlueprintPagePayload: Encodable {
    var blueprint_id: UUID; var page_number: Int; var title: String; var recognized_text: String; var drawing_scale: String?; var room_names: [String]; var finish_codes: [String]; var analysis_json: BlueprintPageAnalysis
    init(draftID:UUID,page:BlueprintPageAnalysis){blueprint_id=draftID;page_number=page.pageNumber;title=page.title;recognized_text=page.recognizedText;drawing_scale=page.drawingScale;room_names=page.roomNames;finish_codes=page.finishCodes;analysis_json=page}
}
