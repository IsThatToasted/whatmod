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
            if !isAdmin {
                model.workspaceMode = .employee
            }
        }
    }
}

private struct EmployeeWorkspaceView: View {
    @Environment(AppModel.self) private var model
    @State private var showingEstimator = false

    var body: some View {
        VStack(spacing: 0) {
            activeWorkspace
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            workspaceSwitcher
            Divider()
            primaryTabBar
        }
        .fullScreenCover(isPresented: $showingEstimator) {
            SmartEstimateWorkspace(onClose: { showingEstimator = false })
        }
    }

    @ViewBuilder
    private var activeWorkspace: some View {
        switch model.selectedTab {
        case .home:
            NavigationStack { HomeView() }
        case .projects:
            NavigationStack { ProjectsView() }
        case .chat:
            NavigationStack { ChatView() }
        case .field:
            NavigationStack { FieldView() }
        case .team:
            NavigationStack { TeamView() }
        }
    }

    private var workspaceSwitcher: some View {
        HStack {
            Menu {
                Button("Field Workspace") {
                    showingEstimator = false
                }
                Button("Smart Estimate") {
                    showingEstimator = true
                }
            } label: {
                Label("Aurelium", systemImage: "square.grid.2x2")
                    .font(.caption.bold())
            }
            Spacer()
            Text("Field")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(.bar)
    }

    private var primaryTabBar: some View {
        HStack(spacing: 0) {
            workspaceTab(.home, title: "Home", icon: "house")
            workspaceTab(.projects, title: "Projects", icon: "briefcase")
            workspaceTab(.chat, title: "Chat", icon: "bubble.left.and.bubble.right")
            workspaceTab(.field, title: "Field", icon: "camera")
            workspaceTab(.team, title: "My Time", icon: "clock.badge.checkmark")
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(.bar)
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

private struct SmartEstimateWorkspace: View {
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            EstimatorView()
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back to Field", action: onClose)
                    }
                }
        }
    }
}
