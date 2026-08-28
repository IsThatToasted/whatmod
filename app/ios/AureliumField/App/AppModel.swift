import Foundation
import Observation

@Observable
final class AppModel {
    var selectedTab: AppTab = .home
    var activeEstimate = EstimateDraft.sample
}

enum AppTab: Hashable {
    case home, projects, estimate, field, team
}
