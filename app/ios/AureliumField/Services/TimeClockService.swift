import Foundation
import Observation
import CoreLocation
import Supabase

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
    private var cloud: SupabaseService { .shared }

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
        guard let client = cloud.client, let org = cloud.organizationID, let user = cloud.userID else { return }
        do {
            let rows: [TimeEntryRecord] = try await client.from("time_entries")
                .select("id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at")
                .eq("organization_id", value: org.uuidString).eq("user_id", value: user.uuidString)
                .order("clock_in", ascending: false).limit(30).execute().value
            entries = rows
            activeEntry = rows.first(where: { $0.clockOut == nil })
            if activeEntry != nil { requestLocation() }
        } catch { AFPublicError.capture(error, code: .clockLoad); errorMessage = AFPublicError.text(.clockLoad, "We couldn't load your timecards.") }
    }

    func clockIn(projectID: UUID, costCode: String?, notes: String?) async {
        guard let client = cloud.client, let org = cloud.organizationID, let user = cloud.userID else { return }
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
            let row: TimeEntryRecord = try await client.from("time_entries").insert(payload)
                .select("id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at").single().execute().value
            activeEntry = row; await refresh()
        } catch { AFPublicError.capture(error, code: .clockIn); errorMessage = AFPublicError.text(.clockIn, "We couldn't clock you in.") }
    }

    func clockOut() async {
        guard let client = cloud.client, let entry = activeEntry else { return }
        isWorking = true; defer { isWorking = false }
        let loc = lastLocation
        struct Patch: Encodable { let clock_out: Date; let clock_out_latitude: Double?; let clock_out_longitude: Double?; let clock_out_accuracy_m: Double? }
        do {
            let patch = Patch(clock_out: .now, clock_out_latitude: loc?.coordinate.latitude, clock_out_longitude: loc?.coordinate.longitude, clock_out_accuracy_m: loc?.horizontalAccuracy)
            try await client.from("time_entries").update(patch).eq("id", value: entry.id.uuidString).execute()
            activeEntry = nil; manager.stopUpdatingLocation(); await refresh()
        } catch { AFPublicError.capture(error, code: .clockOut); errorMessage = AFPublicError.text(.clockOut, "We couldn't clock you out.") }
    }

    func updateDraft(_ entry: TimeEntryRecord) async {
        guard let client = cloud.client, entry.status == "draft" else { return }
        struct Patch: Encodable { let project_id: UUID; let clock_in: Date; let clock_out: Date?; let cost_code: String?; let notes: String? }
        do {
            try await client.from("time_entries").update(Patch(project_id: entry.projectID, clock_in: entry.clockIn, clock_out: entry.clockOut, cost_code: entry.costCode, notes: entry.notes)).eq("id", value: entry.id.uuidString).execute()
            await refresh()
        } catch { AFPublicError.capture(error, code: .timeEdit); errorMessage = AFPublicError.text(.timeEdit, "We couldn't save that draft timecard.") }
    }

    func submit(_ entry: TimeEntryRecord) async {
        guard let client = cloud.client else { return }
        do { try await client.rpc("submit_time_entry", params: ["entry_id": entry.id.uuidString]).execute(); await refresh() }
        catch { AFPublicError.capture(error, code: .timeSubmit); errorMessage = AFPublicError.text(.timeSubmit, "We couldn't submit that timecard.") }
    }

    func requestEdit(_ entry: TimeEntryRecord, reason: String) async -> Bool {
        guard let client = cloud.client, let out = entry.clockOut, !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        struct Params: Encodable { let entry_id:UUID; let new_clock_in:Date; let new_clock_out:Date; let new_project_id:UUID; let new_cost_code:String?; let new_notes:String?; let edit_reason:String }
        do {
            let params = Params(entry_id: entry.id, new_clock_in: entry.clockIn, new_clock_out: out, new_project_id: entry.projectID, new_cost_code: entry.costCode, new_notes: entry.notes, edit_reason: reason)
            try await client.rpc("request_time_entry_edit", params: params).execute()
            return true
        } catch { AFPublicError.capture(error, code: .timeEdit); errorMessage = AFPublicError.text(.timeEdit, "We couldn't request that correction."); return false }
    }

    private func saveLocationSample(_ location: CLLocation, entry: TimeEntryRecord) async {
        guard let client = cloud.client else { return }
        struct Sample: Encodable { let organization_id: UUID; let time_entry_id: UUID; let user_id: UUID; let latitude: Double; let longitude: Double; let accuracy_m: Double; let captured_at: Date }
        let sample = Sample(organization_id: entry.organizationID, time_entry_id: entry.id, user_id: entry.userID, latitude: location.coordinate.latitude, longitude: location.coordinate.longitude, accuracy_m: location.horizontalAccuracy, captured_at: location.timestamp)
        try? await client.from("time_location_samples").insert(sample).execute()
    }
}
