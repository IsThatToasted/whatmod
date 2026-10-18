import Foundation

struct MemberPermission: Codable, Hashable, Identifiable {
    var permissionKey: String
    var allowed: Bool
    var id: String { permissionKey }
    enum CodingKeys: String, CodingKey { case permissionKey = "permission_key"; case allowed }
}

@MainActor
final class PermissionService {
    static let shared = PermissionService()
    private init() {}
    private var cloud: WorkspaceService { .shared }

    func myPermissions() async throws -> [MemberPermission] {
        try await cloud.rpcValue("my_permissions", params: EmptyPermissionPayload(), as: [MemberPermission].self)
    }

    func adminPermissions(userID: UUID) async throws -> [MemberPermission] {
        struct Params: Encodable { let member_user_id: UUID }
        return try await cloud.rpcValue("admin_get_member_permissions", params: Params(member_user_id: userID), as: [MemberPermission].self)
    }

    func setAdminPermission(userID: UUID, key: String, allowed: Bool) async throws {
        struct Params: Encodable { let member_user_id: UUID; let key: String; let new_allowed: Bool }
        try await cloud.rpcVoid("admin_set_member_permission", params: Params(member_user_id: userID, key: key, new_allowed: allowed))
    }

    func assertChatCreatePermission() async throws {
        try await cloud.rpcVoid("chat_assert_create_permission", params: EmptyPermissionPayload())
    }
}

private struct EmptyPermissionPayload: Encodable {}
