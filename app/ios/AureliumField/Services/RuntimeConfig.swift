import Foundation

struct RuntimeConfig: Decodable, Sendable {
    let cloudURL: String
    let publicKey: String

    /// Small, deterministic bundle lookup. Do not recursively enumerate the app
    /// bundle during process launch; Xcode places resources either at the resource
    /// root or in the preserved Resources directory depending on project generation.
    static func load() -> RuntimeConfig? {
        var candidates: [URL] = []

        if let direct = Bundle.main.url(forResource: "RuntimeConfig", withExtension: "json") {
            candidates.append(direct)
        }
        if let resourceURL = Bundle.main.resourceURL {
            candidates.append(resourceURL.appendingPathComponent("RuntimeConfig.json"))
            candidates.append(resourceURL.appendingPathComponent("Resources/RuntimeConfig.json"))
        }

        var seen = Set<String>()
        for url in candidates where seen.insert(url.path).inserted {
            guard
                let data = try? Data(contentsOf: url),
                let decoded = try? JSONDecoder().decode(RuntimeConfig.self, from: data)
            else { continue }

            let endpoint = decoded.cloudURL.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = decoded.publicKey.trimmingCharacters(in: .whitespacesAndNewlines)
            guard endpoint.hasPrefix("https://"), URL(string: endpoint) != nil, !key.isEmpty else { continue }
            return RuntimeConfig(cloudURL: endpoint, publicKey: key)
        }
        return nil
    }
}
