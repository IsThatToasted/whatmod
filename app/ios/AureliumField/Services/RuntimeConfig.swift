import Foundation

struct RuntimeConfig: Decodable {
    let cloudURL: String
    let publicKey: String

    static func load() -> RuntimeConfig? {
        let fm = FileManager.default
        var candidates: [URL] = []
        if let direct = Bundle.main.url(forResource: "RuntimeConfig", withExtension: "json") { candidates.append(direct) }
        if let resources = Bundle.main.resourceURL {
            candidates.append(resources.appendingPathComponent("RuntimeConfig.json"))
            candidates.append(resources.appendingPathComponent("Resources/RuntimeConfig.json"))
            if let enumerator = fm.enumerator(at: resources, includingPropertiesForKeys: nil) {
                for case let url as URL in enumerator where url.lastPathComponent == "RuntimeConfig.json" { candidates.append(url) }
            }
        }
        for url in candidates {
            guard let data = try? Data(contentsOf: url), let config = try? JSONDecoder().decode(RuntimeConfig.self, from: data) else { continue }
            let endpoint = config.cloudURL.trimmingCharacters(in: .whitespacesAndNewlines)
            let key = config.publicKey.trimmingCharacters(in: .whitespacesAndNewlines)
            guard endpoint.hasPrefix("https://"), !key.isEmpty else { continue }
            return .init(cloudURL: endpoint, publicKey: key)
        }
        return nil
    }
}
