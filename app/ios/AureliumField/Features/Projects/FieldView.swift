import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct FieldView: View {
    @Environment(AppModel.self) private var model
    @State private var field = FieldOperationsService.shared
    @State private var selectedProjectID: UUID?

    var body: some View {
        List {
            Section {
                Picker("Project", selection: $selectedProjectID) {
                    Text("Select a project").tag(Optional<UUID>.none)
                    ForEach(model.projects) { project in
                        Text(project.name).tag(UUID?.some(project.id))
                    }
                }
            } header: {
                Text("Working on")
            } footer: {
                Text("Everything captured here stays attached to the selected project and is shared with the web workspace.")
            }

            if let projectID = selectedProjectID {
                Section("Capture & document") {
                    NavigationLink { PhotoProgressView(projectID: projectID) } label: {
                        FieldMenuRow(icon: "camera.fill", title: "Photos & Progress", subtitle: "Before/after photos, progress evidence, site conditions", count: field.records(kind: .photoProgress).count)
                    }
                    NavigationLink { DailyLogView(projectID: projectID) } label: {
                        FieldMenuRow(icon: "list.clipboard.fill", title: "Daily Log", subtitle: "Weather, manpower, work completed, blockers", count: field.records(kind: .dailyLog).count)
                    }
                    NavigationLink { PunchQualityView(projectID: projectID) } label: {
                        FieldMenuRow(icon: "checkmark.circle.fill", title: "Punch & Quality", subtitle: "Deficiencies, assignments, due dates, closeout", count: field.records(kind: .punch).filter { $0.status != "closed" }.count)
                    }
                }

                Section("Reference & compliance") {
                    NavigationLink { FieldDocumentsView(projectID: projectID) } label: {
                        FieldMenuRow(icon: "doc.on.doc.fill", title: "Plans & Documents", subtitle: "Current plans, scopes, PDFs and revisions", count: field.records(kind: .document).count)
                    }
                    NavigationLink { SafetyView(projectID: projectID) } label: {
                        FieldMenuRow(icon: "cross.case.fill", title: "Safety", subtitle: "Toolbox talks, observations, incidents, acknowledgements", count: field.records(kind: .safety).filter { !$0.acknowledged }.count)
                    }
                }

                Section("Labor") {
                    Button {
                        model.selectedTab = .team
                    } label: {
                        FieldMenuRow(icon: "clock.badge.checkmark.fill", title: "Time & Cost Codes", subtitle: "Clock in, choose cost code, review and submit time", count: nil)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                ContentUnavailableView("Select a project", systemImage: "briefcase", description: Text("Choose the project you are working on to open field tools."))
            }
        }
        .navigationTitle("Field")
        .task {
            selectedProjectID = model.selectedProjectID ?? model.projects.first?.id
            await field.refresh(projectID: selectedProjectID)
        }
        .onChange(of: selectedProjectID) { _, newValue in
            if let id = newValue, let project = model.projects.first(where: { $0.id == id }) { model.selectProject(project) }
            Task { await field.refresh(projectID: newValue) }
        }
        .alert("Field", isPresented: Binding(get: { field.errorMessage != nil }, set: { if !$0 { field.errorMessage = nil } })) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(field.errorMessage ?? "")
        }
    }
}

private struct FieldMenuRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let count: Int?

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 19, weight: .semibold))
                .frame(width: 38, height: 38)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.body.weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer()
            if let count {
                Text("\(count)")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.quaternary, in: Capsule())
            }
        }
        .padding(.vertical, 4)
    }
}

private struct PhotoProgressView: View {
    let projectID: UUID
    @State private var field = FieldOperationsService.shared
    @State private var pickerItem: PhotosPickerItem?
    @State private var caption = ""

