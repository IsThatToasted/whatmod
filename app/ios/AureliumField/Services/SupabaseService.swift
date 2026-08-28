import Foundation
import Observation
import Supabase
import AuthenticationServices

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

@MainActor @Observable
final class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient?
    var userID: UUID?
    var email: String?
    var membership: OrganizationMembership?
    var isLoading = true
    var errorMessage: String?

    var isAuthenticated: Bool { userID != nil }
    var organizationID: UUID? { membership?.organizationID }
    var isAdmin: Bool { ["owner", "admin"].contains(membership?.role ?? "") }

    private init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let urlString = (info["SUPABASE_URL"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let key = (info["SUPABASE_ANON_KEY"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let url = URL(string: urlString), urlString.hasPrefix("https://"), !key.isEmpty {
            client = SupabaseClient(supabaseURL: url, supabaseKey: key)
        } else {
            client = nil
        }
    }

    func bootstrap() async {
        defer { isLoading = false }
        guard let client else { errorMessage = "Supabase is not configured in the iOS build."; return }
        do {
            let session = try await client.auth.session
            userID = session.user.id
            email = session.user.email
            await loadMembership()
        } catch {
            userID = nil
            membership = nil
        }
    }

    func signInWithGoogle() async {
        guard let client else { errorMessage = "Supabase is not configured."; return }
        do {
            try await client.auth.signInWithOAuth(provider: .google, redirectTo: URL(string: "aureliumfield://auth-callback")!)
            let session = try await client.auth.session
            userID = session.user.id
            email = session.user.email
            await loadMembership()
        } catch { errorMessage = error.localizedDescription }
    }

    func handle(_ url: URL) async {
        guard let client else { return }
        do {
            try await client.auth.session(from: url)
            let session = try await client.auth.session
            userID = session.user.id
            email = session.user.email
            await loadMembership()
        } catch { errorMessage = error.localizedDescription }
    }

    func signOut() async {
        guard let client else { return }
        do { try await client.auth.signOut(); userID = nil; email = nil; membership = nil }
        catch { errorMessage = error.localizedDescription }
    }

    func loadMembership() async {
        guard let client, let userID else { membership = nil; return }
        do {
            let rows: [OrganizationMembership] = try await client
                .from("organization_members")
                .select("organization_id,user_id,role,display_name,active,organizations(id,name,slug)")
                .eq("user_id", value: userID.uuidString)
                .eq("active", value: true)
                .limit(1)
                .execute().value
            membership = rows.first
        } catch { membership = nil }
    }


    struct CloudProjectRow: Codable {
        var id: UUID
        var name: String
        var addressLine1: String?
        var city: String?
        var region: String?
        var status: String
        var primaryTrade: String
        var description: String?
        var updatedAt: Date
        enum CodingKeys: String, CodingKey {
            case id, name, city, region, status, description
            case addressLine1 = "address_line1"
            case primaryTrade = "primary_trade"
            case updatedAt = "updated_at"
        }
    }

    func fetchProjects() async throws -> [ProjectSummary] {
        guard let client, let organizationID else { return [] }
        let rows: [CloudProjectRow] = try await client.from("projects")
            .select("id,name,address_line1,city,region,status,primary_trade,description,updated_at")
            .eq("organization_id", value: organizationID.uuidString)
            .order("updated_at", ascending: false).execute().value
        return rows.map { row in
            let location = [row.addressLine1, row.city, row.region].compactMap{$0}.filter{!$0.isEmpty}.joined(separator: ", ")
            return ProjectSummary(id: row.id, name: row.name, client: "", location: location, status: row.status.capitalized, progress: 0, trade: row.primaryTrade.capitalized, notes: row.description ?? "", updatedAt: row.updatedAt)
        }
    }

    func upsertProject(_ project: ProjectSummary) async {
        guard let client, let organizationID, let userID else { return }
        struct Payload: Encodable {
            let id: UUID; let organization_id: UUID; let name: String; let address_line1: String?
            let status: String; let primary_trade: String; let description: String?; let created_by: UUID
        }
        let payload = Payload(id: project.id, organization_id: organizationID, name: project.name,
                              address_line1: project.location.isEmpty ? nil : project.location,
                              status: project.status.lowercased(), primary_trade: project.trade.lowercased(),
                              description: project.notes.isEmpty ? nil : project.notes, created_by: userID)
        do { try await client.from("projects").upsert(payload).execute() }
        catch { errorMessage = error.localizedDescription }
    }

    func deleteProject(id: UUID) async {
        guard let client else { return }
        do { try await client.from("projects").delete().eq("id", value: id.uuidString).execute() }
        catch { errorMessage = error.localizedDescription }
    }

    func createOrganization(name: String) async throws {
        guard let client else { throw NSError(domain: "Aurelium", code: 1, userInfo: [NSLocalizedDescriptionKey: "Supabase is not configured."]) }
        let _: UUID = try await client.rpc("create_organization", params: ["org_name": name]).execute().value
        await loadMembership()
    }

    func acceptInvite(token: UUID) async throws {
        guard let client else { throw NSError(domain: "Aurelium", code: 1, userInfo: [NSLocalizedDescriptionKey: "Supabase is not configured."]) }
        let _: UUID = try await client.rpc("accept_organization_invite", params: ["invite_token": token.uuidString]).execute().value
        await loadMembership()
    }
}
