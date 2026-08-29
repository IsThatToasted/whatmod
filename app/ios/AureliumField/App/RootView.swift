import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        Group {
            if model.workspaceMode == .admin && cloud.isAdmin {
                AdminWorkspaceView()
            } else {
                EmployeeWorkspaceView()
            }
        }
        .onChange(of: cloud.isAdmin) { _, isAdmin in
            if !isAdmin { model.workspaceMode = .employee }
        }
    }
}

private struct EmployeeWorkspaceView: View {
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
                .tabItem { Label("My Time", systemImage: "clock.badge.checkmark") }
                .tag(AppTab.team)
        }
        .tint(.primary)
    }
}
