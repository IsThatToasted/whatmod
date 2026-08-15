import Foundation
import CoreLocation
import UIKit

@MainActor
final class LocationService: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var location: CLLocation?
    @Published var distanceMeters: CLLocationDistance = 0
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var diagnosticStatus: String = "Location idle"

    @Published var smoothedSpeedMph: Double = 0
    @Published var averageSpeedMph: Double = 0
    @Published var maxSpeedMph: Double = 0
    @Published var movingSeconds: Int = 0
    @Published var gpsQuality: String = "—"

    private let manager = CLLocationManager()
    private let motionEngine = MotionEngine()
    private var isRideActive = false

    override init() {
        super.init()

        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 3
        manager.pausesLocationUpdatesAutomatically = true

        authorizationStatus = manager.authorizationStatus
    }

    func requestPermission() {
        diagnosticStatus = "Requesting location permission"
        manager.requestWhenInUseAuthorization()
    }

    func start() {
        distanceMeters = 0
        smoothedSpeedMph = 0
        averageSpeedMph = 0
        maxSpeedMph = 0
        movingSeconds = 0
        gpsQuality = "Acquiring"
        motionEngine.reset()
        isRideActive = true

        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 2
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true

        diagnosticStatus = "Location active"
        manager.startUpdatingLocation()

        if CLLocationManager.headingAvailable() {
            manager.startUpdatingHeading()
        }
    }

    func stop() {
        isRideActive = false
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()

        manager.allowsBackgroundLocationUpdates = false
        manager.showsBackgroundLocationIndicator = false
        manager.pausesLocationUpdatesAutomatically = true

        diagnosticStatus = "Location stopped"
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        diagnosticStatus = "Authorization: \(authorizationText(manager.authorizationStatus))"
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        diagnosticStatus = "Location error: \(error.localizedDescription)"
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard isRideActive else { return }

        for candidate in locations {
            guard let snapshot = motionEngine.process(candidate) else { continue }

            location = snapshot.location
            distanceMeters = snapshot.distanceMeters
            smoothedSpeedMph = snapshot.speedMph
            averageSpeedMph = snapshot.averageSpeedMph
            maxSpeedMph = snapshot.maxSpeedMph
            movingSeconds = snapshot.movingSeconds
            gpsQuality = snapshot.gpsQuality
        }
    }

    var speedMph: Double {
        smoothedSpeedMph
    }

    var altitudeFt: Double {
        (location?.altitude ?? 0) * 3.280839895
    }

    var heading: Double {
        guard let location else { return 0 }
        if location.course >= 0 { return location.course }
        return 0
    }

    var distanceMiles: Double {
        distanceMeters / 1609.344
    }

    var gpsAccuracy: Double {
        location?.horizontalAccuracy ?? -1
    }

    var speedAccuracyMps: Double {
        guard let location, location.speedAccuracy >= 0 else { return -1 }
        return location.speedAccuracy
    }

    var courseAccuracyDegrees: Double {
        guard let location, location.courseAccuracy >= 0 else { return -1 }
        return location.courseAccuracy
    }

    var batteryLevel: Double {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let value = UIDevice.current.batteryLevel
        return value < 0 ? 0 : Double(value)
    }

    private func authorizationText(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "Not determined"
        case .restricted: return "Restricted"
        case .denied: return "Denied"
        case .authorizedAlways: return "Always"
        case .authorizedWhenInUse: return "When In Use"
        @unknown default: return "Unknown"
        }
    }
}
