import SwiftUI
import Foundation
import CoreLocation

struct TeamView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        TimeClockView()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let org = cloud.membership?.organization {
                            Section(org.name) {
                                Text("Role: \(cloud.membership?.role.capitalized ?? "Member")")
                            }
                        }
                        if cloud.isAdmin {
                            Button {
                                model.workspaceMode = .admin
                            } label: {
                                Label("Switch to Admin View", systemImage: "shield.lefthalf.filled")
                            }
                        }
                        Button(role: .destructive) {
                            Task { await cloud.signOut() }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                }
            }
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
    @State private var showingClockInSheet = false

    private let commonCostCodes = ["Painting", "Prep", "Punch", "Travel", "Shop", "Supervision"]

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                statusCard
                weeklySummary
                recentTimecards
            }
            .padding(16)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Time Clock")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            selectedProjectID = model.selectedProjectID ?? model.projects.first?.id
            await clock.refresh()
        }
        .sheet(isPresented: $showingClockInSheet) { clockInSheet }
        .sheet(item: $editing) { TimeEntryEditor(entry: $0) }
        .confirmationDialog("Submit this timecard?", isPresented: Binding(get: { submitTarget != nil }, set: { if !$0 { submitTarget = nil } }), titleVisibility: .visible) {
            Button("Confirm & Submit") {
                if let entry = submitTarget { Task { await clock.submit(entry) }; submitTarget = nil }
            }
            Button("Cancel", role: .cancel) { submitTarget = nil }
        } message: {
            Text("You can edit freely before submitting. Corrections after submission require admin approval.")
        }
        .alert("Time clock", isPresented: Binding(get: { clock.errorMessage != nil }, set: { if !$0 { clock.errorMessage = nil } })) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(clock.errorMessage ?? "")
        }
    }

    private var statusCard: some View {
        VStack(spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text(clock.activeEntry == nil ? "READY TO WORK" : "ON THE CLOCK")
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(clock.activeEntry == nil ? Color.secondary : Color.green)
                    Text(clock.activeEntry == nil ? "Clock in" : "Current shift")
                        .font(.title2.bold())
                }
                Spacer()
                Image(systemName: clock.activeEntry == nil ? "clock" : "clock.badge.checkmark.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(clock.activeEntry == nil ? Color.secondary : Color.green)
            }

            if let active = clock.activeEntry {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    VStack(spacing: 8) {
                        Text(elapsedString(from: active.clockIn, to: context.date))
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .monospacedDigit()
                        Text(projectName(active.projectID))
                            .font(.headline)
                        HStack(spacing: 12) {
                            Label(active.costCode ?? "No cost code", systemImage: "tag")
                            Label("GPS active", systemImage: "location.fill")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }

                Button {
                    Task { await clock.clockOut() }
                } label: {
                    Label(clock.isWorking ? "Clocking out…" : "Clock Out", systemImage: "stop.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .disabled(clock.isWorking)
            } else {
                VStack(spacing: 5) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                        .font(.headline)
                    Text(Date.now.formatted(date: .omitted, time: .shortened))
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)

                Button {
                    showingClockInSheet = true
                } label: {
                    Label("Clock In", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(model.projects.isEmpty || clock.isWorking)

                Text(model.projects.isEmpty ? "Add or sync a project before clocking in." : "Choose a job and cost code before starting your shift.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(20)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22))
    }

    private var weeklySummary: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("THIS WEEK").font(.caption2.bold()).tracking(1.1).foregroundStyle(.secondary)
                    Text("Timesheet").font(.title3.bold())
                }
                Spacer()
                Text(hoursString(weeklyHours))
                    .font(.title2.bold())
                    .monospacedDigit()
            }
            HStack(spacing: 0) {
                summaryMetric("Regular", value: hoursString(weeklyHours))
                Divider().frame(height: 42)
                summaryMetric("Shifts", value: "\(weeklyEntries.count)")
                Divider().frame(height: 42)
                summaryMetric("Submitted", value: "\(weeklyEntries.filter { $0.status == "submitted" || $0.status == "approved" }.count)")
            }
        }
        .padding(18)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }

    private var recentTimecards: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent timecards").font(.title3.bold())
                Spacer()
                Text("\(clock.entries.count)").font(.caption.bold()).foregroundStyle(.secondary)
            }

            if clock.entries.isEmpty {
                ContentUnavailableView("No time yet", systemImage: "clock", description: Text("Completed shifts will appear here."))
                    .frame(minHeight: 180)
            } else {
                ForEach(clock.entries.prefix(14)) { entry in
                    Button { editing = entry } label: {
                        HStack(spacing: 12) {
                            VStack(spacing: 2) {
                                Text(entry.clockIn.formatted(.dateTime.day()))
                                    .font(.title3.bold())
                                Text(entry.clockIn.formatted(.dateTime.month(.abbreviated)))
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            .frame(width: 44, height: 52)
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))

                            VStack(alignment: .leading, spacing: 5) {
                                Text(projectName(entry.projectID)).font(.body.weight(.semibold))
                                Text(timeRange(entry))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if let code = entry.costCode, !code.isEmpty {
                                    Text(code).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 5) {
                                Text(entryHours(entry)).font(.body.bold()).monospacedDigit()
                                Text(entry.status.capitalized)
                                    .font(.caption2.bold())
                                    .foregroundStyle(statusColor(entry.status))
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 5)

                    if ["draft", "rejected"].contains(entry.status), entry.clockOut != nil {
                        Button(entry.status == "rejected" ? "Review & Resubmit" : "Review & Submit") { submitTarget = entry }
                            .font(.caption.bold())
                            .buttonStyle(.bordered)
                    }
                    if entry.id != clock.entries.prefix(14).last?.id { Divider() }
                }
            }
        }
        .padding(18)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }

    private var clockInSheet: some View {
        NavigationStack {
            Form {
                Section("Job") {
                    Picker("Project", selection: $selectedProjectID) {
                        Text("Select project").tag(Optional<UUID>.none)
                        ForEach(model.projects) { Text($0.name).tag(UUID?.some($0.id)) }
                    }
                }
                Section("Cost code") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(commonCostCodes, id: \.self) { code in
                                Button(code) { costCode = code }
                                    .buttonStyle(.bordered)
                                    .tint(costCode == code ? Color.primary : Color.secondary)
                            }
                        }
                    }
                    TextField("Cost code", text: $costCode)
                }
                Section("Shift notes") {
                    TextField("Optional notes", text: $notes, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    Label(locationDescription, systemImage: "location.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Start Shift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingClockInSheet = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Clock In") {
                        guard let id = selectedProjectID else { return }
                        Task {
                            await clock.clockIn(projectID: id, costCode: costCode, notes: notes)
                            if clock.activeEntry != nil { showingClockInSheet = false; notes = "" }
                        }
                    }
                    .disabled(selectedProjectID == nil || clock.isWorking)
                }
            }
        }
    }

    private var weeklyEntries: [TimeEntryRecord] {
        let calendar = Calendar.current
        let start = calendar.dateInterval(of: .weekOfYear, for: .now)?.start ?? .distantPast
        return clock.entries.filter { $0.clockIn >= start }
    }

    private var weeklyHours: Double {
        weeklyEntries.reduce(0) { total, entry in
            guard let out = entry.clockOut else { return total }
            return total + max(0, out.timeIntervalSince(entry.clockIn) / 3600)
        }
    }

    private var locationDescription: String {
        if let location = clock.lastLocation { return "Location available · ±\(Int(max(0, location.horizontalAccuracy))) m" }
        switch clock.locationAuthorization {
        case .denied, .restricted: return "Location access is off. Your organization may require GPS verification."
        default: return "Aurelium will capture jobsite location when you start the shift."
        }
    }

    private func summaryMetric(_ label: String, value: String) -> some View {
        VStack(spacing: 4) { Text(value).font(.headline.bold()); Text(label).font(.caption2).foregroundStyle(.secondary) }
            .frame(maxWidth: .infinity)
    }

    private func projectName(_ id: UUID) -> String {
        model.projects.first(where: { $0.id == id })?.name ?? "Project"
    }

    private func elapsedString(from start: Date, to end: Date) -> String {
        let seconds = max(0, Int(end.timeIntervalSince(start)))
        return String(format: "%02d:%02d:%02d", seconds / 3600, (seconds % 3600) / 60, seconds % 60)
    }

    private func hoursString(_ hours: Double) -> String { String(format: "%.2f h", hours) }

    private func entryHours(_ entry: TimeEntryRecord) -> String {
        guard let out = entry.clockOut else { return "Active" }
        return hoursString(max(0, out.timeIntervalSince(entry.clockIn) / 3600))
    }

    private func timeRange(_ entry: TimeEntryRecord) -> String {
        let start = entry.clockIn.formatted(date: .omitted, time: .shortened)
        let end = entry.clockOut?.formatted(date: .omitted, time: .shortened) ?? "Now"
        return "\(start) – \(end)"
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "approved": return .green
        case "rejected": return .red
        case "submitted": return .blue
        default: return .secondary
        }
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
                Section("Shift") {
                    DatePicker("Clock in", selection: $entry.clockIn)
                    DatePicker("Clock out", selection: Binding(get: { entry.clockOut ?? entry.clockIn }, set: { entry.clockOut = $0 }))
                    TextField("Cost code", text: Binding<String>(get: { entry.costCode ?? "" }, set: { entry.costCode = $0.isEmpty ? nil : $0 }))
                    TextField("Notes", text: Binding<String>(get: { entry.notes ?? "" }, set: { entry.notes = $0.isEmpty ? nil : $0 }), axis: .vertical)
                }
                if entry.status != "draft" {
                    Section("Request correction") {
                        Text("Submitted time is protected. Explain the correction and send it to an admin for review.")
                            .font(.caption).foregroundStyle(.secondary)
                        TextField("Reason for correction", text: $reason, axis: .vertical)
                        Button("Request Changes") {
                            Task { if await clock.requestEdit(entry, reason: reason) { dismiss() } }
                        }
                        .disabled(reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .navigationTitle("Timecard")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await clock.updateDraft(entry); dismiss() } }.disabled(entry.status != "draft")
                }
            }
        }
    }
}
