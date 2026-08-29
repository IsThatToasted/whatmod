import Foundation
import Observation
import ReplayKit

@MainActor @Observable
final class ScanRecordingService {
    var isRecording = false
    var errorMessage: String?
    private var startedAt: Date?

    func start() async {
        guard RPScreenRecorder.shared().isAvailable else {
            errorMessage = "Scan video recording is unavailable on this device."
            return
        }
        await withCheckedContinuation { continuation in
            RPScreenRecorder.shared().startRecording(withMicrophoneEnabled: false) { [weak self] error in
                Task { @MainActor in
                    self?.errorMessage = error?.localizedDescription
                    self?.isRecording = error == nil
                    self?.startedAt = error == nil ? .now : nil
                    continuation.resume()
                }
            }
        }
    }

    func stop() async -> (fileName: String?, duration: Double?) {
        guard isRecording else { return (nil, nil) }
        let name = "scan-\(UUID().uuidString).mp4"
        let output = AppMediaStore.url(for: name)
        try? FileManager.default.removeItem(at: output)
        let duration = startedAt.map { Date().timeIntervalSince($0) }
        let error: Error? = await withCheckedContinuation { continuation in
            RPScreenRecorder.shared().stopRecording(withOutput: output) { error in continuation.resume(returning: error) }
        }
        isRecording = false
        startedAt = nil
        if let error {
            errorMessage = error.localizedDescription
            return (nil, duration)
        }
        return (name, duration)
    }

    func discard() {
        if isRecording { RPScreenRecorder.shared().discardRecording {} }
        isRecording = false
        startedAt = nil
    }
}
