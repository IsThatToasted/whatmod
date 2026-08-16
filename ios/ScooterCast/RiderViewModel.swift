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

    let location = LocationService()
    let stream = LiveStreamManager()
    let settings = StreamSettings.shared

    private let api = RideAPI()
    private var telemetryTask: Task<Void, Never>?
    private var eventTask: Task<Void, Never>?
    private var lastEventTimestamp: String?
    private var startedAt: Date?

    init() {
        isDiscoverable = StreamSettings.shared.explorerDefault
    }

    func requestPermissions() {
        location.requestPermission()
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

            statusMessage = "Live"
            beginTelemetryLoop()
            beginViewerEventLoop()
        } catch {
            statusMessage = error.localizedDescription
            if let id = session?.id {
                try? await api.endRide(id)
            }

            await stream.stop()
            location.stop()
            UIApplication.shared.isIdleTimerDisabled = false
            session = nil
        }

        isBusy = false
    }

    func endRide() async {
        guard let current = session else { return }

        isBusy = true
        telemetryTask?.cancel()
        telemetryTask = nil
        eventTask?.cancel()
        eventTask = nil

        await stream.stop()
        location.stop()
        UIApplication.shared.isIdleTimerDisabled = false
        try? await api.endRide(current.id)

        session = nil
        startedAt = nil
        elapsedSeconds = 0
        statusMessage = "Ride ended"
        isBusy = false
    }

    func copyViewerLink() {
        guard let url = session?.viewerURL else { return }
        UIPasteboard.general.string = url
        statusMessage = "Viewer link copied"
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
