import Foundation
import ARKit
@preconcurrency import Vision
import SceneKit
import UIKit
import Observation
import simd

// MARK: - Exterior Smart Scanner v3
//
// Workflow:
//   1. FOOTPRINT  – stand back, aim the crosshair at each building corner where the wall meets the ground, tap Mark Corner.
//                   Corners define vertical wall planes. A ballpark estimate is available immediately from story count.
//   2. WALLS      – face a wall (auto-detected from where you aim). Measure eave height, gable apex and openings by
//                   intersecting camera rays with the KNOWN wall plane. Vision rectangles are mapped into wall space,
//                   fused across frames, size-filtered and auto-classified. One tap accepts them.
//   3. REVIEW     – confidence report, editable takeoff, labor model, photos, save.

enum ExteriorPhase: Equatable { case footprint, walls }
enum ExteriorTool: Equatable { case aim, height, gable, opening }

struct ExteriorCandidate: Identifiable, Hashable {
    var id: UUID
    var wallIndex: Int
    var u0: Double
    var v0: Double
    var u1: Double
    var v1: Double
    var kind: ExteriorOpeningClass
    var confidence: Double
    var hits: Int
    var widthFeet: Double { u1 - u0 }
    var heightFeet: Double { v1 - v0 }
}

struct ExteriorOverlayShape: Identifiable {
    enum Style { case footprint, wall, candidate, accepted, pending }
    let id: String
    var points: [CGPoint]
    var closed: Bool
    var style: Style
    var label: String?
}

struct ExteriorPendingCorner: Equatable {
    var wallIndex: Int
    var u: Double
    var v: Double
}

private struct OpeningTrack {
    var id: UUID
    var wallIndex: Int
    var samples: [SIMD4<Double>]
    var hits: Int
    var misses: Int
    var visionConfidence: Double

    var fused: SIMD4<Double> {
        func median(_ k: Int) -> Double {
            let s = samples.map { $0[k] }.sorted()
            return s[s.count / 2]
        }
        return SIMD4<Double>(median(0), median(1), median(2), median(3))
    }

    /// 1 = every frame agrees on size, 0 = measurements all over the place.
    var stability: Double {
        guard samples.count >= 3 else { return 0.3 }
        let ws = samples.map { $0[2] - $0[0] }, hs = samples.map { $0[3] - $0[1] }
        let w = max(0.5, ws.sorted()[ws.count / 2]), h = max(0.5, hs.sorted()[hs.count / 2])
        let wr = (ws.max() ?? w) - (ws.min() ?? w), hr = (hs.max() ?? h) - (hs.min() ?? h)
        return max(0, min(1, 1 - (wr / w + hr / h)))
    }
}

private struct RejectedRect {
    var wallIndex: Int
    var u0: Double
    var v0: Double
    var u1: Double
    var v1: Double
    var kind: ExteriorOpeningClass
    var confidence: Double
}

@MainActor @Observable
final class ExteriorSmartScanController: NSObject, ARSessionDelegate {
    // Capture state
    var phase: ExteriorPhase = .footprint
    var tool: ExteriorTool = .aim
    var corners: [SIMD3<Float>] = []
    var loopClosed = false
    var closureErrorFeet: Double?
    var squaredUp = false
    var walls: [ExteriorWall] = []
    var inputs = ExteriorEstimateInputs()
    var captures: [TaggedCapture] = []
    var manualKind: ExteriorOpeningClass?
    var pendingOpeningCorner: ExteriorPendingCorner?

    // HUD state
    var status = "Stand back where you can see the base of a building corner. Aim the crosshair at the corner where the wall meets the ground, then tap Mark Corner."
    var candidates: [ExteriorCandidate] = []
    var overlay: [ExteriorOverlayShape] = []
    var reticleReadout = ""
    var reticleActive = false
    var focusedWallIndex: Int?
    var pinnedWallIndex: Int?
    var trackingQuality = "Initializing"
    var trackingNormal = false
    var reticleEstimated = false
    var reticleU: Double?

    @ObservationIgnored weak var sceneView: ARSCNView?
    @ObservationIgnored private var cameraTransform = matrix_identity_float4x4
    @ObservationIgnored private var arCamera: ARCamera?
    @ObservationIgnored private var poseAtLastHUD = matrix_identity_float4x4
    @ObservationIgnored private var steady = false
    @ObservationIgnored private var groundY: Float?
    @ObservationIgnored private var lastHUDTime: TimeInterval = 0
    @ObservationIgnored private var lastVisionTime: TimeInterval = 0
    @ObservationIgnored private var visionRunning = false
    @ObservationIgnored private var tracks: [UUID: OpeningTrack] = [:]
    @ObservationIgnored private var rejected: [RejectedRect] = []
    @ObservationIgnored private var openingHistory: [UUID] = []
    @ObservationIgnored private var totalFrames = 0
    @ObservationIgnored private var limitedFrames = 0
    @ObservationIgnored private var cornerAssumed: [Bool] = []
    @ObservationIgnored private var groundAssumed = false

    // MARK: Derived

    var activeWallIndex: Int? { pinnedWallIndex ?? focusedWallIndex }
    var takeoff: ExteriorTakeoff { ExteriorEstimator.compute(walls: walls, inputs: inputs) }
    var galleryItem: EvidenceGalleryItem? { captures.isEmpty ? nil : EvidenceGalleryItem(captures: captures, startIndex: max(0, captures.count - 1)) }
    var anyHeightAssumed: Bool { walls.contains { !$0.heightMeasured } }

    // MARK: Session

