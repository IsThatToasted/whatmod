import SwiftUI

struct TeamView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        List {
            Section("Employee") {
                NavigationLink { TimeClockView() } label: { Label("My Time Clock", systemImage: "clock.badge.checkmark") }
            }
            if cloud.isAdmin {
                Section {
                    Button { model.workspaceMode = .admin } label: {
                        Label("Switch to Admin View", systemImage: "shield.lefthalf.filled")
                    }
                } footer: {
                    Text("Administrative tools are kept in a separate workspace and are never shown to employees.")
                }
            }
            Section("Company") {
                if let org = cloud.membership?.organization { LabeledContent("Organization", value: org.name) }
                LabeledContent("Your role", value: (cloud.membership?.role ?? "member").capitalized)
                if let email = cloud.email { LabeledContent("Signed in", value: email) }
                Button("Sign Out", role: .destructive) { Task { await cloud.signOut() } }
            }
        }
        .navigationTitle("My Time")
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
                    if ["draft", "rejected"].contains(entry.status), entry.clockOut != nil { Button(entry.status == "rejected" ? "Review & Resubmit" : "Review & Submit") { submitTarget = entry }.font(.caption.bold()) }
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

