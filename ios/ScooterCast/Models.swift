import Foundation
import CoreLocation

struct RideSession: Codable, Identifiable {
    let id: UUID
    let shareSlug: String
    let roomName: String
    let livekitURL: String
    let riderToken: String
    let viewerURL: String

    enum CodingKeys: String, CodingKey {
        case id
        case shareSlug = "share_slug"
        case roomName = "room_name"
        case livekitURL = "livekit_url"
        case riderToken = "rider_token"
        case viewerURL = "viewer_url"
    }
}

struct TelemetryPayload: Codable {
    let rideID: UUID
    let latitude: Double
    let longitude: Double
    let speedMph: Double
    let averageSpeedMph: Double
    let maxSpeedMph: Double
    let heading: Double
    let altitudeFt: Double
    let horizontalAccuracyM: Double
    let speedAccuracyMps: Double
    let courseAccuracyDegrees: Double
    let gpsQuality: String
    let distanceMiles: Double
    let phoneBattery: Double
    let elapsedSeconds: Int
    let movingSeconds: Int
    let capturedAt: String

    enum CodingKeys: String, CodingKey {
        case rideID = "ride_id"
        case latitude
        case longitude
        case speedMph = "speed_mph"
        case averageSpeedMph = "average_speed_mph"
        case maxSpeedMph = "max_speed_mph"
        case heading
        case altitudeFt = "altitude_ft"
        case horizontalAccuracyM = "horizontal_accuracy_m"
        case speedAccuracyMps = "speed_accuracy_mps"
        case courseAccuracyDegrees = "course_accuracy_degrees"
        case gpsQuality = "gps_quality"
        case distanceMiles = "distance_miles"
        case phoneBattery = "phone_battery"
        case elapsedSeconds = "elapsed_seconds"
        case movingSeconds = "moving_seconds"
        case capturedAt = "captured_at"
    }
}

struct ViewerEvent: Codable, Identifiable {
    let id: UUID
    let eventType: String
    let emoji: String?
    let label: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case eventType = "event_type"
        case emoji
        case label
        case createdAt = "created_at"
    }
}
