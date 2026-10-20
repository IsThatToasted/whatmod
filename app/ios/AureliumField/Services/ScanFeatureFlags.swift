import Foundation

/// Central switches for scan features that are parked. Flip to true to bring them back.
enum ScanFeatureFlags {
    /// Post-scan walkthrough video recording and playback. Hidden and not recorded while the pipeline is unreliable.
    static let walkthroughVideo = false
}
