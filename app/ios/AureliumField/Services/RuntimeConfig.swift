import Foundation

enum AFRuntimeConfig {
    private struct Payload: Decodable {
        let cloudURL: String
        let publicKey: String
        let googleIOSClientID: String?
        let googleWebClientID: String?
    }

    private enum Resolution {
        case configured(url: URL, key: String, googleIOSClientID: String?, googleWebClientID: String?)
        case missingResource
        case unreadableResource
        case malformedResource
        case invalidEndpoint
        case missingPublicKey
    }

    private static let resolution: Resolution = resolve()

    private static func resolve() -> Resolution {
        guard let resourceURL = locateResource() else { return .missingResource }
        guard let data = try? Data(contentsOf: resourceURL) else { return .unreadableResource }
        guard let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return .malformedResource }

        let rawURL = payload.cloudURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = payload.publicKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let googleIOS = payload.googleIOSClientID?.trimmingCharacters(in: .whitespacesAndNewlines)
        let googleWeb = payload.googleWebClientID?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !key.isEmpty else { return .missingPublicKey }
        guard let url = URL(string: rawURL), url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty else {
            return .invalidEndpoint
        }

        return .configured(
            url: url,
            key: key,
            googleIOSClientID: (googleIOS?.isEmpty == false ? googleIOS : nil),
            googleWebClientID: (googleWeb?.isEmpty == false ? googleWeb : nil)
        )
    }

    private static func locateResource() -> URL? {
        let bundle = Bundle.main
        let fileManager = FileManager.default
        let candidates: [URL?] = [
            bundle.url(forResource: "RuntimeConfig", withExtension: "json"),
            bundle.url(forResource: "RuntimeConfig", withExtension: "json", subdirectory: "Resources"),
            bundle.bundleURL.appendingPathComponent("RuntimeConfig.json"),
            bundle.bundleURL.appendingPathComponent("Resources/RuntimeConfig.json"),
            bundle.resourceURL?.appendingPathComponent("RuntimeConfig.json"),
            bundle.resourceURL?.appendingPathComponent("Resources/RuntimeConfig.json")
        ]
        for candidate in candidates.compactMap({ $0 }) where fileManager.fileExists(atPath: candidate.path) { return candidate }
        guard let root = bundle.resourceURL,
              let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles, .skipsPackageDescendants]) else { return nil }
        var inspected = 0
        for case let fileURL as URL in enumerator {
            inspected += 1
            if inspected > 2_000 { break }
            if fileURL.lastPathComponent == "RuntimeConfig.json" { return fileURL }
        }
        return nil
    }

    static var cloudURL: URL? {
        guard case let .configured(url, _, _, _) = resolution else { return nil }
        return url
    }

    static var publicKey: String {
        guard case let .configured(_, key, _, _) = resolution else { return "" }
        return key
    }

    static var googleIOSClientID: String? {
        guard case let .configured(_, _, clientID, _) = resolution else { return nil }
        return clientID
    }

    static var googleWebClientID: String? {
        guard case let .configured(_, _, _, clientID) = resolution else { return nil }
        return clientID
    }

    static var isGoogleSignInConfigured: Bool {
        googleIOSClientID != nil && googleWebClientID != nil
    }

    static var isConfigured: Bool {
        if case .configured = resolution { return true }
        return false
    }

    static var publicErrorCode: AFErrorCode {
        switch resolution {
        case .configured: return .configuration
        case .missingResource: return .configurationResourceMissing
        case .unreadableResource: return .configurationResourceUnreadable
        case .malformedResource: return .configurationResourceMalformed
        case .invalidEndpoint: return .configurationEndpointInvalid
        case .missingPublicKey: return .configurationPublicKeyMissing
        }
    }
}
