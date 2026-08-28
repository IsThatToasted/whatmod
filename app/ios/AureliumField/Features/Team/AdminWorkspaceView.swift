import SwiftUI
import Observation
import Supabase

private enum AdminTab: Hashable { case overview, timecards, employees, invites }

struct AdminWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @State private var store = AdminWorkspaceStore()
    @State private var selectedTab: AdminTab = .overview

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { AdminDashboardView(selectedTab: $selectedTab) }
                .tabItem { Label("Overview", systemImage: "rectangle.3.group") }
                .tag(AdminTab.overview)
            NavigationStack { AdminTimecardsView() }
                .tabItem { Label("Timecards", systemImage: "clock.badge.checkmark") }
                .badge(store.pendingReviewCount)
                .tag(AdminTab.timecards)
            NavigationStack { AdminEmployeesView() }
                .tabItem { Label("Employees", systemImage: "person.3") }
                .tag(AdminTab.employees)
            NavigationStack { AdminInvitesView() }
                .tabItem { Label("Invites", systemImage: "person.badge.plus") }
                .tag(AdminTab.invites)
        }
        .environment(store)
        .tint(.primary)
        .task { await store.load() }
        .alert("Admin workspace", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(store.errorMessage ?? "") }
    }
}

@MainActor @Observable
private final class AdminWorkspaceStore {
    var members: [AdminOrganizationMember] = []
    var timecards: [TimeEntryRecord] = []
    var editRequests: [AdminTimeEditRequest] = []
    var invites: [OrganizationInviteRecord] = []
    var isLoading = false
    var errorMessage: String?

    private var cloud: SupabaseService { .shared }

    var submittedTimecards: [TimeEntryRecord] { timecards.filter { $0.status == "submitted" } }
    var reviewedTimecards: [TimeEntryRecord] { timecards.filter { ["approved", "rejected"].contains($0.status) } }
    var otherTimecards: [TimeEntryRecord] { timecards.filter { !["submitted", "approved", "rejected"].contains($0.status) } }
    var pendingReviewCount: Int { submittedTimecards.count + editRequests.count }
    var activeMemberCount: Int { members.filter(\.active).count }
    var openInviteCount: Int { invites.filter { $0.acceptedAt == nil && $0.revokedAt == nil && $0.expiresAt > .now }.count }

    func name(for userID: UUID) -> String {
        guard let member = members.first(where: { $0.userID == userID }) else { return "Employee" }
        return member.displayName ?? member.email ?? "Employee"
    }

    func load() async {
        guard cloud.isAdmin, let client = cloud.client, let organizationID = cloud.organizationID else {
            errorMessage = "Admin access is required."
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            members = try await cloud.fetchAdminMembers()
            timecards = try await client.from("time_entries")
                .select("id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at")
                .eq("organization_id", value: organizationID.uuidString)
                .order("clock_in", ascending: false)
                .limit(100)
                .execute().value
            editRequests = try await client.from("time_entry_edit_requests")
                .select("id,time_entry_id,requested_by,proposed_clock_in,proposed_clock_out,proposed_project_id,proposed_cost_code,proposed_notes,reason,status,created_at")
                .eq("organization_id", value: organizationID.uuidString)
                .eq("status", value: "pending")
                .order("created_at", ascending: true)
                .execute().value
            invites = try await cloud.fetchOrganizationInvites()
        } catch { errorMessage = error.localizedDescription }
    }

    func approve(_ entry: TimeEntryRecord) async { await decide(entry, approve: true, note: nil) }
    func reject(_ entry: TimeEntryRecord, note: String?) async { await decide(entry, approve: false, note: note) }

    private func decide(_ entry: TimeEntryRecord, approve: Bool, note: String?) async {
        guard let client = cloud.client else { return }
        struct Params: Encodable { let entry_id: UUID; let approve: Bool; let decision_note: String? }
        do {
            try await client.rpc("admin_decide_time_entry", params: Params(entry_id: entry.id, approve: approve, decision_note: note)).execute()
            await load()
        } catch { errorMessage = error.localizedDescription }
    }

    func deleteTimecard(_ entry:TimeEntryRecord) async {
        guard let client=cloud.client else{return}
        struct Params:Encodable{let entry_id:UUID}
        do{try await client.rpc("admin_delete_time_entry",params:Params(entry_id:entry.id)).execute();await load()}catch{errorMessage=error.localizedDescription}
    }