    var body: some View {
        List {
            Section {
                TextField("What does this photo show?", text: $caption)
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    Label(field.isWorking ? "Saving…" : "Choose Photo", systemImage: "photo.badge.plus")
                }
                .disabled(field.isWorking)
            } header: { Text("Add progress photo") }

            Section("Project photos") {
                if field.records(kind: .photoProgress).isEmpty {
                    Text("No progress photos yet.").foregroundStyle(.secondary)
                }
                ForEach(field.records(kind: .photoProgress)) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Image(systemName: "photo.fill"); Text(record.title).font(.body.weight(.semibold)); Spacer(); Text(record.occurredAt, style: .date).font(.caption).foregroundStyle(.secondary) }
                        if let file = record.attachmentName { Text(file).font(.caption).foregroundStyle(.secondary) }
                    }
                    .swipeActions { Button("Delete", role: .destructive) { Task { await field.delete(record) } } }
                }
            }
        }
        .navigationTitle("Photos & Progress")
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    let name = "progress-\(Int(Date().timeIntervalSince1970)).jpg"
                    if await field.addPhoto(projectID: projectID, data: data, fileName: name, contentType: "image/jpeg", caption: caption) {
                        caption = ""
                        pickerItem = nil
                    }
                }
            }
        }
        .task { await field.refresh(projectID: projectID) }
    }
}

private struct DailyLogView: View {
    let projectID: UUID
    @State private var field = FieldOperationsService.shared
    @State private var weather = "Clear"
    @State private var manpower = 1
    @State private var workCompleted = ""
    @State private var blockers = ""
    @State private var notes = ""

    var body: some View {
        List {
            Section("Today's log") {
                Picker("Weather", selection: $weather) { ForEach(["Clear","Cloudy","Rain","Snow","Wind","Other"], id: \.self) { Text($0) } }
                Stepper("Manpower: \(manpower)", value: $manpower, in: 0...250)
                TextField("Work completed", text: $workCompleted, axis: .vertical).lineLimit(2...5)
                TextField("Blockers / delays", text: $blockers, axis: .vertical).lineLimit(2...4)
                TextField("Additional notes", text: $notes, axis: .vertical).lineLimit(2...4)
                Button("Save Daily Log") {
                    Task {
                        if await field.addDailyLog(projectID: projectID, weather: weather, manpower: manpower, workCompleted: workCompleted, blockers: blockers, notes: notes) {
                            workCompleted = ""; blockers = ""; notes = ""
                        }
                    }
                }
                .disabled(workCompleted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || field.isWorking)
            }

            Section("Recent logs") {
                ForEach(field.records(kind: .dailyLog)) { record in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text(record.occurredAt.formatted(date: .abbreviated, time: .omitted)).font(.body.weight(.semibold)); Spacer(); Text(record.weather ?? "").font(.caption).foregroundStyle(.secondary) }
                        if let work = record.workCompleted, !work.isEmpty { Text(work) }
                        HStack(spacing: 12) {
                            if let manpower = record.manpower { Label("\(manpower) crew", systemImage: "person.2") }
                            if let blockers = record.blockers, !blockers.isEmpty { Label("Blocker noted", systemImage: "exclamationmark.triangle") }
                        }.font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 3)
                }
            }
        }
        .navigationTitle("Daily Log")
        .task { await field.refresh(projectID: projectID) }
    }
}

private struct PunchQualityView: View {
    let projectID: UUID
    @State private var field = FieldOperationsService.shared
    @State private var title = ""
    @State private var details = ""
    @State private var assignee = ""
    @State private var hasDueDate = false
    @State private var dueDate = Date().addingTimeInterval(86_400)

