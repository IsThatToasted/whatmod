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
    @Published var isVideoMuted = false
    @Published var isMicrophoneMuted = false

    private(set) var room: Room?

    private var selectedQuality: StreamQuality = .p720

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
        cameraPosition = preferredCamera
        selectedQuality = quality
        isVideoMuted = false
        isMicrophoneMuted = !microphoneEnabled

        do {
            // LiveKit 2.16.0 in this project uses the default Room initializer.
            // We pass camera capture options when enabling the camera instead.
            let room = Room()
            self.room = room

            try await room.connect(url: url, token: token)

            let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(
                    position: preferredCamera,
                    quality: quality
                ),
                publishOptions: nil
            )

            if let video = publication?.track as? VideoTrack {
                localVideoTrack = video
            } else {
                localVideoTrack = room.localParticipant.localVideoTracks
                    .compactMap { $0.track as? VideoTrack }
                    .first
            }

            if microphoneEnabled {
                _ = try await room.localParticipant.setMicrophone(
                    enabled: true,
                    captureOptions: nil,
                    publishOptions: nil
                )
                isMicrophoneMuted = false
            } else {
                isMicrophoneMuted = true
            }

            guard localVideoTrack != nil else {
                throw NSError(
                    domain: "ScooterCast",
                    code: 1001,
                    userInfo: [
                        NSLocalizedDescriptionKey:
                            "Camera started but no publishable video track was created."
                    ]
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
        guard let room, state == .live, !isSwitchingCamera, !isVideoMuted else {
            return
        }

        isSwitchingCamera = true
        defer { isSwitchingCamera = false }

        // First try LiveKit's camera capturer switch on the currently published
        // local track. This keeps the same publication alive when supported.
        if let localTrack = room.localParticipant.localVideoTracks
            .compactMap({ $0.track as? LocalVideoTrack })
            .first,
           let capturer = localTrack.capturer as? CameraCapturer {

            do {
                let switched = try await capturer.switchCameraPosition()

                if switched {
                    cameraPosition = cameraPosition == .front ? .back : .front
                    localVideoTrack = localTrack
                    errorMessage = nil
                    return
                }
            } catch {
                // Fall through to the reliable disable/re-enable method below.
            }
        }

        // Fallback used by the previously working ScooterCast build.
        let next: AVCaptureDevice.Position =
            cameraPosition == .front ? .back : .front

        do {
            _ = try await room.localParticipant.setCamera(
                enabled: false,
                captureOptions: nil,
                publishOptions: nil
            )

            let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(
                    position: next,
                    quality: selectedQuality
                ),
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
            errorMessage = "Camera flip failed: \(error.localizedDescription)"
        }
    }

    func toggleVideoMute() async {
        guard let room, state == .live else { return }

        do {
            if isVideoMuted {
                let publication = try await room.localParticipant.setCamera(
                    enabled: true,
                    captureOptions: cameraOptions(
                        position: cameraPosition,
                        quality: selectedQuality
                    ),
                    publishOptions: nil
                )

                if let video = publication?.track as? VideoTrack {
                    localVideoTrack = video
                } else {
                    localVideoTrack = room.localParticipant.localVideoTracks
                        .compactMap { $0.track as? VideoTrack }
                        .first
                }

                isVideoMuted = false
            } else {
                _ = try await room.localParticipant.setCamera(
                    enabled: false,
                    captureOptions: nil,
                    publishOptions: nil
                )

                localVideoTrack = nil
                isVideoMuted = true
            }

            errorMessage = nil
        } catch {
            errorMessage = "Video control failed: \(error.localizedDescription)"
        }
    }

    func toggleMicrophoneMute() async {
        guard let room, state == .live else { return }

        do {
            if isMicrophoneMuted {
                _ = try await room.localParticipant.setMicrophone(
                    enabled: true,
                    captureOptions: nil,
                    publishOptions: nil
                )
                isMicrophoneMuted = false
            } else {
                _ = try await room.localParticipant.setMicrophone(
                    enabled: false,
                    captureOptions: nil,
                    publishOptions: nil
                )
                isMicrophoneMuted = true
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
            dimensions: Dimensions(
                width: quality.width,
                height: quality.height
            ),
            fps: quality.fps
        )
    }
}
