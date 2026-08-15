import Foundation
import CoreLocation

struct MotionSnapshot {
    let location: CLLocation
    let speedMph: Double
    let averageSpeedMph: Double
    let maxSpeedMph: Double
    let distanceMeters: Double
    let movingSeconds: Int
    let gpsQuality: String
}

final class MotionEngine {
    private var previousAcceptedLocation: CLLocation?
    private var smoothedSpeedMps: Double = 0
    private var totalMovingSeconds: TimeInterval = 0
    private var totalMovingDistanceMeters: Double = 0
    private var maxSpeedMps: Double = 0

    func reset() {
        previousAcceptedLocation = nil
        smoothedSpeedMps = 0
        totalMovingSeconds = 0
        totalMovingDistanceMeters = 0
        maxSpeedMps = 0
    }

    func process(_ candidate: CLLocation, now: Date = Date()) -> MotionSnapshot? {
        // Ignore stale or clearly poor fixes. This removes many GPS jumps while
        // keeping navigation-quality samples responsive.
        let age = abs(candidate.timestamp.timeIntervalSince(now))
        guard age <= 6 else { return nil }
        guard candidate.horizontalAccuracy >= 0, candidate.horizontalAccuracy <= 45 else {
            return nil
        }

        let rawSpeed = candidate.speed >= 0 ? candidate.speed : 0

        // Speed confidence helps determine how heavily to smooth the sample.
        let speedAccuracy = candidate.speedAccuracy >= 0 ? candidate.speedAccuracy : 5
        let alpha: Double
        if candidate.horizontalAccuracy <= 6 && speedAccuracy <= 1.5 {
            alpha = 0.48
        } else if candidate.horizontalAccuracy <= 15 {
            alpha = 0.34
        } else {
            alpha = 0.22
        }

        if previousAcceptedLocation == nil {
            smoothedSpeedMps = rawSpeed
        } else {
            smoothedSpeedMps = alpha * rawSpeed + (1 - alpha) * smoothedSpeedMps
        }

        if let previous = previousAcceptedLocation {
            let dt = max(0, candidate.timestamp.timeIntervalSince(previous.timestamp))
            let segment = candidate.distance(from: previous)

            // Reject impossible jumps. A 90 m segment in a typical 1–3 sec GPS
            // interval is already far beyond normal scooter movement.
            let plausibleDistance = segment >= 0 && segment <= 90
            let isMoving = smoothedSpeedMps >= 0.75

            if plausibleDistance {
                if isMoving {
                    totalMovingDistanceMeters += segment
                    if dt <= 10 {
                        totalMovingSeconds += dt
                    }
                }
            }
        }

        maxSpeedMps = max(maxSpeedMps, smoothedSpeedMps)
        previousAcceptedLocation = candidate

        let averageMps: Double
        if totalMovingSeconds > 0 {
            averageMps = totalMovingDistanceMeters / totalMovingSeconds
        } else {
            averageMps = smoothedSpeedMps
        }

        return MotionSnapshot(
            location: candidate,
            speedMph: smoothedSpeedMps * 2.2369362921,
            averageSpeedMph: averageMps * 2.2369362921,
            maxSpeedMph: maxSpeedMps * 2.2369362921,
            distanceMeters: totalMovingDistanceMeters,
            movingSeconds: Int(totalMovingSeconds.rounded()),
            gpsQuality: quality(for: candidate)
        )
    }

    private func quality(for location: CLLocation) -> String {
        let accuracy = location.horizontalAccuracy
        if accuracy <= 5 { return "excellent" }
        if accuracy <= 12 { return "good" }
        if accuracy <= 25 { return "fair" }
        return "weak"
    }
}
