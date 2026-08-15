import Foundation

enum AppConfig {
    static let supabaseURLString = "https://pcsrsfghbmvgfqwmldfi.supabase.co"
    static let rideAPIURLString = "https://pcsrsfghbmvgfqwmldfi.supabase.co/functions/v1/ride-api"
    static let viewerBaseURLString = "https://whatmod.com/ride/"
    static let telemetryInterval: TimeInterval = 2.0

    static var supabaseURL: URL? { URL(string: supabaseURLString) }
    static var rideAPIURL: URL? { URL(string: rideAPIURLString) }
    static var viewerBaseURL: URL? { URL(string: viewerBaseURLString) }

    static var riderAdminKey: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ScooterCastRiderKey") as? String,
              !value.isEmpty,
              value != "NOT_CONFIGURED",
              !value.contains("$(") else {
            return ""
        }
        return value
    }

    static var startupDiagnostics: [String] {
        var messages: [String] = []
        messages.append(rideAPIURL == nil ? "Ride API URL: INVALID" : "Ride API URL: OK")
        messages.append(viewerBaseURL == nil ? "Viewer URL: INVALID" : "Viewer URL: OK")
        messages.append(riderAdminKey.isEmpty ? "Rider credential: MISSING" : "Rider credential: OK")
        return messages
    }
}