    func configure(_ view: ARSCNView) {
        sceneView = view
        view.session.delegate = self
        view.automaticallyUpdatesLighting = true
        view.scene = SCNScene()
        view.debugOptions = []
        view.pointOfView?.camera?.zNear = 0.05
        view.pointOfView?.camera?.zFar = 2000
        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravity
        config.planeDetection = [.horizontal]
        config.environmentTexturing = .none
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) { config.sceneReconstruction = .mesh }
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors, .resetSceneReconstruction])
    }

    func stop() { sceneView?.session.pause() }

    // MARK: Rays

    private var viewCenter: CGPoint {
        guard let v = sceneView else { return .zero }
        return CGPoint(x: v.bounds.midX, y: v.bounds.midY)
    }

    private func rayFor(_ p: CGPoint) -> (origin: SIMD3<Float>, dir: SIMD3<Float>)? {
        guard let v = sceneView else { return nil }
        let n = v.unprojectPoint(SCNVector3(Float(p.x), Float(p.y), 0))
        let f = v.unprojectPoint(SCNVector3(Float(p.x), Float(p.y), 1))
        let o = SIMD3<Float>(n.x, n.y, n.z)
        let d = SIMD3<Float>(f.x - n.x, f.y - n.y, f.z - n.z)
        let len = simd_length(d)
        guard len > 1e-6 else { return nil }
        return (o, d / len)
    }

    private var cameraPosition: SIMD3<Float> {
        let c = cameraTransform.columns.3
        return SIMD3<Float>(c.x, c.y, c.z)
    }

    private func isInFront(_ p: SIMD3<Float>) -> Bool {
        let c = cameraTransform.columns.2
        let forward = SIMD3<Float>(-c.x, -c.y, -c.z)
        return simd_dot(p - cameraPosition, forward) > 0.05
    }

    private func project(_ p: SIMD3<Float>) -> CGPoint? {
        guard let v = sceneView, let cam = arCamera, isInFront(p) else { return nil }
        return cam.projectPoint(p, orientation: interfaceOrientation(), viewportSize: v.bounds.size)
    }

    private func toCamera(_ p: SIMD3<Float>, inverse inv: simd_float4x4) -> SIMD3<Float> {
        let q = inv * SIMD4<Float>(p.x, p.y, p.z, 1)
        return SIMD3<Float>(q.x, q.y, q.z)
    }

    /// Projects a world polygon after clipping it to the camera's near plane, so a 400 ft wall you are standing next to
    /// still draws the part that is in view instead of disappearing because one corner is behind you.
    private func clippedPolygon(_ pts: [SIMD3<Float>]) -> [CGPoint]? {
        guard pts.count >= 3 else { return nil }
        let inv = simd_inverse(cameraTransform)
        let cs = pts.map { toCamera($0, inverse: inv) }
        let near: Float = -0.15   // camera space looks down -z
        var out: [SIMD3<Float>] = []
        for i in cs.indices {
            let a = cs[i], b = cs[(i + 1) % cs.count]
            let aIn = a.z < near, bIn = b.z < near
            if aIn { out.append(a) }
            if aIn != bIn {
                let t = (near - a.z) / (b.z - a.z)
                out.append(a + (b - a) * t)
            }
        }
        guard out.count >= 3 else { return nil }
        let pts2 = out.compactMap { cp -> CGPoint? in
            let w = cameraTransform * SIMD4<Float>(cp.x, cp.y, cp.z, 1)
            return project(SIMD3<Float>(w.x, w.y, w.z))
        }
        return pts2.count >= 3 ? pts2 : nil
    }

    private func clippedSegment(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> [CGPoint]? {
        let inv = simd_inverse(cameraTransform)
        var ca = toCamera(a, inverse: inv), cb = toCamera(b, inverse: inv)
        let near: Float = -0.15
        let aIn = ca.z < near, bIn = cb.z < near
        if !aIn && !bIn { return nil }
        if aIn != bIn {
            let t = (near - ca.z) / (cb.z - ca.z)
            let m = ca + (cb - ca) * t
            if aIn { cb = m } else { ca = m }
        }
        let wa = cameraTransform * SIMD4<Float>(ca.x, ca.y, ca.z, 1), wb = cameraTransform * SIMD4<Float>(cb.x, cb.y, cb.z, 1)
        guard let pa = project(SIMD3<Float>(wa.x, wa.y, wa.z)), let pb = project(SIMD3<Float>(wb.x, wb.y, wb.z)) else { return nil }
        return [pa, pb]
    }

    /// Forgiving ground lock. Order: ARKit plane hits (measured) -> geometric intersection with the ground height we
    /// already know -> an ESTIMATED ground at typical hand-held camera height so the user can always start where they want.
    private func groundHit(at p: CGPoint) -> (point: SIMD3<Float>, estimated: Bool)? {
        guard let v = sceneView else { return nil }
        let eye = cameraPosition
        let targets: [ARRaycastQuery.Target] = [.existingPlaneInfinite, .estimatedPlane]
        for target in targets {
            guard let q = v.raycastQuery(from: p, allowing: target, alignment: .horizontal),
                  let hit = v.session.raycast(q).first else { continue }
            let c = hit.worldTransform.columns.3
            guard c.y < eye.y - 0.25 else { continue }
            // A deck, porch or roof far from the known ground level is not the ground. Fall through to geometry.
            if let gy = groundY, !groundAssumed, abs(c.y - gy) > 1.2 { continue }
            return (SIMD3<Float>(c.x, c.y, c.z), false)
        }
        guard let r = rayFor(p), r.dir.y < -0.006 else { return nil }
        let known = groundY != nil
        let gy = groundY ?? (eye.y - 1.45)
        let t = (gy - r.origin.y) / r.dir.y
        guard t > 0.3, t < 400 else { return nil }
        return (r.origin + r.dir * t, !known || groundAssumed)
    }

    private func frameFor(_ wallIndex: Int) -> WallFrame? {
        guard wallIndex >= 0, wallIndex < walls.count else { return nil }
        let w = walls[wallIndex]
        guard w.startIndex < corners.count, w.endIndex < corners.count else { return nil }
        return WallFrame(a: corners[w.startIndex], b: corners[w.endIndex])
    }

    private func wallUnderRay(_ r: (origin: SIMD3<Float>, dir: SIMD3<Float>)) -> Int? {
        var bestIndex: Int?
        var bestT: Float = .greatestFiniteMagnitude
        for i in walls.indices {
            guard let f = frameFor(i), let hit = f.intersect(origin: r.origin, direction: r.dir) else { continue }
            let l = f.local(hit.point)
            guard l.u > -0.5, l.u < f.lengthMeters + 0.5, l.v > -0.7, l.v < 90 else { continue }
            if hit.t < bestT { bestT = hit.t; bestIndex = i }
        }
        return bestIndex
    }

    private func meters(_ feet: Double) -> Float { Float(feet / exteriorFeetPerMeter) }
    private func feet(_ m: Float) -> Double { Double(m) * exteriorFeetPerMeter }

    // MARK: Footprint

    func setStories(_ n: Int) {
        inputs.stories = max(1, min(12, n))
        let h = ExteriorDefaults.assumedEaveHeightFeet(stories: inputs.stories)
        for i in walls.indices where !walls[i].heightMeasured { walls[i].heightFeet = h }
    }

    enum CornerAssumption { case wallSurface, square, straight, myPosition }

    func markCorner() { placeCorner(assumption: nil) }

    /// Place a corner when the base of the wall is blocked (bushes, steps, cars, fences).
    func markBlockedCorner(_ assumption: CornerAssumption) { placeCorner(assumption: assumption) }

    private func placeCorner(assumption: CornerAssumption?) {
        guard phase == .footprint else { return }
        var point: SIMD3<Float>
        var assumed = false
        if let assumption {
            guard let r = rayFor(viewCenter) else { return }
            switch assumption {
            case .wallSurface:
                guard let f = wallSurfacePoint() else {
                    status = "No wall surface found there (surface detection reaches about 15 ft). Use a Far corner option instead."
                    return
                }
                point = f
                assumed = groundY == nil
            case .myPosition:
                let cp = cameraPosition
                point = SIMD3<Float>(cp.x, groundY ?? (cp.y - 1.45), cp.z)
                assumed = true
            case .square, .straight:
                guard corners.count >= 2 else { status = "Mark at least two corners first so the app knows the wall direction."; return }
                let last = corners[corners.count - 1], prev = corners[corners.count - 2]
                let dx = last.x - prev.x, dz = last.z - prev.z
                let len = (dx * dx + dz * dz).squareRoot()
                guard len > 0.3 else { return }
                let dirPrev = SIMD3<Float>(dx / len, 0, dz / len)
                // Vertical plane that contains the NEXT wall line: normal = previous wall direction (square) or its perpendicular (straight).
                let n = assumption == .square ? dirPrev : SIMD3<Float>(dirPrev.z, 0, -dirPrev.x)
                let denom = simd_dot(r.dir, n)
                guard abs(denom) > 0.15 else {
                    status = "You are looking along that wall. Step to the side so the corner edge is across your view."
                    return
                }
                let t = simd_dot(last - r.origin, n) / denom
                guard t > 0.5, t < 400 else { status = "Aim at the vertical corner edge you want to place."; return }
                let hit = r.origin + r.dir * t
                point = SIMD3<Float>(hit.x, last.y, hit.z)
                assumed = true
            }
        } else {
            if let g = groundHit(at: viewCenter) {
                point = g.point
                assumed = g.estimated
                if !g.estimated, groundAssumed { refineGround(to: point.y) }
            } else if let f = wallSurfacePoint() {
                // Aiming above the ground (tall wall, distant corner): use the wall surface at the crosshair instead.
                point = f
                assumed = groundY == nil
            } else {
                status = corners.count >= 2
                    ? "Crosshair is not on the ground or a detected wall. For a far or tall corner, aim at its vertical edge and use Blocked > Far corner."
                    : "Crosshair is not on the ground or a detected wall. Stand at the corner and use Blocked > Mark my position, or tilt down to the base."
                return
            }
        }
        if groundY == nil { groundY = point.y; groundAssumed = assumed }
        if corners.count >= 3, ExteriorGeometry.distanceXZ(point, corners[0]) < 1.5 {
            closeLoop(measuredStart: point)
            return
        }
        if let last = corners.last, ExteriorGeometry.distanceXZ(point, last) < 0.9 {
            status = "That is too close to the last corner. Walk to the next corner."
            return
        }
        corners.append(point)
        cornerAssumed.append(assumed)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let flag = assumed ? " Placed by assumption, so it is flagged for review." : ""
        switch corners.count {
        case 1: status = "Corner 1 locked. Walk to the next corner and mark it. Re-marking Corner 1 at the end closes the loop and corrects drift." + flag
        case 2: status = "Wall 1 defined. Long wall? Step back, aim at the far corner's vertical edge at any height and use Blocked > Far corner. Otherwise keep going around." + flag
        default: status = "Corner \(corners.count) locked. Aim back at Corner 1 to close the loop automatically." + flag
        }
    }

    /// Vertical surface at the crosshair (ARKit plane). Height is forced to the ground level so base heights stay consistent.
    private func wallSurfacePoint() -> SIMD3<Float>? {
        guard let v = sceneView else { return nil }
        let targets: [ARRaycastQuery.Target] = [.existingPlaneInfinite, .estimatedPlane]
        for target in targets {
            if let q = v.raycastQuery(from: viewCenter, allowing: target, alignment: .vertical), let hit = v.session.raycast(q).first {
                let c = hit.worldTransform.columns.3
                return SIMD3<Float>(c.x, groundY ?? (cameraPosition.y - 1.45), c.z)
            }
        }
        return nil
    }

    /// A measured ground hit replaces an earlier estimated ground height, and corners placed on the estimate follow it.
    private func refineGround(to y: Float) {
        groundY = y
        groundAssumed = false
        for i in corners.indices where i < cornerAssumed.count && cornerAssumed[i] { corners[i].y = y }
    }

    /// Three corners of a rectangular building are enough: the fourth is c0 + c2 - c1.
    func completeRectangle() {
        guard phase == .footprint, corners.count == 3 else { return }
        let c = corners
        let fourth = SIMD3<Float>(c[0].x + c[2].x - c[1].x, c[0].y, c[0].z + c[2].z - c[1].z)
        corners.append(fourth)
        cornerAssumed.append(true)
        loopClosed = true
        closureErrorFeet = nil
        finishFootprint()
    }

    func undoCorner() {
        guard phase == .footprint, !corners.isEmpty else { return }
        corners.removeLast()
        if !cornerAssumed.isEmpty { cornerAssumed.removeLast() }
        if corners.isEmpty { groundY = nil; groundAssumed = false }
        status = "Last corner removed."
    }

    /// The user re-marked the first corner: use the misclosure to spread drift across the loop (compass rule).
    private func closeLoop(measuredStart p: SIMD3<Float>) {
        let start = corners[0]
        let ex = p.x - start.x, ez = p.z - start.z
        closureErrorFeet = feet((ex * ex + ez * ez).squareRoot())
        let n = Float(corners.count)
        for i in 1..<corners.count {
            let k = Float(i) / n
            corners[i].x -= ex * k
            corners[i].z -= ez * k
        }
        loopClosed = true
        finishFootprint()
    }

    func closeLoopManually() {
        guard phase == .footprint, corners.count >= 3 else { return }
        loopClosed = true
        closureErrorFeet = nil
        finishFootprint()
    }

    func finishOpen() {
        guard phase == .footprint, corners.count >= 2 else { return }
        loopClosed = false
        finishFootprint()
    }

    /// Drops vertices where the wall continues straight (a baseline "direction point" on a long facade), so a 400 ft
    /// elevation is one wall instead of several.
    private func mergeCollinearCorners() {
        var changed = true
        while changed {
            changed = false
            let n = corners.count
            if (loopClosed && n <= 3) || (!loopClosed && n <= 2) { return }
            let range: Range<Int> = loopClosed ? 0..<n : 1..<(n - 1)
            for k in range {
                let prev = corners[(k + n - 1) % n], cur = corners[k], next = corners[(k + 1) % n]
                if abs(ExteriorGeometry.cornerAngleDegrees(prev, cur, next) - 180) < 4 {
                    corners.remove(at: k)
                    if k < cornerAssumed.count { cornerAssumed.remove(at: k) }
                    changed = true
                    break
                }
            }
        }
    }

    private func finishFootprint() {
        mergeCollinearCorners()
        squaredUp = false
        if loopClosed, let sq = ExteriorGeometry.squaredUp(corners) {
            corners = sq
            squaredUp = true
        }
        let count = loopClosed ? corners.count : corners.count - 1
        let h = ExteriorDefaults.assumedEaveHeightFeet(stories: inputs.stories)
        var built: [ExteriorWall] = []
        for i in 0..<count {
            let j = (i + 1) % corners.count
            guard let f = WallFrame(a: corners[i], b: corners[j]) else { continue }
            built.append(ExteriorWall(label: "Wall \(built.count + 1)", startIndex: i, endIndex: j, lengthFeet: f.lengthFeet, heightFeet: h, heightMeasured: false))
        }
        guard !built.isEmpty else {
            status = "Those corners were too close together to form a wall. Undo and re-mark them."
            loopClosed = false
            return
        }
        walls = built
        phase = .walls
        tool = .aim
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        status = "Footprint locked: \(walls.count) wall\(walls.count == 1 ? "" : "s"). Ballpark estimate is live. Face a wall and set its height, gable and openings to tighten it."
    }

    func resetFootprint() {
        corners.removeAll(); walls.removeAll(); candidates.removeAll(); tracks.removeAll(); rejected.removeAll(); openingHistory.removeAll()
        loopClosed = false; closureErrorFeet = nil; squaredUp = false
        groundY = nil; groundAssumed = false; cornerAssumed.removeAll(); phase = .footprint; tool = .aim
        pinnedWallIndex = nil; focusedWallIndex = nil; pendingOpeningCorner = nil
        status = "Footprint cleared. Aim at the base of the first corner and tap Mark Corner."
    }

    // MARK: Wall measurement

    func setTool(_ t: ExteriorTool) {
        tool = (tool == t) ? .aim : t
        pendingOpeningCorner = nil
        switch tool {
        case .aim: status = "Aim at a wall to work on it. Candidate openings appear as you hold steady."
        case .height: status = "Aim at the top of the wall (the eave or top of the siding) and tap Set Height."
        case .gable: status = "Aim at the very peak of the gable and tap Set Apex."
        case .opening: status = "Aim at one corner of the opening, tap Corner 1, then aim at the opposite corner."
        }
    }

    func togglePin() {
        if pinnedWallIndex != nil { pinnedWallIndex = nil; status = "Wall lock released. Aim auto-selects the wall."; return }
        pinnedWallIndex = focusedWallIndex
        if let i = pinnedWallIndex, i < walls.count { status = "\(walls[i].label) locked. Measure it from any angle." }
    }

    func pinWall(_ index: Int) {
        guard index < walls.count else { return }
        pinnedWallIndex = (pinnedWallIndex == index) ? nil : index
    }

    private func hitOnActiveWall() -> (index: Int, frame: WallFrame, u: Double, v: Double, range: Double)? {
        guard let idx = activeWallIndex, let f = frameFor(idx), let r = rayFor(viewCenter),
              let hit = f.intersect(origin: r.origin, direction: r.dir) else { return nil }
        let l = f.local(hit.point)
        return (idx, f, feet(l.u), feet(l.v), feet(hit.t))
    }

    func commitPrimaryAction() {
        switch (phase, tool) {
        case (.footprint, _): markCorner()
        case (.walls, .height): commitHeight()
        case (.walls, .gable): commitGable()
        case (.walls, .opening): commitOpeningCorner()
        default: break
        }
    }

    private func commitHeight() {
        guard let h = hitOnActiveWall() else { status = "Aim at the wall you are measuring."; return }
        guard h.v >= 2, h.v <= 250 else { status = "That height looks wrong. Aim at the eave line of this wall."; return }
        walls[h.index].heightFeet = h.v
        walls[h.index].heightMeasured = true
        // Until measured, other walls assume the same eave. Better than the story guess, and still flagged as assumed.
        for i in walls.indices where !walls[i].heightMeasured { walls[i].heightFeet = h.v }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        status = String(format: "%@ height locked at %.1f ft. Unmeasured walls assume the same eave.", walls[h.index].label, h.v)
        tool = .aim
    }

    private func commitGable() {
        guard let h = hitOnActiveWall() else { status = "Aim at the gable peak on the wall plane."; return }
        let rise = h.v - walls[h.index].heightFeet
        guard rise > 0.8, rise < walls[h.index].lengthFeet * 0.9 else {
            status = "The apex must be above the eave line. Set the eave height first, then aim at the peak."
            return
        }
        walls[h.index].gableRiseFeet = rise
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let slope = walls[h.index].gableSlopeDegrees ?? 0
        status = String(format: "Gable added: %.1f ft rise, roof pitch about %.0f°.", rise, slope)
        tool = .aim
    }

    func removeGable() {
        guard let i = activeWallIndex, i < walls.count else { return }
        walls[i].gableRiseFeet = nil
        status = "Gable removed from \(walls[i].label)."
    }

    private func commitOpeningCorner() {
        guard let h = hitOnActiveWall() else { status = "Aim at the wall the opening is on."; return }
        guard let first = pendingOpeningCorner else {
            pendingOpeningCorner = ExteriorPendingCorner(wallIndex: h.index, u: h.u, v: h.v)
            status = "Corner 1 set. Aim at the opposite corner and tap again."
            return
        }
        guard first.wallIndex == h.index else {
            pendingOpeningCorner = nil
            status = "Both corners must be on the same wall. Start again."
            return
        }
        let u0 = min(first.u, h.u), u1 = max(first.u, h.u), v0 = min(first.v, h.v), v1 = max(first.v, h.v)
        pendingOpeningCorner = nil
        guard ExteriorOpeningPriors.plausible(widthFeet: u1 - u0, heightFeet: v1 - v0) else {
            status = "That size is not plausible for an opening. Try the two opposite corners again."
            return
        }
        let guess = ExteriorOpeningPriors.classify(widthFeet: u1 - u0, heightFeet: v1 - v0, bottomFeet: v0)
        let kind = manualKind ?? guess.kind
        addOpening(wall: h.index, kind: kind, u0: u0, v0: v0, u1: u1, v1: v1, confidence: 0.92, source: "manual", assumed: false, predicted: nil)
        status = String(format: "%@ added · %.1f × %.1f ft.", kind.rawValue, u1 - u0, v1 - v0)
    }

    private func addOpening(wall: Int, kind: ExteriorOpeningClass, u0: Double, v0: Double, u1: Double, v1: Double, confidence: Double, source: String, assumed: Bool, predicted: (Double, Double)?) {
        guard wall < walls.count else { return }
        var o = ExteriorOpening(kind: kind, u0: u0, v0: v0, u1: u1, v1: v1, confidence: confidence, source: source)
        o.assumedSize = assumed
        o.predictedWidthFeet = predicted?.0
        o.predictedHeightFeet = predicted?.1
        walls[wall].openings.append(o)
        openingHistory.append(o.id)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    func quickAdd(_ kind: ExteriorOpeningClass) {
        guard phase == .walls, let idx = activeWallIndex, idx < walls.count else { status = "Aim at a wall first."; return }
        let size = ExteriorOpeningPriors.standardSize(for: kind)
        var centerU = walls[idx].lengthFeet / 2
        var bottom: Double = (kind == .window) ? 3.0 : 0
        if let h = hitOnActiveWall() {
            centerU = max(size.w / 2, min(walls[idx].lengthFeet - size.w / 2, h.u))
            if kind == .window { bottom = max(0.5, h.v - size.h / 2) }
        }
        addOpening(wall: idx, kind: kind, u0: centerU - size.w / 2, v0: bottom, u1: centerU + size.w / 2, v1: bottom + size.h, confidence: 0.4, source: "quick-add", assumed: true, predicted: nil)
        status = "\(kind.rawValue) added at a standard size. Measure it for a tighter number."
    }

    func undoLastOpening() {
        while let last = openingHistory.popLast() {
            for i in walls.indices {
                if let k = walls[i].openings.firstIndex(where: { $0.id == last }) {
                    walls[i].openings.remove(at: k)
                    status = "Last opening removed."
                    return
                }
            }
        }
    }

    // MARK: Candidates

    func accept(_ c: ExteriorCandidate, as kind: ExteriorOpeningClass? = nil) {
        guard c.wallIndex < walls.count else { return }
        addOpening(wall: c.wallIndex, kind: kind ?? c.kind, u0: c.u0, v0: c.v0, u1: c.u1, v1: c.v1, confidence: c.confidence, source: "auto-tracked", assumed: false, predicted: (c.widthFeet, c.heightFeet))
        tracks.removeValue(forKey: c.id)
        candidates.removeAll { $0.id == c.id }
        status = String(format: "%@ accepted · %.1f × %.1f ft.", (kind ?? c.kind).rawValue, c.widthFeet, c.heightFeet)
    }

    func acceptLikely() {
        let likely = candidates.filter { $0.confidence >= 0.72 && $0.hits >= 5 }
        for c in likely { accept(c) }
        status = likely.isEmpty ? "No candidates are stable enough to bulk-accept yet. Hold steady a little longer." : "\(likely.count) openings accepted. Check them in review."
    }

    func dismiss(_ c: ExteriorCandidate) {
        rejected.append(RejectedRect(wallIndex: c.wallIndex, u0: c.u0, v0: c.v0, u1: c.u1, v1: c.v1, kind: c.kind, confidence: c.confidence))
        tracks.removeValue(forKey: c.id)
        candidates.removeAll { $0.id == c.id }
    }

    // MARK: Photos

    func capturePhoto(tag: EvidenceTag) {
        guard let v = sceneView else { return }
        let image = v.snapshot()
        guard let data = image.jpegData(compressionQuality: 0.82) else { status = "Could not capture that photo."; return }
        let id = UUID()
        let name = "exterior-\(id.uuidString).jpg"
        do { try data.write(to: AppMediaStore.url(for: name), options: .atomic) } catch { status = "Could not save that photo."; return }
        var label = "Exterior"
        if let i = activeWallIndex, i < walls.count { label = walls[i].label }
        captures.append(TaggedCapture(id: id, tag: tag, capturedAt: .now, imageFileName: name, note: label))
        if let i = activeWallIndex, i < walls.count { walls[i].photoCaptureIDs.append(id) }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        status = "\(tag.rawValue.capitalized) photo saved to \(label)."
    }

    func discardUnsavedMedia() {
        for c in captures { try? FileManager.default.removeItem(at: AppMediaStore.url(for: c.imageFileName)) }
        captures.removeAll()
    }

    // MARK: Frame loop

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        cameraTransform = frame.camera.transform
        arCamera = frame.camera
        totalFrames += 1
        var quality = "Tracking locked"
        var normal = true
        switch frame.camera.trackingState {
        case .normal: break
        case .limited(_): quality = "Tracking limited"; normal = false; limitedFrames += 1
        case .notAvailable: quality = "Tracking unavailable"; normal = false; limitedFrames += 1
        }
        if trackingQuality != quality { trackingQuality = quality }
        if trackingNormal != normal { trackingNormal = normal }

        if frame.timestamp - lastHUDTime > 0.1 {
            lastHUDTime = frame.timestamp
            updateSteady()
            refreshHUD()
        }
        if phase == .walls, steady, trackingNormal, !visionRunning, pendingOpeningCorner == nil,
           frame.timestamp - lastVisionTime > 0.5, let idx = activeWallIndex {
            lastVisionTime = frame.timestamp
            runVision(frame: frame, wallIndex: idx)
        }
    }

    private func updateSteady() {
        let a = poseAtLastHUD.columns.3, b = cameraTransform.columns.3
        let moved = simd_length(SIMD3<Float>(a.x - b.x, a.y - b.y, a.z - b.z))
        let fa = poseAtLastHUD.columns.2, fb = cameraTransform.columns.2
        let turned = simd_dot(SIMD3<Float>(fa.x, fa.y, fa.z), SIMD3<Float>(fb.x, fb.y, fb.z))
        steady = moved < 0.03 && turned > 0.9995
        poseAtLastHUD = cameraTransform
    }

    // MARK: Overlay + readouts

    private func refreshHUD() {
        guard let view = sceneView, view.bounds.width > 1 else { return }
        var shapes = footprintShapes()
        switch phase {
        case .footprint:
            if let g = groundHit(at: viewCenter) {
                let p = g.point
                reticleActive = true
                reticleEstimated = g.estimated
                if let last = corners.last {
                    let d = String(format: "%.1f ft from last corner", feet(ExteriorGeometry.distanceXZ(p, last)))
                    reticleReadout = g.estimated ? d + " · estimated ground" : d
                    if let seg = clippedSegment(last, p) {
                        shapes.append(ExteriorOverlayShape(id: "rubber", points: seg, closed: false, style: .pending, label: nil))
                    }
                } else {
                    reticleReadout = g.estimated ? "Estimated ground. Tap to start here." : "Ground locked. Aim at the first corner."
                }
            } else {
                reticleActive = false
                reticleEstimated = false
                reticleReadout = corners.count >= 2 ? "Not on ground · use Blocked > Far corner" : "Not on ground · use Blocked"
            }
        case .walls:
            var focus: Int?
            if let ray = rayFor(viewCenter) { focus = wallUnderRay(ray) }
            if focusedWallIndex != focus { focusedWallIndex = focus }
            if let idx = activeWallIndex, idx < walls.count, let f = frameFor(idx) {
                shapes.append(contentsOf: wallShapes(index: idx, frame: f))
                reticleActive = true
                if let h = hitOnActiveWall() {
                    reticleU = h.u
                    reticleReadout = readout(for: h.index, u: h.u, v: h.v, range: h.range)
                    if let p = pendingOpeningCorner, p.wallIndex == idx {
                        if let pts = rect(frame: f, u0: min(p.u, h.u), v0: min(p.v, h.v), u1: max(p.u, h.u), v1: max(p.v, h.v)) {
                            shapes.append(ExteriorOverlayShape(id: "pending", points: pts, closed: true, style: .pending, label: nil))
                        }
                    }
                } else {
                    reticleU = nil
                    reticleReadout = "\(walls[idx].label) · aim at the wall"
                }
            } else {
                reticleActive = false
                reticleReadout = "Aim at a wall. Corners define where walls are."
            }
        }
        overlay = shapes
    }

    private func readout(for idx: Int, u: Double, v: Double, range: Double) -> String {
        let w = walls[idx]
        switch tool {
        case .height: return String(format: "Height here %.1f ft", v)
        case .gable: return String(format: "Apex %.1f ft · rise %.1f ft", v, v - w.heightFeet)
        case .opening:
            if let p = pendingOpeningCorner, p.wallIndex == idx { return String(format: "%.1f × %.1f ft", abs(u - p.u), abs(v - p.v)) }
            return String(format: "%.1f ft along · %.1f ft up", u, v)
        case .aim:
            let assumed = w.heightMeasured ? "" : " (assumed)"
            var text = String(format: "%@ · %.0f ft long · %.1f ft high", w.label, w.lengthFeet, w.heightFeet) + assumed
            text += String(format: " · %.0f ft away", range)
            if range > 250 { text += " · long range, accuracy drops" }
            return text
        }
    }

    private func rect(frame f: WallFrame, u0: Double, v0: Double, u1: Double, v1: Double) -> [CGPoint]? {
        let pts = [f.world(u: meters(u0), v: meters(v0)), f.world(u: meters(u1), v: meters(v0)), f.world(u: meters(u1), v: meters(v1)), f.world(u: meters(u0), v: meters(v1))]
        return clippedPolygon(pts)
    }

    private func footprintShapes() -> [ExteriorOverlayShape] {
        var out: [ExteriorOverlayShape] = []
        for (i, c) in corners.enumerated() {
            if let p = project(c) { out.append(ExteriorOverlayShape(id: "corner-\(i)", points: [p], closed: false, style: .footprint, label: "\(i + 1)")) }
            if i + 1 < corners.count, let seg = clippedSegment(c, corners[i + 1]) {
                out.append(ExteriorOverlayShape(id: "seg-\(i)", points: seg, closed: false, style: .footprint, label: nil))
            }
        }
        if loopClosed, corners.count > 2, let seg = clippedSegment(corners[corners.count - 1], corners[0]) {
            out.append(ExteriorOverlayShape(id: "seg-close", points: seg, closed: false, style: .footprint, label: nil))
        }
        return out
    }

    private func wallShapes(index: Int, frame f: WallFrame) -> [ExteriorOverlayShape] {
        var out: [ExteriorOverlayShape] = []
        let w = walls[index]
        let L = f.lengthMeters, H = meters(w.heightFeet)
        var outline = [f.world(u: 0, v: 0), f.world(u: L, v: 0), f.world(u: L, v: H)]
        if let rise = w.gableRiseFeet { outline.append(f.world(u: L / 2, v: H + meters(rise))) }
        outline.append(f.world(u: 0, v: H))
        if let pts = clippedPolygon(outline) { out.append(ExteriorOverlayShape(id: "wall-\(index)", points: pts, closed: true, style: .wall, label: nil)) }
        for o in w.openings {
            if let r = rect(frame: f, u0: o.u0, v0: o.v0, u1: o.u1, v1: o.v1) {
                let label = String(format: "%@ %.1f×%.1f", o.kind.rawValue, o.widthFeet, o.heightFeet)
                out.append(ExteriorOverlayShape(id: "open-\(o.id.uuidString)", points: r, closed: true, style: .accepted, label: label))
            }
        }
        for c in candidates where c.wallIndex == index {
            if let r = rect(frame: f, u0: c.u0, v0: c.v0, u1: c.u1, v1: c.v1) {
                let label = String(format: "%@? %.1f×%.1f", c.kind.rawValue, c.widthFeet, c.heightFeet)
                out.append(ExteriorOverlayShape(id: "cand-\(c.id.uuidString)", points: r, closed: true, style: .candidate, label: label))
            }
        }
        return out
    }

    // MARK: Vision → wall space

    private func interfaceOrientation() -> UIInterfaceOrientation {
        sceneView?.window?.windowScene?.interfaceOrientation ?? .portrait
    }

    private func runVision(frame: ARFrame, wallIndex: Int) {
        guard let view = sceneView, view.bounds.width > 1 else { return }
        visionRunning = true
        let pixelBuffer = frame.capturedImage
        let size = view.bounds.size
        let transform = frame.displayTransform(for: interfaceOrientation(), viewportSize: size)
        let pose = frame.camera.transform
        let request = VNDetectRectanglesRequest { [weak self] req, _ in
            let results = (req.results as? [VNRectangleObservation]) ?? []
            var quads: [[CGPoint]] = []
            var confs: [Double] = []
            for o in results where o.confidence >= 0.5 {
                quads.append([o.topLeft, o.topRight, o.bottomRight, o.bottomLeft])
                confs.append(Double(o.confidence))
            }
            Task { @MainActor in
                self?.consumeVision(quads: quads, confidences: confs, transform: transform, size: size, pose: pose, wallIndex: wallIndex)
            }
        }
        request.maximumObservations = 16
        request.minimumAspectRatio = 0.15
        request.maximumAspectRatio = 1.0
        request.minimumSize = 0.015
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            // Raw sensor orientation. Corners are mapped through ARKit's displayTransform so they match what the user sees.
            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
            do { try handler.perform([request]) } catch { Task { @MainActor in self?.visionRunning = false } }
        }
    }

    private func poseDrifted(from a: simd_float4x4, to b: simd_float4x4) -> Bool {
        let ta = a.columns.3, tb = b.columns.3
        let moved = simd_length(SIMD3<Float>(ta.x - tb.x, ta.y - tb.y, ta.z - tb.z))
        let fa = a.columns.2, fb = b.columns.2
        let facing = simd_dot(SIMD3<Float>(fa.x, fa.y, fa.z), SIMD3<Float>(fb.x, fb.y, fb.z))
        return moved > 0.05 || facing < 0.9990
    }

    private func consumeVision(quads: [[CGPoint]], confidences: [Double], transform: CGAffineTransform, size: CGSize, pose: simd_float4x4, wallIndex: Int) {
        visionRunning = false
        guard phase == .walls, wallIndex < walls.count, let f = frameFor(wallIndex) else { return }
        // If the camera moved while Vision was running, the corner rays would be wrong. Drop this result.
        guard !poseDrifted(from: pose, to: cameraTransform) else { return }

        let wall = walls[wallIndex]
        let wallArea = max(1, wall.rectangleSquareFeet)
        var touched = Set<UUID>()

        for (qi, quad) in quads.enumerated() {
            var pts: [(u: Double, v: Double)] = []
            for q in quad {
                let imageTopLeft = CGPoint(x: q.x, y: 1 - q.y)
                let n = imageTopLeft.applying(transform)
                let vp = CGPoint(x: n.x * size.width, y: n.y * size.height)
                guard let r = rayFor(vp), let hit = f.intersect(origin: r.origin, direction: r.dir) else { break }
                let l = f.local(hit.point)
                pts.append((feet(l.u), feet(l.v)))
            }
            guard pts.count == 4 else { continue }
            let us = pts.map { $0.u }, vs = pts.map { $0.v }
            guard let u0 = us.min(), let u1 = us.max(), let v0 = vs.min(), let v1 = vs.max() else { continue }
            let w = u1 - u0, h = v1 - v0
            // A real opening is an upright rectangle in wall space. Skewed or rotated quads are siding lines, shadows, trim edges.
            var area = 0.0
            for i in 0..<4 {
                let j = (i + 1) % 4
                area += pts[i].u * pts[j].v - pts[j].u * pts[i].v
            }
            let fill = abs(area) / 2 / max(w * h, 0.01)
            guard fill > 0.85 else { continue }
            guard ExteriorOpeningPriors.plausible(widthFeet: w, heightFeet: h) else { continue }
            guard u0 > -0.5, u1 < wall.lengthFeet + 0.5, v0 > -0.7, v1 < wall.peakHeightFeet + 1.5 else { continue }
            guard w * h < wallArea * 0.5 else { continue }
            merge(rect: SIMD4<Double>(u0, v0, u1, v1), confidence: confidences[qi], wallIndex: wallIndex, touched: &touched)
        }

        let viewBounds = sceneView?.bounds ?? .zero
        for id in Array(tracks.keys) {
            guard let t = tracks[id], t.wallIndex == wallIndex, !touched.contains(id) else { continue }
            // Only count a miss if the opening should currently be on screen. Panning away is not a failed detection.
            let m = t.fused
            let center = f.world(u: meters((m[0] + m[2]) / 2), v: meters((m[1] + m[3]) / 2))
            guard let sp = project(center), viewBounds.insetBy(dx: 20, dy: 20).contains(sp) else { continue }
            var updated = t
            updated.misses += 1
            if (updated.misses > 6 && updated.hits < 5) || updated.misses > 20 {
                tracks.removeValue(forKey: id)
            } else {
                tracks[id] = updated
            }
        }
        publishCandidates(for: wallIndex)
    }

    private func merge(rect r: SIMD4<Double>, confidence: Double, wallIndex: Int, touched: inout Set<UUID>) {
        var bestID: UUID?
        var bestIoU = 0.45
        for (id, t) in tracks where t.wallIndex == wallIndex {
            let m = t.fused
            let score = ExteriorGeometry.iou((u0: m[0], v0: m[1], u1: m[2], v1: m[3]), (u0: r[0], v0: r[1], u1: r[2], v1: r[3]))
            if score > bestIoU { bestIoU = score; bestID = id }
        }
        if let id = bestID, var t = tracks[id] {
            t.samples.append(r)
            if t.samples.count > 12 { t.samples.removeFirst() }
            t.hits += 1
            t.misses = 0
            t.visionConfidence = max(t.visionConfidence * 0.9, confidence)
            tracks[id] = t
            touched.insert(id)
        } else {
            let id = UUID()
            tracks[id] = OpeningTrack(id: id, wallIndex: wallIndex, samples: [r], hits: 1, misses: 0, visionConfidence: confidence)
            touched.insert(id)
        }
    }

    private func publishCandidates(for wallIndex: Int) {
        guard wallIndex < walls.count else { return }
        var out: [ExteriorCandidate] = []
        for t in tracks.values where t.wallIndex == wallIndex && t.hits >= 3 && t.misses <= 3 {
            let m = t.fused
            let w = m[2] - m[0], h = m[3] - m[1]
            let key = (u0: m[0], v0: m[1], u1: m[2], v1: m[3])
            // Skip anything already accepted or dismissed.
            let alreadyAccepted = walls[wallIndex].openings.contains { o in
                ExteriorGeometry.iou(key, (u0: o.u0, v0: min(o.v0, o.v1), u1: o.u1, v1: max(o.v0, o.v1))) > 0.4
            }
            if alreadyAccepted { continue }
            let dismissed = rejected.contains { r in
                r.wallIndex == wallIndex && ExteriorGeometry.iou(key, (u0: r.u0, v0: r.v0, u1: r.u1, v1: r.v1)) > 0.4
            }
            if dismissed { continue }
            let guess = ExteriorOpeningPriors.classify(widthFeet: w, heightFeet: h, bottomFeet: m[1])
            let conf = 0.3 * t.visionConfidence + 0.3 * min(1, Double(t.hits) / 8) + 0.2 * guess.fit + 0.2 * t.stability
            out.append(ExteriorCandidate(id: t.id, wallIndex: wallIndex, u0: m[0], v0: m[1], u1: m[2], v1: m[3], kind: guess.kind, confidence: min(0.98, conf), hits: t.hits))
        }
        out.sort { $0.hits > $1.hits }
        let top = Array(out.prefix(80))
        candidates = top + candidates.filter { $0.wallIndex != wallIndex }
    }

    // MARK: 3D model

    /// Builds a simple textured-color model from the measured geometry (walls, gables, openings, ground footprint) and
    /// exports it as USDZ so the existing "Open saved 3D model" viewer and storage upload work unchanged.
    /// Returns nil if SceneKit cannot write the file; the scan still saves without a model.
    func exportModel(scanID: UUID) -> String? {
        guard !walls.isEmpty, !corners.isEmpty else { return nil }
        let scene = SCNScene()
        let root = scene.rootNode
        var cx: Float = 0, cz: Float = 0
        for c in corners { cx += c.x; cz += c.z }
        cx /= Float(corners.count); cz /= Float(corners.count)
        let baseY = corners.map { $0.y }.min() ?? 0

        func material(_ color: UIColor) -> SCNMaterial {
            let m = SCNMaterial()
            m.diffuse.contents = color
            m.lightingModel = .physicallyBased
            m.isDoubleSided = true
            return m
        }

        // Ground footprint slab.
        if corners.count >= 3 {
            let path = UIBezierPath()
            for (i, c) in corners.enumerated() {
                let pt = CGPoint(x: CGFloat(c.x - cx), y: CGFloat(-(c.z - cz)))
                if i == 0 { path.move(to: pt) } else { path.addLine(to: pt) }
            }
            path.close()
            let slab = SCNShape(path: path, extrusionDepth: 0.05)
            slab.materials = [material(UIColor(white: 0.82, alpha: 1))]
            let node = SCNNode(geometry: slab)
            node.eulerAngles.x = -.pi / 2
            node.position = SCNVector3(0, -0.025, 0)
            root.addChildNode(node)
        }

        for wall in walls {
            guard wall.startIndex < corners.count, wall.endIndex < corners.count,
                  let f = WallFrame(a: corners[wall.startIndex], b: corners[wall.endIndex]) else { continue }
            let L = Float(wall.lengthFeet / exteriorFeetPerMeter)
            let H = Float(wall.heightFeet / exteriorFeetPerMeter)
            let angle = atan2(-f.uHat.z, f.uHat.x)
            let mid = SIMD3<Float>(f.a.x - cx + f.uHat.x * L / 2, f.a.y - baseY, f.a.z - cz + f.uHat.z * L / 2)

            let body = SCNBox(width: CGFloat(L), height: CGFloat(H), length: 0.12, chamferRadius: 0)
            body.materials = [material(UIColor(white: 0.93, alpha: 1))]
            let bodyNode = SCNNode(geometry: body)
            bodyNode.position = SCNVector3(mid.x, mid.y + H / 2, mid.z)
            bodyNode.eulerAngles.y = angle
            root.addChildNode(bodyNode)

            if let rise = wall.gableRiseFeet, rise > 0 {
                let R = Float(rise / exteriorFeetPerMeter)
                let tri = UIBezierPath()
                tri.move(to: CGPoint(x: CGFloat(-L / 2), y: 0))
                tri.addLine(to: CGPoint(x: CGFloat(L / 2), y: 0))
                tri.addLine(to: CGPoint(x: 0, y: CGFloat(R)))
                tri.close()
                let gable = SCNShape(path: tri, extrusionDepth: 0.12)
                gable.materials = [material(UIColor(white: 0.9, alpha: 1))]
                let gNode = SCNNode(geometry: gable)
                gNode.position = SCNVector3(mid.x, mid.y + H, mid.z)
                gNode.eulerAngles.y = angle
                root.addChildNode(gNode)
            }

            for o in wall.openings {
                let w = Float(o.widthFeet / exteriorFeetPerMeter), h = Float(o.heightFeet / exteriorFeetPerMeter)
                let uc = Float((o.u0 + o.u1) / 2 / exteriorFeetPerMeter)
                let vc = Float((min(o.v0, o.v1) + max(o.v0, o.v1)) / 2 / exteriorFeetPerMeter)
                let color: UIColor
                switch o.kind {
                case .window: color = UIColor(red: 0.35, green: 0.6, blue: 0.85, alpha: 1)
                case .door: color = UIColor(red: 0.45, green: 0.3, blue: 0.2, alpha: 1)
                case .garageDoor: color = UIColor(white: 0.55, alpha: 1)
                case .opening: color = UIColor(red: 0.9, green: 0.55, blue: 0.2, alpha: 1)
                }
                let box = SCNBox(width: CGFloat(w), height: CGFloat(h), length: 0.16, chamferRadius: 0)
                box.materials = [material(color)]
                let n = SCNNode(geometry: box)
                let p = SIMD3<Float>(f.a.x - cx + f.uHat.x * uc, f.a.y - baseY + vc, f.a.z - cz + f.uHat.z * uc)
                n.position = SCNVector3(p.x, p.y, p.z)
                n.eulerAngles.y = angle
                root.addChildNode(n)
            }
        }

        let name = "exterior-\(scanID.uuidString).usdz"
        let url = AppMediaStore.url(for: name)
        try? FileManager.default.removeItem(at: url)
        let ok = scene.write(to: url, options: nil, delegate: nil, progressHandler: nil)
        return ok && FileManager.default.fileExists(atPath: url.path) ? name : nil
    }

    // MARK: Save

    func buildDetail() -> ExteriorScanDetail {
        let limitedShare = totalFrames > 0 ? Double(limitedFrames) / Double(totalFrames) : 0
        return ExteriorScanDetail(
            corners: corners.map { ExteriorCorner($0) },
            loopClosed: loopClosed,
            closureErrorFeet: closureErrorFeet,
            squaredUp: squaredUp,
            inputs: inputs,
            walls: walls,
            trackingLimitedShare: limitedShare,
            rejectedCandidateCount: rejected.count,
            assumedCorners: cornerAssumed.filter { $0 }.count
        )
    }

    func learningSamples(projectID: UUID, walkthroughID: UUID) -> [ScannerLearningSample] {
        var out: [ScannerLearningSample] = []
        for w in walls {
            for o in w.openings where o.source != "quick-add" {
                if let pw = o.predictedWidthFeet, let ph = o.predictedHeightFeet {
                    let changed = abs(pw - o.widthFeet) > 0.25 || abs(ph - o.heightFeet) > 0.25
                    let action = changed ? "edit_prediction" : "confirm_prediction"
                    out.append(ScannerLearningSample(projectID: projectID, walkthroughID: walkthroughID, mode: .exterior, feature: o.kind.featureKind, action: action, predictedWidthFeet: pw, predictedHeightFeet: ph, correctedWidthFeet: o.widthFeet, correctedHeightFeet: o.heightFeet, confidence: o.confidence))
                } else {
                    out.append(ScannerLearningSample(projectID: projectID, walkthroughID: walkthroughID, mode: .exterior, feature: o.kind.featureKind, action: "manual_teach", correctedWidthFeet: o.widthFeet, correctedHeightFeet: o.heightFeet, confidence: o.confidence))
                }
            }
            if let slope = w.gableSlopeDegrees {
                out.append(ScannerLearningSample(projectID: projectID, walkthroughID: walkthroughID, mode: .exterior, feature: .roofSlope, action: "manual_teach", correctedSlopeDegrees: slope, confidence: 0.9))
            }
        }
        for r in rejected.prefix(25) {
            out.append(ScannerLearningSample(projectID: projectID, walkthroughID: walkthroughID, mode: .exterior, feature: r.kind.featureKind, action: "reject_prediction", predictedWidthFeet: r.u1 - r.u0, predictedHeightFeet: r.v1 - r.v0, confidence: r.confidence))
        }
        return out
    }

    func makeScan(projectID: UUID, name: String, notes: String) -> (scan: WalkthroughScan, samples: [ScannerLearningSample])? {
        guard !walls.isEmpty else { return nil }
        let scanID = UUID()
        let detail = buildDetail()
        let t = ExteriorEstimator.compute(walls: walls, inputs: inputs)
        let report = ExteriorConfidence.evaluate(detail: detail)

        var jsonName: String?
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        if let data = try? encoder.encode(detail) {
            let fileName = "exterior-\(scanID.uuidString).json"
            if (try? data.write(to: AppMediaStore.url(for: fileName), options: .atomic)) != nil { jsonName = fileName }
        }

        let usdzName = exportModel(scanID: scanID)
        let entryAndGarage = t.entryDoorCount + t.garageDoorCount
        let measurement = RoomMeasurementSummary(
            wallLinearFeet: t.perimeterFeet,
            averageWallHeightFeet: t.averageHeightFeet,
            grossWallSquareFeet: t.grossSquareFeet,
            openingsSquareFeet: t.deductedSquareFeet,
            paintableWallSquareFeet: t.netSquareFeet,
            ceilingSquareFeet: nil,
            detectedDoorCount: entryAndGarage,
            detectedWindowCount: t.windowCount,
            estimatedTrimLinearFeet: inputs.includeTrim ? t.trimLinearFeet : nil
        )

        let doorRate = t.doorHours > 0 ? Double(entryAndGarage) / t.doorHours : inputs.doorRate
        let trimRateEffective = t.trimHours > 0 ? t.trimLinearFeet / t.trimHours : inputs.trimRate
        let lines: [ScopeEstimateLine] = [
            ScopeEstimateLine(kind: .walls, enabled: true, quantity: t.netSquareFeet, unit: "sq ft", productionRate: t.effectiveWallRate, laborHours: t.wallLaborHours),
            ScopeEstimateLine(kind: .doors, enabled: entryAndGarage > 0, quantity: Double(entryAndGarage), unit: "doors", productionRate: doorRate, laborHours: t.doorHours),
            ScopeEstimateLine(kind: .windows, enabled: t.windowCount > 0, quantity: Double(t.windowCount), unit: "windows", productionRate: inputs.windowRate, laborHours: t.windowHours),
            ScopeEstimateLine(kind: .trim, enabled: inputs.includeTrim && t.trimLinearFeet > 0, quantity: t.trimLinearFeet, unit: "lin ft", productionRate: trimRateEffective, laborHours: t.trimHours),
            ScopeEstimateLine(kind: .ceiling, enabled: false, quantity: 0, unit: "sq ft", productionRate: 125, laborHours: 0)
        ]
        let total = lines.filter { $0.enabled }.reduce(0) { $0 + $1.laborHours }

        let storyWord = inputs.stories == 1 ? "story" : "stories"
        var summary = "Exterior Smart Scan v3 · \(walls.count) wall\(walls.count == 1 ? "" : "s") · \(inputs.stories) \(storyWord) · \(inputs.surface.rawValue) · \(inputs.condition.rawValue) · \(inputs.application.rawValue) · \(inputs.coats) coats."
        summary += " Scan confidence \(report.label) (\(Int(report.score * 100))%). " + report.reasons.joined(separator: " ")
        if let slope = t.maxSlopeDegrees { summary += String(format: " Roof pitch about %.0f° from measured gable.", slope) }
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedNotes.isEmpty { summary += " Notes: " + trimmedNotes }

        let room = CapturedRoomSummary(id: UUID(), name: name, wallCount: walls.count, doorCount: entryAndGarage, windowCount: t.windowCount, source: .manual, verificationRequired: report.label != "High")
        let measuredWalls = walls.map { MeasuredWall(id: $0.id, lengthFeet: $0.lengthFeet, heightFeet: $0.heightFeet, grossSquareFeet: $0.grossSquareFeet) }
        let auto = AutoEstimateResult(productionSquareFeetPerHour: t.effectiveWallRate, laborHours: t.wallLaborHours, measurementsConfirmed: inputs.measurementsVerified, scopeLines: lines, totalLaborHours: total)
        let scan = WalkthroughScan(id: scanID, projectID: projectID, createdAt: .now, room: room, transcript: summary, captures: captures, videoFileName: nil, durationSeconds: nil, usdzFileName: usdzName, roomPlanJSONFileName: jsonName, measurements: measurement, autoEstimate: auto, measuredWalls: measuredWalls, archivedAt: nil)
        return (scan, learningSamples(projectID: projectID, walkthroughID: scanID))
    }
}
