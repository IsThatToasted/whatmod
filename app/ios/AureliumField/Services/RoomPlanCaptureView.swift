import SwiftUI
import RoomPlan

struct RoomPlanCaptureView: UIViewRepresentable {
    var onComplete: (CapturedRoom) -> Void
    var onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onComplete: onComplete) }

    func makeUIView(context: Context) -> RoomCaptureView {
        let view = RoomCaptureView(frame: .zero)
        view.captureSession.delegate = context.coordinator
        context.coordinator.view = view
        let config = RoomCaptureSession.Configuration()
        view.captureSession.run(configuration: config)
        return view
    }

    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}

    static func dismantleUIView(_ uiView: RoomCaptureView, coordinator: Coordinator) {
        uiView.captureSession.stop()
    }

    final class Coordinator: NSObject, RoomCaptureSessionDelegate {
        weak var view: RoomCaptureView?
        let onComplete: (CapturedRoom) -> Void
        init(onComplete: @escaping (CapturedRoom) -> Void) { self.onComplete = onComplete }

        func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
            guard error == nil else { return }
            Task {
                do {
                    let room = try await RoomBuilder(options: [.beautifyObjects]).capturedRoom(from: data)
                    await MainActor.run { self.onComplete(room) }
                } catch { }
            }
        }
    }
}
