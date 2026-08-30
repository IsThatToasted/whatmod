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
    @Published var activeStabilizationLabel = "Off"
    @Published var stabilizationSupported = false
    @Published var backgroundCameraAccessLabel = "Not checked"

    private(set) var room: Room?

    private var selectedQuality: StreamQuality = .p720
    private var selectedStabilization: StabilizationPreference = .cinematic

    func start(
        url: String,
        token: String,
        preferredCamera: AVCaptureDevice.Position,
        quality: StreamQuality,
        stabilization: StabilizationPreference,
        microphoneEnabled: Bool
    ) async throws {
        state = .connecting
        errorMessage = nil
        localVideoTrack = nil
        cameraPosition = preferredCamera
        selectedQuality = quality
        selectedStabilization = stabilization
        activeStabilizationLabel = "Configuring…"
        stabilizationSupported = false
        isVideoMuted = false
        isMicrophoneMuted = !microphoneEnabled

        do {
            // LiveKit normally suspends local camera tracks when iOS backgrounds
            // the application. ScooterCast is a continuous ride broadcaster, so
            // keep the local video publication alive until End Ride is explicitly
            // pressed or the process is terminated.
            let roomOptions = RoomOptions(
                suspendLocalVideoTracksInBackground: false
            )
            let room = Room(
                delegate: nil,
                connectOptions: nil,
                roomOptions: roomOptions
            )
            self.room = room

            // Let LiveKit own AVAudioSession. LiveKit 2.16 is designed to
            // automatically switch to playAndRecord when local audio is
            // published. We keep a fixed ride-friendly session policy but do
            // not manually activate/deactivate AVAudioSession ourselves.
            configureLiveKitAudioPolicy()

            if microphoneEnabled {
                // Pre-warm the audio engine before the peer connection starts.
                // Failure here is non-fatal; the post-connect microphone retry
                // still gets a chance to recover.
                try? await AudioManager.shared.setRecordingAlwaysPreparedMode(
                    true,
                    audioProcessingOptions: nil
                )
            }

            try await room.connect(url: url, token: token)

            let publication = try await room.localParticipant.setCamera(
                enabled: true,
                captureOptions: cameraOptions(
                    position: preferredCamera,
                    quality: quality
                ),
                publishOptions: videoPublishOptions(for: quality)
            )

            if let video = publication?.track as? VideoTrack {
                localVideoTrack = video
            } else {
                localVideoTrack = room.localParticipant.localVideoTracks
                    .compactMap { $0.track as? VideoTrack }
                    .first
            }

            configureCameraForBackgroundMultitasking()

            // Microphone is optional and must never abort video startup.
            if microphoneEnabled {
                do {
                    try await enableMicrophoneWithRetry(in: room)
                    isMicrophoneMuted = false
                } catch {
                    isMicrophoneMuted = true
                    errorMessage = "Video is live. Microphone could not start: \(error.localizedDescription)"
                }
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

            applyConfiguredStabilization()
            scheduleStabilizationStatusRefresh()
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
                    configureCameraForBackgroundMultitasking()
                    applyConfiguredStabilization()
                    scheduleStabilizationStatusRefresh()
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
                publishOptions: videoPublishOptions(for: selectedQuality)
            )

            if let video = publication?.track as? VideoTrack {
                localVideoTrack = video
            } else {
                localVideoTrack = room.localParticipant.localVideoTracks
                    .compactMap { $0.track as? VideoTrack }
                    .first
            }

            cameraPosition = next
            configureCameraForBackgroundMultitasking()
            applyConfiguredStabilization()
            scheduleStabilizationStatusRefresh()
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
                    publishOptions: videoPublishOptions(for: selectedQuality)
                )

                if let video = publication?.track as? VideoTrack {
                    localVideoTrack = video
                } else {
                    localVideoTrack = room.localParticipant.localVideoTracks
                        .compactMap { $0.track as? VideoTrack }
                        .first
                }

                isVideoMuted = false
                configureCameraForBackgroundMultitasking()
                applyConfiguredStabilization()
                scheduleStabilizationStatusRefresh()
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
                configureLiveKitAudioPolicy()
                try await AudioManager.shared.setRecordingAlwaysPreparedMode(
                    true,
                    audioProcessingOptions: nil
                )
                try await enableMicrophoneWithRetry(in: room)
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
        activeStabilizationLabel = "Off"
        stabilizationSupported = false
        backgroundCameraAccessLabel = "Not checked"
        try? await AudioManager.shared.setRecordingAlwaysPreparedMode(
            false,
            audioProcessingOptions: nil
        )
        state = .idle
    }


    private func configureLiveKitAudioPolicy() {
        // Use LiveKit 2.16's built-in AVAudioSession management.
        // Do not manually activate AVAudioSession or construct a custom
        // AudioSessionConfiguration here.
        AudioManager.shared.audioSession.isAutomaticConfigurationEnabled = true
        AudioManager.shared.audioSession.isSpeakerOutputPreferred = true
    }

    private func enableMicrophoneWithRetry(in room: Room) async throws {
        configureLiveKitAudioPolicy()

        do {
            _ = try await room.localParticipant.setMicrophone(
                enabled: true,
                captureOptions: nil,
                publishOptions: nil
            )
            return
        } catch {
            // Physical-device camera/audio startup can race. Give LiveKit's
            // automatic audio-session observer one short retry window.
            try? await Task.sleep(for: .milliseconds(350))
            configureLiveKitAudioPolicy()

            try? await AudioManager.shared.setRecordingAlwaysPreparedMode(
                true,
                audioProcessingOptions: nil
            )

            _ = try await room.localParticipant.setMicrophone(
                enabled: true,
                captureOptions: nil,
                publishOptions: nil
            )
        }
    }

    private func configureCameraForBackgroundMultitasking() {
        guard let capturer = currentCameraCapturer() else {
            backgroundCameraAccessLabel = "Camera unavailable"
            return
        }

        let session = capturer.captureSession

        // Prevent AVCaptureSession from attempting to take over the same
        // AVAudioSession that LiveKit uses for microphone publishing.
        session.usesApplicationAudioSession = true
        session.automaticallyConfiguresApplicationAudioSession = false

        if session.isMultitaskingCameraAccessSupported {
            session.isMultitaskingCameraAccessEnabled = true
            backgroundCameraAccessLabel = "Background camera enabled"
        } else {
            // The LiveKit room, microphone and GPS remain alive in background.
            // iOS may suspend actual camera frames on devices/OS versions where
            // multitasking camera access is unavailable.
            backgroundCameraAccessLabel = "Background camera unsupported"
        }
    }

    func refreshBackgroundMediaConfiguration() {
        guard state == .live else { return }

        configureCameraForBackgroundMultitasking()

        if !isMicrophoneMuted {
            configureLiveKitAudioPolicy()
        }
    }

    private func currentCameraCapturer() -> CameraCapturer? {
        guard let room else { return nil }

        return room.localParticipant.localVideoTracks
            .compactMap { $0.track as? LocalVideoTrack }
            .compactMap { $0.capturer as? CameraCapturer }
            .first
    }

    private func applyConfiguredStabilization() {
        guard let capturer = currentCameraCapturer() else {
            stabilizationSupported = false
            activeStabilizationLabel = "Unavailable"
            return
        }

        let session = capturer.captureSession

        let cameraDevice = session.inputs
            .compactMap { $0 as? AVCaptureDeviceInput }
            .map(\.device)
            .first { $0.hasMediaType(.video) }

        let preferredMode = resolvedStabilizationMode(
            preference: selectedStabilization,
            device: cameraDevice
        )

        var foundVideoConnection = false

        for output in session.outputs {
            for connection in output.connections {
                let hasVideoPort = connection.inputPorts.contains {
                    $0.mediaType == .video
                }

                guard hasVideoPort else { continue }
                guard connection.isVideoStabilizationSupported else { continue }

                foundVideoConnection = true
                connection.preferredVideoStabilizationMode = preferredMode
            }
        }

        stabilizationSupported = foundVideoConnection

        if !foundVideoConnection {
            activeStabilizationLabel = "Unsupported"
        } else if selectedStabilization == .off {
            activeStabilizationLabel = "Off"
        } else {
            activeStabilizationLabel = "Requested \(selectedStabilization.rawValue)"
        }
    }

    private func resolvedStabilizationMode(
        preference: StabilizationPreference,
        device: AVCaptureDevice?
    ) -> AVCaptureVideoStabilizationMode {
        switch preference {
        case .off:
            return .off

        case .auto:
            return .auto

        case .standard:
            return supportedMode(
                preferred: .standard,
                fallbacks: [.auto],
                device: device
            )

        case .cinematic:
            return supportedMode(
                preferred: .cinematic,
                fallbacks: [.standard, .auto],
                device: device
            )

        case .maximum:
            // Extended cinematic is intentionally the strongest mode we request
            // directly here. If the active format can't use it, fall back safely.
            return supportedMode(
                preferred: .cinematicExtended,
                fallbacks: [.cinematic, .standard, .auto],
                device: device
            )
        }
    }

    private func supportedMode(
        preferred: AVCaptureVideoStabilizationMode,
        fallbacks: [AVCaptureVideoStabilizationMode],
        device: AVCaptureDevice?
    ) -> AVCaptureVideoStabilizationMode {
        guard let format = device?.activeFormat else {
            return preferred
        }

        if format.isVideoStabilizationModeSupported(preferred) {
            return preferred
        }

        for fallback in fallbacks {
            if fallback == .auto || format.isVideoStabilizationModeSupported(fallback) {
                return fallback
            }
        }

        return .off
    }

    private func scheduleStabilizationStatusRefresh() {
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard let self else { return }
            self.refreshActiveStabilizationStatus()
        }
    }

    private func refreshActiveStabilizationStatus() {
        guard let capturer = currentCameraCapturer() else {
            activeStabilizationLabel = "Unavailable"
            stabilizationSupported = false
            return
        }

        let connections = capturer.captureSession.outputs
            .flatMap(\.connections)
            .filter { connection in
                connection.inputPorts.contains { $0.mediaType == .video }
                    && connection.isVideoStabilizationSupported
            }

        guard let connection = connections.first else {
            activeStabilizationLabel = "Unsupported"
            stabilizationSupported = false
            return
        }

        stabilizationSupported = true
        activeStabilizationLabel = stabilizationName(
            connection.activeVideoStabilizationMode
        )
    }

    private func stabilizationName(
        _ mode: AVCaptureVideoStabilizationMode
    ) -> String {
        switch mode {
        case .off:
            return "Off"
        case .standard:
            return "Standard"
        case .cinematic:
            return "Cinematic"
        case .cinematicExtended:
            return "Cinematic+"
        case .auto:
            return "Auto"
        default:
            // Covers newer iOS stabilization modes without making this
            // LiveKit 2.16 / iOS 17 project depend on newer enum cases.
            return "Enhanced"
        }
    }

    private func videoPublishOptions(for quality: StreamQuality) -> VideoPublishOptions {
        VideoPublishOptions(
            encoding: VideoEncoding(
                maxBitrate: quality.maxBitrate,
                maxFps: quality.fps
            ),
            simulcast: true,
            simulcastLayers: quality.simulcastLayers,
            preferredCodec: .h264,
            preferredBackupCodec: .h264,
            degradationPreference: .maintainResolution
        )
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
