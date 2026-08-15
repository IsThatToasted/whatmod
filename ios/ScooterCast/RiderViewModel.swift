import Foundation
import UIKit

@MainActor
final class RiderViewModel: ObservableObject {
    @Published var title = "Scooter Ride"
    @Published var session: RideSession?
    @Published var statusMessage = "Ready"
    @Published var isBusy = false
    @Published var isDiscoverable = true
    @Published var elapsedSeconds = 0

    let location = LocationService()
    let stream = LiveStreamManager()

    private let api = RideAPI()
    private var telemetryTask: Task<Void, Never>?
    private var startedAt: Date?

    func requestPermissions() {
        location.requestPermission()
    }

    func startRide() async {
        guard session == nil, !isBusy else { return }
        isBusy = true
        statusMessage = "Creating private ride…"

        do {
            let newSession = try await api.createRide(title: title, isDiscoverable: isDiscoverable)
            session = newSession
            startedAt = Date()
            elapsedSeconds = 0

            location.start()

            statusMessage = "Connecting WebRTC…"
            try await stream.start(url: newSession.livekitURL, token: newSession.riderToken)

            statusMessage = "Live"
            beginTelemetryLoop()
        } catch {
            statusMessage = error.localizedDescription
            if let id = session?.id { try? await api.endRide(id) }
            await stream.stop()
            location.stop()
            session = nil
        }

        isBusy = false
    }

    func endRide() async {
        guard let current = session else { return }
        isBusy = true
        telemetryTask?.cancel()
        telemetryTask = nil

        await stream.stop()
        location.stop()
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
            heading: location.heading,
            altitudeFt: location.altitudeFt,
            horizontalAccuracyM: location.gpsAccuracy,
            distanceMiles: location.distanceMiles,
            phoneBattery: location.batteryLevel,
            elapsedSeconds: elapsedSeconds,
            capturedAt: formatter.string(from: Date())
        )

        try? await api.sendTelemetry(payload)
    }
}
