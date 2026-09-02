import SwiftUI
import ARKit

struct SmartScannerV2View: View {
    let project: ProjectSummary
    let roomCount: Int
    let onInterior: () -> Void
    let onExterior: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 8) {
                Image(systemName: "viewfinder.circle.fill").font(.system(size: 48))
                Text("Smart Scanner").font(.largeTitle.bold())
                Text("One walkthrough experience, with a capture engine optimized for where you're working.")
                    .multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .padding(.top, 24)

            modeCard(title: "Interior", subtitle: "RoomPlan + LiDAR · walls, doors, windows, ceiling and trim", icon: "house.fill", action: onInterior)
            modeCard(title: "Exterior", subtitle: "ARKit + LiDAR + visual opening detection · elevations, openings and roof slopes", icon: "building.2.fill", action: onExterior)

            VStack(alignment: .leading, spacing: 6) {
                Label("Teach Scanner is available in both review flows", systemImage: "brain.head.profile")
                    .font(.subheadline.bold())
                Text("Corrections become labeled examples for future model training. Aurelium never silently changes measurements from learned behavior without confidence and review.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
            Spacer()
        }
        .padding()
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func modeCard(title: String, subtitle: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title2).frame(width: 42, height: 42).background(.primary.opacity(0.08), in: Circle())
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.title3.bold()); Text(subtitle).font(.caption).foregroundStyle(.secondary) }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding(16).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(.plain)
    }
}

struct ExteriorSmartScanView: View {
    let project: ProjectSummary
    let onSave: (WalkthroughScan, [ScannerLearningSample]) -> Void
    let onCancel: () -> Void

    @State private var controller = ExteriorSmartScanController()
    @State private var showingReview = false

    var body: some View {
        ZStack {
            ExteriorARView(controller: controller).ignoresSafeArea()
            Rectangle().fill(.clear).contentShape(Rectangle()).gesture(SpatialTapGesture().onEnded { value in controller.handleTap(value.location) })
            candidateOverlay
            controls
        }
        .sheet(isPresented: $showingReview) { ExteriorScanReviewView(project: project, controller: controller, onSave: onSave, onCancel: onCancel) }
        .onDisappear { controller.stop() }
    }

    private var candidateOverlay: some View {
        GeometryReader { geo in
            ForEach(controller.candidates) { candidate in
                let r = candidate.normalizedRect
                let rect = CGRect(x: r.minX * geo.size.width, y: (1-r.maxY) * geo.size.height, width: r.width * geo.size.width, height: r.height * geo.size.height)
                Menu {
                    Button("Confirm as Window") { controller.confirmCandidate(candidate, as: .window) }
                    Button("Confirm as Door") { controller.confirmCandidate(candidate, as: .door) }
                    Button("Ignore", role: .destructive) { controller.candidates.removeAll { $0.id == candidate.id } }
                } label: {
                    RoundedRectangle(cornerRadius: 8).stroke(.yellow, lineWidth: 2).frame(width: rect.width, height: rect.height)
                        .overlay(alignment: .topLeading) { Text("OPENING?").font(.caption2.bold()).padding(4).background(.black.opacity(0.65), in: Capsule()).foregroundStyle(.white) }
                }
                .position(x: rect.midX, y: rect.midY)
            }
        }.allowsHitTesting(true)
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack {
                Button("Cancel", action: onCancel).buttonStyle(.bordered).tint(.white)
                Spacer()
                Text("EXTERIOR SMART SCAN").font(.caption.bold()).padding(.horizontal, 10).padding(.vertical, 7).background(.black.opacity(0.55), in: Capsule()).foregroundStyle(.white)
                Spacer()
                Button("Review") { showingReview = true }.buttonStyle(.borderedProminent)
            }
            Spacer()
            VStack(spacing: 10) {
                Text(controller.status).font(.caption).multilineTextAlignment(.center).foregroundStyle(.white).padding(10).background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 12))
                HStack(spacing: 8) {
                    teachButton(.window); teachButton(.door); teachButton(.opening); teachButton(.roofSlope)
                }
                HStack {
                    Label("\(controller.surfaces.count) wall planes", systemImage: "square.split.2x1")
                    Spacer()
                    Label("\(controller.openings.count) openings", systemImage: "rectangle.dashed")
                    if let slope = controller.lastSlopeDegrees { Spacer(); Text(String(format: "Roof %.1f°", slope)) }
                }
                .font(.caption.bold()).foregroundStyle(.white).padding(10).background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 12))
            }
        }.padding()
    }

    private func teachButton(_ kind: TaughtFeatureKind) -> some View {
        Button { controller.beginTeach(kind) } label: {
            VStack(spacing: 4) { Image(systemName: kind.systemImage); Text(kind == .roofSlope ? "Slope" : kind.rawValue).font(.caption2) }
                .frame(maxWidth: .infinity).padding(.vertical, 9)
        }.buttonStyle(.borderedProminent).tint(controller.teachKind == kind ? .orange : .black.opacity(0.68))
    }
}

private struct ExteriorARView: UIViewRepresentable {
    let controller: ExteriorSmartScanController
    func makeUIView(context: Context) -> ARSCNView { let view = ARSCNView(frame: .zero); controller.configure(view); return view }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}

private struct ExteriorScanReviewView: View {
    let project: ProjectSummary
    @Bindable var controller: ExteriorSmartScanController
    let onSave: (WalkthroughScan, [ScannerLearningSample]) -> Void
    let onCancel: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var elevationName = "Exterior Elevation"

