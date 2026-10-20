import Foundation
import simd

// MARK: - Exterior Smart Scanner v3 · geometry, model and estimating engine
//
// Design principle: the wall is DEFINED by two footprint corners the estimator marks on the ground.
// Every other measurement (heights, openings, gables) is a camera ray intersected analytically with
// that known vertical plane. We never depend on ARKit "discovering" a wall plane on flat paint.

let exteriorFeetPerMeter: Double = 3.28084

// MARK: Persisted model

struct ExteriorCorner: Codable, Hashable {
    var x: Double
    var y: Double
    var z: Double
    init(_ v: SIMD3<Float>) { x = Double(v.x); y = Double(v.y); z = Double(v.z) }
    var vector: SIMD3<Float> { SIMD3<Float>(Float(x), Float(y), Float(z)) }
}

enum ExteriorOpeningClass: String, Codable, CaseIterable, Hashable {
    case window = "Window"
    case door = "Door"
    case garageDoor = "Garage door"
    case opening = "Opening"

    var featureKind: TaughtFeatureKind {
        switch self {
        case .window: return .window
        case .door, .garageDoor: return .door
        case .opening: return .opening
        }
    }
    var icon: String {
        switch self {
        case .window: return "rectangle.split.3x1"
        case .door: return "door.left.hand.open"
        case .garageDoor: return "car.side"
        case .opening: return "rectangle.dashed"
        }
    }
}

struct ExteriorOpening: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var kind: ExteriorOpeningClass
    /// Rectangle in wall-local feet. u runs along the wall from its start corner, v is height above local grade.
    var u0: Double
    var v0: Double
    var u1: Double
    var v1: Double
    var confidence: Double
    /// "auto-tracked" (Vision fused in wall space), "manual" (two-corner tap), "quick-add" (standard size, not measured)
    var source: String
    var assumedSize: Bool = false
    var deduct: Bool = true
    var predictedWidthFeet: Double? = nil
    var predictedHeightFeet: Double? = nil

    var widthFeet: Double { abs(u1 - u0) }
    var heightFeet: Double { abs(v1 - v0) }
    var bottomFeet: Double { min(v0, v1) }
    var areaSquareFeet: Double { widthFeet * heightFeet }
    var perimeterFeet: Double { 2 * (widthFeet + heightFeet) }

    mutating func setSize(width: Double, height: Double) {
        let cu = (u0 + u1) / 2
        u0 = cu - width / 2; u1 = cu + width / 2
        v1 = v0 + height
    }
}

struct ExteriorWall: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var label: String
    var startIndex: Int
    var endIndex: Int
    var lengthFeet: Double
    var heightFeet: Double
    var heightMeasured: Bool
    /// Gable: rise of the apex above the eave line, in feet. nil = flat top / no gable.
    var gableRiseFeet: Double? = nil
    var openings: [ExteriorOpening] = []
    var photoCaptureIDs: [UUID] = []

    var rectangleSquareFeet: Double { lengthFeet * heightFeet }
    var gableSquareFeet: Double { 0.5 * lengthFeet * (gableRiseFeet ?? 0) }
    var grossSquareFeet: Double { rectangleSquareFeet + gableSquareFeet }
    var peakHeightFeet: Double { heightFeet + (gableRiseFeet ?? 0) }
    /// Roof pitch implied by the measured gable (nil without a gable).
    var gableSlopeDegrees: Double? {
        guard let rise = gableRiseFeet, rise > 0, lengthFeet > 0 else { return nil }
        return atan2(rise, lengthFeet / 2) * 180 / .pi
    }
}

enum ExteriorSurface: String, Codable, CaseIterable, Hashable {
    case siding = "Vinyl / smooth siding"
    case lap = "Wood lap / fiber cement"
    case stucco = "Stucco"
    case masonry = "Brick / masonry"
    case shake = "Shake / rough wood"

    /// Planning multiplier on the base production rate. These are starting defaults, not measured truth.
    var productionFactor: Double {
        switch self {
        case .siding: return 1.0
        case .lap: return 0.9
        case .stucco: return 0.75
        case .masonry: return 0.7
        case .shake: return 0.6
        }
    }
}

