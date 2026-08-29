import Foundation
import Observation
import AuthenticationServices
import UIKit
import Security

struct OrganizationMembership: Codable, Identifiable, Hashable {
    var organizationID: UUID
    var userID: UUID
    var role: String
    var displayName: String?
    var active: Bool
    var organization: OrganizationInfo?
    var id: UUID { organizationID }

    enum CodingKeys: String, CodingKey {
        case organizationID = "organization_id"
        case userID = "user_id"
        case role
        case displayName = "display_name"
        case active
        case organization = "organizations"
    }
}

struct OrganizationInfo: Codable, Hashable {
    var id: UUID
    var name: String
    var slug: String
}

struct CloudFilter: Sendable {
    let column: String
    let op: String
    let value: String

    init(_ column: String, _ value: String, op: String = "eq") {
        self.column = column
        self.value = value
        self.op = op
    }
}

struct AdminOrganizationMember: Codable, Identifiable, Hashable {
    var userID: UUID
    var displayName: String?
    var email: String?
    var phone: String?
    var role: String
    var active: Bool
    var joinedAt: Date
    var id: UUID { userID }

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case displayName = "display_name"
        case email, phone, role, active
        case joinedAt = "joined_at"
    }
}

struct OrganizationInviteRecord: Codable, Identifiable, Hashable {
    var id: UUID
    var email: String?
    var role: String
    var token: UUID
    var expiresAt: Date
    var acceptedAt: Date?
    var revokedAt: Date?
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, email, role, token
        case expiresAt = "expires_at"
        case acceptedAt = "accepted_at"
        case revokedAt = "revoked_at"
        case createdAt = "created_at"
    }
}

struct AdminTimeEditRequest: Codable, Identifiable, Hashable {
    var id: UUID
    var timeEntryID: UUID
    var requestedBy: UUID
    var proposedClockIn: Date
    var proposedClockOut: Date?
    var proposedProjectID: UUID
    var proposedCostCode: String?
    var proposedNotes: String?
    var reason: String
    var status: String
    var createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, reason, status
        case timeEntryID = "time_entry_id"
        case requestedBy = "requested_by"
        case proposedClockIn = "proposed_clock_in"
        case proposedClockOut = "proposed_clock_out"
        case proposedProjectID = "proposed_project_id"
        case proposedCostCode = "proposed_cost_code"
        case proposedNotes = "proposed_notes"
        case createdAt = "created_at"
    }
}

private struct NativeSession: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userID: UUID
    var email: String?
}

private struct AuthTokenResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Double?
    let expiresAt: Double?
    let user: AuthUser?

    struct AuthUser: Codable {
        let id: UUID
        let email: String?
    }

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case user
    }
}

private struct JWTPayload: Decodable {
    let sub: String
    let email: String?
    let exp: Double
}

private enum NativeCloudError: LocalizedError {
    case configuration
    case authentication(String)
    case invalidResponse
    case api(Int, String)
    case missingResult

    var errorDescription: String? {
        switch self {
        case .configuration:
            return "Aurelium Field could not connect to your workspace. Reference: AF-CFG-101"
        case .authentication(let code):
            return "Sign in could not be completed. Reference: \(code)"
        case .invalidResponse:
            return "The workspace returned an invalid response. Reference: AF-NET-101"
        case .api(_, let message):
            return message
        case .missingResult:
            return "The requested workspace record was not returned. Reference: AF-NET-102"
        }
    }
}

@MainActor @Observable
final class WorkspaceService {
    static let shared = WorkspaceService()

    var userID: UUID?
    var email: String?
    var membership: OrganizationMembership?
    var isLoading = true
    var errorMessage: String?

    var isAuthenticated: Bool { userID != nil && session != nil }
    var organizationID: UUID? { membership?.organizationID }
    var isAdmin: Bool { ["owner", "admin"].contains(membership?.role ?? "") }
    var isCloudReady: Bool { config != nil && session != nil }

    private var config: RuntimeConfig?
    private var session: NativeSession?
    private let membershipCacheKey = "aurelium.ios.membership.v2"
    private let sessionStore = KeychainSessionStore(service: "com.aurelium.field", account: "native-session-v2")

    private init() {
        // Deliberately no cloud/auth SDK construction during process launch.
        // The v0.8 native client is Foundation URLSession + Keychain only.
    }

