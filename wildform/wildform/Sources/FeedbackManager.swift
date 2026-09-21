import AVFoundation
import UIKit

@MainActor
final class FeedbackManager {
    static let shared = FeedbackManager()

    enum Cue {
        case tap, scan, attack, dodge, victory, evolve, purchase
    }

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let sampleRate = 44_100.0
    private var prepared = false

    private init() {}

    func play(_ cue: Cue, enabled: Bool = true) {
        haptic(for: cue)
        guard enabled else { return }
        prepareAudioIfNeeded()
        guard prepared else { return }

        let notes: [(Double, Double)]
        switch cue {
        case .tap: notes = [(520, 0.055)]
        case .scan: notes = [(330, 0.07), (470, 0.08), (690, 0.09)]
        case .attack: notes = [(145, 0.055), (95, 0.07)]
        case .dodge: notes = [(760, 0.045), (980, 0.05)]
        case .victory: notes = [(440, 0.08), (660, 0.08), (880, 0.16)]
        case .evolve: notes = [(300, 0.11), (450, 0.11), (620, 0.11), (930, 0.22)]
        case .purchase: notes = [(620, 0.07), (820, 0.12)]
        }

        if let buffer = makeBuffer(notes: notes) {
            player.stop()
            player.scheduleBuffer(buffer, at: nil, options: .interrupts)
            player.play()
        }
    }

    private func prepareAudioIfNeeded() {
        guard !prepared else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            engine.attach(player)
            let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
            engine.connect(player, to: engine.mainMixerNode, format: format)
            try engine.start()
            prepared = true
        } catch {
            prepared = false
        }
    }

    private func makeBuffer(notes: [(Double, Double)]) -> AVAudioPCMBuffer? {
        let gap = 0.018
        let duration = notes.reduce(0.0) { $0 + $1.1 + gap }
        let frames = AVAudioFrameCount(duration * sampleRate)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let data = buffer.floatChannelData?[0] else { return nil }

        buffer.frameLength = frames
        var cursor = 0
        for (frequency, noteDuration) in notes {
            let noteFrames = Int(noteDuration * sampleRate)
            for i in 0..<noteFrames where cursor < Int(frames) {
                let t = Double(i) / sampleRate
                let progress = Double(i) / Double(max(1, noteFrames))
                let envelope = sin(.pi * min(1, progress)) * max(0, 1 - progress * 0.55)
                data[cursor] = Float(sin(2 * .pi * frequency * t) * 0.18 * envelope)
                cursor += 1
            }
            let gapFrames = Int(gap * sampleRate)
            for _ in 0..<gapFrames where cursor < Int(frames) {
                data[cursor] = 0
                cursor += 1
            }
        }
        return buffer
    }

    private func haptic(for cue: Cue) {
        switch cue {
        case .attack:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .victory, .evolve, .purchase:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .dodge:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        default:
            UISelectionFeedbackGenerator().selectionChanged()
        }
    }
}
