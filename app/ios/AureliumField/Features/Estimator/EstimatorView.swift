import SwiftUI
import RoomPlan
import AVKit

struct EstimatorView: View {
    @Environment(AppModel.self) private var model
    @State private var projectSearch = ""
    @State private var showingScan = false

    private var matchingProjects: [ProjectSummary] {
        let q = projectSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        return model.projects.filter { $0.name.localizedCaseInsensitiveContains(q) || $0.client.localizedCaseInsensitiveContains(q) || $0.location.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                projectPicker

                VStack(alignment: .leading, spacing: 6) {
                    Text("AI-ASSISTED").font(.caption2.bold()).tracking(1.4).foregroundStyle(.secondary)
                    Text("Scan, narrate, tag, review.").font(.largeTitle.bold())
                    Text("RoomPlan measurements and your field evidence stay attached to the job from walkthrough through proposal.").foregroundStyle(.secondary)
                }

                if let project = model.selectedProject {
                    Button { showingScan = true } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "viewfinder").font(.title2).frame(width: 36)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Start Smart Walkthrough").font(.headline)
                                Text("Scan + narration + tagged photos + video").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer(); Image(systemName: "chevron.right").foregroundStyle(.secondary)
                        }
                        .padding(16).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Starts a walkthrough for \(project.name)")

                    walkthroughSection(project)
                } else {
                    ContentUnavailableView("Choose a project", systemImage: "briefcase", description: Text("Search for an existing job above or create one from Projects."))
                }
            }
            .padding()
        }
        .navigationTitle("Smart Estimate")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showingScan) {
            if let project = model.selectedProject {
                SmartScanExperience(project: project) { result in
                    model.addWalkthrough(result)
                    showingScan = false
                } onCancel: { showingScan = false }
            }
        }
    }

    private var projectPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WALKTHROUGH PROJECT").font(.caption2.bold()).tracking(1.2).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search every job, client, or address", text: $projectSearch)
                    .textInputAutocapitalization(.words)
                if !projectSearch.isEmpty { Button { projectSearch = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }.buttonStyle(.plain) }
            }
            .padding(.horizontal, 14).frame(height: 48).background(.quaternary, in: RoundedRectangle(cornerRadius: 14))

            if !matchingProjects.isEmpty {
                VStack(spacing: 0) {
                    ForEach(matchingProjects.prefix(6)) { project in
                        Button {
                            model.selectProject(project); projectSearch = ""
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) { Text(project.name).font(.headline); Text("\(project.client) · \(project.location)").font(.caption).foregroundStyle(.secondary) }
                                Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                            }.padding(12)
                        }.buttonStyle(.plain)
                        if project.id != matchingProjects.prefix(6).last?.id { Divider().padding(.leading, 12) }
                    }
                }.background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
            }

            if let selected = model.selectedProject {
                HStack(spacing: 12) {
                    Image(systemName: "briefcase.fill").frame(width: 36, height: 36).background(.primary.opacity(0.08), in: Circle())
                    VStack(alignment: .leading, spacing: 2) { Text(selected.name).font(.headline); Text("\(selected.client) · \(selected.location)").font(.caption).foregroundStyle(.secondary) }
                    Spacer(); Text("SELECTED").font(.caption2.bold()).foregroundStyle(.secondary)
                }.padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
            }
        }
    }

    @ViewBuilder private func walkthroughSection(_ project: ProjectSummary) -> some View {
        let scans = model.walkthroughs(for: project.id)
        VStack(alignment: .leading, spacing: 12) {
            HStack { Text("Walkthroughs").font(.title2.bold()); Spacer(); Text("\(scans.count)").foregroundStyle(.secondary) }
            if scans.isEmpty {
                ContentUnavailableView("No walkthroughs yet", systemImage: "video", description: Text("Start a Smart Walkthrough to build measurable job evidence."))
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
            } else {
                ForEach(scans) { scan in
                    NavigationLink { WalkthroughReviewView(walkthrough: scan) } label: {
                        HStack(spacing: 12) {
                            ZStack { RoundedRectangle(cornerRadius: 12).fill(.primary.opacity(0.08)); Image(systemName: scan.videoFileName == nil ? "cube.transparent" : "play.rectangle.fill").font(.title3) }.frame(width: 52, height: 52)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(scan.room.name).font(.headline)
                                Text(scan.createdAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                                Text("\(scan.captures.count) tagged captures · \(scan.room.wallCount) walls").font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }.padding(12).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }.buttonStyle(.plain)
                    .contextMenu { Button("Delete walkthrough", role: .destructive) { model.deleteWalkthrough(scan) } }
                }
            }
        }
    }
}