    func decideEditRequest(_ request: AdminTimeEditRequest, approve: Bool) async {
        guard let client = cloud.client else { return }
        struct Params: Encodable { let request_id: UUID; let approve: Bool; let admin_note: String? }
        do {
            try await client.rpc("decide_time_entry_edit", params: Params(request_id: request.id, approve: approve, admin_note: nil)).execute()
            await load()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct AdminTimeEditRequest: Codable, Identifiable, Hashable {
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

private struct AdminDashboardView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = SupabaseService.shared
    @Binding var selectedTab: AdminTab

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ADMIN WORKSPACE").font(.caption2.bold()).foregroundStyle(.secondary).tracking(1.2)
                    Text(cloud.membership?.organization?.name ?? "Organization").font(.title.bold())
                    Text("People, time approvals and organization access are isolated from the employee workspace.").foregroundStyle(.secondary)
                }.padding(.vertical, 8)
            }
            Section("Needs attention") {
                AdminCountRow(title: "Submitted timecards", value: store.submittedTimecards.count, icon: "clock.badge.exclamationmark") { selectedTab = .timecards }
                AdminCountRow(title: "Employee edit requests", value: store.editRequests.count, icon: "pencil.and.list.clipboard") { selectedTab = .timecards }
                AdminCountRow(title: "Open employee invites", value: store.openInviteCount, icon: "person.badge.plus") { selectedTab = .invites }
            }
            Section("Organization") {
                AdminCountRow(title: "Active employees", value: store.activeMemberCount, icon: "person.3") { selectedTab = .employees }
            }
        }
        .navigationTitle("Admin")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
    }
}

private struct AdminCountRow: View {
    let title: String
    let value: Int
    let icon: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).frame(width: 26).foregroundStyle(.secondary)
                Text(title).foregroundStyle(.primary)
                Spacer()
                Text("\(value)").font(.headline.monospacedDigit())
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }.contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

private struct AdminTimecardsView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var editing: TimeEntryRecord?
    @State private var rejectTarget: TimeEntryRecord?
    @State private var rejectionReason = ""
    @State private var deleteTarget: TimeEntryRecord?

    var body: some View {
        List {
            if !store.editRequests.isEmpty {
                Section("Employee edit requests") {
                    ForEach(store.editRequests) { request in
                        VStack(alignment: .leading, spacing: 9) {
                            Text(store.name(for: request.requestedBy)).font(.headline)
                            Text(request.reason).foregroundStyle(.secondary)
                            Text(formatRange(request.proposedClockIn, request.proposedClockOut)).font(.caption).foregroundStyle(.secondary)
                            HStack {
                                Button("Reject", role: .destructive) { Task { await store.decideEditRequest(request, approve: false) } }
                                Spacer()
                                Button("Approve Changes") { Task { await store.decideEditRequest(request, approve: true) } }.buttonStyle(.borderedProminent).tint(.primary)
                            }
                        }.padding(.vertical, 6)
                    }
                }
            }
            Section("Submitted") {
                if store.submittedTimecards.isEmpty {
                    ContentUnavailableView("No timecards waiting", systemImage: "checkmark.circle", description: Text("Submitted employee timecards will appear here."))
                }
                ForEach(store.submittedTimecards) { entry in
                    AdminTimecardRow(entry: entry, employee: store.name(for: entry.userID), project: projectName(entry.projectID)) {
                        editing = entry
                    } approve: {
                        Task { await store.approve(entry) }
                    } reject: {
                        rejectionReason = ""
                        rejectTarget = entry
                    } delete: { deleteTarget = entry }
                }
            }
            if !store.reviewedTimecards.isEmpty {
                Section("Reviewed history") {
                    ForEach(store.reviewedTimecards.prefix(30)) { entry in
                        AdminTimecardRow(entry: entry, employee: store.name(for: entry.userID), project: projectName(entry.projectID)) { editing = entry } delete: { deleteTarget = entry }
                    }
                }
            }
            if !store.otherTimecards.isEmpty {
                Section("Draft / open timecards") {
                    ForEach(store.otherTimecards.prefix(30)) { entry in
                        AdminTimecardRow(entry:entry,employee:store.name(for:entry.userID),project:projectName(entry.projectID)){editing=entry} delete:{deleteTarget=entry}
                    }
                }
            }
        }
        .navigationTitle("Timecards")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
        .sheet(item: $editing) { AdminTimeEntryEditor(entry: $0) { await store.load() } }
        .alert("Reject timecard", isPresented: Binding(get: { rejectTarget != nil }, set: { if !$0 { rejectTarget = nil } })) {
            TextField("Reason", text: $rejectionReason)
            Button("Cancel", role: .cancel) { rejectTarget = nil }
            Button("Reject", role: .destructive) {
                if let entry = rejectTarget { Task { await store.reject(entry, note: rejectionReason) } }
                rejectTarget = nil
            }
        } message: { Text("The employee will see this timecard as rejected and may correct and resubmit it.") }
        .confirmationDialog("Delete timecard?", isPresented:Binding(get:{deleteTarget != nil},set:{if !$0{deleteTarget=nil}}),titleVisibility:.visible){
            Button("DELETE",role:.destructive){if let entry=deleteTarget{Task{await store.deleteTimecard(entry)}};deleteTarget=nil}
            Button("Cancel",role:.cancel){deleteTarget=nil}
        } message:{Text("This permanently deletes the timecard and its GPS/edit-request history. This cannot be undone.")}
    }

    private func projectName(_ id: UUID) -> String { model.projects.first(where: { $0.id == id })?.name ?? "Project" }
}

