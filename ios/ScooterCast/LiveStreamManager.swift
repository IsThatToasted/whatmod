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
    @Published var localVideoTrack: LocalVideoTrack?
    @Published var cameraPosition: AVCaptureDevice.Position = .back
    @Published var isSwitchingCamera = false
    @Published var isVideoMuted = false
    @Published var isMicrophoneMuted = false

    private(set) var room: Room?
    private var videoPublication: LocalTrackPublication?
    private var audioPublication: LocalTrackPublication?

    func start(
        url: String,
        token: String,
        preferredCamera: AVCaptureDevice.Position,
        quality: StreamQuality,
        microphoneEnabled: Bool
    ) async throws {
        state = .connecting
        errorMessage = nil
        localVideoTrack = nil
        videoPublication = nil
        audioPublication = nil
        cameraPosition = preferredCamera
        isVideoMuted = false
        isMicrophoneMuted = !microphoneEnabled

        do {
            let options = RoomOptions(
                defaultCameraCaptureOptions: cameraOptions(
                    position: preferredCamera,
                    quality: quality
                ),
                adaptiveStream: true,
                dynacast: true
            )

            let room = Room(options: options)
            self.room = room

            try await room.connect(url: url, token: token)

            guard let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(position: preferredCamera, quality: quality),
                publishOptions: nil
            ) else {
                throw NSError(
                    domain: "ScooterCast",
                    code: 1001,
                    userInfo: [NSLocalizedDescriptionKey: "LiveKit did not create a camera publication."]
                )
            }

            videoPublication = publication
            localVideoTrack = publication.track as? LocalVideoTrack

            if microphoneEnabled {
                audioPublication = try await room.localParticipant.setMicrophone(
                    enabled: true,
                    captureOptions: nil,
                    publishOptions: nil
                )
            }

            guard localVideoTrack != nil else {
                throw NSError(
                    domain: "ScooterCast",
                    code: 1002,
                    userInfo: [NSLocalizedDescriptionKey: "Camera published but no local video track was available."]
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
        guard state == .live, !isSwitchingCamera else { return }
        guard let track = localVideoTrack else {
            errorMessage = "No local camera track is available."
            return
        }

        guard let capturer = track.capturer as? CameraCapturer else {
            errorMessage = "The current video track is not using an iPhone camera capturer."
            return
        }

        isSwitchingCamera = true
        defer { isSwitchingCamera = false }

        do {
            let didSwitch = try await capturer.switchCameraPosition()

            if didSwitch {
                cameraPosition = cameraPosition == .front ? .back : .front
                errorMessage = nil
            } else {
                errorMessage = "No alternate camera was available."
            }
        } catch {
            errorMessage = "Camera flip failed: \(error.localizedDescription)"
        }
    }

    func toggleVideoMute() async {
        guard let publication = videoPublication else { return }

        do {
            if isVideoMuted {
                try await publication.unmute()
                isVideoMuted = false
            } else {
                try await publication.mute()
                isVideoMuted = true
            }
            errorMessage = nil
        } catch {
            errorMessage = "Video control failed: \(error.localizedDescription)"
        }
    }

    func toggleMicrophoneMute() async {
        guard let room else { return }

        do {
            if let publication = audioPublication {
                if isMicrophoneMuted {
                    try await publication.unmute()
                    isMicrophoneMuted = false
                } else {
                    try await publication.mute()
                    isMicrophoneMuted = true
                }
            } else {
                let publication = try await room.localParticipant.setMicrophone(
                    enabled: true,
                    captureOptions: nil,
                    publishOptions: nil
                )
                audioPublication = publication
                isMicrophoneMuted = false
            }
            errorMessage = nil
        } catch {
            errorMessage = "Microphone control failed: \(error.localizedDescription)"
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
        videoPublication = nil
        audioPublication = nil
        room = nil
        isVideoMuted = false
        isMicrophoneMuted = false
        state = .idle
    }

    private func cameraOptions(
        position: AVCaptureDevice.Position,
        quality: StreamQuality
    ) -> CameraCaptureOptions {
        CameraCaptureOptions(
            deviceType: nil,
            device: nil,
            position: position,
            preferredFormat: nil,
            dimensions: Dimensions(width: quality.width, height: quality.height),
            fps: quality.fps
        )
    }
}
