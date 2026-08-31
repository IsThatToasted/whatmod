import Foundation
import Observation

struct FieldRecord: Codable, Identifiable, Hashable {
    var id: UUID
    var organizationID: UUID
    var projectID: UUID
    var createdBy: UUID
    var recordType: String
    var title: String
    var notes: String?
    var status: String
    var occurredAt: Date
    var dueAt: Date?
    var assigneeName: String?
    var weather: String?
    var manpower: Int?
    var workCompleted: String?
    var blockers: String?
    var revision: String?
    var safetyType: String?
    var severity: String?
    var acknowledged: Bool
    var attachmentPath: String?
    var attachmentName: String?
    var attachmentContentType: String?
    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, title, notes, status, weather, manpower, blockers, revision, severity, acknowledged
        case organizationID = "organization_id"
        case projectID = "project_id"
        case createdBy = "created_by"
        case recordType = "record_type"
        case occurredAt = "occurred_at"
        case dueAt = "due_at"
        case assigneeName = "assignee_name"
        case workCompleted = "work_completed"
        case safetyType = "safety_type"
        case attachmentPath = "attachment_path"
        case attachmentName = "attachment_name"
        case attachmentContentType = "attachment_content_type"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

enum FieldRecordKind: String, CaseIterable, Identifiable {
    case photoProgress = "photo_progress"
    case dailyLog = "daily_log"
    case punch = "punch"
    case document = "document"
    case safety = "safety"

    var id: String { rawValue }
    var title: String {
        switch self {
        case .photoProgress: return "Photos & Progress"
        case .dailyLog: return "Daily Log"
        case .punch: return "Punch & Quality"
        case .document: return "Plans & Documents"
        case .safety: return "Safety"
        }
    }
}

@MainActor @Observable
final class FieldOperationsService {
    static let shared = FieldOperationsService()

    var records: [FieldRecord] = []
    var isWorking = false
    var errorMessage: String?

    private var cloud: WorkspaceService { .shared }

    func refresh(projectID: UUID?) async {
        guard let projectID, let organizationID = cloud.organizationID else {
            records = []
            return
        }
        do {
            let rows: [FieldRecord] = try await cloud.selectRows(
                table: "field_records",
                columns: "id,organization_id,project_id,created_by,record_type,title,notes,status,occurred_at,due_at,assignee_name,weather,manpower,work_completed,blockers,revision,safety_type,severity,acknowledged,attachment_path,attachment_name,attachment_content_type,created_at,updated_at",
                filters: [CloudFilter("organization_id", organizationID.uuidString), CloudFilter("project_id", projectID.uuidString)],
                order: "occurred_at.desc",
                limit: 200
            )
            records = rows
        } catch {
            errorMessage = "Field records could not be loaded. Reference: AF-FIELD-101"
        }
    }

    func records(kind: FieldRecordKind) -> [FieldRecord] {
        records.filter { $0.recordType == kind.rawValue }
    }

    func addDailyLog(projectID: UUID, weather: String, manpower: Int?, workCompleted: String, blockers: String, notes: String) async -> Bool {
        await create(
            projectID: projectID,
            kind: .dailyLog,
            title: "Daily Log",
            notes: notes,
            weather: weather,
            manpower: manpower,
            workCompleted: workCompleted,
            blockers: blockers
        )
    }

    func addPunch(projectID: UUID, title: String, notes: String, assignee: String, dueAt: Date?) async -> Bool {
        await create(projectID: projectID, kind: .punch, title: title, notes: notes, dueAt: dueAt, assignee: assignee, status: "open")
    }

    func addSafety(projectID: UUID, title: String, type: String, severity: String, notes: String) async -> Bool {
        await create(projectID: projectID, kind: .safety, title: title, notes: notes, safetyType: type, severity: severity, status: "open")
    }

    func addPhoto(projectID: UUID, data: Data, fileName: String, contentType: String, caption: String) async -> Bool {
        guard let organizationID = cloud.organizationID, let userID = cloud.userID else { return false }
        isWorking = true
        defer { isWorking = false }
        do {
            let safeName = "\(UUID().uuidString)-\(fileName.replacingOccurrences(of: " ", with: "-"))"
            let path = "\(organizationID.uuidString)/\(projectID.uuidString)/\(userID.uuidString)/\(safeName)"
            _ = try await cloud.uploadStorage(bucket: "field-files", path: path, data: data, contentType: contentType)
            return await create(
                projectID: projectID,
                kind: .photoProgress,
                title: caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Progress photo" : caption,
                notes: nil,
                attachmentPath: path,
                attachmentName: fileName,
                attachmentContentType: contentType,
                managesWorkingState: false
            )
        } catch {
            errorMessage = "The photo could not be saved. Reference: AF-FIELD-102"
            return false
        }
    }

