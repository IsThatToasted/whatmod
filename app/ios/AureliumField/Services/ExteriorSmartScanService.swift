import Foundation
import ARKit
@preconcurrency import Vision
import SceneKit
import UIKit
import Observation

struct VisionOpeningCandidate: Identifiable, Hashable {
    var id: UUID
    var normalizedRect: CGRect
    var confidence: Double
    var observations: Int
    var locked: Bool
}

private struct OpeningTrack {
    var id: UUID
    var rect: CGRect
    var hits: Int
    var misses: Int
    var confidence: Double
    var lastSeen: Date
}

private struct FacadePlaneTrack {
    var id: UUID
    var widthFeet: Double
    var heightFeet: Double
    var samples: [(Double, Double)]
    var observations: Int
    var locked: Bool
    var lastUpdated: Date

    var stability: Double {
        guard samples.count >= 3 else { return 0 }
        let widths = samples.map { $0.0 }
        let heights = samples.map { $0.1 }
        let widthMean = widths.reduce(0.0, +) / Double(widths.count)
        let heightMean = heights.reduce(0.0, +) / Double(heights.count)
        let widthDenominator = max(widthMean, 0.1)
        let heightDenominator = max(heightMean, 0.1)
        var normalizedVariance = 0.0
        for sample in samples {
            let widthError = abs(sample.0 - widthMean) / widthDenominator
            let heightError = abs(sample.1 - heightMean) / heightDenominator
            normalizedVariance += widthError + heightError
        }
        normalizedVariance /= Double(samples.count)
        return max(0.0, min(1.0, 1.0 - normalizedVariance * 4.0))
    }
}

@MainActor @Observable
final class ExteriorSmartScanController: NSObject, @preconcurrency ARSessionDelegate {
    var candidates: [VisionOpeningCandidate] = []
    var openings: [SmartOpening] = []
    var surfaces: [SmartSurface] = []
    var status = "Point at one elevation and sweep slowly left to right. Aurelium will lock stable facade geometry."
    var teachKind: TaughtFeatureKind?
    var pendingTeachPoints: [SIMD3<Float>] = []
    var lastSlopeDegrees: Double?
    var captureProgress: Double = 0
    var trackingQuality = "Initializing"

    weak var sceneView: ARSCNView?
    private var lastVisionAt = Date.distantPast
    private var visionRunning = false
    private var openingTracks: [UUID: OpeningTrack] = [:]
    private var facadeTracks: [UUID: FacadePlaneTrack] = [:]

