import Foundation
import AVFoundation
import LiveKit

@MainActor
final class LiveStreamManager: ObservableObject {
    enum State: String {
        case idle = "OFFLINE"
        case connecting = "CONNECTING"
        case live = "LIVE"
        case stopping = "STOPPING"
        case failed = "ERROR"
    }

    @Published var state: State = .idle
    @Published var errorMessage: String?
    @Published var localVideoTrack: VideoTrack?
    @Published var cameraPosition: AVCaptureDevice.Position = .back
    @Published var isSwitchingCamera = false

    private(set) var room: Room?

    func start(url: String, token: String) async throws {
        state = .connecting
        errorMessage = nil
        localVideoTrack = nil

        do {
            let room = Room()
            self.room = room

            try await room.connect(url: url, token: token)

            let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(position: cameraPosition),
                publishOptions: nil
            )

            if let video = publication?.track as? VideoTrack {
                localVideoTrack = video
            } else {
                localVideoTrack = room.localParticipant.localVideoTracks
                    .compactMap { $0.track as? VideoTrack }
                    .first
            }

            _ = try await room.localParticipant.setMicrophone(
                enabled: true,
                captureOptions: nil,
                publishOptions: nil
            )

            guard localVideoTrack != nil else {
                throw NSError(
                    domain: "ScooterCast",
                    code: 1001,
                    userInfo: [NSLocalizedDescriptionKey: "Camera started but no publishable video track was created."]
                )
            }

            state = .live
        } catch {
            state = .failed
            errorMessage = error.localizedDescription
            throw error
        }
    }

    func switchCamera() async {
        guard let room, state == .live, !isSwitchingCamera else { return }

        isSwitchingCamera = true
        defer { isSwitchingCamera = false }

        let next: AVCaptureDevice.Position = cameraPosition == .back ? .front : .back

        do {
            // Re-create the camera publication with explicit capture options.
            // This is deliberately simple and reliable for V1: viewers may see
            // a very brief camera interruption during the switch.
            _ = try await room.localParticipant.setCamera(
                enabled: false,
                captureOptions: nil,
                publishOptions: nil
            )

            let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(position: next),
                publishOptions: nil
            )

            if let video = publication?.track as? VideoTrack {
                localVideoTrack = video
            } else {
                localVideoTrack = room.localParticipant.localVideoTracks
                    .compactMap { $0.track as? VideoTrack }
                    .first
            }

            cameraPosition = next
            errorMessage = nil
        } catch {
            errorMessage = "Camera switch failed: \(error.localizedDescription)"
        }
    }

    func stop() async {
        state = .stopping

        if let room {
            try? await room.localParticipant.setCamera(
                enabled: false,
                captureOptions: nil,
                publishOptions: nil
            )
            try? await room.localParticipant.setMicrophone(
                enabled: false,
                captureOptions: nil,
                publishOptions: nil
            )
            await room.disconnect()
        }

        localVideoTrack = nil
        room = nil
        state = .idle
    }

    private func cameraOptions(position: AVCaptureDevice.Position) -> CameraCaptureOptions {
        CameraCaptureOptions(
            deviceType: nil,
            device: nil,
            position: position,
            preferredFormat: nil,
            dimensions: Dimensions(width: 1280, height: 720),
            fps: 30
        )
    }
}
