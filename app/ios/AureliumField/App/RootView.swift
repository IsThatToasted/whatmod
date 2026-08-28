import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house") }
                .tag(AppTab.home)
            NavigationStack { ProjectsView() }
                .tabItem { Label("Projects", systemImage: "briefcase") }
                .tag(AppTab.projects)
            NavigationStack { EstimatorView() }
                .tabItem { Label("Estimate", systemImage: "wand.and.stars") }
                .tag(AppTab.estimate)
            NavigationStack { FieldView() }
                .tabItem { Label("Field", systemImage: "camera") }
                .tag(AppTab.field)
            NavigationStack { TeamView() }
                .tabItem { Label("Team", systemImage: "person.3") }
                .tag(AppTab.team)
        }
        .tint(.primary)
    }
}
