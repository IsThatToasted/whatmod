import Foundation
import Observation
import CoreLocation

struct TimeEntryRecord: Codable, Identifiable, Hashable {
    var id: UUID
    var organizationID: UUID
    var projectID: UUID
    var userID: UUID
    var clockIn: Date
    var clockOut: Date?
    var costCode: String?
    var notes: String?
    var status: String
    var submittedAt: Date?
    var approvedAt: Date?
    enum CodingKeys: String, CodingKey {
        case id, status, notes
        case organizationID = "organization_id"
        case projectID = "project_id"
        case userID = "user_id"
        case clockIn = "clock_in"
        case clockOut = "clock_out"
        case costCode = "cost_code"
        case submittedAt = "submitted_at"
        case approvedAt = "approved_at"
    }
}

@MainActor @Observable
final class TimeClockService: NSObject, CLLocationManagerDelegate {
    static let shared = TimeClockService()
    var activeEntry: TimeEntryRecord?
    var entries: [TimeEntryRecord] = []
    var lastLocation: CLLocation?
    var locationAuthorization: CLAuthorizationStatus = .notDetermined
    var errorMessage: String?
    var isWorking = false

    private let manager = CLLocationManager()
    private var cloud: WorkspaceService { .shared }

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 25
        manager.activityType = .other
        manager.pausesLocationUpdatesAutomatically = true
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        locationAuthorization = manager.authorizationStatus
    }

    func requestLocation() {
        if manager.authorizationStatus == .notDetermined { manager.requestAlwaysAuthorization() }
        else if manager.authorizationStatus == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
        manager.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        locationAuthorization = manager.authorizationStatus
        if [.authorizedAlways, .authorizedWhenInUse].contains(manager.authorizationStatus) { manager.startUpdatingLocation() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        lastLocation = location
        guard let entry = activeEntry else { return }
        Task { await saveLocationSample(location, entry: entry) }
    }

    func refresh() async {
        guard let org = cloud.organizationID, let user = cloud.userID else { return }
        do {
            let rows: [TimeEntryRecord] = try await cloud.selectRows(
                table: "time_entries",
                columns: "id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at",
                filters: [CloudFilter("organization_id", org.uuidString), CloudFilter("user_id", user.uuidString)],
                order: "clock_in.desc",
                limit: 30
            )
            entries = rows
            activeEntry = rows.first(where: { $0.clockOut == nil })
            if activeEntry != nil { requestLocation() }
        } catch { errorMessage = error.localizedDescription }
    }

    func clockIn(projectID: UUID, costCode: String?, notes: String?) async {
        guard let org = cloud.organizationID, let user = cloud.userID else { return }
        isWorking = true; defer { isWorking = false }
        requestLocation()
        let loc = lastLocation
        struct Insert: Encodable {
            let organization_id: UUID, project_id: UUID, user_id: UUID, clock_in: Date
            let cost_code: String?, notes: String?, clock_in_latitude: Double?, clock_in_longitude: Double?, clock_in_accuracy_m: Double?
        }
        do {
            let payload = Insert(organization_id: org, project_id: projectID, user_id: user, clock_in: .now, cost_code: costCode, notes: notes,
                                 clock_in_latitude: loc?.coordinate.latitude, clock_in_longitude: loc?.coordinate.longitude, clock_in_accuracy_m: loc?.horizontalAccuracy)
            let row: TimeEntryRecord = try await cloud.insertReturning(
                table: "time_entries",
                payload: payload,
                columns: "id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at",
                as: TimeEntryRecord.self
            )
            activeEntry = row; await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func clockOut() async {
        guard let entry = activeEntry else { return }
        isWorking = true; defer { isWorking = false }
        let loc = lastLocation
        struct Patch: Encodable { let clock_out: Date; let clock_out_latitude: Double?; let clock_out_longitude: Double?; let clock_out_accuracy_m: Double? }
        do {
            let patch = Patch(clock_out: .now, clock_out_latitude: loc?.coordinate.latitude, clock_out_longitude: loc?.coordinate.longitude, clock_out_accuracy_m: loc?.horizontalAccuracy)
            try await cloud.updateRows(table: "time_entries", payload: patch, filters: [CloudFilter("id", entry.id.uuidString)])
            activeEntry = nil; manager.stopUpdatingLocation(); await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func updateDraft(_ entry: TimeEntryRecord) async {
        guard entry.status == "draft" else { return }
        struct Patch: Encodable { let project_id: UUID; let clock_in: Date; let clock_out: Date?; let cost_code: String?; let notes: String? }
        do {
            try await cloud.updateRows(
                table: "time_entries",
                payload: Patch(project_id: entry.projectID, clock_in: entry.clockIn, clock_out: entry.clockOut, cost_code: entry.costCode, notes: entry.notes),
                filters: [CloudFilter("id", entry.id.uuidString)]
            )
            await refresh()
        } catch { errorMessage = error.localizedDescription }
    }

    func submit(_ entry: TimeEntryRecord) async {
        struct Params: Encodable { let entry_id: UUID }
        do { try await cloud.rpcVoid("submit_time_entry", params: Params(entry_id: entry.id)); await refresh() }
        catch { errorMessage = error.localizedDescription }
    }

    func requestEdit(_ entry: TimeEntryRecord, reason: String) async -> Bool {
        guard let out = entry.clockOut, !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        struct Params: Encodable { let entry_id:UUID; let new_clock_in:Date; let new_clock_out:Date; let new_project_id:UUID; let new_cost_code:String?; let new_notes:String?; let edit_reason:String }
        do {
            let params = Params(entry_id: entry.id, new_clock_in: entry.clockIn, new_clock_out: out, new_project_id: entry.projectID, new_cost_code: entry.costCode, new_notes: entry.notes, edit_reason: reason)
            try await cloud.rpcVoid("request_time_entry_edit", params: params)
            return true
        } catch { errorMessage = error.localizedDescription; return false }
    }

    private func saveLocationSample(_ location: CLLocation, entry: TimeEntryRecord) async {
        struct Sample: Encodable { let organization_id: UUID; let time_entry_id: UUID; let user_id: UUID; let latitude: Double; let longitude: Double; let accuracy_m: Double; let captured_at: Date }
        let sample = Sample(organization_id: entry.organizationID, time_entry_id: entry.id, user_id: entry.userID, latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, accuracy_m: location.horizontalAccuracy, captured_at: location.timestamp)
        try? await cloud.insertRecord(table: "time_location_samples", payload: sample)
    }
}
