import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("OPERATIONS").font(.caption2.weight(.bold)).foregroundStyle(.secondary).tracking(1.5)
                    Text("Good afternoon.").font(.largeTitle.bold())
                    Text("Everything your field and office need, without the tool sprawl.").foregroundStyle(.secondary)
                }
                Button { model.selectedTab = .estimate } label: {
                    Label("Start Smart Estimate", systemImage: "wand.and.stars").frame(maxWidth: .infinity)
                }.buttonStyle(.borderedProminent).controlSize(.large).tint(.primary)
                metricStrip
                VStack(alignment: .leading, spacing: 12) {
                    Text("Projects").font(.title2.bold())
                    ForEach(ProjectSummary.samples) { project in
                        VStack(alignment: .leading, spacing: 7) {
                            HStack { Text(project.name).font(.headline); Spacer(); Text(project.status).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                            Text("\(project.location) · \(project.client)").font(.caption).foregroundStyle(.secondary)
                            ProgressView(value: project.progress)
                        }.padding(.vertical, 6)
                    }
                }
            }.padding()
        }.navigationTitle("Aurelium Field").navigationBarTitleDisplayMode(.inline)
    }

    private var metricStrip: some View {
        HStack(spacing: 10) {
            metric("Pipeline", "$184k")
            metric("Active", "6")
            metric("Paint margin", "38.4%")
        }
    }
    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 5) { Text(title).font(.caption2).foregroundStyle(.secondary); Text(value).font(.headline) }
            .frame(maxWidth: .infinity, alignment: .leading).padding(12).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
