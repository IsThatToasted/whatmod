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
        VStack(spacing: 0) {
            Group {
                switch model.selectedTab {
                case .home:
                    NavigationStack { HomeView() }
                case .projects:
                    NavigationStack { ProjectsView() }
                case .estimate:
                    NavigationStack { EstimatorView() }
                case .field:
                    NavigationStack { FieldView() }
                case .team:
                    NavigationStack { TeamView() }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Divider()
            HStack(spacing: 0) {
                workspaceTab(.home, title: "Home", icon: "house")
                workspaceTab(.projects, title: "Projects", icon: "briefcase")
                workspaceTab(.estimate, title: "Estimate", icon: "wand.and.stars")
                workspaceTab(.field, title: "Field", icon: "camera")
                workspaceTab(.team, title: "My Time", icon: "clock.badge.checkmark")
            }
            .padding(.horizontal, 4)
            .padding(.top, 8)
            .padding(.bottom, 6)
            .background(.bar)
        }
    }

    private func workspaceTab(_ tab: AppTab, title: String, icon: String) -> some View {
        Button {
            model.selectedTab = tab
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: model.selectedTab == tab ? .semibold : .regular))
                Text(title)
                    .font(.caption2.weight(model.selectedTab == tab ? .semibold : .regular))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundStyle(model.selectedTab == tab ? .primary : .secondary)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(model.selectedTab == tab ? .isSelected : [])
    }
}