    func configure(_ view: ARSCNView) {
        sceneView = view
        view.session.delegate = self
        view.automaticallyUpdatesLighting = true
        view.scene = SCNScene()
        view.debugOptions = []
        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravity
        config.planeDetection = [.vertical, .horizontal]
        config.environmentTexturing = .automatic
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification) { config.sceneReconstruction = .meshWithClassification }
        else if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) { config.sceneReconstruction = .mesh }
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors, .resetSceneReconstruction])
    }

    func stop() { sceneView?.session.pause() }

    func beginTeach(_ kind: TaughtFeatureKind) {
        teachKind = kind
        pendingTeachPoints.removeAll()
        status = kind == .roofSlope ? "Teach roof slope: tap the low point, then the high point." : "Teach \(kind.rawValue.lowercased()): tap opposite corners on the facade."
    }

    func cancelTeach() { teachKind = nil; pendingTeachPoints.removeAll(); status = "Teaching cancelled. Continue the facade sweep." }

    func handleTap(_ point: CGPoint) {
        guard let view = sceneView, let kind = teachKind,
              let query = view.raycastQuery(from: point, allowing: .existingPlaneGeometry, alignment: .any) ?? view.raycastQuery(from: point, allowing: .estimatedPlane, alignment: .any),
              let hit = view.session.raycast(query).first else {
            status = "Could not lock that point to mapped geometry. Sweep across this area once more and retry."
            return
        }
        let t = hit.worldTransform.columns.3
        pendingTeachPoints.append(SIMD3<Float>(t.x,t.y,t.z))
        guard pendingTeachPoints.count == 2 else { status = "First edge locked. Tap the opposite corner."; return }
        let a = pendingTeachPoints[0], b = pendingTeachPoints[1]
        if kind == .roofSlope {
            let horizontal = hypot(Double(b.x-a.x),Double(b.z-a.z)); let rise = abs(Double(b.y-a.y))
            let angle = atan2(rise, max(horizontal, 0.0001)) * 180.0 / Double.pi
            lastSlopeDegrees = angle
            status = String(format:"Roof slope locked at %.1f°.",angle)
        } else {
            let width = hypot(Double(b.x-a.x),Double(b.z-a.z))*3.28084
            let height = abs(Double(b.y-a.y))*3.28084
            openings.append(SmartOpening(kind:kind,widthFeet:max(width,0.1),heightFeet:max(height,0.1),confidence:1,source:"taught+world-geometry",confirmedByUser:true))
            status = "\(kind.rawValue) locked from taught facade geometry."
        }
        teachKind=nil; pendingTeachPoints.removeAll(); recomputeProgress()
    }

    func confirmCandidate(_ candidate: VisionOpeningCandidate, as kind: TaughtFeatureKind) {
        guard let view = sceneView else { return }
        let b=view.bounds, r=candidate.normalizedRect
        let points=[CGPoint(x:r.minX*b.width,y:(1-r.maxY)*b.height),CGPoint(x:r.maxX*b.width,y:(1-r.minY)*b.height)]
        let hits=points.compactMap { p -> ARRaycastResult? in
            guard let q=view.raycastQuery(from:p,allowing:.existingPlaneGeometry,alignment:.vertical) ?? view.raycastQuery(from:p,allowing:.estimatedPlane,alignment:.vertical) else{return nil}
            return view.session.raycast(q).first
        }
        guard hits.count==2 else { status="Opening is visually stable, but its wall depth is not locked yet. Sweep across it once more or use Teach Scanner."; return }
        let a=hits[0].worldTransform.columns.3,bp=hits[1].worldTransform.columns.3
        let width=hypot(Double(bp.x-a.x),Double(bp.z-a.z))*3.28084, height=abs(Double(bp.y-a.y))*3.28084
        guard width > 0.5, height > 0.5, width < 30, height < 30 else { status="Depth lock produced an implausible opening size. Use Teach Scanner for this feature."; return }
        openings.append(SmartOpening(kind:kind,widthFeet:width,heightFeet:height,confidence:candidate.confidence,source:"tracked-vision+facade-depth",confirmedByUser:true))
        candidates.removeAll{$0.id==candidate.id}; openingTracks.removeValue(forKey:candidate.id)
        status=String(format:"%@ locked · %.1f × %.1f ft",kind.rawValue,width,height); recomputeProgress()
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        switch frame.camera.trackingState {
        case .normal: trackingQuality="Tracking locked"
        case .limited(_): trackingQuality="Tracking limited"
        case .notAvailable: trackingQuality="Tracking unavailable"
        }
        guard Date().timeIntervalSince(lastVisionAt)>0.45,!visionRunning else{return}
        lastVisionAt = .now; visionRunning = true
        let request=VNDetectRectanglesRequest { [weak self] req,_ in
            let observations=(req.results as? [VNRectangleObservation] ?? []).filter{$0.confidence>=0.52 && $0.boundingBox.width>0.045 && $0.boundingBox.height>0.065}.prefix(12)
            let compact=observations.map{($0.boundingBox,Double($0.confidence))}
            Task{@MainActor in self?.mergeOpeningObservations(compact);self?.visionRunning=false}
        }
        request.maximumObservations=12; request.minimumAspectRatio=0.18; request.maximumAspectRatio=0.92; request.minimumSize=0.045; request.quadratureTolerance=18
        let pixelBuffer=frame.capturedImage
        DispatchQueue.global(qos:.userInitiated).async { [weak self] in
            let handler=VNImageRequestHandler(cvPixelBuffer:pixelBuffer,orientation:.right,options:[:])
            do{try handler.perform([request])}catch{Task{@MainActor in self?.visionRunning=false}}
        }
    }

    func session(_ session: ARSession,didAdd anchors:[ARAnchor]){updatePlanes(from:anchors)}
    func session(_ session: ARSession,didUpdate anchors:[ARAnchor]){updatePlanes(from:anchors)}

    private func mergeOpeningObservations(_ observations:[(CGRect,Double)]) {
        var touched=Set<UUID>()
        for (rect,confidence) in observations {
            let match=openingTracks.values.filter{$0.misses<4}.max{a,b in iou(a.rect,rect)<iou(b.rect,rect)}
            if let m=match, iou(m.rect,rect)>0.38 {
                var t=m; t.rect=blend(t.rect,rect,0.35);t.hits+=1;t.misses=0;t.confidence=max(t.confidence,confidence);t.lastSeen = .now; openingTracks[t.id] = t; touched.insert(t.id)
            } else {
                let id=UUID();openingTracks[id]=OpeningTrack(id:id,rect:rect,hits:1,misses:0,confidence:confidence,lastSeen:.now);touched.insert(id)
            }
        }
        for id in Array(openingTracks.keys) where !touched.contains(id) { openingTracks[id]?.misses += 1; if openingTracks[id]!.misses>5 { openingTracks.removeValue(forKey:id) } }
        candidates=openingTracks.values.filter{$0.hits>=3 && $0.misses<=2}.sorted{$0.hits>$1.hits}.prefix(5).map{VisionOpeningCandidate(id:$0.id,normalizedRect:$0.rect,confidence:min(0.98,$0.confidence + Double(min($0.hits,8))*0.025),observations:$0.hits,locked:$0.hits>=6)}
        if !candidates.isEmpty && teachKind==nil { status="Facade geometry is stable. Confirm highlighted openings only when they stay locked in place." }
    }

    private func updatePlanes(from anchors:[ARAnchor]) {
        for plane in anchors.compactMap({$0 as? ARPlaneAnchor}).filter({$0.alignment == .vertical}) {
            let width=Double(plane.extent.x)*3.28084, height=Double(plane.extent.z)*3.28084
            guard width>3,height>3 else{continue}
            var track=facadeTracks[plane.identifier] ?? FacadePlaneTrack(id:plane.identifier,widthFeet:width,heightFeet:height,samples:[],observations:0,locked:false,lastUpdated:.now)
            track.widthFeet=width;track.heightFeet=height;track.observations+=1;track.lastUpdated = .now; track.samples.append((width,height)); if track.samples.count > 10 { track.samples.removeFirst() }
            track.locked = track.observations>=5 && track.stability>=0.82
            facadeTracks[plane.identifier]=track
        }
        let stable=facadeTracks.values.filter{$0.locked}.sorted{$0.widthFeet*$0.heightFeet > $1.widthFeet*$1.heightFeet}
        surfaces=stable.enumerated().map{idx,t in SmartSurface(id:t.id,label:"Locked facade \(idx+1)",widthFeet:t.widthFeet,heightFeet:t.heightFeet,confidence:t.stability,source:"ARKit persistent vertical plane")}
        if surfaces.isEmpty && !facadeTracks.isEmpty { status="Hold the elevation in view and move sideways slowly. Aurelium is stabilizing its edges before locking dimensions." }
        else if !surfaces.isEmpty && candidates.isEmpty && teachKind==nil { status="Facade locked. Continue the sweep to find doors/windows, or teach anything Aurelium misses." }
        recomputeProgress()
    }

    private func recomputeProgress(){
        let geometry = min(1,Double(surfaces.count)/2.0)
        let tracking = trackingQuality == "Tracking locked" ? 1.0 : 0.45
        let features = openings.isEmpty ? 0.35 : min(1,0.45+Double(openings.count)*0.1)
        captureProgress = min(1,geometry*0.55 + tracking*0.2 + features*0.25)
    }

    private func iou(_ a:CGRect,_ b:CGRect)->Double { let i=a.intersection(b);guard !i.isNull else{return 0};return Double(i.width*i.height/(a.width*a.height+b.width*b.height-i.width*i.height)) }
    private func blend(_ a:CGRect,_ b:CGRect,_ f:CGFloat)->CGRect { CGRect(x:a.origin.x*(1-f)+b.origin.x*f,y:a.origin.y*(1-f)+b.origin.y*f,width:a.width*(1-f)+b.width*f,height:a.height*(1-f)+b.height*f) }
}
