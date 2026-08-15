import Foundation
import CoreLocation
import UIKit

@MainActor
final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var location: CLLocation?
    @Published var distanceMeters: CLLocationDistance = 0
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()
    private var lastDistanceLocation: CLLocation?

    override init() {
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        manager.distanceFilter = 2
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        authorizationStatus = manager.authorizationStatus
    }

    func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    func start() {
        distanceMeters = 0
        lastDistanceLocation = nil
        manager.startUpdatingLocation()
        manager.startUpdatingHeading()
    }

    func stop() {
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
        lastDistanceLocation = nil
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let newest = locations.last else { return }

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
        return max(0, Double(UIDevice.current.batteryLevel))
    }
}
