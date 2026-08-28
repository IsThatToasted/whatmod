import SwiftUI

struct TeamView: View {
    @State private var cloud = SupabaseService.shared
    var body: some View {
        List {
            Section("Time & attendance") {
                NavigationLink { TimeClockView() } label: { Label("My Time Clock", systemImage: "clock.badge.checkmark") }
                if cloud.isAdmin { NavigationLink { TimeApprovalView() } label: { Label("Timesheet Approvals", systemImage: "checkmark.seal") } }
            }
            if cloud.isAdmin {
                Section("Organization") { NavigationLink { InviteEmployeeView() } label: { Label("Invite Employees", systemImage: "person.badge.plus") } }
            }
            Section("Company") {
                if let org = cloud.membership?.organization { LabeledContent("Organization", value: org.name) }
                LabeledContent("Your role", value: (cloud.membership?.role ?? "member").capitalized)
                if let email = cloud.email { LabeledContent("Signed in", value: email) }
                Button("Sign Out", role: .destructive) { Task { await cloud.signOut() } }
            }
        }.navigationTitle("Team")
    }
}

private struct TimeClockView: View {
    @Environment(AppModel.self) private var model
    @State private var clock = TimeClockService.shared
    @State private var selectedProjectID: UUID?
    @State private var costCode = "Painting"
    @State private var notes = ""
    @State private var editing: TimeEntryRecord?
    @State private var submitTarget: TimeEntryRecord?

    var body: some View {
        List {
            Section {
                if let active = clock.activeEntry {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CLOCKED IN").font(.caption.bold()).foregroundStyle(.green)
                        Text(active.clockIn.formatted(date: .omitted, time: .shortened)).font(.title2.bold())
                        Text("GPS tracking is active while Aurelium Field is running.").font(.caption).foregroundStyle(.secondary)
                    }
                    Button("Clock Out", role: .destructive) { Task { await clock.clockOut() } }.disabled(clock.isWorking)
                } else {
                    Picker("Project", selection: $selectedProjectID) {
                        Text("Select project").tag(Optional<UUID>.none)
                        ForEach(model.projects) { Text($0.name).tag(UUID?.some($0.id)) }
                    }
                    TextField("Cost code", text: $costCode)
                    TextField("Shift notes", text: $notes, axis: .vertical)
                    Button("Clock In") { if let id = selectedProjectID { Task { await clock.clockIn(projectID: id, costCode: costCode, notes: notes) } } }
                        .disabled(selectedProjectID == nil || clock.isWorking)
                }
            } header: { Text("Current shift") }

            Section("Recent timecards") {
                ForEach(clock.entries) { entry in
                    Button { editing = entry } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack { Text(entry.clockIn.formatted(date: .abbreviated, time: .shortened)); Spacer(); Text(entry.status.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary) }
                            if let out = entry.clockOut { Text("Out: \(out.formatted(date: .omitted, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
                        }
                    }.buttonStyle(.plain)
                    if entry.status == "draft", entry.clockOut != nil { Button("Review & Submit") { submitTarget = entry }.font(.caption.bold()) }
                }
            }
        }
        .navigationTitle("Time Clock")
        .task { selectedProjectID = model.selectedProjectID ?? model.projects.first?.id; clock.requestLocation(); await clock.refresh() }
        .sheet(item: $editing) { TimeEntryEditor(entry: $0) }
        .confirmationDialog("Submit this timecard?", isPresented: Binding(get: { submitTarget != nil }, set: { if !$0 { submitTarget = nil } }), titleVisibility: .visible) {
            Button("Confirm & Submit") { if let entry = submitTarget { Task { await clock.submit(entry) }; submitTarget = nil } }
            Button("Cancel", role: .cancel) { submitTarget = nil }
        } message: { Text("You can edit freely before submitting. Corrections after submission require admin approval.") }
        .alert("Time clock", isPresented: Binding(get: { clock.errorMessage != nil }, set: { if !$0 { clock.errorMessage = nil } })) { Button("OK", role: .cancel) {} } message: { Text(clock.errorMessage ?? "") }
    }
}

