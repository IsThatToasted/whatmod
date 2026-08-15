import SwiftUI

struct SettingsView: View {
    @ObservedObject private var settings = StreamSettings.shared

    var body: some View {
        NavigationStack {
            Form {
                Section("Stream") {
                    Picker("Video Quality", selection: $settings.quality) {
                        ForEach(StreamQuality.allCases) { quality in
                            Text(quality.rawValue).tag(quality)
                        }
                    }

                    Picker("Starting Camera", selection: $settings.preferredCamera) {
                        ForEach(PreferredCamera.allCases) { camera in
                            Text(camera.rawValue).tag(camera)
                        }
                    }

                    Toggle("Start with Microphone", isOn: $settings.startWithMicrophone)
                    Toggle("Keep Screen Awake", isOn: $settings.keepScreenAwake)
                }

                Section("Discovery") {
                    Toggle("Explorer On by Default", isOn: $settings.explorerDefault)

                    Text("You can still change Explorer visibility for each ride before going live.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Streaming Notes") {
                    LabeledContent("Recommended", value: "720p / 30 FPS")
                    LabeledContent("Viewer", value: "whatmod.com/ride")
                    LabeledContent("Backend", value: "LiveKit + Supabase")

                    Text("Higher resolutions can increase cellular data use, heat, battery drain, and LiveKit downstream transfer.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Version") {
                    LabeledContent("ScooterCast", value: "1.5.0")
                }
            }
            .navigationTitle("Settings")
        }
    }
}
