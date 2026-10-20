import SwiftUI
import ARKit

// MARK: - Exterior Smart Scanner v3 · capture UI

struct ExteriorSmartScanView: View {
    let project: ProjectSummary
    let onSave: (WalkthroughScan, [ScannerLearningSample]) -> Void
    let onCancel: () -> Void

    @State private var controller = ExteriorSmartScanController()
    @State private var showingReview = false
    @State private var confirmCancel = false
    @State private var gallery: EvidenceGalleryItem?

    var body: some View {
        ZStack {
            ExteriorARView(controller: controller).ignoresSafeArea()
            overlayCanvas.allowsHitTesting(false).ignoresSafeArea()
            reticle.allowsHitTesting(false).ignoresSafeArea()
            VStack(spacing: 10) {
                topBar
                statusBar
                Spacer()
                if controller.phase == .walls { quickEstimate }
                bottomPanel
            }
            .padding()
        }
        .sheet(isPresented: $showingReview) {
            ExteriorScanReviewView(project: project, controller: controller, onSave: onSave)
        }
        .confirmationDialog("Discard this exterior scan?", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Discard scan", role: .destructive) { controller.discardUnsavedMedia(); controller.stop(); onCancel() }
            Button("Keep scanning", role: .cancel) {}
        }
        .fullScreenCover(item: $gallery) { EvidenceGalleryView(item: $0) }
        .onDisappear { controller.stop() }
    }

    // MARK: Layers