private struct SmartScanExperience: View {
    let project: ProjectSummary
    let onComplete: (WalkthroughScan) -> Void
    let onCancel: () -> Void

    @State private var controller = RoomScanController()
    @State private var speech = SpeechCaptureService()
    @State private var recorder = ScanRecordingService()
    @State private var captures: [TaggedCapture] = []
    @State private var completedRoom: CapturedRoom?
    @State private var errorMessage: String?
    @State private var isFinishing = false
    @State private var captureConfirmation: EvidenceTag?

    var body: some View {
        ZStack {
            RoomPlanCaptureView(controller: controller) { room in
                completedRoom = room
                Task { await finalize(room: room) }
            } onError: { errorMessage = $0 }
            .ignoresSafeArea()

            LinearGradient(colors: [.black.opacity(0.72), .clear, .black.opacity(0.78)], startPoint: .top, endPoint: .bottom).ignoresSafeArea().allowsHitTesting(false)

            VStack(spacing: 12) {
                topBar
                Spacer()
                if let tag = captureConfirmation {
                    Label("\(tag.rawValue) captured", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.bold()).padding(.horizontal, 14).padding(.vertical, 9).background(.black.opacity(0.78), in: Capsule()).foregroundStyle(.white).transition(.scale.combined(with: .opacity))
                }
                transcriptPanel
                evidenceButtons
            }
            .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 10)
        }
        .task {
            await recorder.start()
            if await speech.requestPermission() { try? speech.start() }
        }
        .alert("Walkthrough issue", isPresented: Binding(get: { errorMessage != nil || recorder.errorMessage != nil || speech.errorMessage != nil }, set: { if !$0 { errorMessage = nil; recorder.errorMessage = nil; speech.errorMessage = nil } })) {
            Button("OK", role: .cancel) { errorMessage = nil; recorder.errorMessage = nil; speech.errorMessage = nil }
        } message: { Text(errorMessage ?? recorder.errorMessage ?? speech.errorMessage ?? "Unknown error") }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button { speech.stop(); recorder.discard(); onCancel() } label: { Image(systemName: "xmark").font(.headline).frame(width: 42, height: 42).background(.black.opacity(0.76), in: Circle()).foregroundStyle(.white) }
            VStack(alignment: .leading, spacing: 1) {
                Text(project.name).font(.subheadline.bold()).lineLimit(1)
                Text("SMART WALKTHROUGH · \(captures.count) TAGS").font(.caption2.bold()).opacity(0.76)
            }.foregroundStyle(.white)
            Spacer()
            Button {
                Task {
                    if speech.isRecording { speech.stop() }
                    else if await speech.requestPermission() { try? speech.start() }
                }
            } label: {
                Label(speech.isRecording ? "Narrating" : "Mic off", systemImage: speech.isRecording ? "waveform" : "mic.slash.fill")
                    .font(.caption.bold()).padding(.horizontal, 11).frame(height: 42).background(.black.opacity(0.76), in: Capsule()).foregroundStyle(.white)
            }
            Button { isFinishing = true; speech.stop(); controller.finish() } label: {
                Text(isFinishing ? "Saving…" : "Finish").font(.subheadline.bold()).padding(.horizontal, 15).frame(height: 42).background(.white, in: Capsule()).foregroundStyle(.black)
            }.disabled(isFinishing)
        }
    }

    private var transcriptPanel: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack { Label("Live narration", systemImage: "quote.bubble.fill").font(.caption.bold()); Spacer(); Circle().fill(speech.isRecording ? .red : .gray).frame(width: 7, height: 7) }
            Text(speech.transcript.isEmpty ? "Narrate what you see: prep, damage, furniture to move, access concerns, coatings, exclusions…" : speech.transcript)
                .font(.caption).lineLimit(3).frame(maxWidth: .infinity, alignment: .leading).opacity(speech.transcript.isEmpty ? 0.72 : 1)
        }.padding(12).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
    }

    private var evidenceButtons: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(EvidenceTag.allCases, id: \.self) { tag in
                    Button { capture(tag) } label: {
                        VStack(spacing: 5) { Image(systemName: tag.icon).font(.headline); Text(tag.rawValue).font(.caption2.bold()).lineLimit(1).minimumScaleFactor(0.75) }
                            .frame(minWidth: tag == .doNotDisturb ? 116 : 82, minHeight: 54).padding(.horizontal, 8).background(.black.opacity(0.84), in: RoundedRectangle(cornerRadius: 13)).foregroundStyle(.white).overlay(RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.24)))
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private func capture(_ tag: EvidenceTag) {
        guard let image = controller.snapshot(), let data = image.jpegData(compressionQuality: 0.82) else {
            errorMessage = "The camera frame was not ready. Keep scanning and try the tag again."
            return
        }
        let fileName = "capture-\(UUID().uuidString).jpg"
        do {
            try data.write(to: AppMediaStore.url(for: fileName), options: .atomic)
            captures.append(.init(id: UUID(), tag: tag, capturedAt: .now, imageFileName: fileName, note: nil))
            withAnimation { captureConfirmation = tag }
            Task { try? await Task.sleep(for: .seconds(1.1)); await MainActor.run { withAnimation { captureConfirmation = nil } } }
        } catch { errorMessage = error.localizedDescription }
    }

    private func finalize(room: CapturedRoom) async {
        let recording = await recorder.stop()
        let summary = CapturedRoomSummary(id: UUID(), name: "Scan \(Date().formatted(date: .omitted, time: .shortened))", wallCount: room.walls.count, doorCount: room.doors.count, windowCount: room.windows.count, source: .roomPlan, verificationRequired: true)
        let result = WalkthroughScan(id: UUID(), projectID: project.id, createdAt: .now, room: summary, transcript: speech.transcript, captures: captures, videoFileName: recording.fileName, durationSeconds: recording.duration)
        onComplete(result)
    }
}

