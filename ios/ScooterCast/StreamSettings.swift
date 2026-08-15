import Foundation
import AVFoundation

enum StreamQuality: String, CaseIterable, Identifiable {
    case p480 = "480p"
    case p720 = "720p"
    case p1080 = "1080p"

    var id: String { rawValue }

    var width: Int32 {
        switch self {
        case .p480: return 854
        case .p720: return 1280
        case .p1080: return 1920
        }
    }

    var height: Int32 {
        switch self {
        case .p480: return 480
        case .p720: return 720
        case .p1080: return 1080
        }
    }

    var fps: Int {
        switch self {
        case .p480: return 30
        case .p720: return 30
        case .p1080: return 30
        }
    }
}

enum PreferredCamera: String, CaseIterable, Identifiable {
    case back = "Back"
    case front = "Front"

    var id: String { rawValue }

    var position: AVCaptureDevice.Position {
        self == .front ? .front : .back
    }
}

@MainActor
final class StreamSettings: ObservableObject {
    static let shared = StreamSettings()

    @Published var quality: StreamQuality {
        didSet { UserDefaults.standard.set(quality.rawValue, forKey: "streamQuality") }
    }

    @Published var preferredCamera: PreferredCamera {
        didSet { UserDefaults.standard.set(preferredCamera.rawValue, forKey: "preferredCamera") }
    }

    @Published var startWithMicrophone: Bool {
        didSet { UserDefaults.standard.set(startWithMicrophone, forKey: "startWithMicrophone") }
    }

    @Published var explorerDefault: Bool {
        didSet { UserDefaults.standard.set(explorerDefault, forKey: "explorerDefault") }
    }

    @Published var keepScreenAwake: Bool {
        didSet { UserDefaults.standard.set(keepScreenAwake, forKey: "keepScreenAwake") }
    }

    private init() {
        let defaults = UserDefaults.standard

        quality = StreamQuality(
            rawValue: defaults.string(forKey: "streamQuality") ?? StreamQuality.p720.rawValue
        ) ?? .p720

        preferredCamera = PreferredCamera(
            rawValue: defaults.string(forKey: "preferredCamera") ?? PreferredCamera.back.rawValue
        ) ?? .back

        startWithMicrophone = defaults.object(forKey: "startWithMicrophone") as? Bool ?? true
        explorerDefault = defaults.object(forKey: "explorerDefault") as? Bool ?? true
        keepScreenAwake = defaults.object(forKey: "keepScreenAwake") as? Bool ?? true
    }
}
