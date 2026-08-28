import SwiftUI

struct ProjectsView: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var editingProject: ProjectSummary?
    @State private var showingNewProject = false

    private var filtered: [ProjectSummary] {
        model.projects.filter {
            search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) || $0.client.localizedCaseInsensitiveContains(search) || $0.location.localizedCaseInsensitiveContains(search)
        }
    }

    var body: some View {
        List {
            ForEach(filtered) { project in
                Button { editingProject = project } label: {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(project.name).font(.headline).foregroundStyle(.primary)
                            Spacer()
                            Text(project.status.uppercased()).font(.caption2.bold()).foregroundStyle(.secondary)
                        }
                        Text("\(project.client) · \(project.location)").font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 10) {
                            ProgressView(value: project.progress)
                            Text("\(Int(project.progress * 100))%").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 5)
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
    }
}

private struct ProjectEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let original: ProjectSummary?
    @State private var name: String
    @State private var client: String
    @State private var location: String
    @State private var status: String
    @State private var trade: String
    @State private var notes: String

    init(project: ProjectSummary?) {
        original = project
        _name = State(initialValue: project?.name ?? "")
        _client = State(initialValue: project?.client ?? "")
        _location = State(initialValue: project?.location ?? "")
        _status = State(initialValue: project?.status ?? "Estimating")
        _trade = State(initialValue: project?.trade ?? "Painting")
        _notes = State(initialValue: project?.notes ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Project") {
                    TextField("Project name", text: $name)
                    TextField("Client", text: $client)
                    TextField("Address / location", text: $location)
                    Picker("Status", selection: $status) {
                        ForEach(["Lead", "Estimating", "Scheduled", "Active", "Paused", "Complete", "Archived"], id: \.self) { Text($0) }
                    }
                    Picker("Primary trade", selection: $trade) {
                        ForEach(["Painting", "General", "Drywall", "Flooring", "Roofing", "Other"], id: \.self) { Text($0) }
                    }
                }
                Section("Job notes") { TextField("Scope, access notes, contact details…", text: $notes, axis: .vertical).lineLimit(4...8) }
                if let original {
                    Section { Button("Delete project", role: .destructive) { model.deleteProject(original); dismiss() } }
                }
            }
            .navigationTitle(original == nil ? "New Project" : "Edit Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let project = ProjectSummary(
                            id: original?.id ?? UUID(), name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                            client: client.trimmingCharacters(in: .whitespacesAndNewlines), location: location.trimmingCharacters(in: .whitespacesAndNewlines),
                            status: status, progress: original?.progress ?? 0, trade: trade, notes: notes, updatedAt: .now
                        )
                        model.upsertProject(project); dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