private struct AdminTimecardRow: View {
    let entry: TimeEntryRecord
    let employee: String
    let project: String
    let edit: () -> Void
    var approve: (() -> Void)? = nil
    var reject: (() -> Void)? = nil
    var delete: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack { Text(employee).font(.headline); Spacer(); Text(entry.status.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary) }
            Text(project).font(.subheadline).foregroundStyle(.secondary)
            Text(formatRange(entry.clockIn, entry.clockOut)).font(.caption).foregroundStyle(.secondary)
            HStack {
                Button("Edit", action: edit).buttonStyle(.bordered)
                if let delete { Button(role:.destructive,action:delete){Label("Delete",systemImage:"trash")} }
                Spacer()
                if let reject { Button("Reject", role: .destructive, action: reject) }
                if let approve { Button("Approve", action: approve).buttonStyle(.borderedProminent).tint(.primary) }
            }
        }.padding(.vertical, 5)
    }
}

private struct AdminTimeEntryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = SupabaseService.shared
    @State var entry: TimeEntryRecord
    @State private var adjustmentReason = ""
    let onSaved: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Project", selection: $entry.projectID) { ForEach(model.projects) { Text($0.name).tag($0.id) } }
                DatePicker("Clock in", selection: $entry.clockIn)
                DatePicker("Clock out", selection: Binding(get: { entry.clockOut ?? entry.clockIn }, set: { entry.clockOut = $0 }))
                TextField("Cost code", text: optionalText($entry.costCode))
                TextField("Notes", text: optionalText($entry.notes), axis: .vertical)
                Section("Audit note") {
                    TextField("Reason for admin adjustment", text: $adjustmentReason, axis: .vertical)
                    Text("Admin edits are recorded with the administrator and timestamp.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Edit Timecard")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }.disabled(adjustmentReason.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                }
            }
        }
    }

    private func save() async {
        guard let client = cloud.client else { return }
        struct Params: Encodable {
            let entry_id: UUID; let new_clock_in: Date; let new_clock_out: Date?; let new_project_id: UUID
            let new_cost_code: String?; let new_notes: String?; let adjustment_reason: String
        }
        do {
            let params = Params(entry_id: entry.id, new_clock_in: entry.clockIn, new_clock_out: entry.clockOut, new_project_id: entry.projectID, new_cost_code: entry.costCode, new_notes: entry.notes, adjustment_reason: adjustmentReason)
            try await client.rpc("admin_update_time_entry", params: params).execute()
            await onSaved()
            dismiss()
        } catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminEmployeesView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = SupabaseService.shared
    @State private var editing: AdminOrganizationMember?
    @State private var removeTarget: AdminOrganizationMember?

    var body: some View {
        List {
            ForEach(store.members) { member in
                HStack(spacing: 12) {
                    Circle().fill(.quaternary).frame(width: 42, height: 42).overlay(Text(initial(member)).font(.headline))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(member.displayName ?? member.email ?? "Unnamed employee").font(.headline)
                        Text("\(member.email ?? "No email") · \(member.role.capitalized)").font(.caption).foregroundStyle(.secondary)
                        if member.active { Text("Active").font(.caption2.bold()).foregroundStyle(.green) }
                        else { Text("Inactive").font(.caption2.bold()).foregroundStyle(.secondary) }
                    }
                    Spacer()
                    Menu {
                        Button("Edit Employee", systemImage: "pencil") { editing = member }
                        if member.active && member.role != "owner" { Button("Remove from Organization", systemImage: "person.fill.xmark", role: .destructive) { removeTarget = member } }
                    } label: { Image(systemName: "ellipsis.circle").font(.title3) }
                }.padding(.vertical, 4)
            }
        }
        .navigationTitle("Employees")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
        .sheet(item: $editing) { AdminEmployeeEditor(member: $0) { await store.load() } }
        .confirmationDialog("Remove employee?", isPresented: Binding(get: { removeTarget != nil }, set: { if !$0 { removeTarget = nil } }), titleVisibility: .visible) {
            Button("Remove from Organization", role: .destructive) {
                if let member = removeTarget { Task { await remove(member) } }
                removeTarget = nil
            }
            Button("Cancel", role: .cancel) { removeTarget = nil }
        } message: { Text("Access is deactivated, but historical timecards and audit records are preserved.") }
    }

    private func initial(_ member: AdminOrganizationMember) -> String { String((member.displayName ?? member.email ?? "?").prefix(1)).uppercased() }
    private func remove(_ member: AdminOrganizationMember) async {
        do { try await cloud.removeAdminMember(userID: member.userID); await store.load() }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminEmployeeEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = SupabaseService.shared
    @State var member: AdminOrganizationMember
    let onSaved: () async -> Void
    private let roles = ["crew", "foreman", "estimator", "pm", "office", "admin", "owner"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Display name", text: optionalText($member.displayName))
                LabeledContent("Email", value: member.email ?? "Unavailable")
                TextField("Phone", text: optionalText($member.phone)).keyboardType(.phonePad)
                Picker("Role", selection: $member.role) { ForEach(roles, id: \.self) { Text($0.capitalized).tag($0) } }
                Toggle("Active organization access", isOn: $member.active)
            }
            .navigationTitle("Edit Employee")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } } }
            }
        }
    }

    private func save() async {
        do { try await cloud.updateAdminMember(member); await onSaved(); dismiss() }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private struct AdminInvitesView: View {
    @Environment(AppModel.self) private var model
    @Environment(AdminWorkspaceStore.self) private var store
    @State private var cloud = SupabaseService.shared
    @State private var email = ""
    @State private var role = "crew"
    @State private var generatedURL: URL?
    private let roles = ["crew", "foreman", "estimator", "pm", "office", "admin"]

    var body: some View {
        List {
            Section("New employee invite") {
                TextField("Employee email (recommended)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                Picker("Role", selection: $role) { ForEach(roles, id: \.self) { Text($0.capitalized).tag($0) } }
                Button("Generate Join Link", systemImage: "person.badge.plus") { Task { await generate() } }
                if let generatedURL {
                    Text(generatedURL.absoluteString).font(.caption).textSelection(.enabled)
                    ShareLink(item: generatedURL) { Label("Email or Share Invite", systemImage: "square.and.arrow.up") }
                }
            }
            Section("Invite history") {
                ForEach(store.invites) { invite in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text(invite.email ?? "Open email invite").font(.headline); Spacer(); Text(invite.role.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary) }
                        Text(inviteStatus(invite)).font(.caption).foregroundStyle(.secondary)
                        if invite.acceptedAt == nil && invite.revokedAt == nil && invite.expiresAt > .now {
                            Button("Revoke Invite", role: .destructive) { Task { await revoke(invite) } }.font(.caption.bold())
                        }
                    }.padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Invites")
        .toolbar { adminEmployeeToolbar(model: model) }
        .refreshable { await store.load() }
    }

    private func generate() async {
        do {
            let token = try await cloud.createOrganizationInvite(email: email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : email.trimmingCharacters(in: .whitespacesAndNewlines), role: role)
            generatedURL = URL(string: "https://whatmod.com/app/#/join?invite=\(token.uuidString)")
            await store.load()
        } catch { store.errorMessage = error.localizedDescription }
    }

    private func revoke(_ invite: OrganizationInviteRecord) async {
        do { try await cloud.revokeOrganizationInvite(id: invite.id); await store.load() }
        catch { store.errorMessage = error.localizedDescription }
    }

    private func inviteStatus(_ invite: OrganizationInviteRecord) -> String {
        if invite.acceptedAt != nil { return "Accepted" }
        if invite.revokedAt != nil { return "Revoked" }
        if invite.expiresAt <= .now { return "Expired" }
        return "Active · expires \(invite.expiresAt.formatted(date: .abbreviated, time: .omitted))"
    }
}

@ToolbarContentBuilder
private func adminEmployeeToolbar(model: AppModel) -> some ToolbarContent {
    ToolbarItem(placement: .topBarTrailing) {
        Button { model.workspaceMode = .employee } label: { Label("Employee View", systemImage: "person.crop.circle") }
    }
}

private func optionalText(_ binding: Binding<String?>) -> Binding<String> {
    Binding<String>(get: { binding.wrappedValue ?? "" }, set: { binding.wrappedValue = $0.isEmpty ? nil : $0 })
}

private func formatRange(_ start: Date, _ end: Date?) -> String {
    let startText = start.formatted(date: .abbreviated, time: .shortened)
    guard let end else { return "\(startText) – open" }
    return "\(startText) – \(end.formatted(date: .omitted, time: .shortened))"
}
