import Foundation

enum RideAPIError: LocalizedError {
    case badResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .badResponse:
            return "The ScooterCast server returned an invalid response."
        case .server(let message):
            return message
        }
    }
}

struct RideAPI {
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private struct CreateRideBody: Encodable {
        let title: String
        let isDiscoverable: Bool

        enum CodingKeys: String, CodingKey {
            case title
            case isDiscoverable = "is_discoverable"
        }
    }

    func createRide(title: String, isDiscoverable: Bool) async throws -> RideSession {
        guard !AppConfig.riderAdminKey.isEmpty else {
            throw RideAPIError.server(
                "Rider credential is not configured. Build using GitHub Actions after adding RIDER_ADMIN_KEY."
            )
        }

        guard let apiURL = AppConfig.rideAPIURL else {
            throw RideAPIError.server("Ride API URL is invalid.")
        }

        guard let viewerBaseURL = AppConfig.viewerBaseURL else {
            throw RideAPIError.server("Viewer URL is invalid.")
        }

        var request = URLRequest(
            url: apiURL.appending(queryItems: [
                URLQueryItem(name: "action", value: "create")
            ])
        )

        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.riderAdminKey, forHTTPHeaderField: "x-rider-key")
        request.setValue(viewerBaseURL.absoluteString, forHTTPHeaderField: "x-viewer-base")
        request.httpBody = try encoder.encode(
            CreateRideBody(title: title, isDiscoverable: isDiscoverable)
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(RideSession.self, from: data)
    }

    func sendTelemetry(_ telemetry: TelemetryPayload) async throws {
        guard !AppConfig.riderAdminKey.isEmpty else {
            throw RideAPIError.server("Rider credential is not configured.")
        }

        guard let apiURL = AppConfig.rideAPIURL else {
            throw RideAPIError.server("Ride API URL is invalid.")
        }

        var request = URLRequest(
            url: apiURL.appending(queryItems: [
                URLQueryItem(name: "action", value: "telemetry")
            ])
        )

        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.riderAdminKey, forHTTPHeaderField: "x-rider-key")
        request.httpBody = try encoder.encode(telemetry)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    func endRide(_ rideID: UUID) async throws {
        guard !AppConfig.riderAdminKey.isEmpty else {
            throw RideAPIError.server("Rider credential is not configured.")
        }

        guard let apiURL = AppConfig.rideAPIURL else {
            throw RideAPIError.server("Ride API URL is invalid.")
        }

        var request = URLRequest(
            url: apiURL.appending(queryItems: [
                URLQueryItem(name: "action", value: "end")
            ])
        )

        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppConfig.riderAdminKey, forHTTPHeaderField: "x-rider-key")
        request.httpBody = try encoder.encode(["ride_id": rideID.uuidString])

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw RideAPIError.badResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            let message =
                (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String

            throw RideAPIError.server(message ?? "Server error \(http.statusCode)")
        }
    }
}