    func bootstrap() async {
        isLoading = true
        defer { isLoading = false }

        guard let runtime = RuntimeConfig.load(), URL(string: runtime.cloudURL) != nil else {
            errorMessage = NativeCloudError.configuration.localizedDescription
            return
        }
        config = runtime

        guard var stored = sessionStore.load() else {
            clearIdentity()
            return
        }

        do {
            if stored.expiresAt.timeIntervalSinceNow < 90 {
                stored = try await refreshSession(stored)
            }
            apply(stored)

            if let cached = cachedMembership(for: stored.userID) {
                membership = cached
            }

            do {
                try await loadMembershipThrowing()
            } catch {
                // A cached membership is enough to keep the native workspace usable.
                // A transient network failure should never terminate or log the user out.
                if membership == nil {
                    errorMessage = "Workspace membership could not be refreshed. Reference: AF-ORG-101"
                }
            }
        } catch {
            sessionStore.clear()
            clearIdentity()
        }
    }

    func signInWithGoogle() async {
        guard config != nil || RuntimeConfig.load() != nil else {
            errorMessage = NativeCloudError.configuration.localizedDescription
            return
        }
        if config == nil { config = RuntimeConfig.load() }
        guard let activeConfig = config else {
            errorMessage = NativeCloudError.configuration.localizedDescription
            return
        }

        do {
            let callback = try await NativeWebAuthCoordinator.shared.signIn(cloudURL: activeConfig.cloudURL)
            let newSession = try sessionFromCallback(callback)
            sessionStore.save(newSession)
            apply(newSession)
            try await loadMembershipThrowing()
        } catch is CancellationError {
            return
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Sign in could not be completed. Reference: AF-AUTH-201"
        }
    }


    func signOut() async {
        if let current = session {
            try? await requestData(path: "/auth/v1/logout", method: "POST", body: nil, additionalHeaders: [:], sessionOverride: current, retryOnUnauthorized: false)
        }
        sessionStore.clear()
        clearCachedMembership()
        clearIdentity()
    }

    func loadMembership() async {
        do { try await loadMembershipThrowing() }
        catch {
            if membership == nil { errorMessage = "Workspace membership could not be loaded. Reference: AF-ORG-101" }
        }
    }

    private func loadMembershipThrowing() async throws {
        guard let userID else { membership = nil; return }
        let rows: [OrganizationMembership] = try await selectRows(
            table: "organization_members",
            columns: "organization_id,user_id,role,display_name,active,organizations(id,name,slug)",
            filters: [CloudFilter("user_id", userID.uuidString), CloudFilter("active", "true")],
            limit: 1
        )
        membership = rows.first
        cacheMembership(membership)
    }

    private func apply(_ value: NativeSession) {
        session = value
        userID = value.userID
        email = value.email
    }

    private func clearIdentity() {
        session = nil
        userID = nil
        email = nil
        membership = nil
    }

    private func sessionFromCallback(_ url: URL) throws -> NativeSession {
        guard url.scheme?.lowercased() == "aureliumfield", url.host?.lowercased() == "auth-callback" else {
            throw NativeCloudError.authentication("AF-AUTH-202")
        }
        let fragment = Self.parameters(from: url.fragment ?? "")
        if fragment["error"] != nil || fragment["error_description"] != nil {
            throw NativeCloudError.authentication("AF-AUTH-203")
        }
        guard let access = fragment["access_token"], !access.isEmpty,
              let refresh = fragment["refresh_token"], !refresh.isEmpty else {
            throw NativeCloudError.authentication("AF-AUTH-204")
        }
        let payload = try Self.decodeJWT(access)
        guard let uid = UUID(uuidString: payload.sub) else {
            throw NativeCloudError.authentication("AF-AUTH-205")
        }
        return NativeSession(accessToken: access, refreshToken: refresh, expiresAt: Date(timeIntervalSince1970: payload.exp), userID: uid, email: payload.email)
    }