    func addDocument(projectID: UUID, data: Data, fileName: String, contentType: String, title: String, revision: String, notes: String) async -> Bool {
        guard let organizationID = cloud.organizationID, let userID = cloud.userID else { return false }
        isWorking = true
        defer { isWorking = false }
        do {
            let safeName = "\(UUID().uuidString)-\(fileName.replacingOccurrences(of: " ", with: "-"))"
            let path = "\(organizationID.uuidString)/\(projectID.uuidString)/\(userID.uuidString)/\(safeName)"
            _ = try await cloud.uploadStorage(bucket: "field-files", path: path, data: data, contentType: contentType)
            return await create(
                projectID: projectID,
                kind: .document,
                title: title.isEmpty ? fileName : title,
                notes: notes,
                revision: revision,
                attachmentPath: path,
                attachmentName: fileName,
                attachmentContentType: contentType,
                managesWorkingState: false
            )
        } catch {
            errorMessage = "The document could not be saved. Reference: AF-FIELD-103"
            return false
        }
    }

    func setStatus(_ record: FieldRecord, status: String) async {
        struct Patch: Encodable { let status: String; let acknowledged: Bool?; let updated_at: Date }
        do {
            let acknowledged = record.recordType == FieldRecordKind.safety.rawValue && status == "closed" ? true : nil
            try await cloud.updateRows(table: "field_records", payload: Patch(status: status, acknowledged: acknowledged, updated_at: .now), filters: [CloudFilter("id", record.id.uuidString)])
            await refresh(projectID: record.projectID)
        } catch {
            errorMessage = "The field item could not be updated. Reference: AF-FIELD-104"
        }
    }

    func delete(_ record: FieldRecord) async {
        do {
            try await cloud.deleteRows(table: "field_records", filters: [CloudFilter("id", record.id.uuidString)])
            await refresh(projectID: record.projectID)
        } catch {
            errorMessage = "The field item could not be removed. Reference: AF-FIELD-105"
        }
    }

    @discardableResult
    private func create(
        projectID: UUID,
        kind: FieldRecordKind,
        title: String,
        notes: String?,
        dueAt: Date? = nil,
        assignee: String? = nil,
        weather: String? = nil,
        manpower: Int? = nil,
        workCompleted: String? = nil,
        blockers: String? = nil,
        revision: String? = nil,
        safetyType: String? = nil,
        severity: String? = nil,
        status: String = "open",
        attachmentPath: String? = nil,
        attachmentName: String? = nil,
        attachmentContentType: String? = nil,
        managesWorkingState: Bool = true
    ) async -> Bool {
        guard let organizationID = cloud.organizationID, let userID = cloud.userID else { return false }
        if managesWorkingState { isWorking = true }
        defer { if managesWorkingState { isWorking = false } }

        struct Insert: Encodable {
            let organization_id: UUID
            let project_id: UUID
            let created_by: UUID
            let record_type: String
            let title: String
            let notes: String?
            let status: String
            let occurred_at: Date
            let due_at: Date?
            let assignee_name: String?
            let weather: String?
            let manpower: Int?
            let work_completed: String?
            let blockers: String?
            let revision: String?
            let safety_type: String?
            let severity: String?
            let attachment_path: String?
            let attachment_name: String?
            let attachment_content_type: String?
        }

        do {
            let payload = Insert(
                organization_id: organizationID,
                project_id: projectID,
                created_by: userID,
                record_type: kind.rawValue,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                notes: notes?.trimmingCharacters(in: .whitespacesAndNewlines),
                status: status,
                occurred_at: .now,
                due_at: dueAt,
                assignee_name: assignee?.trimmingCharacters(in: .whitespacesAndNewlines),
                weather: weather?.trimmingCharacters(in: .whitespacesAndNewlines),
                manpower: manpower,
                work_completed: workCompleted?.trimmingCharacters(in: .whitespacesAndNewlines),
                blockers: blockers?.trimmingCharacters(in: .whitespacesAndNewlines),
                revision: revision?.trimmingCharacters(in: .whitespacesAndNewlines),
                safety_type: safetyType?.trimmingCharacters(in: .whitespacesAndNewlines),
                severity: severity?.trimmingCharacters(in: .whitespacesAndNewlines),
                attachment_path: attachmentPath,
                attachment_name: attachmentName,
                attachment_content_type: attachmentContentType
            )
            try await cloud.insertRecord(table: "field_records", payload: payload)
            await refresh(projectID: projectID)
            return true
        } catch {
            errorMessage = "The field record could not be saved. Reference: AF-FIELD-106"
            return false
        }
    }
}
