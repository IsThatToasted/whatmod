import SwiftUI
struct ProjectsView: View {
    @State private var search = ""
    var body: some View {
        List(ProjectSummary.samples.filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) || $0.client.localizedCaseInsensitiveContains(search) }) { p in
            VStack(alignment:.leading,spacing:5){HStack{Text(p.name).font(.headline);Spacer();Text(p.status).font(.caption).foregroundStyle(.secondary)};Text("\(p.client) · \(p.location)").font(.caption).foregroundStyle(.secondary);ProgressView(value:p.progress)}.padding(.vertical,5)
        }.searchable(text:$search,prompt:"Projects, clients, addresses").navigationTitle("Projects").toolbar{Button(action:{}){Image(systemName:"plus")}}
    }
}