    var body: some View {
        List {
            Section("New punch item") {
                TextField("Issue / deficiency", text: $title)
                TextField("Details", text: $details, axis: .vertical)
                TextField("Assigned to", text: $assignee)
                Toggle("Due date", isOn: $hasDueDate)
                if hasDueDate { DatePicker("Due", selection: $dueDate, displayedComponents: .date) }
                Button("Create Punch Item") {
                    Task {
                        if await field.addPunch(projectID: projectID, title: title, notes: details, assignee: assignee, dueAt: hasDueDate ? dueDate : nil) {
                            title = ""; details = ""; assignee = ""; hasDueDate = false
                        }
                    }
                }.disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Section("Open") {
                let open = field.records(kind: .punch).filter { $0.status != "closed" }
                if open.isEmpty { Text("No open punch items.").foregroundStyle(.secondary) }
                ForEach(open) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(record.title).font(.body.weight(.semibold))
                        if let notes = record.notes, !notes.isEmpty { Text(notes).font(.subheadline).foregroundStyle(.secondary) }
                        HStack { if let who = record.assigneeName, !who.isEmpty { Label(who, systemImage: "person") }; if let due = record.dueAt { Text("Due \(due.formatted(date: .abbreviated, time: .omitted))") } }.font(.caption).foregroundStyle(.secondary)
                        Button("Mark Complete") { Task { await field.setStatus(record, status: "closed") } }.font(.caption.bold())
                    }.padding(.vertical, 3)
                }
            }

            Section("Completed") {
                ForEach(field.records(kind: .punch).filter { $0.status == "closed" }) { record in
                    Label(record.title, systemImage: "checkmark.circle.fill").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Punch & Quality")
        .task { await field.refresh(projectID: projectID) }
    }
}

private struct FieldDocumentsView: View {
    let projectID: UUID
    @State private var field = FieldOperationsService.shared
    @State private var showImporter = false
    @State private var documentTitle = ""
    @State private var revision = ""
    @State private var notes = ""

    var body: some View {
        List {
            Section("Add document") {
                TextField("Document title", text: $documentTitle)
                TextField("Revision", text: $revision)
                TextField("Notes", text: $notes, axis: .vertical)
                Button { showImporter = true } label: { Label("Choose PDF or File", systemImage: "doc.badge.plus") }
            }
            Section("Current documents") {
                if field.records(kind: .document).isEmpty { Text("No documents uploaded yet.").foregroundStyle(.secondary) }
                ForEach(field.records(kind: .document)) { record in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(record.title).font(.body.weight(.semibold))
                        HStack { if let revision = record.revision, !revision.isEmpty { Text("Rev \(revision)") }; if let name = record.attachmentName { Text(name) } }.font(.caption).foregroundStyle(.secondary)
                        if let notes = record.notes, !notes.isEmpty { Text(notes).font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
        }
        .navigationTitle("Plans & Documents")
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf, .data], allowsMultipleSelection: false) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            Task {
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url) else { return }
                let type = url.pathExtension.lowercased() == "pdf" ? "application/pdf" : "application/octet-stream"
                if await field.addDocument(projectID: projectID, data: data, fileName: url.lastPathComponent, contentType: type, title: documentTitle, revision: revision, notes: notes) {
                    documentTitle = ""; revision = ""; notes = ""
                }
            }
        }
        .task { await field.refresh(projectID: projectID) }
    }
}

private struct SafetyView: View {
    let projectID: UUID
    @State private var field = FieldOperationsService.shared
    @State private var title = ""
    @State private var type = "Observation"
    @State private var severity = "Low"
    @State private var notes = ""

    var body: some View {
        List {
            Section("New safety record") {
                Picker("Type", selection: $type) { ForEach(["Observation","Toolbox Talk","Inspection","Incident","Near Miss"], id: \.self) { Text($0) } }
                Picker("Severity", selection: $severity) { ForEach(["Low","Medium","High","Critical"], id: \.self) { Text($0) } }
                TextField("Title", text: $title)
                TextField("Notes / corrective action", text: $notes, axis: .vertical).lineLimit(2...5)
                Button("Save Safety Record") {
                    Task {
                        if await field.addSafety(projectID: projectID, title: title, type: type, severity: severity, notes: notes) { title = ""; notes = "" }
                    }
                }.disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Section("Safety activity") {
                if field.records(kind: .safety).isEmpty { Text("No safety records yet.").foregroundStyle(.secondary) }
                ForEach(field.records(kind: .safety)) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack { Text(record.title).font(.body.weight(.semibold)); Spacer(); Text(record.severity ?? "").font(.caption.bold()).foregroundStyle(record.severity == "Critical" || record.severity == "High" ? Color.red : Color.secondary) }
                        Text(record.safetyType ?? "Safety").font(.caption).foregroundStyle(.secondary)
                        if let notes = record.notes, !notes.isEmpty { Text(notes).font(.subheadline).foregroundStyle(.secondary) }
                        if !record.acknowledged { Button("Acknowledge / Close") { Task { await field.setStatus(record, status: "closed") } }.font(.caption.bold()) }
                    }.padding(.vertical, 3)
                }
            }
        }
        .navigationTitle("Safety")
        .task { await field.refresh(projectID: projectID) }
    }
}