    private func refreshSession(_ value: NativeSession) async throws -> NativeSession {
        guard let config else { throw NativeCloudError.configuration }
        var components = URLComponents(string: config.cloudURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/auth/v1/token")
        components?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        guard let url = components?.url else { throw NativeCloudError.configuration }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(config.publicKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try Self.encoder().encode(["refresh_token": value.refreshToken])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NativeCloudError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw NativeCloudError.api(http.statusCode, "Session expired. Please sign in again. Reference: AF-AUTH-206") }
        let token = try Self.decoder().decode(AuthTokenResponse.self, from: data)
        let jwt = try Self.decodeJWT(token.accessToken)
        guard let uid = token.user?.id ?? UUID(uuidString: jwt.sub) else { throw NativeCloudError.authentication("AF-AUTH-205") }
        let expiry = token.expiresAt.map { Date(timeIntervalSince1970: $0) } ?? Date().addingTimeInterval(token.expiresIn ?? 3600)
        let refreshed = NativeSession(accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: expiry, userID: uid, email: token.user?.email ?? jwt.email)
        sessionStore.save(refreshed)
        apply(refreshed)
        return refreshed
    }

    // MARK: - Projects

    struct CloudProjectRow: Codable {
        var id: UUID
        var name: String
        var clientName: String?
        var addressLine1: String?
        var city: String?
        var region: String?
        var status: String
        var primaryTrade: String
        var description: String?
        var progressPercent: Int
        var updatedAt: Date

        enum CodingKeys: String, CodingKey {
            case id, name, city, region, status, description
            case clientName = "client_name"
            case addressLine1 = "address_line1"
            case primaryTrade = "primary_trade"
            case progressPercent = "progress_percent"
            case updatedAt = "updated_at"
        }
    }

    func fetchProjects() async throws -> [ProjectSummary] {
        guard let organizationID else { return [] }
        let rows: [CloudProjectRow] = try await selectRows(
            table: "projects",
            columns: "id,name,client_name,address_line1,city,region,status,primary_trade,description,progress_percent,updated_at",
            filters: [CloudFilter("organization_id", organizationID.uuidString)],
            order: "updated_at.desc"
        )
        return rows.map { row in
            let location = [row.addressLine1, row.city, row.region].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
            return ProjectSummary(id: row.id, name: row.name, client: row.clientName ?? "", location: location, status: row.status.capitalized, progress: Double(row.progressPercent) / 100.0, trade: row.primaryTrade.capitalized, notes: row.description ?? "", updatedAt: row.updatedAt)
        }
    }

    func upsertProject(_ project: ProjectSummary) async {
        guard let organizationID, let userID else { return }
        struct Payload: Encodable {
            let id: UUID
            let organization_id: UUID
            let name: String
            let client_name: String?
            let address_line1: String?
            let status: String
            let primary_trade: String
            let description: String?
            let progress_percent: Int
            let created_by: UUID
        }
        let payload = Payload(
            id: project.id,
            organization_id: organizationID,
            name: project.name,
            client_name: project.client.isEmpty ? nil : project.client,
            address_line1: project.location.isEmpty ? nil : project.location,
            status: project.status.lowercased(),
            primary_trade: project.trade.lowercased(),
            description: project.notes.isEmpty ? nil : project.notes,
            progress_percent: min(100, max(0, Int((project.progress * 100).rounded()))),
            created_by: userID
        )
        do { try await upsertRecord(table: "projects", payload: payload, onConflict: "id") }
        catch { errorMessage = "Project could not be saved. Reference: AF-PROJ-101" }
    }

    func deleteProject(id: UUID) async {
        do { try await deleteRows(table: "projects", filters: [CloudFilter("id", id.uuidString)]) }
        catch { errorMessage = "Project could not be deleted. Reference: AF-PROJ-102" }
    }

    // MARK: - Organization / admin

    func createOrganization(name: String) async throws {
        struct Params: Encodable { let org_name: String }
        let _: UUID = try await rpcValue("create_organization", params: Params(org_name: name), as: UUID.self)
        try await loadMembershipThrowing()
    }

    func acceptInvite(token: UUID) async throws {
        struct Params: Encodable { let invite_token: UUID }
        let _: UUID = try await rpcValue("accept_organization_invite", params: Params(invite_token: token), as: UUID.self)
        try await loadMembershipThrowing()
    }

    func fetchAdminMembers() async throws -> [AdminOrganizationMember] {
        guard isAdmin else { throw NativeCloudError.api(403, "Admin access required. Reference: AF-ADM-101") }
        return try await rpcValue("admin_list_members", params: EmptyPayload(), as: [AdminOrganizationMember].self)
    }

    func updateAdminMember(_ member: AdminOrganizationMember) async throws {
        guard isAdmin else { throw NativeCloudError.api(403, "Admin access required. Reference: AF-ADM-101") }
        struct Params: Encodable {
            let member_user_id: UUID
            let new_display_name: String
            let new_phone: String
            let new_role: String
            let new_active: Bool
        }
        try await rpcVoid("admin_update_member", params: Params(member_user_id: member.userID, new_display_name: member.displayName ?? "", new_phone: member.phone ?? "", new_role: member.role, new_active: member.active))
        if member.userID == userID { try await loadMembershipThrowing() }
    }

    func removeAdminMember(userID: UUID) async throws {
        struct Params: Encodable { let member_user_id: UUID }
        try await rpcVoid("admin_remove_member", params: Params(member_user_id: userID))
    }

    func fetchOrganizationInvites() async throws -> [OrganizationInviteRecord] {
        guard let organizationID else { return [] }
        return try await selectRows(
            table: "organization_invites",
            columns: "id,email,role,token,expires_at,accepted_at,revoked_at,created_at",
            filters: [CloudFilter("organization_id", organizationID.uuidString)],
            order: "created_at.desc",
            limit: 50
        )
    }

    func createOrganizationInvite(email: String?, role: String) async throws -> UUID {
        struct Params: Encodable { let invite_email: String?; let invite_role: String }
        struct Result: Decodable { let token: UUID; let expires_at: Date }
        let rows: [Result] = try await rpcValue("create_organization_invite", params: Params(invite_email: email, invite_role: role), as: [Result].self)
        guard let token = rows.first?.token else { throw NativeCloudError.missingResult }
        return token
    }

    func revokeOrganizationInvite(id: UUID) async throws {
        struct Params: Encodable { let invite_id: UUID }
        try await rpcVoid("revoke_organization_invite", params: Params(invite_id: id))
    }

    func fetchAdminTimeEntries() async throws -> [TimeEntryRecord] {
        guard let organizationID else { return [] }
        return try await selectRows(
            table: "time_entries",
            columns: "id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at",
            filters: [CloudFilter("organization_id", organizationID.uuidString)],
            order: "clock_in.desc",
            limit: 100
        )
    }

    func fetchPendingTimeEditRequests() async throws -> [AdminTimeEditRequest] {
        guard let organizationID else { return [] }
        return try await selectRows(
            table: "time_entry_edit_requests",
            columns: "id,time_entry_id,requested_by,proposed_clock_in,proposed_clock_out,proposed_project_id,proposed_cost_code,proposed_notes,reason,status,created_at",
            filters: [CloudFilter("organization_id", organizationID.uuidString), CloudFilter("status", "pending")],
            order: "created_at.asc"
        )
    }

    func decideAdminTimeEntry(id: UUID, approve: Bool, note: String?) async throws {
        struct Params: Encodable { let entry_id: UUID; let approve: Bool; let decision_note: String? }
        try await rpcVoid("admin_decide_time_entry", params: Params(entry_id: id, approve: approve, decision_note: note))
    }

    func deleteAdminTimeEntry(id: UUID) async throws {
        struct Params: Encodable { let entry_id: UUID }
        try await rpcVoid("admin_delete_time_entry", params: Params(entry_id: id))
    }

    func decideTimeEditRequest(id: UUID, approve: Bool) async throws {
        struct Params: Encodable { let request_id: UUID; let approve: Bool; let admin_note: String? }
        try await rpcVoid("decide_time_entry_edit", params: Params(request_id: id, approve: approve, admin_note: nil))
    }

    func updateAdminTimeEntry(_ entry: TimeEntryRecord, reason: String) async throws {
        struct Params: Encodable {
            let entry_id: UUID
            let new_clock_in: Date
            let new_clock_out: Date?
            let new_project_id: UUID
            let new_cost_code: String?
            let new_notes: String?
            let adjustment_reason: String
        }
        try await rpcVoid("admin_update_time_entry", params: Params(entry_id: entry.id, new_clock_in: entry.clockIn, new_clock_out: entry.clockOut, new_project_id: entry.projectID, new_cost_code: entry.costCode, new_notes: entry.notes, adjustment_reason: reason))
    }

    // MARK: - Native REST primitives

    func selectRows<T: Decodable>(table: String, columns: String = "*", filters: [CloudFilter] = [], order: String? = nil, limit: Int? = nil) async throws -> T {
        var items = [URLQueryItem(name: "select", value: columns)]
        items.append(contentsOf: filters.map { URLQueryItem(name: $0.column, value: "\($0.op).\($0.value)") })
        if let order { items.append(URLQueryItem(name: "order", value: order)) }
        if let limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
        let data = try await requestData(path: "/rest/v1/\(table)", method: "GET", queryItems: items)
        return try Self.decoder().decode(T.self, from: data)
    }

    func insertRecord<Body: Encodable>(table: String, payload: Body) async throws {
        let body = try Self.encoder().encode(payload)
        _ = try await requestData(path: "/rest/v1/\(table)", method: "POST", body: body, additionalHeaders: ["Prefer": "return=minimal"])
    }

    func insertReturning<Body: Encodable, T: Decodable>(table: String, payload: Body, columns: String, as: T.Type) async throws -> T {
        let body = try Self.encoder().encode(payload)
        let data = try await requestData(path: "/rest/v1/\(table)", method: "POST", queryItems: [URLQueryItem(name: "select", value: columns)], body: body, additionalHeaders: ["Prefer": "return=representation"])
        let rows = try Self.decoder().decode([T].self, from: data)
        guard let first = rows.first else { throw NativeCloudError.missingResult }
        return first
    }

    func upsertRecord<Body: Encodable>(table: String, payload: Body, onConflict: String) async throws {
        let body = try Self.encoder().encode(payload)
        _ = try await requestData(
            path: "/rest/v1/\(table)",
            method: "POST",
            queryItems: [URLQueryItem(name: "on_conflict", value: onConflict)],
            body: body,
            additionalHeaders: ["Prefer": "resolution=merge-duplicates,return=minimal"]
        )
    }

    func updateRows<Body: Encodable>(table: String, payload: Body, filters: [CloudFilter]) async throws {
        let items = filters.map { URLQueryItem(name: $0.column, value: "\($0.op).\($0.value)") }
        let body = try Self.encoder().encode(payload)
        _ = try await requestData(path: "/rest/v1/\(table)", method: "PATCH", queryItems: items, body: body, additionalHeaders: ["Prefer": "return=minimal"])
    }

    func deleteRows(table: String, filters: [CloudFilter]) async throws {
        let items = filters.map { URLQueryItem(name: $0.column, value: "\($0.op).\($0.value)") }
        _ = try await requestData(path: "/rest/v1/\(table)", method: "DELETE", queryItems: items, additionalHeaders: ["Prefer": "return=minimal"])
    }

    func rpcVoid<Body: Encodable>(_ name: String, params: Body) async throws {
        let body = try Self.encoder().encode(params)
        _ = try await requestData(path: "/rest/v1/rpc/\(name)", method: "POST", body: body, additionalHeaders: ["Prefer": "return=minimal"])
    }

    func rpcValue<Body: Encodable, T: Decodable>(_ name: String, params: Body, as: T.Type) async throws -> T {
        let body = try Self.encoder().encode(params)
        let data = try await requestData(path: "/rest/v1/rpc/\(name)", method: "POST", body: body)
        return try Self.decoder().decode(T.self, from: data)
    }

    func uploadStorage(bucket: String, path: String, data: Data, contentType: String) async throws -> String {
        let encodedPath = path.split(separator: "/").map { part in
            String(part).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String(part)
        }.joined(separator: "/")
        _ = try await requestData(
            path: "/storage/v1/object/\(bucket)/\(encodedPath)",
            method: "POST",
            body: data,
            additionalHeaders: ["Content-Type": contentType, "x-upsert": "false"]
        )
        return path
    }

    private func requestData(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Data? = nil,
        additionalHeaders: [String: String] = [:],
        sessionOverride: NativeSession? = nil,
        retryOnUnauthorized: Bool = true
    ) async throws -> Data {
        guard let config else { throw NativeCloudError.configuration }
        var active = sessionOverride ?? session
        guard var active else { throw NativeCloudError.authentication("AF-AUTH-207") }

        if active.expiresAt.timeIntervalSinceNow < 60 && retryOnUnauthorized {
            active = try await refreshSession(active)
        }

        let base = config.cloudURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var components = URLComponents(string: base + path)
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else { throw NativeCloudError.configuration }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(config.publicKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(active.accessToken)", forHTTPHeaderField: "Authorization")
        if body != nil && additionalHeaders["Content-Type"] == nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (key, value) in additionalHeaders { request.setValue(value, forHTTPHeaderField: key) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NativeCloudError.invalidResponse }

        if http.statusCode == 401 && retryOnUnauthorized {
            let refreshed = try await refreshSession(active)
            return try await requestData(path: path, method: method, queryItems: queryItems, body: body, additionalHeaders: additionalHeaders, sessionOverride: refreshed, retryOnUnauthorized: false)
        }

        guard (200..<300).contains(http.statusCode) else {
            let detail = Self.apiMessage(from: data)
            throw NativeCloudError.api(http.statusCode, detail)
        }
        return data
    }

    private static func apiMessage(from data: Data) -> String {
        guard !data.isEmpty,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return "Workspace request failed. Reference: AF-NET-103"
        }
        let raw = (object["message"] as? String) ?? (object["error_description"] as? String) ?? "Workspace request failed"
        #if DEBUG
        return raw
        #else
        return "Workspace request failed. Reference: AF-NET-103"
        #endif
    }

    private func cachedMembership(for userID: UUID) -> OrganizationMembership? {
        guard let data = UserDefaults.standard.data(forKey: membershipCacheKey),
              let cached = try? Self.decoder().decode(OrganizationMembership.self, from: data),
              cached.userID == userID,
              cached.active else { return nil }
        return cached
    }

    private func cacheMembership(_ value: OrganizationMembership?) {
        guard let value, let data = try? Self.encoder().encode(value) else {
            clearCachedMembership()
            return
        }
        UserDefaults.standard.set(data, forKey: membershipCacheKey)
    }

    private func clearCachedMembership() {
        UserDefaults.standard.removeObject(forKey: membershipCacheKey)
    }

    private static func parameters(from fragment: String) -> [String: String] {
        var components = URLComponents()
        components.query = fragment
        return Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
            item.value.map { (item.name, $0) }
        })
    }

    private static func decodeJWT(_ token: String) throws -> JWTPayload {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { throw NativeCloudError.authentication("AF-AUTH-205") }
        var raw = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while raw.count % 4 != 0 { raw.append("=") }
        guard let data = Data(base64Encoded: raw) else { throw NativeCloudError.authentication("AF-AUTH-205") }
        return try JSONDecoder().decode(JWTPayload.self, from: data)
    }

    private static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            let fractional = ISO8601DateFormatter()
            fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = fractional.date(from: string) { return date }
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let date = plain.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid workspace date")
        }
        return decoder
    }

    private static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }
}