enum ExteriorCondition: String, Codable, CaseIterable, Hashable {
    case good = "Good · wash only"
    case fair = "Fair · scrape, caulk, spot prime"
    case poor = "Poor · heavy prep"

    /// Prep labor as a fraction of paint labor.
    var prepFraction: Double {
        switch self {
        case .good: return 0.10
        case .fair: return 0.25
        case .poor: return 0.50
        }
    }
}

enum ExteriorApplication: String, Codable, CaseIterable, Hashable {
    case brushRoll = "Brush / roll"
    case spray = "Spray + back-roll"

    var productionFactor: Double { self == .brushRoll ? 1.0 : 1.8 }
}

enum ExteriorDeductPolicy: String, Codable, CaseIterable, Hashable {
    case all = "Deduct all"
    case largeOnly = "Large only (20 sq ft+)"
    case none = "Deduct none"
}

struct ExteriorEstimateInputs: Codable, Hashable {
    var stories: Int = 1
    var surface: ExteriorSurface = .siding
    var condition: ExteriorCondition = .fair
    var application: ExteriorApplication = .brushRoll
    var baseWallRate: Double = 150          // sq ft per labor hour, matches the app's existing wall default
    var coats: Int = 2
    var deductPolicy: ExteriorDeductPolicy = .all
    var includeTrim: Bool = true
    var trimRate: Double = 50               // lin ft per labor hour
    var doorRate: Double = 2                // entry doors per labor hour
    var garageDoorHours: Double = 1.5       // labor hours per garage door
    var windowRate: Double = 2              // windows per labor hour
    var measurementsVerified: Bool = false
}

struct ExteriorScanDetail: Codable, Hashable {
    var version: Int = 3
    var createdAt: Date = .now
    var corners: [ExteriorCorner]
    var loopClosed: Bool
    var closureErrorFeet: Double?
    var squaredUp: Bool
    var inputs: ExteriorEstimateInputs
    var walls: [ExteriorWall]
    var trackingLimitedShare: Double
    var rejectedCandidateCount: Int
    var assumedCorners: Int? = nil
}

// MARK: Wall coordinate frame

/// A vertical wall plane defined by two ground corners. Distances in meters; use the `*Feet` helpers for UI.
struct WallFrame {
    let a: SIMD3<Float>
    let b: SIMD3<Float>
    let uHat: SIMD3<Float>
    let normal: SIMD3<Float>
    let lengthMeters: Float

    init?(a: SIMD3<Float>, b: SIMD3<Float>) {
        let dx = b.x - a.x, dz = b.z - a.z
        let l = (dx * dx + dz * dz).squareRoot()
        guard l > 0.3 else { return nil }
        self.a = a
        self.b = b
        self.lengthMeters = l
        self.uHat = SIMD3<Float>(dx / l, 0, dz / l)
        self.normal = SIMD3<Float>(dz / l, 0, -dx / l)
    }

    var lengthFeet: Double { Double(lengthMeters) * exteriorFeetPerMeter }

    func baseY(atU u: Float) -> Float { a.y + (b.y - a.y) * (u / lengthMeters) }

    func local(_ p: SIMD3<Float>) -> (u: Float, v: Float) {
        let u = (p.x - a.x) * uHat.x + (p.z - a.z) * uHat.z
        return (u, p.y - baseY(atU: u))
    }

    func world(u: Float, v: Float) -> SIMD3<Float> {
        SIMD3<Float>(a.x + uHat.x * u, baseY(atU: u) + v, a.z + uHat.z * u)
    }

    /// Camera ray ∩ wall plane. Rejects grazing and behind-camera hits.
    func intersect(origin o: SIMD3<Float>, direction d: SIMD3<Float>) -> (point: SIMD3<Float>, t: Float)? {
        let denom = simd_dot(d, normal)
        guard abs(denom) > 0.04 else { return nil }
        let t = simd_dot(a - o, normal) / denom
        guard t > 0.2, t < 700 else { return nil }
        return (o + d * t, t)
    }
}

enum ExteriorGeometry {
    /// Quadrilateral area helper used for plausibility checks.
    static func distanceXZ(_ p: SIMD3<Float>, _ q: SIMD3<Float>) -> Float {
        let dx = p.x - q.x, dz = p.z - q.z
        return (dx * dx + dz * dz).squareRoot()
    }