    private var overlayCanvas: some View {
        let shapes = controller.overlay
        return Canvas { context, _ in
            for s in shapes {
                let color = ExteriorScanPalette.color(for: s.style)
                if s.points.count == 1, let p = s.points.first {
                    let r: CGFloat = 7
                    context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)), with: .color(color))
                    if let l = s.label { context.draw(Text(l).font(.caption2.bold()).foregroundColor(.white), at: CGPoint(x: p.x, y: p.y - 16)) }
                } else if s.points.count >= 2 {
                    var path = Path()
                    path.addLines(s.points)
                    if s.closed {
                        path.closeSubpath()
                        context.fill(path, with: .color(color.opacity(0.14)))
                    }
                    let dash: [CGFloat] = s.style == .pending ? [6, 4] : []
                    context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 2.5, dash: dash))
                    if let l = s.label {
                        let cx = s.points.map { $0.x }.reduce(0, +) / CGFloat(s.points.count)
                        let cy = s.points.map { $0.y }.reduce(0, +) / CGFloat(s.points.count)
                        context.draw(Text(l).font(.caption2.bold()).foregroundColor(.white), at: CGPoint(x: cx, y: cy))
                    }
                }
            }
        }
    }

    private var reticle: some View {
        let color: Color = controller.reticleActive ? (controller.reticleEstimated ? .orange : .green) : .white
        return ZStack {
            Circle().stroke(color, lineWidth: 2).frame(width: 34, height: 34)
            Rectangle().fill(color).frame(width: 2, height: 12).offset(y: -23)
            Rectangle().fill(color).frame(width: 2, height: 12).offset(y: 23)
            Rectangle().fill(color).frame(width: 12, height: 2).offset(x: -23)
            Rectangle().fill(color).frame(width: 12, height: 2).offset(x: 23)
            Circle().fill(color).frame(width: 4, height: 4)
            Text(controller.reticleReadout)
                .font(.caption.bold()).foregroundStyle(.white)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(.black.opacity(0.62), in: Capsule())
                .offset(y: 56)
        }
    }

    // MARK: Chrome

    private var hasProgress: Bool { !controller.corners.isEmpty || !controller.walls.isEmpty }

    private var topBar: some View {
        HStack {
            Button("Cancel") { if hasProgress { confirmCancel = true } else { controller.stop(); onCancel() } }
                .buttonStyle(.bordered).tint(.white)
            Spacer()
            Text(controller.phase == .footprint ? "STEP 1 · FOOTPRINT" : "STEP 2 · MEASURE WALLS")
                .font(.caption.bold()).padding(.horizontal, 10).padding(.vertical, 7)
                .background(.black.opacity(0.55), in: Capsule()).foregroundStyle(.white)
            Spacer()
            Button("Review") { showingReview = true }
                .buttonStyle(.borderedProminent).disabled(controller.walls.isEmpty)
        }
    }

    private var statusBar: some View {
        VStack(spacing: 6) {
            Text(controller.status)
                .font(.caption).multilineTextAlignment(.center).foregroundStyle(.white)
                .padding(10).frame(maxWidth: .infinity)
                .background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 12))
            if !controller.trackingNormal {
                Label(controller.trackingQuality + ". Move slowly and keep texture in view.", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption2.bold()).foregroundStyle(.yellow)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(.black.opacity(0.6), in: Capsule())
            }
        }
    }

    private var quickEstimate: some View {
        let t = controller.takeoff
        return HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "%.0f sq ft paintable", t.netSquareFeet)).font(.subheadline.bold())
                Text(String(format: "%.0f ft perimeter · %d windows · %d doors", t.perimeterFeet, t.windowCount, t.entryDoorCount + t.garageDoorCount)).font(.caption2)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "%.1f labor hr", t.totalLaborHours)).font(.subheadline.bold())
                Text(controller.anyHeightAssumed ? "Ballpark · heights assumed" : "Heights measured").font(.caption2)
                    .foregroundStyle(controller.anyHeightAssumed ? .yellow : .green)
            }
        }
        .foregroundStyle(.white).padding(10)
        .background(.black.opacity(0.62), in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder private var bottomPanel: some View {
        if controller.phase == .footprint { footprintPanel } else { wallsPanel }
    }

    // MARK: Footprint panel

    private var footprintPanel: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Text("Stories").font(.caption.bold()).foregroundStyle(.white)
                ForEach(1...3, id: \.self) { n in
                    Button { controller.setStories(n) } label: {
                        Text("\(n)").font(.subheadline.bold()).frame(width: 40, height: 32)
                    }
                    .buttonStyle(.borderedProminent).tint(controller.inputs.stories == n ? .blue : .black.opacity(0.6))
                }
                Spacer()
                Text("\(controller.corners.count) corner\(controller.corners.count == 1 ? "" : "s")")
                    .font(.caption.bold()).foregroundStyle(.white)
            }
            HStack(spacing: 10) {
                Button { controller.undoCorner() } label: { Image(systemName: "arrow.uturn.backward").frame(width: 44, height: 44) }
                    .buttonStyle(.borderedProminent).tint(.black.opacity(0.65)).disabled(controller.corners.isEmpty)
                Button { controller.markCorner() } label: {
                    Text(controller.corners.isEmpty ? "Mark Corner 1" : "Mark Corner \(controller.corners.count + 1)")
                        .font(.headline).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent).tint(controller.reticleEstimated ? .orange : .green)
                Menu {
                    Text("Base of the corner hidden? Aim at the vertical corner edge anywhere you can see it.")
                    Button("Use wall surface at crosshair") { controller.markBlockedCorner(.wallSurface) }
                    Button("Square to previous wall (perspective)") { controller.markBlockedCorner(.square) }.disabled(controller.corners.count < 2)
                    Button("Straight along previous wall") { controller.markBlockedCorner(.straight) }.disabled(controller.corners.count < 2)
                    Button("Complete rectangle (auto 4th corner)") { controller.completeRectangle() }.disabled(controller.corners.count != 3)
                } label: { Text("Blocked").font(.subheadline.bold()).frame(width: 70, height: 44) }
                .buttonStyle(.borderedProminent).tint(.black.opacity(0.65))
                Menu {
                    Button("Close loop (back to Corner 1)") { controller.closeLoopManually() }.disabled(controller.corners.count < 3)
                    Button("Finish with open footprint") { controller.finishOpen() }.disabled(controller.corners.count < 2)
                } label: { Text("Finish").font(.subheadline.bold()).frame(width: 64, height: 44) }
                .buttonStyle(.borderedProminent).tint(.black.opacity(0.65)).disabled(controller.corners.count < 2)
            }
        }
        .padding(10).background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: Walls panel

    private var wallsPanel: some View {
        VStack(spacing: 10) {
            wallChips
            if !activeCandidates.isEmpty { candidateStrip }
            toolRow
            if controller.tool != .aim { primaryActionButton }
        }
        .padding(10).background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 16))
    }

    private var wallChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(controller.walls.enumerated()), id: \.element.id) { index, wall in
                    let isActive = controller.activeWallIndex == index
                    let pinned = controller.pinnedWallIndex == index
                    Button { controller.pinWall(index) } label: {
                        HStack(spacing: 5) {
                            if pinned { Image(systemName: "lock.fill") }
                            Text(wall.label).font(.caption.bold())
                            Image(systemName: wall.heightMeasured ? "checkmark.circle.fill" : "questionmark.circle")
                            if !wall.openings.isEmpty { Text("\(wall.openings.count)").font(.caption2) }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 7)
                    }
                    .buttonStyle(.borderedProminent).tint(isActive ? .blue : .black.opacity(0.6))
                }
            }
        }
    }

    private var activeCandidates: [ExteriorCandidate] {
        guard let idx = controller.activeWallIndex else { return [] }
        return controller.candidates.filter { $0.wallIndex == idx }
    }

    private var candidateStrip: some View {
        HStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(activeCandidates) { c in candidateChip(c) }
                }
            }
            Button("Accept likely") { controller.acceptLikely() }
                .font(.caption.bold()).buttonStyle(.borderedProminent).tint(.green)
        }
    }

    private func candidateChip(_ c: ExteriorCandidate) -> some View {
        Menu {
            ForEach(ExteriorOpeningClass.allCases, id: \.self) { kind in
                Button("Accept as \(kind.rawValue)") { controller.accept(c, as: kind) }
            }
            Button("Dismiss", role: .destructive) { controller.dismiss(c) }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: c.kind.icon)
                Text(String(format: "%@ %.1f×%.1f", c.kind.rawValue, c.widthFeet, c.heightFeet)).font(.caption.bold())
                Text("\(Int(c.confidence * 100))%").font(.caption2)
            }
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(.yellow.opacity(0.9), in: Capsule()).foregroundStyle(.black)
        } primaryAction: {
            controller.accept(c)
        }
    }

    private var toolRow: some View {
        HStack(spacing: 8) {
            toolButton("Height", icon: "arrow.up.and.down", tool: .height)
            toolButton("Gable", icon: "triangle", tool: .gable)
            toolButton("Opening", icon: "rectangle.dashed", tool: .opening)
            Menu {
                ForEach(ExteriorOpeningClass.allCases, id: \.self) { kind in
                    Button("Add \(kind.rawValue) (standard size)") { controller.quickAdd(kind) }
                }
                Button("Undo last opening", role: .destructive) { controller.undoLastOpening() }
            } label: { toolLabel("Quick add", icon: "plus.rectangle.on.rectangle", active: false) }
            Menu {
                Button("Photo · PAINT") { controller.capturePhoto(tag: .paint) }
                Button("Photo · COVER") { controller.capturePhoto(tag: .cover) }
                Button("Photo · DAMAGE") { controller.capturePhoto(tag: .damage) }
                Button("Photo · DO NOT DISTURB") { controller.capturePhoto(tag: .doNotDisturb) }
                Button("Photo · REMOVE") { controller.capturePhoto(tag: .remove) }
                if !controller.captures.isEmpty {
                    Button("View photos (\(controller.captures.count))") { gallery = controller.galleryItem }
                }
                Divider()
                Button(controller.pinnedWallIndex == nil ? "Lock current wall" : "Unlock wall") { controller.togglePin() }
                Button("Remove gable from wall", role: .destructive) { controller.removeGable() }
                Menu("Manual opening type") {
                    Button("Auto-classify") { controller.manualKind = nil }
                    ForEach(ExteriorOpeningClass.allCases, id: \.self) { kind in Button(kind.rawValue) { controller.manualKind = kind } }
                }
                Button("Re-mark footprint", role: .destructive) { controller.resetFootprint() }
            } label: { toolLabel("More", icon: "ellipsis.circle", active: false) }
        }
    }

    private func toolButton(_ title: String, icon: String, tool: ExteriorTool) -> some View {
        Button { controller.setTool(tool) } label: { toolLabel(title, icon: icon, active: controller.tool == tool) }
            .buttonStyle(.plain)
    }

    private func toolLabel(_ title: String, icon: String, active: Bool) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
            Text(title).font(.caption2)
        }
        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 8)
        .background(active ? Color.orange : Color.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
    }

    private var primaryActionButton: some View {
        var title = "Place"
        switch controller.tool {
        case .height: title = "Set Height"
        case .gable: title = "Set Apex"
        case .opening: title = controller.pendingOpeningCorner == nil ? "Corner 1" : "Corner 2"
        case .aim: break
        }
        return Button { controller.commitPrimaryAction() } label: {
            Text(title).font(.headline).frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.borderedProminent).tint(.green)
    }
}

