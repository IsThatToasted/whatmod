import SwiftUI

struct ProjectsView: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var detailsProject: ProjectSummary?
    @State private var editingProject: ProjectSummary?
    @State private var showingNewProject = false

    private var filtered: [ProjectSummary] {
        model.projects.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) || $0.client.localizedCaseInsensitiveContains(search) || $0.location.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List {
            ForEach(filtered) { project in
                Button {
                    model.selectProject(project)
                    detailsProject = project
                } label: {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(project.name).font(.headline).foregroundStyle(.primary)
                            Spacer()
                            if model.selectedProjectID == project.id { Text("SELECTED").font(.caption2.bold()).foregroundStyle(.secondary) }
                            Text(project.status.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                        Text("\(project.client) · \(project.location)").font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 10) { ProgressView(value: project.progress); Text("\(Int(project.progress * 100))%").font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                    }.padding(.vertical, 5).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) { model.deleteProject(project) } label: { Label("Delete", systemImage: "trash") }
                    Button { editingProject = project } label: { Label("Edit", systemImage: "pencil") }.tint(.gray)
                }
            }
        }
        .searchable(text: $search, prompt: "Projects, clients, addresses")
        .navigationTitle("Projects")
        .toolbar { Button { showingNewProject = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showingNewProject) { ProjectEditorView(project: nil) }
        .sheet(item: $editingProject) { ProjectEditorView(project: $0) }
        .sheet(item: $detailsProject) { project in
            ProjectDetailsView(project: project) {
                detailsProject = nil
                editingProject = project
            }
        }
    }
}

private struct ProjectDetailsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var clock = TimeClockService.shared
    let project: ProjectSummary
    let edit: () -> Void

    private var scans: [WalkthroughScan] { model.walkthroughs(for: project.id) }
    private var projectEntries: [TimeEntryRecord] { clock.entries.filter { $0.projectID == project.id } }
    private var evidenceCount: Int { scans.reduce(0) { $0 + $1.captures.count } }
    private var estimatedLabor: Double { scans.compactMap { $0.autoEstimate?.totalLaborHours ?? $0.autoEstimate?.laborHours }.reduce(0,+) }
    private var timeHours: Double { projectEntries.reduce(0) { total, entry in guard let out=entry.clockOut else{return total}; return total + max(0,out.timeIntervalSince(entry.clockIn)/3600) } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) { Text(project.name).font(.title2.bold()); Text(project.client.isEmpty ? "No client assigned" : project.client).foregroundStyle(.secondary) }
                            Spacer(); Text(project.status.uppercased()).font(.caption2.bold()).padding(.horizontal,9).padding(.vertical,6).background(.quaternary,in:Capsule())
                        }
                        if !project.location.isEmpty { Label(project.location, systemImage:"mappin.and.ellipse").font(.subheadline).foregroundStyle(.secondary) }
                    }.padding(.vertical,6)
                }
                Section("Project details") {
                    LabeledContent("Primary trade", value: project.trade)
                    LabeledContent("Progress", value: "\(Int(project.progress * 100))%")
                    LabeledContent("Last updated", value: project.updatedAt.formatted(date:.abbreviated,time:.shortened))
                    if !project.notes.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty { VStack(alignment:.leading,spacing:5){Text("Job notes").font(.caption).foregroundStyle(.secondary);Text(project.notes)} }
                }
                Section("Smart Estimate associations") {
                    LabeledContent("Walkthrough rooms", value:"\(scans.count)")
                    LabeledContent("Tagged evidence", value:"\(evidenceCount)")
                    LabeledContent("Estimated labor", value: scans.isEmpty ? "—" : String(format:"%.1f hr",estimatedLabor))
                    if let completed=scans.compactMap(\.archivedAt).max(){LabeledContent("Walkthrough completed", value:completed.formatted(date:.abbreviated,time:.shortened))}
                    if scans.isEmpty { Text("No walkthroughs have been captured for this project yet.").font(.caption).foregroundStyle(.secondary) }
                    else { ForEach(scans){scan in VStack(alignment:.leading,spacing:5){HStack{Text(scan.room.name).font(.headline);Spacer();if scan.archivedAt != nil {Label("Archived",systemImage:"archivebox.fill").font(.caption2.bold()).foregroundStyle(.secondary)}};Text(scan.createdAt.formatted(date:.abbreviated,time:.shortened)).font(.caption).foregroundStyle(.secondary);HStack(spacing:12){Text("\(scan.room.wallCount) walls");Text("\(scan.room.doorCount) doors");Text("\(scan.room.windowCount) windows");Text("\(scan.captures.count) tags")}.font(.caption2).foregroundStyle(.secondary);if let labor=scan.autoEstimate?.totalLaborHours ?? scan.autoEstimate?.laborHours {Text(String(format:"%.1f estimated labor hours",labor)).font(.caption).foregroundStyle(.secondary)}}.padding(.vertical,5)} }
                }
                Section("My time on this project") {
                    LabeledContent("Timecards", value:"\(projectEntries.count)")
                    LabeledContent("Recorded hours", value:String(format:"%.1f hr",timeHours))
                    if let latest=projectEntries.first { LabeledContent("Latest shift", value:latest.clockIn.formatted(date:.abbreviated,time:.shortened)) }
                    Text("Employee View shows your own time. Administrators can review organization-wide time in Admin View.").font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button { model.selectProject(project); dismiss(); model.selectedTab = .estimate } label: { Label("Open Smart Estimate",systemImage:"wand.and.stars") }
                    Button(action:edit){Label("Edit Project",systemImage:"pencil")}
                }
            }
            .navigationTitle("Project Details").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement:.confirmationAction){Button("Done"){dismiss()}} }
            .task { await clock.refresh() }
        }
    }
}

private struct ProjectEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let original: ProjectSummary?
    @State private var name:String; @State private var client:String; @State private var location:String; @State private var status:String; @State private var trade:String; @State private var notes:String
    init(project:ProjectSummary?){original=project;_name=State(initialValue:project?.name ?? "");_client=State(initialValue:project?.client ?? "");_location=State(initialValue:project?.location ?? "");_status=State(initialValue:project?.status ?? "Estimating");_trade=State(initialValue:project?.trade ?? "Painting");_notes=State(initialValue:project?.notes ?? "")}
    var body: some View { NavigationStack { Form { Section("Project"){TextField("Project name",text:$name);TextField("Client",text:$client);TextField("Address / location",text:$location);Picker("Status",selection:$status){ForEach(["Lead","Estimating","Scheduled","Active","Paused","Complete","Archived"],id:\.self){Text($0)}};Picker("Primary trade",selection:$trade){ForEach(["Painting","General","Drywall","Flooring","Roofing","Other"],id:\.self){Text($0)}}};Section("Job notes"){TextField("Scope, access notes, contact details…",text:$notes,axis:.vertical).lineLimit(4...8)};if let original{Section{Button("Delete project",role:.destructive){model.deleteProject(original);dismiss()}}} }.navigationTitle(original == nil ? "New Project":"Edit Project").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.cancellationAction){Button("Cancel"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("Save"){let project=ProjectSummary(id:original?.id ?? UUID(),name:name.trimmingCharacters(in:.whitespacesAndNewlines),client:client.trimmingCharacters(in:.whitespacesAndNewlines),location:location.trimmingCharacters(in:.whitespacesAndNewlines),status:status,progress:original?.progress ?? 0,trade:trade,notes:notes,updatedAt:.now);model.upsertProject(project);dismiss()}.disabled(name.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)}} } }
}