    /// Interior angle at corner `b` between a→b and b→c, in degrees.
    static func cornerAngleDegrees(_ a: SIMD3<Float>, _ b: SIMD3<Float>, _ c: SIMD3<Float>) -> Double {
        let v1 = SIMD2<Float>(a.x - b.x, a.z - b.z), v2 = SIMD2<Float>(c.x - b.x, c.z - b.z)
        let n1 = simd_length(v1), n2 = simd_length(v2)
        guard n1 > 0.001, n2 > 0.001 else { return 90 }
        let cosA = max(-1, min(1, simd_dot(v1, v2) / (n1 * n2)))
        return Double(acos(cosA)) * 180 / .pi
    }

    /// For a closed 4-corner footprint within tolerance of rectangular, return corners rebuilt as a true rectangle whose
    /// side lengths are the averages of the two independent measurements of each dimension. nil when not rectangular.
    static func squaredUp(_ c: [SIMD3<Float>], maxAngleErrorDegrees: Double = 8, maxSideMismatch: Float = 0.12) -> [SIMD3<Float>]? {
        guard c.count == 4 else { return nil }
        for i in 0..<4 {
            let ang = cornerAngleDegrees(c[(i + 3) % 4], c[i], c[(i + 1) % 4])
            if abs(ang - 90) > maxAngleErrorDegrees { return nil }
        }
        let s0 = distanceXZ(c[0], c[1]), s1 = distanceXZ(c[1], c[2]), s2 = distanceXZ(c[2], c[3]), s3 = distanceXZ(c[3], c[0])
        guard abs(s0 - s2) / max(s0, s2) <= maxSideMismatch, abs(s1 - s3) / max(s1, s3) <= maxSideMismatch else { return nil }
        let w = (s0 + s2) / 2, d = (s1 + s3) / 2
        let dir0 = SIMD3<Float>(c[1].x - c[0].x, 0, c[1].z - c[0].z) / max(s0, 0.001)
        let dir1 = SIMD3<Float>(-dir0.z, 0, dir0.x)
        // Orient dir1 toward the side where c[2] actually is.
        let toC2 = SIMD3<Float>(c[2].x - c[1].x, 0, c[2].z - c[1].z)
        let sign: Float = simd_dot(dir1, toC2) >= 0 ? 1 : -1
        let p0 = c[0]
        let p1 = p0 + dir0 * w
        let p2 = p1 + dir1 * (d * sign)
        let p3 = p0 + dir1 * (d * sign)
        // Keep each corner's measured ground height.
        return [SIMD3<Float>(p0.x, c[0].y, p0.z), SIMD3<Float>(p1.x, c[1].y, p1.z), SIMD3<Float>(p2.x, c[2].y, p2.z), SIMD3<Float>(p3.x, c[3].y, p3.z)]
    }

    static func iou(_ a: (u0: Double, v0: Double, u1: Double, v1: Double), _ b: (u0: Double, v0: Double, u1: Double, v1: Double)) -> Double {
        let ix = max(0, min(a.u1, b.u1) - max(a.u0, b.u0))
        let iy = max(0, min(a.v1, b.v1) - max(a.v0, b.v0))
        let inter = ix * iy
        let areaA = (a.u1 - a.u0) * (a.v1 - a.v0), areaB = (b.u1 - b.u0) * (b.v1 - b.v0)
        let union = areaA + areaB - inter
        return union > 0 ? inter / union : 0
    }
}

// MARK: Opening classification priors

enum ExteriorOpeningPriors {
    /// Size/position priors for residential openings. Returns a class and how well the size fits that class (0...1).
    static func classify(widthFeet w: Double, heightFeet h: Double, bottomFeet b: Double) -> (kind: ExteriorOpeningClass, fit: Double) {
        let atGrade = b < 1.2
        if atGrade, (7.5...18.5).contains(w), (6.2...8.8).contains(h) { return (.garageDoor, 0.9) }
        if atGrade, (8...32).contains(w), (8.8...16).contains(h) { return (.garageDoor, 0.6) } // roll-up / dock / commercial overhead
        if atGrade, (2.3...6.8).contains(w), (6.0...8.8).contains(h) { return (.door, w < 4.3 ? 0.92 : 0.8) }
        if (0.9...40).contains(w), (1.2...20).contains(h), b >= 0.8 { return (.window, (1.5...6).contains(w) && (2...5.5).contains(h) ? 0.9 : 0.7) }
        if b < 2.5, (4.5...9.5).contains(w), (5.5...8.8).contains(h) { return (.door, 0.6) } // sliding / patio
        return (.opening, 0.4)
    }

