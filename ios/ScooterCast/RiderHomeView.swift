import SwiftUI
import AVFoundation

struct RiderHomeView: View {
    @StateObject private var vm = RiderViewModel()

    var body: some View {
        NavigationStack {
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

                        if vm.session != nil {
                            streamControls

                            if let event = vm.latestViewerEvent {
                                viewerEventBanner(event)
                            }
                        }

                        liveCard
                        telemetryGrid
                        controls
                        safetyFooter
                    }
                    .padding()
                }
            }
            .navigationBarHidden(true)
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
                .background(
                    vm.stream.state == .live
                    ? Color.green.opacity(0.18)
                    : Color.white.opacity(0.08)
                )
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
                    .opacity(vm.stream.isVideoMuted ? 0.2 : 1)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "video.fill")
                        .font(.system(size: 34))

                    Text(
                        vm.session == nil
                        ? "Camera preview starts with your live ride"
                        : "Starting camera…"
                    )
                    .font(.subheadline.weight(.semibold))

                    Text("The preview is the actual LiveKit publishing track.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .aspectRatio(16 / 9, contentMode: .fit)
            }

            if vm.stream.isVideoMuted {
                VStack(spacing: 7) {
                    Image(systemName: "video.slash.fill")
                        .font(.system(size: 32))
                    Text("VIDEO PAUSED")
                        .font(.caption.bold())
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .aspectRatio(16 / 9, contentMode: .fit)
            }

            VStack {
                Spacer()

                HStack {
                    Label(
                        vm.stream.cameraPosition == .front ? "FRONT" : "REAR",
                        systemImage: vm.stream.cameraPosition == .front
                            ? "person.crop.rectangle"
                            : "camera.fill"
                    )
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())

                    Spacer()

                    if vm.stream.state == .live {
                        Text(vm.stream.isVideoMuted ? "VIDEO MUTED" : "● LIVE CAMERA")
                            .font(.caption.bold())
                            .foregroundStyle(vm.stream.isVideoMuted ? .orange : .green)
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

    private var streamControls: some View {
        HStack(spacing: 10) {
            streamButton(
                title: vm.stream.isMicrophoneMuted ? "Unmute Mic" : "Mute Mic",
                icon: vm.stream.isMicrophoneMuted ? "mic.slash.fill" : "mic.fill",
                active: vm.stream.isMicrophoneMuted
            ) {
                Task { await vm.stream.toggleMicrophoneMute() }
            }

            streamButton(
                title: vm.stream.isVideoMuted ? "Resume Video" : "Pause Video",
                icon: vm.stream.isVideoMuted ? "video.fill" : "video.slash.fill",
                active: vm.stream.isVideoMuted
            ) {
                Task { await vm.stream.toggleVideoMute() }
            }

            streamButton(
                title: "Flip",
                icon: "camera.rotate.fill",
                active: false
            ) {
                Task { await vm.stream.switchCamera() }
            }
            .disabled(vm.stream.isSwitchingCamera || vm.stream.isVideoMuted)
        }
    }

    private func streamButton(
        title: String,
        icon: String,
        active: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title3)
                Text(title)
                    .font(.caption2.bold())
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(active ? Color.orange.opacity(0.16) : Color.white.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
    }


    private func viewerEventBanner(_ event: ViewerEvent) -> some View {
        HStack(spacing: 12) {
            Text(event.emoji ?? (event.eventType == "moment" ? "📸" : "👋"))
                .font(.system(size: 28))

            VStack(alignment: .leading, spacing: 3) {
                Text(
                    event.eventType == "moment"
                    ? "Moment saved by a viewer"
                    : "Viewer reaction"
                )
                .font(.subheadline.bold())

                Text(event.label ?? "Someone is riding along with you.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(15)
        .background(Color.white.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 18))
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
                    Text("Discoverable at whatmod.com/ride while this ride is live.")
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
        LazyVGrid(
            columns: [GridItem(.flexible()), GridItem(.flexible())],
            spacing: 12
        ) {
            metric("SPEED", String(format: "%.1f", vm.location.speedMph), "MPH", "speedometer")
            metric("DISTANCE", String(format: "%.2f", vm.location.distanceMiles), "MI", "point.topleft.down.to.point.bottomright.curvepath")
            metric("ALTITUDE", String(format: "%.0f", vm.location.altitudeFt), "FT", "mountain.2.fill")
            metric("BATTERY", String(format: "%.0f", vm.location.batteryLevel * 100), "%", "battery.75percent")
            metric("HEADING", String(format: "%.0f", vm.location.heading), "°", "location.north.fill")
            metric("TIME", formattedTime(vm.elapsedSeconds), "", "timer")
            metric("AVG SPEED", String(format: "%.1f", vm.location.averageSpeedMph), "MPH", "gauge.with.dots.needle.33percent")
            metric("MAX SPEED", String(format: "%.1f", vm.location.maxSpeedMph), "MPH", "gauge.with.dots.needle.67percent")
            metric("MOVING", formattedTime(vm.location.movingSeconds), "", "figure.outdoor.cycle")
            metric("GPS", vm.location.gpsQuality.uppercased(), "", "location.fill")
        }
    }

    private func metric(
        _ title: String,
        _ value: String,
        _ suffix: String,
        _ icon: String
    ) -> some View {
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
                Button {
                    vm.copyViewerLink()
                } label: {
                    Label("Copy Viewer Link", systemImage: "link")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.bordered)

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
        Text("Set your stream controls while stopped. Secure your phone before moving.")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.vertical, 10)
    }

    private func formattedTime(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60

        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%02d:%02d", m, s)
    }
}
