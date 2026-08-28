import SwiftUI
import RoomPlan
import ARKit
import CoreImage
import UIKit

@MainActor
final class RoomScanController {
    weak var captureView: RoomCaptureView?
    private let context = CIContext()

    func finish() { captureView?.captureSession.stop() }

    func currentPixelBuffer() -> CVPixelBuffer? {
        captureView?.captureSession.arSession.currentFrame?.capturedImage
    }

    func snapshot() -> UIImage? {
        guard let frame = captureView?.captureSession.arSession.currentFrame else { return nil }
        let image = CIImage(cvPixelBuffer: frame.capturedImage)
        guard let cgImage = context.createCGImage(image, from: image.extent) else { return nil }
        return UIImage(cgImage: cgImage, scale: 1, orientation: .right)
    }
}

struct RoomPlanCaptureView: UIViewRepresentable {
    let controller: RoomScanController
    var onComplete: (CapturedRoom) -> Void
    var onError: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete, onError: onError) }

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        view.captureSession.delegate = context.coordinator
        view.isModelEnabled = true
        context.coordinator.view = view
        controller.captureView = view
        view.captureSession.run(configuration: RoomCaptureSession.Configuration())
        return view
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    static func dismantleUIView(_ uiView: RoomCaptureView, coordinator: Coordinator) {
        uiView.captureSession.stop()
    }

    final class Coordinator: NSObject, RoomCaptureSessionDelegate {
        weak var view: RoomCaptureView?
        let onComplete: (CapturedRoom) -> Void
        let onError: (String) -> Void
        var didComplete = false

        init(onComplete: @escaping (CapturedRoom) -> Void, onError: @escaping (String) -> Void) {
            self.onComplete = onComplete
            self.onError = onError
        }

        func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
            guard !didComplete else { return }
            didComplete = true
            if let error { AFPublicError.capture(error, code: .walkthroughCapture); Task { @MainActor in onError(AFPublicError.text(.walkthroughCapture, "We couldn't finish the spatial scan.")) }; return }
            Task {
                do {
                    let room = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                    await MainActor.run { self.onComplete(room) }
                } catch {
                    AFPublicError.capture(error, code: .walkthroughCapture); await MainActor.run { self.onError(AFPublicError.text(.walkthroughCapture, "We couldn't process the spatial scan.")) }
                }
            }
        }
    }
}
