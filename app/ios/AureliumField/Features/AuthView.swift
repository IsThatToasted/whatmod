import SwiftUI
import UIKit

struct AuthGateView: View {
    @Environment(AppModel.self) private var model
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        Group {
            if cloud.isLoading {
                ProgressView("Opening Aurelium Field…")
            } else if !cloud.isAuthenticated {
                LoginView()
            } else if cloud.requiresWorkspaceConfirmation {
                SignedInCheckpointView()
            } else if cloud.membership == nil {
                OrganizationOnboardingView()
            } else {
                RootView()
                    .task {
                        // Stabilize the authenticated native shell before starting any cloud sync.
                        // Project refresh is user/deferred initiated from Home instead of auth entry.
                        await Task.yield()
                        cloud.markWorkspaceStable()
                    }
            }
        }
        .task { if cloud.isLoading { await cloud.bootstrap() } }
        .alert("Workspace error", isPresented: Binding(get: { cloud.errorMessage != nil }, set: { if !$0 { cloud.errorMessage = nil } })) {
            Button("OK", role: .cancel) { cloud.errorMessage = nil }
        } message: { Text(cloud.errorMessage ?? "Unknown error") }
    }
}


private struct SignedInCheckpointView: View {
    @State private var cloud = WorkspaceService.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Spacer()
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 54))
                .foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 8) {
                Text("Signed in successfully")
                    .font(.largeTitle.bold())
                Text(cloud.workspacePrepared
                     ? "Your organization is loaded and the native workspace is ready."
                     : "Google sign-in completed. Prepare the workspace to connect your company data.")
                    .foregroundStyle(.secondary)
            }
            if let email = cloud.email {
                LabeledContent("Account", value: email)
                    .font(.subheadline)
            }
            Button {
                if cloud.workspacePrepared {
                    cloud.enterPreparedWorkspace()
                } else {
                    cloud.confirmWorkspaceEntry()
                }
            } label: {
                Label(cloud.workspacePrepared ? "Enter Home" : "Prepare Workspace",
                      systemImage: cloud.workspacePrepared ? "house.fill" : "arrow.right.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)

            Button("Copy Diagnostic Details") {
                UIPasteboard.general.string = cloud.productionDiagnosticSummary
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)

            Button("Sign Out", role: .destructive) {
                Task { await cloud.signOut() }
            }
            .frame(maxWidth: .infinity)

            Text("Workspace preparation and Home are intentionally separated. A failed feature screen can never trap Aurelium in a launch crash loop; the next launch returns here safely.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
    }
}

private struct LoginView: View {
    @State private var cloud = WorkspaceService.shared
    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Image(systemName: "building.2.crop.circle.fill").font(.system(size: 54))
            VStack(alignment: .leading, spacing: 8) {
                Text("Aurelium Field").font(.largeTitle.bold())
                Text("Projects, estimating, field documentation, crews and time—one construction workspace.").foregroundStyle(.secondary)
            }
            Button {
                Task { await cloud.signInWithGoogle() }
            } label: {
                Label("Continue with Google", systemImage: "person.crop.circle.badge.checkmark")
                    .font(.headline).frame(maxWidth: .infinity).frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            if cloud.oauthInProgress {
                Text("Complete sign in in Safari. Aurelium Field will reopen automatically.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text("Your company data is separated by organization and protected by organization-level access controls.").font(.caption).foregroundStyle(.secondary)
            Spacer()
        }.padding(24)
    }
}

private struct OrganizationOnboardingView: View {
    @State private var cloud = WorkspaceService.shared
    @State private var mode = 0
    @State private var organizationName = ""
    @State private var inviteToken = ""
    @State private var working = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Organization", selection: $mode) {
                        Text("Create").tag(0); Text("Join").tag(1)
                    }.pickerStyle(.segmented)
                } header: { Text("Create or join organization") }

                if mode == 0 {
                    Section("New organization") {
                        TextField("Company / organization name", text: $organizationName)
                        Text("The first user who creates an organization becomes its owner/admin.").font(.caption).foregroundStyle(.secondary)
                        Button("Create Organization") { create() }.disabled(working || organizationName.trimmingCharacters(in: .whitespaces).count < 2)
                    }
                } else {
                    Section("Join with invite") {
                        TextField("Invite token or join link", text: $inviteToken)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                        Button("Join Organization") { join() }.disabled(working || inviteToken.isEmpty)
                    }
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
                Section("Account") {
                    if let email = cloud.email { LabeledContent("Signed in", value: email) }
                    Button("Sign Out", role: .destructive) { Task { await cloud.signOut() } }
                }
            }
            .navigationTitle("Get started")
            .overlay { if working { ProgressView().controlSize(.large) } }
        }
    }

    private func create() {
        working = true; error = nil
        Task { do { try await cloud.createOrganization(name: organizationName); working = false } catch { self.error = error.localizedDescription; working = false } }
    }
    private func join() {
        working = true; error = nil
        let raw = inviteToken.split(separator: "invite=").last.map(String.init) ?? inviteToken
        guard let token = UUID(uuidString: raw.trimmingCharacters(in: .whitespacesAndNewlines)) else { error = "That invite token is not valid."; working = false; return }
        Task { do { try await cloud.acceptInvite(token: token); working = false } catch { self.error = error.localizedDescription; working = false } }
    }
}
