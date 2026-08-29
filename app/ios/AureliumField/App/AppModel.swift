import Foundation
import Observation

@MainActor @Observable
final class AppModel {
    var selectedTab: AppTab = .home
    var projects: [ProjectSummary] = []
    var walkthroughs: [WalkthroughScan] = []
    var selectedProjectID: UUID?
    var activeEstimate = EstimateDraft.sample

    private let projectsKey = "aurelium.projects.v2"
    private let walkthroughsKey = "aurelium.walkthroughs.v2"

    init() {
        load()
    }

    var selectedProject: ProjectSummary? {
        projects.first(where: { $0.id == selectedProjectID })
    }

    func walkthroughs(for projectID: UUID) -> [WalkthroughScan] {
        walkthroughs.filter { $0.projectID == projectID }.sorted { $0.createdAt > $1.createdAt }
    }

    func selectProject(_ project: ProjectSummary) {
        selectedProjectID = project.id
        activeEstimate.projectID = project.id
        activeEstimate.title = project.name
        activeEstimate.customer = project.client
    }

    func upsertProject(_ project: ProjectSummary) {
        var project = project
        project.updatedAt = .now
        if let index = projects.firstIndex(where: { $0.id == project.id }) {
            projects[index] = project
        } else {
            projects.insert(project, at: 0)
        }
        if selectedProjectID == nil { selectProject(project) }
        persist()
    }

    func deleteProject(_ project: ProjectSummary) {
        let doomedWalkthroughs = walkthroughs.filter { $0.projectID == project.id }
        doomedWalkthroughs.forEach(deleteWalkthroughMedia)
        walkthroughs.removeAll { $0.projectID == project.id }
        projects.removeAll { $0.id == project.id }
        if selectedProjectID == project.id {
            selectedProjectID = projects.first?.id
            if let first = projects.first { selectProject(first) }
        }
        persist()
    }

    func addWalkthrough(_ walkthrough: WalkthroughScan) {
        walkthroughs.insert(walkthrough, at: 0)
        activeEstimate.rooms.append(walkthrough.room)
        if !walkthrough.transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            activeEstimate.notes.append(.init(id: UUID(), timestamp: walkthrough.createdAt, transcript: walkthrough.transcript))
        }
        persist()
    }

    func deleteWalkthrough(_ walkthrough: WalkthroughScan) {
        deleteWalkthroughMedia(walkthrough)
        walkthroughs.removeAll { $0.id == walkthrough.id }
        persist()
    }

    private func deleteWalkthroughMedia(_ walkthrough: WalkthroughScan) {
        if let video = walkthrough.videoFileName { try? FileManager.default.removeItem(at: AppMediaStore.url(for: video)) }
        walkthrough.captures.forEach { try? FileManager.default.removeItem(at: AppMediaStore.url(for: $0.imageFileName)) }
    }

    private func load() {
        let decoder = JSONDecoder()
        if let data = UserDefaults.standard.data(forKey: projectsKey),
           let saved = try? decoder.decode([ProjectSummary].self, from: data) {
            projects = saved
        } else {
            projects = ProjectSummary.samples
        }
        if let data = UserDefaults.standard.data(forKey: walkthroughsKey),
           let saved = try? decoder.decode([WalkthroughScan].self, from: data) {
            walkthroughs = saved
        }
        if let first = projects.first { selectProject(first) }
    }

    private func persist() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(projects) { UserDefaults.standard.set(data, forKey: projectsKey) }
        if let data = try? encoder.encode(walkthroughs) { UserDefaults.standard.set(data, forKey: walkthroughsKey) }
    }
}

enum AppTab: Hashable {
    case home, projects, estimate, field, team
}
