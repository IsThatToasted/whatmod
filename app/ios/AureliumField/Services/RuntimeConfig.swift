import Foundation

enum AureliumRuntimeConfig {
    private struct Payload: Decodable {
        let cloudURL: String
        let publicKey: String
    }

    private static let payload: Payload? = {
        let bundle = Bundle.main
        let fm = FileManager.default
        let candidates: [URL?] = [
            bundle.url(forResource: "RuntimeConfig", withExtension: "json"),
            bundle.url(forResource: "RuntimeConfig", withExtension: "json", subdirectory: "Resources"),
            bundle.bundleURL.appendingPathComponent("RuntimeConfig.json"),
            bundle.bundleURL.appendingPathComponent("Resources/RuntimeConfig.json"),
            bundle.resourceURL?.appendingPathComponent("RuntimeConfig.json"),
            bundle.resourceURL?.appendingPathComponent("Resources/RuntimeConfig.json")
        ]

        for candidate in candidates.compactMap({ $0 }) where fm.fileExists(atPath: candidate.path) {
            if let data = try? Data(contentsOf: candidate),
               let decoded = try? JSONDecoder().decode(Payload.self, from: data) {
                return decoded
            }
        }
        return nil
    }()

    static var cloudURL: URL? {
        guard let raw = payload?.cloudURL.trimmingCharacters(in: .whitespacesAndNewlines),
              raw.hasPrefix("https://") else { return nil }
        return URL(string: raw)
    }

    static var publicKey: String {
        payload?.publicKey.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    static var isConfigured: Bool {
        cloudURL != nil && !publicKey.isEmpty
    }
}
