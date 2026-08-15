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
    let heading: Double
    let altitudeFt: Double
    let horizontalAccuracyM: Double
    let distanceMiles: Double
    let phoneBattery: Double
    let elapsedSeconds: Int
    let capturedAt: String

    enum CodingKeys: String, CodingKey {
        case rideID = "ride_id"
        case latitude
        case longitude
        case speedMph = "speed_mph"
        case heading
        case altitudeFt = "altitude_ft"
        case horizontalAccuracyM = "horizontal_accuracy_m"
        case distanceMiles = "distance_miles"
        case phoneBattery = "phone_battery"
        case elapsedSeconds = "elapsed_seconds"
        case capturedAt = "captured_at"
    }
}