    /// Reject geometry that cannot be a real opening before it ever reaches the estimator.
    static func plausible(widthFeet w: Double, heightFeet h: Double) -> Bool {
        w >= 0.9 && w <= 40 && h >= 1.2 && h <= 20 && w * h >= 2.2
    }

    static func standardSize(for kind: ExteriorOpeningClass) -> (w: Double, h: Double) {
        switch kind {
        case .window: return (3.0, 4.5)
        case .door: return (3.0, 6.7)
        case .garageDoor: return (9.0, 7.0)
        case .opening: return (3.0, 4.0)
        }
    }
}

// MARK: Takeoff + estimate

struct ExteriorWallTakeoff: Identifiable {
    var id: UUID
    var label: String
    var grossSquareFeet: Double
    var deductedSquareFeet: Double
    var netSquareFeet: Double
    var laborHours: Double
}

struct ExteriorTakeoff {
    var walls: [ExteriorWallTakeoff] = []
    var perimeterFeet: Double = 0
    var grossSquareFeet: Double = 0
    var gableSquareFeet: Double = 0
    var openingsSquareFeet: Double = 0
    var deductedSquareFeet: Double = 0
    var netSquareFeet: Double = 0
    var wallLaborHours: Double = 0
    var effectiveWallRate: Double = 0
    var windowCount: Int = 0
    var entryDoorCount: Int = 0
    var garageDoorCount: Int = 0
    var trimLinearFeet: Double = 0
    var trimHours: Double = 0
    var doorHours: Double = 0
    var windowHours: Double = 0
    var totalLaborHours: Double { wallLaborHours + trimHours + doorHours + windowHours }
    var averageHeightFeet: Double = 0
    var maxSlopeDegrees: Double?
}

enum ExteriorEstimator {
    /// Access penalty by working height. Replaces a flat "stories" guess once heights are measured.
    static func accessFactor(heightFeet h: Double) -> Double {
        if h <= 10.5 { return 1.0 }
        if h <= 20.5 { return 0.85 }
        if h <= 40.5 { return 0.7 }
        return 0.55   // lift / swing-stage work above ~40 ft
    }

    static func deducts(_ o: ExteriorOpening, policy: ExteriorDeductPolicy) -> Bool {
        guard o.deduct else { return false }
        switch policy {
        case .all: return true
        case .largeOnly: return o.areaSquareFeet >= 20
        case .none: return false
        }
    }

    static func compute(walls: [ExteriorWall], inputs: ExteriorEstimateInputs) -> ExteriorTakeoff {
        var t = ExteriorTakeoff()
        let coats = Double(max(1, inputs.coats))
        let baseRate = max(1, inputs.baseWallRate) * inputs.surface.productionFactor * inputs.application.productionFactor
        let prepMultiplier = 1 + inputs.condition.prepFraction
        var heightWeighted = 0.0
        for w in walls {
            let gross = w.grossSquareFeet
            let deducted = w.openings.filter { deducts($0, policy: inputs.deductPolicy) }.reduce(0) { $0 + $1.areaSquareFeet }
            let net = max(0, gross - deducted)
            // Access is judged at the working height of the wall (peak when there is a gable).
            let rate = baseRate * accessFactor(heightFeet: w.peakHeightFeet)
            let hours = net / rate * coats * prepMultiplier / 2   // base rate is quoted for a standard two-coat system
            t.walls.append(ExteriorWallTakeoff(id: w.id, label: w.label, grossSquareFeet: gross, deductedSquareFeet: deducted, netSquareFeet: net, laborHours: hours))
            t.perimeterFeet += w.lengthFeet
            t.grossSquareFeet += gross
            t.gableSquareFeet += w.gableSquareFeet
            t.openingsSquareFeet += w.openings.reduce(0) { $0 + $1.areaSquareFeet }
            t.deductedSquareFeet += deducted
            t.netSquareFeet += net
            t.wallLaborHours += hours
            heightWeighted += w.heightFeet * w.lengthFeet
            for o in w.openings {
                switch o.kind {
                case .window: t.windowCount += 1
                case .door: t.entryDoorCount += 1
                case .garageDoor: t.garageDoorCount += 1
                case .opening: break
                }
                if inputs.includeTrim, o.kind != .garageDoor, o.kind != .opening { t.trimLinearFeet += o.perimeterFeet }
            }
            if let s = w.gableSlopeDegrees { t.maxSlopeDegrees = max(t.maxSlopeDegrees ?? 0, s) }
        }
        t.averageHeightFeet = t.perimeterFeet > 0 ? heightWeighted / t.perimeterFeet : 0
        if inputs.includeTrim { t.trimLinearFeet += t.perimeterFeet }   // fascia / eave line follows the footprint
        t.trimHours = inputs.includeTrim ? t.trimLinearFeet / max(1, inputs.trimRate) * prepMultiplier : 0
        t.doorHours = Double(t.entryDoorCount) / max(0.1, inputs.doorRate) + Double(t.garageDoorCount) * inputs.garageDoorHours
        t.windowHours = Double(t.windowCount) / max(0.1, inputs.windowRate)
        t.effectiveWallRate = t.wallLaborHours > 0 ? t.netSquareFeet / t.wallLaborHours : baseRate
        return t
    }
}

