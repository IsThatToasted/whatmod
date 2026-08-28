import SwiftUI
import RoomPlan
import AVKit
import QuickLook

struct EstimatorView: View {
    @Environment(AppModel.self) private var model
    @State private var projectSearch = ""
    @State private var showingScan = false
    @State private var showingCompleteConfirmation = false
    @State private var showingProposal = false

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
                    Text("Spatial measurements and your field evidence stay attached to the job from walkthrough through proposal.").foregroundStyle(.secondary)
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
                    if !model.walkthroughs(for: project.id).isEmpty { walkthroughCompletionCard(project) }
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
                SmartScanExperience(project: project, suggestedRoomName: "Room \(model.walkthroughs(for: project.id).count + 1)") { result in
                    model.addWalkthrough(result)
                    showingScan = false
                } onCancel: { showingScan = false }
            }
        }
        .confirmationDialog("Walkthrough Complete?", isPresented: $showingCompleteConfirmation, titleVisibility: .visible) {
            Button("Walkthrough Complete") { if let project=model.selectedProject { model.completeWalkthroughSet(for:project.id); showingProposal=true } }
            Button("Cancel", role:.cancel) {}
        } message: {
            if let project=model.selectedProject { Text("This archives all \(model.walkthroughs(for:project.id).count) room walkthroughs for \(project.name) and opens the combined estimate/proposal draft.") }
        }
        .sheet(isPresented:$showingProposal) { if let project=model.selectedProject { ProposalDraftView(project:project) } }
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

    private func walkthroughCompletionCard(_ project:ProjectSummary) -> some View {
        let scans=model.walkthroughs(for:project.id); let archived=scans.filter{$0.archivedAt != nil}.count
        return VStack(alignment:.leading,spacing:12){
            HStack{VStack(alignment:.leading,spacing:3){Text("READY TO WRAP UP?").font(.caption2.bold()).tracking(1.1).foregroundStyle(.secondary);Text("Complete the project walkthrough").font(.headline)};Spacer();Text("\(archived)/\(scans.count) archived").font(.caption).foregroundStyle(.secondary)}
            Text("Use this after every room you need has been scanned and reviewed. Aurelium will archive the walkthrough set and assemble the room estimates into a proposal draft.").font(.subheadline).foregroundStyle(.secondary)
            Button{showingCompleteConfirmation=true}label:{Label("Walkthrough Complete",systemImage:"checkmark.seal.fill").font(.headline).frame(maxWidth:.infinity)}.buttonStyle(.borderedProminent).controlSize(.large).tint(.primary)
        }.padding(16).background(.thinMaterial,in:RoundedRectangle(cornerRadius:18))
    }
}

private struct SmartScanExperience: View {
    let project: ProjectSummary
    let suggestedRoomName: String
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
    @State private var pendingWalkthrough: WalkthroughScan?
    @State private var showingEstimateConfirm = false

