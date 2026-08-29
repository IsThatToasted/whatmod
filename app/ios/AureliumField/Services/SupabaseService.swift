import Foundation
import Observation
import Supabase
import GoogleSignIn
import UIKit


private extension UIApplication {
    var afTopViewController: UIViewController? {
        let scenes = connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.first(where: { $0.activationState == .foregroundActive })?.windows.first(where: \.isKeyWindow)
            ?? scenes.flatMap(\.windows).first
        var controller = window?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        if let navigation = controller as? UINavigationController { controller = navigation.visibleViewController }
        if let tab = controller as? UITabBarController { controller = tab.selectedViewController }
        return controller
    }
}

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
        if let url = AFRuntimeConfig.cloudURL, AFRuntimeConfig.isConfigured {
            client = SupabaseClient(supabaseURL: url, supabaseKey: AFRuntimeConfig.publicKey)
        } else {
            client = nil
        }
    }

    func bootstrap() async {
        defer { isLoading = false }
        guard let client else { errorMessage = AFPublicError.text(AFRuntimeConfig.publicErrorCode, "Aurelium Field could not connect to your workspace."); return }
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
        guard let client else {
            errorMessage = AFPublicError.text(AFRuntimeConfig.publicErrorCode, "Aurelium Field could not connect to your workspace.")
            return
        }
        guard let iosClientID = AFRuntimeConfig.googleIOSClientID,
              let webClientID = AFRuntimeConfig.googleWebClientID else {
            errorMessage = AFPublicError.text(.nativeGoogleConfig, "Sign in is temporarily unavailable.")
            return
        }
        guard let presenter = UIApplication.shared.afTopViewController else {
            errorMessage = AFPublicError.text(.nativeGooglePresentation, "We couldn't open sign in.")
            return
        }

        do {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(
                clientID: iosClientID,
                serverClientID: webClientID
            )

            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString, !idToken.isEmpty else {
                throw AFPublicError.error(.nativeGoogleToken, "We couldn't verify sign in.")
            }
            let accessToken = result.user.accessToken.tokenString

            try await client.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .google,
                    idToken: idToken,
                    accessToken: accessToken
                )
            )

            let session = try await client.auth.session
            userID = session.user.id
            email = session.user.email
            await loadMembership()
        } catch let publicError as AFPublicError {
            errorMessage = publicError.displayText
        } catch {
            AFPublicError.capture(error, code: .nativeGoogleExchange)
            errorMessage = AFPublicError.text(.nativeGoogleExchange, "We couldn't complete sign in.")
        }
    }

    func handle(_ url: URL) async {
        // Reserved for non-Google deep links. Native Google Sign-In is handled by
        // GIDSignIn before this method is called.
        _ = url
    }

    func signOut() async {
        guard let client else { return }
        do { try await client.auth.signOut(); GIDSignIn.sharedInstance.signOut(); userID = nil; email = nil; membership = nil }
        catch { AFPublicError.capture(error, code: .signOut); errorMessage = AFPublicError.text(.signOut, "We couldn't sign out cleanly.") }
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
        } catch { AFPublicError.capture(error, code: .authentication); membership = nil; errorMessage = AFPublicError.text(.authentication, "We couldn't load your organization access.") }
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
        catch { AFPublicError.capture(error, code: .projectSave); errorMessage = AFPublicError.text(.projectSave, "We couldn't save that project.") }
    }

    func deleteProject(id: UUID) async {
        guard let client else { return }
        do { try await client.from("projects").delete().eq("id", value: id.uuidString).execute() }
        catch { AFPublicError.capture(error, code: .projectDelete); errorMessage = AFPublicError.text(.projectDelete, "We couldn't delete that project.") }
    }

    func createOrganization(name: String) async throws {
        guard let client else { throw AFPublicError.error(AFRuntimeConfig.publicErrorCode, "Aurelium Field could not connect to your workspace.") }
        let _: UUID = try await client.rpc("create_organization", params: ["org_name": name]).execute().value
        await loadMembership()
    }

    func acceptInvite(token: UUID) async throws {
        guard let client else { throw AFPublicError.error(AFRuntimeConfig.publicErrorCode, "Aurelium Field could not connect to your workspace.") }
        let _: UUID = try await client.rpc("accept_organization_invite", params: ["invite_token": token.uuidString]).execute().value
        await loadMembership()
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

extension SupabaseService {
    func fetchAdminMembers() async throws -> [AdminOrganizationMember] {
        guard isAdmin, let client else { throw AFPublicError.error(.adminAccess, "Admin access is required.") }
        return try await client.rpc("admin_list_members").execute().value
    }

    func updateAdminMember(_ member: AdminOrganizationMember) async throws {
        guard isAdmin, let client else { throw AFPublicError.error(.adminAccess, "Admin access is required.") }
        struct Params: Encodable {
            let member_user_id: UUID
            let new_display_name: String
            let new_phone: String
            let new_role: String
            let new_active: Bool
        }
        let params = Params(member_user_id: member.userID, new_display_name: member.displayName ?? "", new_phone: member.phone ?? "", new_role: member.role, new_active: member.active)
        try await client.rpc("admin_update_member", params: params).execute()
        if member.userID == userID { await loadMembership() }
    }

    func removeAdminMember(userID: UUID) async throws {
        guard isAdmin, let client else { throw AFPublicError.error(.adminAccess, "Admin access is required.") }
        try await client.rpc("admin_remove_member", params: ["member_user_id": userID.uuidString]).execute()
    }

    func fetchOrganizationInvites() async throws -> [OrganizationInviteRecord] {
        guard isAdmin, let client, let organizationID else { return [] }
        return try await client.from("organization_invites")
            .select("id,email,role,token,expires_at,accepted_at,revoked_at,created_at")
            .eq("organization_id", value: organizationID.uuidString)
            .order("created_at", ascending: false)
            .limit(50)
            .execute().value
    }

    func createOrganizationInvite(email: String?, role: String) async throws -> UUID {
        guard isAdmin, let client else { throw AFPublicError.error(.adminAccess, "Admin access is required.") }
        struct Params: Encodable { let invite_email: String?; let invite_role: String }
        struct Result: Decodable { let token: UUID; let expires_at: Date }
        let rows: [Result] = try await client.rpc("create_organization_invite", params: Params(invite_email: email, invite_role: role)).execute().value
        guard let token = rows.first?.token else { throw AFPublicError.error(.adminInvite, "We couldn't create that invitation.") }
        return token
    }

    func revokeOrganizationInvite(id: UUID) async throws {
        guard isAdmin, let client else { throw AFPublicError.error(.adminAccess, "Admin access is required.") }
        try await client.rpc("revoke_organization_invite", params: ["invite_id": id.uuidString]).execute()
    }
}
