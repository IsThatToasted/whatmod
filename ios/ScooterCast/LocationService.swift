import Foundation
import CoreLocation
import UIKit

@MainActor
final class LocationService: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published var location: CLLocation?
    @Published var distanceMeters: CLLocationDistance = 0
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var diagnosticStatus: String = "Location idle"

    private let manager = CLLocationManager()
    private var lastDistanceLocation: CLLocation?
    private var isRideActive = false

    override init() {
        super.init()

        // Keep startup deliberately conservative. Background location is not
        // enabled here because doing so before the app is fully configured can
        // terminate the process with a CoreLocation Objective-C exception.
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
        lastDistanceLocation = nil
        isRideActive = true

        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 2
        manager.pausesLocationUpdatesAutomatically = false

        // The explicit Info.plist declares the 'location' background mode.
        // Only enable this while an actual ride is active.
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

        // Return to foreground-safe defaults after the ride.
        manager.allowsBackgroundLocationUpdates = false
        manager.showsBackgroundLocationIndicator = false
        manager.pausesLocationUpdatesAutomatically = true

        lastDistanceLocation = nil
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
        guard isRideActive, let newest = locations.last else { return }

        if newest.horizontalAccuracy >= 0, newest.horizontalAccuracy <= 50 {
            if let previous = lastDistanceLocation {
                let segment = newest.distance(from: previous)
                if segment > 0, segment < 200 {
                    distanceMeters += segment
                }
            }
            lastDistanceLocation = newest
        }

        location = newest
    }

    var speedMph: Double {
        guard let location, location.speed >= 0 else { return 0 }
        return location.speed * 2.2369362921
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
