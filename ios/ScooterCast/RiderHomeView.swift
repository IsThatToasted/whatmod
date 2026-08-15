import SwiftUI
import AVFoundation

struct RiderHomeView: View {
    @StateObject private var vm = RiderViewModel()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.black, Color(red: 0.03, green: 0.08, blue: 0.10)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 18) {
                    header
                    cameraCard
                    liveCard
                    telemetryGrid
                    controls
                    safetyFooter
                }
                .padding()
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("SCOOTERCAST")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                Text("Private live ride")
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(vm.stream.state.rawValue)
                .font(.caption.bold())
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(vm.stream.state == .live ? Color.green.opacity(0.18) : Color.white.opacity(0.08))
                .clipShape(Capsule())
        }
    }

    private var cameraCard: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 24)
                .fill(Color.black)
                .aspectRatio(16 / 9, contentMode: .fit)

            if let track = vm.stream.localVideoTrack {
                LiveVideoPreview(track: track)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "video.fill")
                        .font(.system(size: 34))
                    Text(vm.session == nil ? "Camera preview starts with your live ride" : "Starting camera…")
                        .font(.subheadline.weight(.semibold))
                    Text("The preview uses the same track being sent to viewers.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .aspectRatio(16 / 9, contentMode: .fit)
            }

            if vm.session != nil {
                Button {
                    Task { await vm.stream.switchCamera() }
                } label: {
                    Image(systemName: "camera.rotate.fill")
                        .font(.title3.bold())
                        .frame(width: 46, height: 46)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }
                .disabled(vm.stream.isSwitchingCamera || vm.stream.state != .live)
                .padding(12)
            }

            VStack {
                Spacer()
                HStack {
                    Label(
                        vm.stream.cameraPosition == .front ? "FRONT" : "REAR",
                        systemImage: vm.stream.cameraPosition == .front ? "person.crop.rectangle" : "road.lanes"
                    )
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())

                    Spacer()

                    if vm.stream.state == .live {
                        Text("● LIVE CAMERA")
                            .font(.caption.bold())
                            .foregroundStyle(.green)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                }
                .padding(12)
            }
            .aspectRatio(16 / 9, contentMode: .fit)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private var liveCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: vm.stream.state == .live ? "video.fill" : "video.slash")
                    .font(.title2)
                Text(vm.statusMessage)
                    .font(.headline)
                Spacer()
            }

            TextField("Ride title", text: $vm.title)
                .textFieldStyle(.plain)
                .padding(14)
                .background(Color.white.opacity(0.07))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .disabled(vm.session != nil)

            Toggle(isOn: $vm.isDiscoverable) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Show in Live Explorer")
                        .font(.subheadline.weight(.semibold))
                    Text("Anyone visiting the ScooterCast ride page can discover this ride.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .disabled(vm.session != nil)

            if let session = vm.session {
                Text(session.viewerURL)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .lineLimit(2)
            }

            if let error = vm.stream.errorMessage, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(18)
        .background(.ultraThinMaterial.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    private var telemetryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            metric("SPEED", String(format: "%.1f", vm.location.speedMph), "MPH", "speedometer")
            metric("DISTANCE", String(format: "%.2f", vm.location.distanceMiles), "MI", "point.topleft.down.to.point.bottomright.curvepath")
            metric("ALTITUDE", String(format: "%.0f", vm.location.altitudeFt), "FT", "mountain.2.fill")
            metric("BATTERY", String(format: "%.0f", vm.location.batteryLevel * 100), "%", "battery.75percent")
            metric("HEADING", String(format: "%.0f", vm.location.heading), "°", "location.north.fill")
            metric("TIME", formattedTime(vm.elapsedSeconds), "", "timer")
        }
    }

    private func metric(_ title: String, _ value: String, _ suffix: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                Text(title).font(.caption.bold())
            }
            .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(value)
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                Text(suffix)
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }

    private var controls: some View {
        VStack(spacing: 12) {
            if vm.session == nil {
                if vm.location.authorizationStatus == .notDetermined {
                    Button {
                        vm.requestPermissions()
                    } label: {
                        Label("Enable Location", systemImage: "location.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.bordered)
                }

                Button {
                    Task { await vm.startRide() }
                } label: {
                    Label("Start Live Ride", systemImage: "dot.radiowaves.left.and.right")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(vm.isBusy)
            } else {
                HStack(spacing: 10) {
                    Button {
                        Task { await vm.stream.switchCamera() }
                    } label: {
                        Label("Flip Camera", systemImage: "camera.rotate.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(vm.stream.isSwitchingCamera || vm.stream.state != .live)

                    Button {
                        vm.copyViewerLink()
                    } label: {
                        Label("Share", systemImage: "link")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                Button(role: .destructive) {
                    Task { await vm.endRide() }
                } label: {
                    Label("End Ride", systemImage: "stop.circle.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isBusy)
            }
        }
    }

    private var safetyFooter: some View {
        Text("Start ScooterCast while stopped, secure your phone, and do not operate the app while the scooter is moving.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.vertical, 10)
    }

    private func formattedTime(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }
}
