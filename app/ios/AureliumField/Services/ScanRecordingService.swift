import Foundation
import Observation
import AVFoundation
import CoreImage

/// Records the actual AR camera frames used by RoomPlan instead of relying on ReplayKit.
/// Video is supplemental evidence: a recording failure never prevents the spatial scan from completing.
@MainActor @Observable
final class ScanRecordingService {
    var isRecording = false
    var errorMessage: String?
    var statusText = "Preparing video"

    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var captureTask: Task<Void, Never>?
    private var startedAt: Date?
    private var firstFrameDate: Date?
    private var outputName: String?
    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    private let outputWidth = 720
    private let outputHeight = 1280

    func start(controller: RoomScanController) async {
        discard()
        errorMessage = nil
        statusText = "Preparing video"
        startedAt = .now
        isRecording = true

        captureTask = Task { @MainActor [weak self] in
            guard let self else { return }
            // Give RoomPlan a moment to deliver its first AR frame.
            var missedFrames = 0
            while !Task.isCancelled && self.isRecording {
                if let source = controller.currentPixelBuffer() {
                    do {
                        try self.append(source)
                        self.statusText = "Video recording"
                        missedFrames = 0
                    } catch {
                        self.errorMessage = "Video capture paused: \(error.localizedDescription)"
                        self.isRecording = false
                        break
                    }
                } else {
                    missedFrames += 1
                    if missedFrames > 30 {
                        self.errorMessage = "The scan is continuing, but no camera frames were available for the review video."
                        self.isRecording = false
                        break
                    }
                }
                try? await Task.sleep(for: .milliseconds(100)) // ~10 fps; enough for walkthrough review, much lighter than 30/60 fps.
            }
        }
    }

    func stop() async -> (fileName: String?, duration: Double?) {
        let duration = startedAt.map { Date().timeIntervalSince($0) }
        isRecording = false
        captureTask?.cancel()
        captureTask = nil

        guard let writer, let input, let outputName else {
            resetWriterState()
            return (nil, duration)
        }

        input.markAsFinished()
        let finalStatus: AVAssetWriter.Status = await withCheckedContinuation { continuation in
            writer.finishWriting { continuation.resume(returning: writer.status) }
        }

        let output = AppMediaStore.url(for: outputName)
        if finalStatus == .completed, FileManager.default.fileExists(atPath: output.path) {
            let size = (try? output.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            if size > 1024 {
                resetWriterState()
                return (outputName, duration)
            }
        }

        let message = writer.error?.localizedDescription ?? "The review video could not be finalized."
        errorMessage = "The RoomPlan scan was saved, but its optional review video was not: \(message)"
        try? FileManager.default.removeItem(at: output)
        resetWriterState()
        return (nil, duration)
    }

    func discard() {
        isRecording = false
        captureTask?.cancel()
        captureTask = nil
        writer?.cancelWriting()
        if let outputName { try? FileManager.default.removeItem(at: AppMediaStore.url(for: outputName)) }
        resetWriterState()
    }

    private func append(_ source: CVPixelBuffer) throws {
        if writer == nil { try configureWriter() }
        guard let writer, let input, let adaptor else { return }
        guard input.isReadyForMoreMediaData else { return }
        guard let pool = adaptor.pixelBufferPool else { throw RecorderError.pixelBufferPoolUnavailable }

        var destination: CVPixelBuffer?
        let status = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &destination)
        guard status == kCVReturnSuccess, let destination else { throw RecorderError.pixelBufferCreationFailed }

        // ARKit delivers the camera image in sensor orientation. Rotate it into portrait and aspect-fill
        // a modest 720x1280 review file to keep cloud uploads and on-device storage reasonable.
        let portrait = CIImage(cvPixelBuffer: source).oriented(.right)
        let target = CGRect(x: 0, y: 0, width: outputWidth, height: outputHeight)
        let scale = max(target.width / portrait.extent.width, target.height / portrait.extent.height)
        var transformed = portrait.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let dx = (target.width - transformed.extent.width) / 2 - transformed.extent.origin.x
        let dy = (target.height - transformed.extent.height) / 2 - transformed.extent.origin.y
        transformed = transformed.transformed(by: CGAffineTransform(translationX: dx, y: dy))
        ciContext.render(transformed, to: destination, bounds: target, colorSpace: CGColorSpaceCreateDeviceRGB())

        let now = Date()
        if firstFrameDate == nil {
            firstFrameDate = now
            writer.startWriting()
            writer.startSession(atSourceTime: .zero)
        }
        guard writer.status == .writing else { throw writer.error ?? RecorderError.writerNotWriting }
        let elapsed = now.timeIntervalSince(firstFrameDate ?? now)
        let time = CMTime(seconds: elapsed, preferredTimescale: 600)
        if !adaptor.append(destination, withPresentationTime: time) {
            throw writer.error ?? RecorderError.appendFailed
        }
    }

    private func configureWriter() throws {
        let name = "scan-\(UUID().uuidString).mp4"
        let output = AppMediaStore.url(for: name)
        try? FileManager.default.removeItem(at: output)

        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: outputWidth,
            AVVideoHeightKey: outputHeight,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 2_000_000,
                AVVideoExpectedSourceFrameRateKey: 10,
                AVVideoMaxKeyFrameIntervalKey: 20,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264MainAutoLevel
            ]
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else { throw RecorderError.cannotAddInput }
        writer.add(input)

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
                kCVPixelBufferWidthKey as String: outputWidth,
                kCVPixelBufferHeightKey as String: outputHeight,
                kCVPixelBufferIOSurfacePropertiesKey as String: [:]
            ]
        )
        self.writer = writer
        self.input = input
        self.adaptor = adaptor
        self.outputName = name
    }

    private func resetWriterState() {
        writer = nil
        input = nil
        adaptor = nil
        outputName = nil
        startedAt = nil
        firstFrameDate = nil
        statusText = "Video unavailable"
    }

    private enum RecorderError: LocalizedError {
        case pixelBufferPoolUnavailable, pixelBufferCreationFailed, writerNotWriting, appendFailed, cannotAddInput
        var errorDescription: String? {
            switch self {
            case .pixelBufferPoolUnavailable: return "Video buffer pool is unavailable."
            case .pixelBufferCreationFailed: return "A video frame could not be allocated."
            case .writerNotWriting: return "The video writer did not enter the recording state."
            case .appendFailed: return "A camera frame could not be written."
            case .cannotAddInput: return "The device could not configure the video encoder."
            }
        }
    }
}
