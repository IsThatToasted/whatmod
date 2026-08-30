import Foundation
import UIKit

@MainActor
final class RiderViewModel: ObservableObject {
    @Published var title = "Scooter Ride"
    @Published var session: RideSession?
    @Published var statusMessage = "Ready"
    @Published var isBusy = false
    @Published var elapsedSeconds = 0
    @Published var isDiscoverable: Bool
    @Published var latestViewerEvent: ViewerEvent?
    @Published var recordingStatus = "Off"
    @Published var recordingError: String?

    let location = LocationService()
    let stream = LiveStreamManager()
    let settings = StreamSettings.shared

    private let api = RideAPI()
    private var telemetryTask: Task<Void, Never>?
    private var riderHeartbeatTask: Task<Void, Never>?
    private var eventTask: Task<Void, Never>?
    private var lifecycleObservers: [NSObjectProtocol] = []
    private var lastEventTimestamp: String?
    private var startedAt: Date?

    init() {
        installLifecycleObservers()
        isDiscoverable = StreamSettings.shared.explorerDefault
    }

    func requestPermissions() {
        location.requestPermission()
    }

    private func installLifecycleObservers() {
        let center = NotificationCenter.default

        lifecycleObservers.append(
            center.addObserver(
                forName: UIApplication.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    // Backgrounding is NOT an End Ride action.
                    self?.stream.refreshBackgroundMediaConfiguration()
                }
            }
        )

        lifecycleObservers.append(
            center.addObserver(
                forName: UIApplication.willEnterForegroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.stream.refreshBackgroundMediaConfiguration()
                    self?.settings.reapplyScreenAwakePreference()
                }
            }
        )

        lifecycleObservers.append(
            center.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.stream.refreshBackgroundMediaConfiguration()
                    self?.settings.reapplyScreenAwakePreference()
                }
            }
        )
    }

    deinit {
        for observer in lifecycleObservers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    func startRide() async {
        guard session == nil, !isBusy else { return }
        isBusy = true
        statusMessage = "Creating private ride…"

        do {
            let newSession = try await api.createRide(
                title: title,
                isDiscoverable: isDiscoverable
            )

            session = newSession
            startedAt = Date()
            elapsedSeconds = 0

            if settings.keepScreenAwake {
                UIApplication.shared.isIdleTimerDisabled = true
            }

            location.start()

            statusMessage = "Connecting WebRTC…"

            try await stream.start(
                url: newSession.livekitURL,
                token: newSession.riderToken,
                preferredCamera: settings.preferredCamera.position,
                quality: settings.quality,
                stabilization: settings.stabilization,
                microphoneEnabled: settings.startWithMicrophone
            )

            recordingStatus = "Starting…"
            recordingError = nil
            do {
                let didStartRecording = try await api.startRecording(newSession.id)
                recordingStatus = didStartRecording ? "Recording" : "Unavailable"
                if !didStartRecording {
                    recordingError = "Recording storage/Egress is not configured."
                }
            } catch {
                recordingStatus = "Unavailable"
                recordingError = error.localizedDescription
            }

            statusMessage = "Live"
            beginTelemetryLoop()
            beginRiderHeartbeatLoop()
            beginViewerEventLoop()
        } catch {
            statusMessage = error.localizedDescription
            if let id = session?.id {
                try? await api.endRide(id)
            }

            await stream.stop()
            location.stop()
            settings.reapplyScreenAwakePreference()
            session = nil
        }

        isBusy = false
    }

    func endRide() async {
        guard let current = session else { return }

        isBusy = true
        telemetryTask?.cancel()
        riderHeartbeatTask?.cancel()
        telemetryTask = nil
        eventTask?.cancel()
        eventTask = nil

        recordingStatus = "Finalizing…"

        // Participant Egress finalizes automatically after the rider leaves.
        await stream.stop()
        location.stop()
        settings.reapplyScreenAwakePreference()
        try? await api.stopRecording(current.id)
        try? await api.endRide(current.id)

        session = nil
        startedAt = nil
        elapsedSeconds = 0
        recordingStatus = "Off"
        recordingError = nil
        statusMessage = "Ride ended"
        isBusy = false
    }

    func copyViewerLink() {
        guard let url = session?.viewerURL else { return }
        UIPasteboard.general.string = url
        statusMessage = "Viewer link copied"
    }

    private func beginRiderHeartbeatLoop() {
        riderHeartbeatTask?.cancel()

        riderHeartbeatTask = Task { [weak self] in
            guard let self else { return }

            while !Task.isCancelled {
                if let ride = self.session {
                    // Rider presence is deliberately independent of GPS.
                    // A stationary rider still refreshes their live status.
                    try? await self.api.sendRiderHeartbeat(ride.id)
                }

                try? await Task.sleep(for: .seconds(15))
            }
        }
    }

    private func beginTelemetryLoop() {
        telemetryTask?.cancel()

        telemetryTask = Task { [weak self] in
            guard let self else { return }

            while !Task.isCancelled {
                await self.sendCurrentTelemetry()
                try? await Task.sleep(for: .seconds(AppConfig.telemetryInterval))
            }
        }
    }

    private func sendCurrentTelemetry() async {
        guard let ride = session, let current = location.location else { return }

        let elapsed = Int(Date().timeIntervalSince(startedAt ?? Date()))
        elapsedSeconds = max(0, elapsed)

        let formatter = ISO8601DateFormatter()

        let payload = TelemetryPayload(
            rideID: ride.id,
            latitude: current.coordinate.latitude,
            longitude: current.coordinate.longitude,
            speedMph: location.speedMph,
            averageSpeedMph: location.averageSpeedMph,
            maxSpeedMph: location.maxSpeedMph,
            heading: location.heading,
            altitudeFt: location.altitudeFt,
            horizontalAccuracyM: location.gpsAccuracy,
            speedAccuracyMps: location.speedAccuracyMps,
            courseAccuracyDegrees: location.courseAccuracyDegrees,
            gpsQuality: location.gpsQuality,
            distanceMiles: location.distanceMiles,
            phoneBattery: location.batteryLevel,
            elapsedSeconds: elapsedSeconds,
            movingSeconds: location.movingSeconds,
            capturedAt: formatter.string(from: Date())
        )

        try? await api.sendTelemetry(payload)
    }

    private func beginViewerEventLoop() {
        eventTask?.cancel()

        eventTask = Task { [weak self] in
            guard let self else { return }

            while !Task.isCancelled {
                if let ride = self.session {
                    do {
                        let events = try await self.api.fetchViewerEvents(
                            rideID: ride.id,
                            after: self.lastEventTimestamp
                        )

                        if let newest = events.last {
                            self.latestViewerEvent = newest
                            self.lastEventTimestamp = newest.createdAt
                        }
                    } catch {
                        // Viewer interaction is optional and must never interrupt
                        // the active stream.
                    }
                }

                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

}
