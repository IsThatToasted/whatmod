import Foundation

enum AppConfig {
    static let supabaseURL = URL(string: "https://pcsrsfghbmvgfqwmldfi.supabase.co")!
    static let rideAPIURL = URL(string: "https://pcsrsfghbmvgfqwmldfi.supabase.co/functions/v1/ride-api")!
    static let viewerBaseURL = URL(string: "https://whatmod.com/ride/")!
    static let telemetryInterval: TimeInterval = 2.0

    /// Injected by GitHub Actions into Info.plist at build time.
    static var riderAdminKey: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "ScooterCastRiderKey") as? String,
              !value.isEmpty,
              value != "NOT_CONFIGURED" else {
            return ""
        }
        return value
    }
}