private struct TimeEntryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var clock = TimeClockService.shared
    @State var entry: TimeEntryRecord
    @State private var reason = ""
    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Clock in", selection: $entry.clockIn)
                DatePicker("Clock out", selection: Binding(get: { entry.clockOut ?? entry.clockIn }, set: { entry.clockOut = $0 }))
                TextField("Cost code", text: Binding<String>(
                    get: { entry.costCode ?? "" },
                    set: { entry.costCode = $0.isEmpty ? nil : $0 }
                ))
                TextField("Notes", text: Binding<String>(
                    get: { entry.notes ?? "" },
                    set: { entry.notes = $0.isEmpty ? nil : $0 }
                ), axis: .vertical)
                if entry.status != "draft" {
                    Section("Request correction") {
                        Text("This timecard has been submitted. Edit the fields above, explain the correction, then request admin approval.").font(.caption).foregroundStyle(.secondary)
                        TextField("Reason for correction", text: $reason, axis: .vertical)
                        Button("Request Changes") { Task { if await clock.requestEdit(entry, reason: reason) { dismiss() } } }.disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .navigationTitle("Timecard")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await clock.updateDraft(entry); dismiss() } }.disabled(entry.status != "draft") }
            }
        }
    }
}

private struct InviteEmployeeView: View {
    @State private var cloud = SupabaseService.shared
    @State private var email = ""
    @State private var role = "crew"
    @State private var inviteURL: URL?
    @State private var error: String?

    var body: some View {
        Form {
            Section("Employee") {
                TextField("Email (optional)", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                Picker("Role", selection: $role) { ForEach(["crew","foreman","estimator","pm","office","admin"], id: \.self) { Text($0.capitalized) } }
                Button("Generate Join Link") { generate() }
            }
            if let inviteURL {
                Section("Join link") {
                    Text(inviteURL.absoluteString).font(.caption).textSelection(.enabled)
                    ShareLink(item: inviteURL) { Label("Email or share invite", systemImage: "square.and.arrow.up") }
                }
            }
            if let error { Text(error).foregroundStyle(.red) }
        }.navigationTitle("Invite Employees")
    }

    private func generate() {
        guard let client = cloud.client else { return }
        Task {
            do {
                struct Params: Encodable { let invite_email: String?; let invite_role: String }
                struct Result: Decodable { let token: UUID; let expires_at: Date }
                let rows: [Result] = try await client.rpc("create_organization_invite", params: Params(invite_email: email.isEmpty ? nil : email, invite_role: role)).execute().value
                if let token = rows.first?.token { inviteURL = URL(string: "https://whatmod.com/app/#/join?invite=\(token.uuidString)") }
            } catch { self.error = error.localizedDescription }
        }
    }
}

private struct TimeApprovalView: View {
    @State private var rows: [TimeEntryRecord] = []
    @State private var cloud = SupabaseService.shared
    @State private var error: String?
    var body: some View {
        List {
            if rows.isEmpty { ContentUnavailableView("No pending timecards", systemImage: "checkmark.circle", description: Text("Submitted employee timecards will appear here.")) }
            ForEach(rows) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.clockIn.formatted(date: .abbreviated, time: .shortened)).font(.headline)
                    if let out = entry.clockOut { Text("Clock out: \(out.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
                    HStack {
                        Button("Approve") { decide(entry, approve: true) }.buttonStyle(.borderedProminent)
                        Button("Reject") { decide(entry, approve: false) }.buttonStyle(.bordered)
                    }
                }.padding(.vertical, 6)
            }
        }.navigationTitle("Timesheet Approvals").task { await load() }
        .alert("Approval error", isPresented: Binding(get:{error != nil},set:{if !$0{error=nil}})){Button("OK",role:.cancel){}} message:{Text(error ?? "")}
    }
    private func load() async {
        guard let client = cloud.client, let org = cloud.organizationID else { return }
        do { rows = try await client.from("time_entries").select("id,organization_id,project_id,user_id,clock_in,clock_out,cost_code,notes,status,submitted_at,approved_at").eq("organization_id",value:org.uuidString).eq("status",value:"submitted").order("submitted_at",ascending:true).execute().value }
        catch { self.error = error.localizedDescription }
    }
    private func decide(_ entry: TimeEntryRecord, approve: Bool) {
        guard let client = cloud.client, let admin = cloud.userID else { return }
        Task {
            do {
                struct Patch: Encodable { let status:String; let approved_by:UUID?; let approved_at:Date?; let rejected_at:Date? }
                let patch = Patch(status: approve ? "approved" : "rejected", approved_by: approve ? admin : nil, approved_at: approve ? .now : nil, rejected_at: approve ? nil : .now)
                try await client.from("time_entries").update(patch).eq("id",value:entry.id.uuidString).execute(); await load()
            } catch { self.error = error.localizedDescription }
        }
    }
}

