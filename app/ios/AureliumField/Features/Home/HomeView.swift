import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("EMPLOYEE WORKSPACE").font(.caption2.weight(.bold)).foregroundStyle(.secondary).tracking(1.5)
                    Text("Good afternoon.").font(.largeTitle.bold())
                    Text("Your jobs, field capture, estimates and time in one focused workspace.").foregroundStyle(.secondary)
                }
                Button { model.selectedTab = .estimate } label: {
                    Label("Start Smart Estimate", systemImage: "wand.and.stars").frame(maxWidth: .infinity)
                }.buttonStyle(.borderedProminent).controlSize(.large).tint(.primary)
                metricStrip
                VStack(alignment: .leading, spacing: 12) {
                    Text("Projects").font(.title2.bold())
                    ForEach(model.projects.prefix(5)) { project in
                        Button {
                            model.selectProject(project)
                            model.selectedTab = .projects
                        } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                HStack {
                                    Text(project.name).font(.headline).foregroundStyle(.primary)
                                    Spacer()
                                    Text(project.status).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                                }
                                Text(project.location).font(.caption).foregroundStyle(.secondary)
                                ProgressView(value: project.progress)
                            }.padding(.vertical, 7).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens this project in Projects")
                    }
                }
            }.padding()
        }
        .navigationTitle("Aurelium Field")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if cloud.isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { model.workspaceMode = .admin } label: { Image(systemName: "shield.lefthalf.filled") }
                        .accessibilityLabel("Switch to Admin View")
                }
            }
        }
    }

    private var metricStrip: some View {
        HStack(spacing: 10) {
            metric("Projects", "\(model.projects.count)")
            metric("Field capture", "Ready")
            metric("My time", "GPS")
        }
    }
    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.caption2).foregroundStyle(.secondary); Text(value).font(.headline) }
            .frame(maxWidth: .infinity, alignment: .leading).padding(12).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