    var body: some View {
        ZStack {
            RoomPlanCaptureView(controller: controller) { room in
                completedRoom = room
                Task { await finalize(room: room) }
            } onError: { _ in errorMessage = AFPublicError.text(.walkthroughCapture, "We couldn't continue the spatial scan.") }
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
            await recorder.start(controller: controller)
            if await speech.requestPermission() { try? speech.start() }
        }
        .sheet(isPresented: $showingEstimateConfirm) {
            if let pendingWalkthrough {
                PostScanEstimateView(walkthrough: pendingWalkthrough) { finished in
                    onComplete(finished)
                } onDiscard: {
                    if let video = pendingWalkthrough.videoFileName { try? FileManager.default.removeItem(at: AppMediaStore.url(for: video)) }
                    if let model = pendingWalkthrough.usdzFileName { try? FileManager.default.removeItem(at: AppMediaStore.url(for: model)) }
                    if let json = pendingWalkthrough.roomPlanJSONFileName { try? FileManager.default.removeItem(at: AppMediaStore.url(for: json)) }
                    captures.forEach { try? FileManager.default.removeItem(at: AppMediaStore.url(for: $0.imageFileName)) }
                    onCancel()
                }
            }
        }
        .alert("Walkthrough issue", isPresented: Binding(get: { errorMessage != nil || speech.errorMessage != nil }, set: { if !$0 { errorMessage = nil; speech.errorMessage = nil } })) {
            Button("OK", role: .cancel) { errorMessage = nil; speech.errorMessage = nil }
        } message: { Text(errorMessage ?? speech.errorMessage ?? AFPublicError.text(.unknown)) }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button { speech.stop(); recorder.discard(); onCancel() } label: { Image(systemName: "xmark").font(.headline).frame(width: 42, height: 42).background(.black.opacity(0.76), in: Circle()).foregroundStyle(.white) }
            VStack(alignment: .leading, spacing: 1) {
                Text(project.name).font(.subheadline.bold()).lineLimit(1)
                Text("SMART WALKTHROUGH · \(captures.count) TAGS").font(.caption2.bold()).opacity(0.76)
                if let warning = recorder.errorMessage {
                    Text("VIDEO OPTIONAL · UNAVAILABLE").font(.caption2.bold()).foregroundStyle(.yellow)
                        .accessibilityLabel(warning)
                } else {
                    Text(recorder.statusText.uppercased()).font(.caption2.bold()).opacity(0.7)
                }
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
            errorMessage = AFPublicError.text(.evidenceCapture, "The camera frame was not ready. Keep scanning and try the tag again.")
            return
        }
        let fileName = "capture-\(UUID().uuidString).jpg"
        do {
            try data.write(to: AppMediaStore.url(for: fileName), options: .atomic)
            captures.append(.init(id: UUID(), tag: tag, capturedAt: .now, imageFileName: fileName, note: nil))
            withAnimation { captureConfirmation = tag }
            Task { try? await Task.sleep(for: .seconds(1.1)); await MainActor.run { withAnimation { captureConfirmation = nil } } }
        } catch { AFPublicError.capture(error, code: .evidenceCapture); errorMessage = AFPublicError.text(.evidenceCapture, "We couldn't save that tagged photo.") }
    }

