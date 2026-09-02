import Foundation
import ARKit
import Vision
import SceneKit
import UIKit
import Observation

struct VisionOpeningCandidate: Identifiable, Hashable {
    var id: UUID = UUID()
    var normalizedRect: CGRect
    var confidence: Double
}

@MainActor @Observable
final class ExteriorSmartScanController: NSObject, ARSessionDelegate {
    var candidates: [VisionOpeningCandidate] = []
    var openings: [SmartOpening] = []
    var surfaces: [SmartSurface] = []
    var status = "Move slowly across the elevation. Aurelium is mapping vertical surfaces."
    var teachKind: TaughtFeatureKind?
    var pendingTeachPoints: [SIMD3<Float>] = []
    var lastSlopeDegrees: Double?

    weak var sceneView: ARSCNView?
    private var lastVisionAt = Date.distantPast
    private var visionRunning = false

    func configure(_ view: ARSCNView) {
        sceneView = view
        view.session.delegate = self
        view.automaticallyUpdatesLighting = true
        view.scene = SCNScene()
        view.debugOptions = []
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.vertical, .horizontal]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification) {
            config.sceneReconstruction = .meshWithClassification
        } else if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            config.sceneReconstruction = .mesh
        }
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func stop() { sceneView?.session.pause() }

    func beginTeach(_ kind: TaughtFeatureKind) {
        teachKind = kind
        pendingTeachPoints.removeAll()
        status = kind == .roofSlope ? "Teach roof slope: tap the low point, then the high point." : "Teach \(kind.rawValue.lowercased()): tap opposite corners of the feature."
    }

    func cancelTeach() {
        teachKind = nil
        pendingTeachPoints.removeAll()
        status = "Teaching cancelled. Continue scanning."
    }

    func handleTap(_ point: CGPoint) {
        guard let view = sceneView, let kind = teachKind,
              let query = view.raycastQuery(from: point, allowing: .estimatedPlane, alignment: .any),
              let hit = view.session.raycast(query).first else {
            status = "Could not lock that point to geometry. Move slightly and try again."
            return
        }
        let t = hit.worldTransform.columns.3
        pendingTeachPoints.append(SIMD3<Float>(t.x, t.y, t.z))
        guard pendingTeachPoints.count == 2 else {
            status = "First point locked. Tap the opposite point."
            return
        }
        let a = pendingTeachPoints[0], b = pendingTeachPoints[1]
        if kind == .roofSlope {
            let horizontal = hypot(Double(b.x - a.x), Double(b.z - a.z))
            let rise = abs(Double(b.y - a.y))
            let angle = atan2(rise, max(horizontal, 0.0001)) * 180 / .pi
            lastSlopeDegrees = angle
            status = String(format: "Roof slope taught: %.1f°. Tap Teach again to refine it.", angle)
        } else {
            let widthMeters = hypot(Double(b.x - a.x), Double(b.z - a.z))
            let heightMeters = abs(Double(b.y - a.y))
            openings.append(SmartOpening(kind: kind, widthFeet: max(widthMeters * 3.28084, 0.1), heightFeet: max(heightMeters * 3.28084, 0.1), confidence: 1, source: "taught", confirmedByUser: true))
            status = "\(kind.rawValue) learned for this scan. Aurelium will use this correction as labeled training data."
        }
        teachKind = nil
        pendingTeachPoints.removeAll()
    }

    func confirmCandidate(_ candidate: VisionOpeningCandidate, as kind: TaughtFeatureKind) {
        guard let view = sceneView else { return }
        let bounds = view.bounds
        // Vision coordinates are bottom-left based. Convert two candidate corners into view coordinates.
        let left = candidate.normalizedRect.minX * bounds.width
        let right = candidate.normalizedRect.maxX * bounds.width
        let top = (1 - candidate.normalizedRect.maxY) * bounds.height
        let bottom = (1 - candidate.normalizedRect.minY) * bounds.height
        guard let q1 = view.raycastQuery(from: CGPoint(x: left, y: top), allowing: .estimatedPlane, alignment: .vertical),
              let q2 = view.raycastQuery(from: CGPoint(x: right, y: bottom), allowing: .estimatedPlane, alignment: .vertical),
              let h1 = view.session.raycast(q1).first,
              let h2 = view.session.raycast(q2).first else {
            status = "Candidate found visually, but depth was not stable enough. Use Teach Scanner to confirm it."
            return
        }
        let a = h1.worldTransform.columns.3, b = h2.worldTransform.columns.3
        let width = hypot(Double(b.x - a.x), Double(b.z - a.z)) * 3.28084
        let height = abs(Double(b.y - a.y)) * 3.28084
        openings.append(SmartOpening(kind: kind, widthFeet: max(width, 0.1), heightFeet: max(height, 0.1), confidence: candidate.confidence, source: "vision+lidar", confirmedByUser: true))
        candidates.removeAll { $0.id == candidate.id }
        status = "Confirmed \(kind.rawValue.lowercased()) from camera + depth."
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard Date().timeIntervalSince(lastVisionAt) > 0.8, !visionRunning else { return }
        lastVisionAt = .now
        visionRunning = true
        let request = VNDetectRectanglesRequest { [weak self] request, _ in
            let results = (request.results as? [VNRectangleObservation] ?? [])
                .filter { $0.confidence >= 0.45 }
                .prefix(6)
                .map { VisionOpeningCandidate(normalizedRect: $0.boundingBox, confidence: Double($0.confidence)) }
            Task { @MainActor in
                self?.candidates = results
                self?.visionRunning = false
            }
        }
        request.maximumObservations = 8
        request.minimumAspectRatio = 0.18
        request.maximumAspectRatio = 0.95
        request.minimumSize = 0.05
        let handler = VNImageRequestHandler(cvPixelBuffer: frame.capturedImage, orientation: .right, options: [:])
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do { try handler.perform([request]) }
            catch { Task { @MainActor in self?.visionRunning = false } }
        }
    }

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { updatePlanes(from: anchors) }
    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { updatePlanes(from: anchors) }

    private func updatePlanes(from anchors: [ARAnchor]) {
        let vertical = anchors.compactMap { $0 as? ARPlaneAnchor }.filter { $0.alignment == .vertical }
        guard !vertical.isEmpty else { return }
        for plane in vertical {
            let width = Double(plane.extent.x) * 3.28084
            let height = Double(plane.extent.z) * 3.28084
            guard width > 1, height > 1 else { continue }
            if let idx = surfaces.firstIndex(where: { $0.id.uuidString == plane.identifier.uuidString }) {
                surfaces[idx].widthFeet = width
                surfaces[idx].heightFeet = height
            } else {
                surfaces.append(SmartSurface(id: plane.identifier, label: "Elevation segment \(surfaces.count + 1)", widthFeet: width, heightFeet: height, confidence: 0.72, source: "ARKit vertical plane"))
            }
        }
    }
}