// MARK: Confidence

struct ExteriorConfidenceReport {
    var score: Double
    var label: String
    var reasons: [String]
}

enum ExteriorConfidence {
    static func evaluate(detail: ExteriorScanDetail) -> ExteriorConfidenceReport {
        var score = 1.0
        var reasons: [String] = []
        let walls = detail.walls
        guard !walls.isEmpty else { return ExteriorConfidenceReport(score: 0, label: "No data", reasons: ["No walls captured."]) }

        let assumed = walls.filter { !$0.heightMeasured }.count
        if assumed > 0 {
            score -= 0.35 * Double(assumed) / Double(walls.count)
            reasons.append("\(assumed) of \(walls.count) wall heights are assumed from story count, not measured.")
        } else {
            reasons.append("All wall heights measured on the wall plane.")
        }
        if detail.loopClosed, let e = detail.closureErrorFeet {
            if e > 3 { score -= 0.2; reasons.append(String(format: "Loop closed with %.1f ft of drift. Re-walk if the building is small.", e)) }
            else { reasons.append(String(format: "Loop closed within %.1f ft.", e)) }
        } else if !detail.loopClosed, walls.count > 1 {
            score -= 0.05
            reasons.append("Footprint left open (partial scan).")
        }
        if let a = detail.assumedCorners, a > 0 {
            score -= min(0.2, 0.07 * Double(a))
            reasons.append("\(a) corner\(a == 1 ? "" : "s") placed by assumption (estimated ground or perspective). Verify the footprint.")
        }
        if detail.squaredUp { reasons.append("Opposite sides averaged into a square footprint.") }
        if detail.trackingLimitedShare > 0.25 {
            score -= 0.15
            reasons.append("Tracking was limited for \(Int(detail.trackingLimitedShare * 100))% of the scan.")
        }
        let quick = walls.flatMap(\.openings).filter { $0.assumedSize }.count
        if quick > 0 { score -= min(0.15, 0.03 * Double(quick)); reasons.append("\(quick) openings use standard sizes rather than measured sizes.") }
        let weak = walls.flatMap(\.openings).filter { $0.confidence < 0.6 }.count
        if weak > 0 { score -= min(0.1, 0.03 * Double(weak)); reasons.append("\(weak) openings have low confidence. Check them in review.") }
        score = max(0, min(1, score))
        let label = score >= 0.8 ? "High" : (score >= 0.55 ? "Medium" : "Low")
        return ExteriorConfidenceReport(score: score, label: label, reasons: reasons)
    }
}

// MARK: Story-based starting heights (used until a wall is actually measured)

enum ExteriorDefaults {
    static func assumedEaveHeightFeet(stories: Int) -> Double {
        switch max(1, stories) {
        case 1: return 9.5
        case 2: return 19.5
        default: return 9.5 + 10.0 * Double(max(1, stories) - 1)
        }
    }
}
