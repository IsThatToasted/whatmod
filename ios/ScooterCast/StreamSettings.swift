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


enum StabilizationPreference: String, CaseIterable, Identifiable {
    case off = "Off"
    case auto = "Auto"
    case standard = "Standard"
    case cinematic = "Cinematic"
    case maximum = "Maximum"

    var id: String { rawValue }

    var detail: String {
        switch self {
        case .off:
            return "No camera stabilization. Lowest processing and widest field of view."
        case .auto:
            return "Lets iOS select an appropriate stabilization mode for the current camera and format."
        case .standard:
            return "Moderate stabilization with some crop and a small latency tradeoff."
        case .cinematic:
            return "Stronger smoothing for riding footage, with more crop and additional latency."
        case .maximum:
            return "Chooses the strongest supported stabilization mode for the active camera format."
        }
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


    @Published var stabilization: StabilizationPreference {
        didSet { UserDefaults.standard.set(stabilization.rawValue, forKey: "stabilizationPreference") }
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


        stabilization = StabilizationPreference(
            rawValue: defaults.string(forKey: "stabilizationPreference")
                ?? StabilizationPreference.cinematic.rawValue
        ) ?? .cinematic

        startWithMicrophone = defaults.object(forKey: "startWithMicrophone") as? Bool ?? true
        explorerDefault = defaults.object(forKey: "explorerDefault") as? Bool ?? true
        keepScreenAwake = defaults.object(forKey: "keepScreenAwake") as? Bool ?? true
    }
}