    private var gross: Double { controller.surfaces.reduce(0) { $0 + $1.grossSquareFeet } }
    private var openingsArea: Double { controller.openings.reduce(0) { $0 + $1.areaSquareFeet } }
    private var net: Double { max(0, gross - openingsArea) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Elevation") { TextField("Name", text: $elevationName); LabeledContent("Gross mapped wall", value: String(format:"%.0f sq ft", gross)); LabeledContent("Openings", value:String(format:"- %.0f sq ft", openingsArea)); LabeledContent("Paintable", value:String(format:"%.0f sq ft", net)) }
                Section("Detected wall segments") { ForEach(controller.surfaces) { s in VStack(alignment:.leading){Text(s.label).font(.headline);Text(String(format:"%.1f × %.1f ft · %.0f sq ft",s.widthFeet,s.heightFeet,s.grossSquareFeet)).foregroundStyle(.secondary)} } }
                Section("Doors, windows & openings") { ForEach($controller.openings) { $o in VStack(alignment:.leading,spacing:8){Picker("Type",selection:$o.kind){Text("Window").tag(TaughtFeatureKind.window);Text("Door").tag(TaughtFeatureKind.door);Text("Opening").tag(TaughtFeatureKind.opening)};HStack{TextField("Width ft",value:$o.widthFeet,format:.number).keyboardType(.decimalPad);TextField("Height ft",value:$o.heightFeet,format:.number).keyboardType(.decimalPad)};Text("\(o.source) · confidence \(Int(o.confidence*100))%").font(.caption).foregroundStyle(.secondary)} } }
                if let slope = controller.lastSlopeDegrees { Section("Roof") { LabeledContent("Taught slope", value:String(format:"%.1f°",slope)); Text("Slope is retained as a correction/training label and can be adjusted during proposal review.").font(.caption).foregroundStyle(.secondary) } }
                Section { Text("If an opening was missed, return to scan and use Teach Scanner. Manual correction is part of the smart workflow, not a separate measuring mode.").font(.caption).foregroundStyle(.secondary) }
            }
            .navigationTitle("Review Exterior")
            .toolbar {
                ToolbarItem(placement:.cancellationAction){Button("Back"){dismiss()}}
                ToolbarItem(placement:.confirmationAction){Button("Save"){save()}.disabled(controller.surfaces.isEmpty)}
            }
        }
    }

    private func save() {
        let doors = controller.openings.filter{$0.kind == .door}.count
        let windows = controller.openings.filter{$0.kind == .window}.count
        let measurement = RoomMeasurementSummary(wallLinearFeet: controller.surfaces.reduce(0){$0+$1.widthFeet}, averageWallHeightFeet: controller.surfaces.isEmpty ? 0 : controller.surfaces.reduce(0){$0+$1.heightFeet}/Double(controller.surfaces.count), grossWallSquareFeet:gross, openingsSquareFeet:openingsArea, paintableWallSquareFeet:net, ceilingSquareFeet:nil, detectedDoorCount:doors, detectedWindowCount:windows, estimatedTrimLinearFeet:nil)
        let lines:[ScopeEstimateLine] = [
            .init(kind:.walls,enabled:true,quantity:net,unit:"sq ft",productionRate:150,laborHours:net/150),
            .init(kind:.doors,enabled:doors>0,quantity:Double(doors),unit:"doors",productionRate:2,laborHours:Double(doors)/2),
            .init(kind:.windows,enabled:windows>0,quantity:Double(windows),unit:"windows",productionRate:2,laborHours:Double(windows)/2),
            .init(kind:.trim,enabled:false,quantity:0,unit:"lin ft",productionRate:50,laborHours:0),
            .init(kind:.ceiling,enabled:false,quantity:0,unit:"sq ft",productionRate:125,laborHours:0)
        ]
        let total=lines.reduce(0){$0+$1.laborHours}
        let scan=WalkthroughScan(id:UUID(),projectID:project.id,createdAt:.now,room:.init(id:UUID(),name:elevationName,wallCount:controller.surfaces.count,doorCount:doors,windowCount:windows,source:.manual,verificationRequired:controller.openings.contains{$0.confidence<0.65}),transcript:"Exterior Smart Scan",captures:[],videoFileName:nil,durationSeconds:nil,usdzFileName:nil,roomPlanJSONFileName:nil,measurements:measurement,autoEstimate:.init(productionSquareFeetPerHour:150,laborHours:net/150,measurementsConfirmed:true,scopeLines:lines,totalLaborHours:total),measuredWalls:controller.surfaces.map{MeasuredWall(id:$0.id,lengthFeet:$0.widthFeet,heightFeet:$0.heightFeet,grossSquareFeet:$0.grossSquareFeet)},archivedAt:nil)
        let samples=controller.openings.filter{$0.confirmedByUser}.map{ScannerLearningSample(projectID:project.id,walkthroughID:scan.id,mode:.exterior,feature:$0.kind,action:$0.source == "taught" ? "manual_teach" : "confirm_prediction",predictedWidthFeet:$0.source == "taught" ? nil:$0.widthFeet,predictedHeightFeet:$0.source == "taught" ? nil:$0.heightFeet,correctedWidthFeet:$0.widthFeet,correctedHeightFeet:$0.heightFeet,correctedSlopeDegrees:nil,confidence:$0.confidence)} + (controller.lastSlopeDegrees.map{[ScannerLearningSample(projectID:project.id,walkthroughID:scan.id,mode:.exterior,feature:.roofSlope,action:"manual_teach",predictedWidthFeet:nil,predictedHeightFeet:nil,correctedWidthFeet:nil,correctedHeightFeet:nil,correctedSlopeDegrees:$0,confidence:1)]} ?? [])
        onSave(scan,samples); dismiss()
    }
}