private struct WalkthroughReviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let walkthrough: WalkthroughScan
    @State private var deleting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let fileName = walkthrough.videoFileName {
                    let url = AppMediaStore.url(for: fileName)
                    VideoPlayer(player: AVPlayer(url: url)).frame(height: 260).clipShape(RoundedRectangle(cornerRadius: 18))
                } else {
                    ContentUnavailableView("Video unavailable", systemImage: "video.slash", description: Text("The spatial scan data is still available below."))
                        .frame(height: 220).background(.quaternary, in: RoundedRectangle(cornerRadius: 18))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(walkthrough.room.name).font(.title2.bold())
                    Text(walkthrough.createdAt.formatted(date: .long, time: .shortened)).foregroundStyle(.secondary)
                    HStack { metric("Walls", walkthrough.room.wallCount); metric("Windows", walkthrough.room.windowCount); metric("Doors", walkthrough.room.doorCount); metric("Tags", walkthrough.captures.count) }
                }

                if !walkthrough.transcript.isEmpty {
                    VStack(alignment: .leading, spacing: 8) { Label("Narration", systemImage: "waveform").font(.headline); Text(walkthrough.transcript).textSelection(.enabled) }
                }

                if !walkthrough.captures.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Tagged evidence").font(.headline)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 10)], spacing: 10) {
                            ForEach(walkthrough.captures) { capture in
                                VStack(alignment: .leading, spacing: 7) {
                                    if let data = try? Data(contentsOf: AppMediaStore.url(for: capture.imageFileName)), let uiImage = UIImage(data: data) {
                                        Image(uiImage: uiImage).resizable().scaledToFill().frame(height: 120).clipped().clipShape(RoundedRectangle(cornerRadius: 12))
                                    }
                                    Label(capture.tag.rawValue, systemImage: capture.tag.icon).font(.caption.bold())
                                }.padding(8).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                            }
                        }
                    }
                }

                Button("Delete walkthrough", role: .destructive) { deleting = true }.frame(maxWidth: .infinity)
            }.padding()
        }
        .navigationTitle("Scan Review")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete this walkthrough?", isPresented: $deleting, titleVisibility: .visible) {
            Button("Delete Walkthrough", role: .destructive) { model.deleteWalkthrough(walkthrough); dismiss() }
        } message: { Text("Its local scan video and tagged photos will also be removed.") }
    }

    private func metric(_ title: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) { Text("\(value)").font(.headline); Text(title).font(.caption2).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}