enum ExteriorScanPalette {
    static func color(for style: ExteriorOverlayShape.Style) -> Color {
        switch style {
        case .footprint: return .cyan
        case .wall: return .white
        case .candidate: return .yellow
        case .accepted: return .green
        case .pending: return .orange
        }
    }
}

private struct ExteriorARView: UIViewRepresentable {
    let controller: ExteriorSmartScanController
    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView(frame: .zero)
        controller.configure(view)
        return view
    }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}

// MARK: - Review

private struct ExteriorScanReviewView: View {
    let project: ProjectSummary
    @Bindable var controller: ExteriorSmartScanController
    let onSave: (WalkthroughScan, [ScannerLearningSample]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = "Exterior"
    @State private var notes = ""
    @State private var gallery: EvidenceGalleryItem?

    private var take: ExteriorTakeoff { controller.takeoff }
    private var report: ExteriorConfidenceReport { ExteriorConfidence.evaluate(detail: controller.buildDetail()) }

    private var storiesBinding: Binding<Int> {
        Binding(get: { controller.inputs.stories }, set: { controller.setStories($0) })
    }

    var body: some View {
        NavigationStack {
            Form {
                confidenceSection
                profileSection
                takeoffSection
                ForEach($controller.walls) { $wall in
                    ExteriorWallEditorSection(wall: $wall)
                }
                Section("Evidence") {
                    Label("\(controller.captures.count) photo\(controller.captures.count == 1 ? "" : "s") attached", systemImage: "photo.on.rectangle")
                    if !controller.captures.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(Array(controller.captures.enumerated()), id: \.element.id) { i, capture in
                                    Button { gallery = EvidenceGalleryItem(captures: controller.captures, startIndex: i) } label: { EvidenceThumbnail(capture: capture) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    Text("3D model of the footprint, walls, gables and openings is generated on save.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Notes") {
                    TextField("Scan name", text: $name)
                    TextField("Access, prep, exclusions", text: $notes, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    Toggle("I verified these measurements on site", isOn: $controller.inputs.measurementsVerified)
                    Text("Quantities come from device geometry and are never guaranteed exact. Check anything flagged above before sending a proposal.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .fullScreenCover(item: $gallery) { EvidenceGalleryView(item: $0) }
            .navigationTitle("Review Exterior")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Back") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(controller.walls.isEmpty) }
            }
        }
    }

    private var confidenceSection: some View {
        Section("Scan confidence") {
            HStack {
                Text(report.label).font(.title3.bold()).foregroundStyle(report.label == "High" ? .green : (report.label == "Medium" ? .orange : .red))
                Spacer()
                Text("\(Int(report.score * 100))%").foregroundStyle(.secondary)
            }
            ForEach(report.reasons, id: \.self) { r in Text(r).font(.caption).foregroundStyle(.secondary) }
        }
    }

    private var profileSection: some View {
        Section("Job profile") {
            Stepper("Stories: \(controller.inputs.stories)", value: storiesBinding, in: 1...3)
            Picker("Surface", selection: $controller.inputs.surface) {
                ForEach(ExteriorSurface.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Condition", selection: $controller.inputs.condition) {
                ForEach(ExteriorCondition.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Application", selection: $controller.inputs.application) {
                ForEach(ExteriorApplication.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Stepper("Coats: \(controller.inputs.coats)", value: $controller.inputs.coats, in: 1...3)
            Picker("Openings", selection: $controller.inputs.deductPolicy) {
                ForEach(ExteriorDeductPolicy.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Toggle("Include trim, casing and fascia", isOn: $controller.inputs.includeTrim)
            HStack {
                Text("Base wall rate (sq ft / hr)")
                Spacer()
                TextField("150", value: $controller.inputs.baseWallRate, format: .number)
                    .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 80)
            }
            Text("Surface, condition, application and working height adjust this rate automatically. These are starting planning factors. Tune the base rate to your crew's real production.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    private var takeoffSection: some View {
        Section("Takeoff & labor") {
            LabeledContent("Perimeter", value: String(format: "%.0f ft", take.perimeterFeet))
            LabeledContent("Gross wall (incl. gables)", value: String(format: "%.0f sq ft", take.grossSquareFeet))
            if take.gableSquareFeet > 0 { LabeledContent("Gable area", value: String(format: "%.0f sq ft", take.gableSquareFeet)) }
            LabeledContent("Openings deducted", value: String(format: "- %.0f sq ft", take.deductedSquareFeet))
            LabeledContent("Net paintable", value: String(format: "%.0f sq ft", take.netSquareFeet)).font(.headline)
            LabeledContent("Walls labor", value: String(format: "%.1f hr @ %.0f sq ft/hr", take.wallLaborHours, take.effectiveWallRate))
            if take.trimHours > 0 { LabeledContent("Trim · \(Int(take.trimLinearFeet)) lin ft", value: String(format: "%.1f hr", take.trimHours)) }
            if take.doorHours > 0 { LabeledContent("Doors · \(take.entryDoorCount + take.garageDoorCount)", value: String(format: "%.1f hr", take.doorHours)) }
            if take.windowHours > 0 { LabeledContent("Windows · \(take.windowCount)", value: String(format: "%.1f hr", take.windowHours)) }
            LabeledContent("Total labor", value: String(format: "%.1f hr", take.totalLaborHours)).font(.headline)
            if let slope = take.maxSlopeDegrees { LabeledContent("Roof pitch (from gable)", value: String(format: "%.0f°", slope)) }
        }
    }

    private func save() {
        guard let result = controller.makeScan(projectID: project.id, name: name.isEmpty ? "Exterior" : name, notes: notes) else { return }
        onSave(result.scan, result.samples)
        dismiss()
    }
}

private struct ExteriorWallEditorSection: View {
    @Binding var wall: ExteriorWall

    var body: some View {
        Section {
            numberRow("Length (ft)", value: $wall.lengthFeet)
            numberRow(wall.heightMeasured ? "Eave height (ft)" : "Eave height (ft) · assumed", value: heightBinding)
            Toggle("Gable", isOn: gableToggle)
            if wall.gableRiseFeet != nil { numberRow("Gable rise (ft)", value: gableRiseBinding) }
            LabeledContent("Gross", value: String(format: "%.0f sq ft", wall.grossSquareFeet))
            ForEach($wall.openings) { $opening in
                ExteriorOpeningEditorRow(opening: $opening)
            }
            .onDelete { wall.openings.remove(atOffsets: $0) }
            Menu("Add opening") {
                ForEach(ExteriorOpeningClass.allCases, id: \.self) { kind in
                    Button(kind.rawValue) { addStandard(kind) }
                }
            }
        } header: {
            Text(wall.label)
        }
    }

    private var heightBinding: Binding<Double> {
        Binding(get: { wall.heightFeet }, set: { wall.heightFeet = $0; wall.heightMeasured = true })
    }

    private var gableToggle: Binding<Bool> {
        Binding(get: { wall.gableRiseFeet != nil }, set: { wall.gableRiseFeet = $0 ? max(2, wall.lengthFeet * 0.25) : nil })
    }

    private var gableRiseBinding: Binding<Double> {
        Binding(get: { wall.gableRiseFeet ?? 0 }, set: { wall.gableRiseFeet = $0 })
    }

    private func numberRow(_ title: String, value: Binding<Double>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", value: value, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
        }
    }

    private func addStandard(_ kind: ExteriorOpeningClass) {
        let size = ExteriorOpeningPriors.standardSize(for: kind)
        let centerU = wall.lengthFeet / 2
        let bottom: Double = kind == .window ? 3 : 0
        var o = ExteriorOpening(kind: kind, u0: centerU - size.w / 2, v0: bottom, u1: centerU + size.w / 2, v1: bottom + size.h, confidence: 0.4, source: "quick-add")
        o.assumedSize = true
        wall.openings.append(o)
    }
}

private struct ExteriorOpeningEditorRow: View {
    @Binding var opening: ExteriorOpening

    private var widthBinding: Binding<Double> {
        Binding(get: { opening.widthFeet }, set: { opening.setSize(width: max(0.1, $0), height: opening.heightFeet); opening.assumedSize = false })
    }
    private var heightBinding: Binding<Double> {
        Binding(get: { opening.heightFeet }, set: { opening.setSize(width: opening.widthFeet, height: max(0.1, $0)); opening.assumedSize = false })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Type", selection: $opening.kind) {
                ForEach(ExteriorOpeningClass.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            HStack {
                TextField("Width ft", value: widthBinding, format: .number).keyboardType(.decimalPad)
                Text("×")
                TextField("Height ft", value: heightBinding, format: .number).keyboardType(.decimalPad)
            }
            Toggle("Deduct from wall area", isOn: $opening.deduct)
            Text("\(opening.source) · confidence \(Int(opening.confidence * 100))%" + (opening.assumedSize ? " · standard size, not measured" : ""))
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}

/// Small tappable photo preview with its tag.
struct EvidenceThumbnail: View {
    let capture: TaggedCapture
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let data = try? Data(contentsOf: AppMediaStore.url(for: capture.imageFileName)), let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill().frame(width: 96, height: 72).clipped().clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                RoundedRectangle(cornerRadius: 10).fill(.quaternary).frame(width: 96, height: 72)
            }
            Label(capture.tag.rawValue, systemImage: capture.tag.icon).font(.caption2.bold()).lineLimit(1)
        }
    }
}