private struct EmptyPayload: Encodable {}

@MainActor
private final class NativeWebAuthCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = NativeWebAuthCoordinator()
    private var webSession: ASWebAuthenticationSession?
    private var expectedState: String?

    func signIn(cloudURL: String) async throws -> URL {
        let state = UUID().uuidString.lowercased()
        expectedState = state
        guard var components = URLComponents(string: "https://whatmod.com/app/ios-auth.html") else {
            throw NativeCloudError.authentication("AF-AUTH-201")
        }
        components.queryItems = [
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "endpoint", value: cloudURL)
        ]
        guard let startURL = components.url else { throw NativeCloudError.authentication("AF-AUTH-201") }

        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: startURL, callbackURLScheme: "aureliumfield") { [weak self] callbackURL, error in
                Task { @MainActor in
                    defer { self?.webSession = nil }
                    if let authError = error as? ASWebAuthenticationSessionError, authError.code == .canceledLogin {
                        continuation.resume(throwing: CancellationError())
                        return
                    }
                    if error != nil {
                        continuation.resume(throwing: NativeCloudError.authentication("AF-AUTH-201"))
                        return
                    }
                    guard let callbackURL,
                          let callback = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          callback.scheme?.lowercased() == "aureliumfield",
                          callback.host?.lowercased() == "auth-callback",
                          callback.queryItems?.first(where: { $0.name == "state" })?.value == self?.expectedState else {
                        continuation.resume(throwing: NativeCloudError.authentication("AF-AUTH-202"))
                        return
                    }
                    continuation.resume(returning: callbackURL)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webSession = session
            guard session.start() else {
                self.webSession = nil
                continuation.resume(throwing: NativeCloudError.authentication("AF-AUTH-201"))
                return
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let window = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) {
            return window
        }
        if let window = scenes.flatMap({ $0.windows }).first {
            return window
        }
        return ASPresentationAnchor()
    }
}

private struct KeychainSessionStore {
    let service: String
    let account: String

    func save(_ session: NativeSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        clear()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    func load() -> NativeSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(NativeSession.self, from: data)
    }

    func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