    private func finalize(room: CapturedRoom) async {
        let recording = await recorder.stop()
        let scanID = UUID()
        let summary = CapturedRoomSummary(id: UUID(), name: suggestedRoomName, wallCount: room.walls.count, doorCount: room.doors.count, windowCount: room.windows.count, source: .roomPlan, verificationRequired: true)

        let feetPerMeter = 3.280839895
        let sqftPerSquareMeter = 10.763910417
        let measuredWalls = room.walls.map { wall in
            MeasuredWall(id: wall.identifier, lengthFeet: Double(wall.dimensions.x) * feetPerMeter, heightFeet: Double(wall.dimensions.y) * feetPerMeter, grossSquareFeet: Double(wall.dimensions.x * wall.dimensions.y) * sqftPerSquareMeter)
        }
        let wallLinear = measuredWalls.reduce(0.0) { $0 + $1.lengthFeet }
        let heights = measuredWalls.map { $0.heightFeet }
        let averageHeight = heights.isEmpty ? 0 : heights.reduce(0,+) / Double(heights.count)
        let grossWall = room.walls.reduce(0.0) { $0 + Double($1.dimensions.x * $1.dimensions.y) * sqftPerSquareMeter }
        let openings = (room.windows + room.doors).reduce(0.0) { $0 + Double($1.dimensions.x * $1.dimensions.y) * sqftPerSquareMeter }
        let ceilingArea = room.floors.reduce(0.0) { $0 + Double($1.dimensions.x * $1.dimensions.y) * sqftPerSquareMeter }
        let doorCasing = room.doors.reduce(0.0) { total, door in
            let width = Double(door.dimensions.x) * feetPerMeter
            let height = Double(door.dimensions.y) * feetPerMeter
            return total + width + (2 * height) // one face of casing: head + two legs
        }
        let windowCasing = room.windows.reduce(0.0) { total, window in
            let width = Double(window.dimensions.x) * feetPerMeter
            let height = Double(window.dimensions.y) * feetPerMeter
            return total + (2 * width) + (2 * height)
        }
        let trimLength = wallLinear + doorCasing + windowCasing // base + detected opening casing starting point
        let measurements = RoomMeasurementSummary(
            wallLinearFeet: wallLinear,
            averageWallHeightFeet: averageHeight,
            grossWallSquareFeet: grossWall,
            openingsSquareFeet: openings,
            paintableWallSquareFeet: max(0, grossWall - openings),
            ceilingSquareFeet: ceilingArea > 0 ? ceilingArea : nil,
            detectedDoorCount: room.doors.count,
            detectedWindowCount: room.windows.count,
            estimatedTrimLinearFeet: trimLength
        )

        var usdzName: String?
        var jsonName: String?
        do {
            let modelName = "room-\(scanID.uuidString).usdz"
            let modelURL = AppMediaStore.url(for: modelName)
            try room.export(to: modelURL, exportOptions: .mesh)
            usdzName = modelName

            let encoded = try JSONEncoder().encode(room)
            let capturedJSON = "room-\(scanID.uuidString).json"
            try encoded.write(to: AppMediaStore.url(for: capturedJSON), options: .atomic)
            jsonName = capturedJSON
        } catch {
            AFPublicError.capture(error, code: .modelExport); errorMessage = AFPublicError.text(.modelExport, "Measurements were saved, but the 3D room model could not be stored.")
        }

        pendingWalkthrough = WalkthroughScan(id: scanID, projectID: project.id, createdAt: .now, room: summary, transcript: speech.transcript, captures: captures, videoFileName: recording.fileName, durationSeconds: recording.duration, usdzFileName: usdzName, roomPlanJSONFileName: jsonName, measurements: measurements, autoEstimate: nil, measuredWalls: measuredWalls)
        showingEstimateConfirm = true
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

                if let modelFile = walkthrough.usdzFileName {
                    NavigationLink { RoomModelPreview(url: AppMediaStore.url(for: modelFile)) } label: {
                        Label("Open saved 3D room model", systemImage: "cube.transparent.fill")
                            .font(.headline).frame(maxWidth: .infinity, alignment: .leading).padding(14)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }.buttonStyle(.plain)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(walkthrough.room.name).font(.title2.bold())
                    Text(walkthrough.createdAt.formatted(date: .long, time: .shortened)).foregroundStyle(.secondary)
                    HStack { metric("Walls", walkthrough.room.wallCount); metric("Windows", walkthrough.room.windowCount); metric("Doors", walkthrough.room.doorCount); metric("Tags", walkthrough.captures.count) }
                }

                if let measurements = walkthrough.measurements {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Measured scope").font(.headline)
                        LabeledContent("Wall length", value: String(format: "%.1f ft", measurements.wallLinearFeet))
                        LabeledContent("Average height", value: String(format: "%.1f ft", measurements.averageWallHeightFeet))
                        LabeledContent("Gross wall area", value: String(format: "%.0f sq ft", measurements.grossWallSquareFeet))
                        LabeledContent("Doors + windows", value: String(format: "− %.0f sq ft", measurements.openingsSquareFeet))
                        LabeledContent("Paintable walls", value: String(format: "%.0f sq ft", measurements.paintableWallSquareFeet))
                        if let walls = walkthrough.measuredWalls {
                            ForEach(Array(walls.enumerated()), id: \.element.id) { index, wall in
                                LabeledContent("Wall \(index + 1)", value: String(format: "%.1f × %.1f ft", wall.lengthFeet, wall.heightFeet))
                            }
                        }
                        if let estimate = walkthrough.autoEstimate {
                            Divider()
                            if let lines = estimate.scopeLines {
                                ForEach(lines.filter(\.enabled)) { line in
                                    LabeledContent(line.kind.rawValue, value: String(format: "%.1f hr", line.laborHours))
                                }
                            } else {
                                LabeledContent("Production rate", value: String(format: "%.0f sq ft/hr", estimate.productionSquareFeetPerHour))
                            }
                            LabeledContent("Estimated labor", value: String(format: "%.1f hr", estimate.totalLaborHours ?? estimate.laborHours))
                        }
                    }.padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
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


private struct PostScanEstimateView: View {
    let walkthrough: WalkthroughScan
    let onSave: (WalkthroughScan) -> Void
    let onDiscard: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var confirmed = false
    @State private var roomName: String
    @State private var wallRate = "150"
    @State private var paintDoors = false
    @State private var paintWindows = false
    @State private var paintTrim = false
    @State private var paintCeiling = false
    @State private var doorQuantity: String
    @State private var doorRate = "2"
    @State private var windowQuantity: String
    @State private var windowRate = "2"
    @State private var trimQuantity: String
    @State private var trimRate = "50"
    @State private var ceilingQuantity: String
    @State private var ceilingRate = "125"

    init(walkthrough: WalkthroughScan, onSave: @escaping (WalkthroughScan) -> Void, onDiscard: @escaping () -> Void) {
        self.walkthrough = walkthrough
        self.onSave = onSave
        self.onDiscard = onDiscard
        let m = walkthrough.measurements
        _roomName = State(initialValue: walkthrough.room.name)
        _doorQuantity = State(initialValue: String(m?.detectedDoorCount ?? walkthrough.room.doorCount))
        _windowQuantity = State(initialValue: String(m?.detectedWindowCount ?? walkthrough.room.windowCount))
        _trimQuantity = State(initialValue: String(format: "%.1f", m?.estimatedTrimLinearFeet ?? m?.wallLinearFeet ?? 0))
        _ceilingQuantity = State(initialValue: String(format: "%.0f", m?.ceilingSquareFeet ?? 0))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Room scan complete").font(.title2.bold())
                    Text("Confirm the detected measurements, then choose exactly what is being painted. Checked scopes expand so their quantity and production rate can be corrected before the estimate is created.").foregroundStyle(.secondary)
                }

                Section("Room name") {
                    TextField("e.g. Living Room, Bedroom 2, Main Hall", text:$roomName).textInputAutocapitalization(.words)
                    Text("This name follows the scan, 3D model, tagged evidence, estimate lines, and proposal so the next person knows exactly which room they are reviewing.").font(.caption).foregroundStyle(.secondary)
                }

                if let m = walkthrough.measurements {
                    Section("Measured room") {
                        LabeledContent("Wall length", value: String(format: "%.1f ft", m.wallLinearFeet))
                        LabeledContent("Average wall height", value: String(format: "%.1f ft", m.averageWallHeightFeet))
                        LabeledContent("Paintable wall area", value: String(format: "%.0f sq ft", m.paintableWallSquareFeet))
                        if let ceiling = m.ceilingSquareFeet { LabeledContent("Ceiling footprint", value: String(format: "%.0f sq ft", ceiling)) }
                        LabeledContent("Detected doors", value: "\(m.detectedDoorCount ?? walkthrough.room.doorCount)")
                        LabeledContent("Detected windows", value: "\(m.detectedWindowCount ?? walkthrough.room.windowCount)")
                    }
                }

                Section("Paint walls") {
                    Label("Included", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                    if let area = walkthrough.measurements?.paintableWallSquareFeet { LabeledContent("Quantity", value: String(format: "%.0f sq ft", area)) }
                    rateField("Production rate", text: $wallRate, suffix: "sq ft/hr")
                    if let hours = wallHours { LabeledContent("Wall labor", value: String(format: "%.1f hr", hours)) }
                }

                scopeSection(title: "Paint Doors", isOn: $paintDoors, icon: "door.left.hand.open") {
                    quantityRateFields(quantity: $doorQuantity, quantitySuffix: "doors", rate: $doorRate, rateSuffix: "doors/hr", labor: doorHours)
                }

                scopeSection(title: "Paint Windows", isOn: $paintWindows, icon: "window.vertical.closed") {
                    quantityRateFields(quantity: $windowQuantity, quantitySuffix: "windows", rate: $windowRate, rateSuffix: "windows/hr", labor: windowHours)
                }

                scopeSection(title: "Paint Trim", isOn: $paintTrim, icon: "ruler") {
                    Text("Starts with detected wall perimeter (base) plus one face of detected door/window casing. Correct it here for crown, omitted casing, closets, or unusual trim.")
                        .font(.caption).foregroundStyle(.secondary)
                    quantityRateFields(quantity: $trimQuantity, quantitySuffix: "linear ft", rate: $trimRate, rateSuffix: "linear ft/hr", labor: trimHours)
                }

                scopeSection(title: "Paint Ceiling", isOn: $paintCeiling, icon: "rectangle.topthird.inset.filled") {
                    Text("Ceiling area starts from the spatial scan's detected floor footprint for the room. Adjust if the ceiling is vaulted, tray-shaped, or otherwise non-planar.")
                        .font(.caption).foregroundStyle(.secondary)
                    quantityRateFields(quantity: $ceilingQuantity, quantitySuffix: "sq ft", rate: $ceilingRate, rateSuffix: "sq ft/hr", labor: ceilingHours)
                }

                Section("Verification") {
                    Toggle("Measurements are reasonably accurate", isOn: $confirmed)
                    LabeledContent("Estimated room labor", value: String(format: "%.1f hours", totalHours))
                        .font(.headline)
                    Text("This is a production estimate, not a final price. Prep, coats, materials, labor cost, overhead and profit can be refined in the estimate editor.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Create room estimate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Discard", role: .destructive) { dismiss(); onDiscard() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create Estimate") { createEstimate() }
                        .disabled(!confirmed || !ratesAreValid || roomName.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
                }
            }
        }.interactiveDismissDisabled()
    }

    @ViewBuilder
    private func scopeSection<Content: View>(title: String, isOn: Binding<Bool>, icon: String, @ViewBuilder content: () -> Content) -> some View {
        Section {
            Toggle(isOn: isOn) { Label(title, systemImage: icon).font(.headline) }
            if isOn.wrappedValue { content() }
        }
    }

    @ViewBuilder
    private func quantityRateFields(quantity: Binding<String>, quantitySuffix: String, rate: Binding<String>, rateSuffix: String, labor: Double?) -> some View {
        rateField("Quantity", text: quantity, suffix: quantitySuffix)
        rateField("Production rate", text: rate, suffix: rateSuffix)
        if let labor { LabeledContent("Estimated labor", value: String(format: "%.1f hr", labor)) }
    }

    private func rateField(_ label: String, text: Binding<String>, suffix: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            TextField("0", text: text).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 78)
            Text(suffix).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var wallHours: Double? { hours(quantity: walkthrough.measurements?.paintableWallSquareFeet, rate: Double(wallRate)) }
    private var doorHours: Double? { paintDoors ? hours(quantity: Double(doorQuantity), rate: Double(doorRate)) : nil }
    private var windowHours: Double? { paintWindows ? hours(quantity: Double(windowQuantity), rate: Double(windowRate)) : nil }
    private var trimHours: Double? { paintTrim ? hours(quantity: Double(trimQuantity), rate: Double(trimRate)) : nil }
    private var ceilingHours: Double? { paintCeiling ? hours(quantity: Double(ceilingQuantity), rate: Double(ceilingRate)) : nil }
    private var totalHours: Double { [wallHours, doorHours, windowHours, trimHours, ceilingHours].compactMap { $0 }.reduce(0,+) }

    private var ratesAreValid: Bool {
        guard (Double(wallRate) ?? 0) > 0 else { return false }
        if paintDoors && !validPair(doorQuantity, doorRate) { return false }
        if paintWindows && !validPair(windowQuantity, windowRate) { return false }
        if paintTrim && !validPair(trimQuantity, trimRate) { return false }
        if paintCeiling && !validPair(ceilingQuantity, ceilingRate) { return false }
        return true
    }

    private func validPair(_ quantity: String, _ rate: String) -> Bool { (Double(quantity) ?? -1) >= 0 && (Double(rate) ?? 0) > 0 }
    private func hours(quantity: Double?, rate: Double?) -> Double? {
        guard let quantity, let rate, quantity >= 0, rate > 0 else { return nil }
        return quantity / rate
    }

    private func createEstimate() {
        guard let wallRateValue = Double(wallRate), let wallQty = walkthrough.measurements?.paintableWallSquareFeet, let wallLabor = wallHours else { return }
        var lines: [ScopeEstimateLine] = [
            .init(kind: .walls, enabled: true, quantity: wallQty, unit: "sqft", productionRate: wallRateValue, laborHours: wallLabor)
        ]
        func add(_ kind: EstimateScopeKind, enabled: Bool, quantity: String, unit: String, rate: String, labor: Double?) {
            guard enabled, let q = Double(quantity), let r = Double(rate), let labor else { return }
            lines.append(.init(kind: kind, enabled: true, quantity: q, unit: unit, productionRate: r, laborHours: labor))
        }
        add(.doors, enabled: paintDoors, quantity: doorQuantity, unit: "each", rate: doorRate, labor: doorHours)
        add(.windows, enabled: paintWindows, quantity: windowQuantity, unit: "each", rate: windowRate, labor: windowHours)
        add(.trim, enabled: paintTrim, quantity: trimQuantity, unit: "lf", rate: trimRate, labor: trimHours)
        add(.ceiling, enabled: paintCeiling, quantity: ceilingQuantity, unit: "sqft", rate: ceilingRate, labor: ceilingHours)

        var updated = walkthrough
        updated.room.name = roomName.trimmingCharacters(in:.whitespacesAndNewlines)
        updated.room.verificationRequired = !confirmed
        updated.autoEstimate = AutoEstimateResult(
            productionSquareFeetPerHour: wallRateValue,
            laborHours: wallLabor,
            measurementsConfirmed: confirmed,
            scopeLines: lines,
            totalLaborHours: lines.reduce(0) { $0 + $1.laborHours }
        )
        dismiss(); onSave(updated)
    }
}

private struct ProposalDraftView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let project:ProjectSummary
    private var scans:[WalkthroughScan]{model.walkthroughs(for:project.id)}
    private var totalLabor:Double{scans.compactMap{$0.autoEstimate?.totalLaborHours ?? $0.autoEstimate?.laborHours}.reduce(0,+)}
    private var evidenceCount:Int{scans.reduce(0){$0+$1.captures.count}}
    private var scopeTotals:[(EstimateScopeKind,Double,String,Double)]{var totals:[EstimateScopeKind:(Double,String,Double)]=[:];for scan in scans{for line in scan.autoEstimate?.scopeLines?.filter(\.enabled) ?? []{let c=totals[line.kind] ?? (0,line.unit,0);totals[line.kind]=(c.0+line.quantity,line.unit,c.2+line.laborHours)}};return EstimateScopeKind.allCases.compactMap{kind in guard let v=totals[kind] else{return nil};return(kind,v.0,v.1,v.2)}}
    var body:some View{NavigationStack{List{
        Section{VStack(alignment:.leading,spacing:7){Text("WALKTHROUGH COMPLETE").font(.caption2.bold()).tracking(1.2).foregroundStyle(.secondary);Text("\(project.name) Proposal Draft").font(.title2.bold());Text("All captured rooms are archived and the measured painting scope is assembled below. Pricing, materials, coats, prep, overhead and profit can be layered onto this production draft next.").foregroundStyle(.secondary)}.padding(.vertical,6)}
        Section("Project summary"){LabeledContent("Client",value:project.client.isEmpty ? "Not assigned":project.client);LabeledContent("Location",value:project.location.isEmpty ? "Not assigned":project.location);LabeledContent("Rooms",value:"\(scans.count)");LabeledContent("Tagged evidence",value:"\(evidenceCount)");LabeledContent("Production labor",value:String(format:"%.1f hr",totalLabor)).font(.headline)}
        if !scopeTotals.isEmpty{Section("Combined measured scope"){ForEach(scopeTotals,id:\.0){kind,quantity,unit,labor in VStack(alignment:.leading,spacing:4){HStack{Text(kind.rawValue).font(.headline);Spacer();Text(String(format:"%.1f hr",labor)).foregroundStyle(.secondary)};Text("\(formatQuantity(quantity)) \(unit)").font(.caption).foregroundStyle(.secondary)}.padding(.vertical,4)}}}
        Section("Rooms"){ForEach(scans){scan in VStack(alignment:.leading,spacing:6){HStack{Text(scan.room.name).font(.headline);Spacer();Label("Archived",systemImage:"archivebox.fill").font(.caption2.bold()).foregroundStyle(.secondary)};if let m=scan.measurements{Text(String(format:"%.0f sq ft paintable walls · %.1f ft avg height",m.paintableWallSquareFeet,m.averageWallHeightFeet)).font(.caption).foregroundStyle(.secondary)};if let auto=scan.autoEstimate{Text(String(format:"%.1f labor hours",auto.totalLaborHours ?? auto.laborHours)).font(.caption).foregroundStyle(.secondary)}else{Text("Measurements captured · estimate confirmation pending").font(.caption).foregroundStyle(.orange)}}.padding(.vertical,5)}}
        if scans.contains(where:{!$0.transcript.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}){Section("Walkthrough notes"){ForEach(scans.filter{!$0.transcript.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty}){scan in VStack(alignment:.leading,spacing:4){Text(scan.room.name).font(.headline);Text(scan.transcript).font(.subheadline).foregroundStyle(.secondary)}.padding(.vertical,4)}}}
        Section{Label("Production draft saved",systemImage:"checkmark.seal.fill").foregroundStyle(.green);Text("The walkthrough archive is complete. This proposal remains a draft until pricing and final scope are reviewed.").font(.caption).foregroundStyle(.secondary)}
    }.navigationTitle("Estimate / Proposal").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.confirmationAction){Button("Done"){dismiss()}}}}}
    private func formatQuantity(_ value:Double)->String{value.rounded()==value ? String(Int(value)):String(format:"%.1f",value)}
}

private struct RoomModelPreview: UIViewControllerRepresentable {
    let url: URL
    func makeCoordinator() -> Coordinator { Coordinator(url: url) }
    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController(); controller.dataSource = context.coordinator; return controller
    }
    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}
    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL; init(url: URL) { self.url = url }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { url as NSURL }
    }
}
