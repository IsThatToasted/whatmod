import SwiftUI
import LiveKit

struct LiveVideoPreview: UIViewRepresentable {
    let track: VideoTrack?

    func makeUIView(context: Context) -> VideoView {
        let view = VideoView(frame: .zero)
        view.layoutMode = .fill
        view.clipsToBounds = true
        return view
    }

    func updateUIView(_ uiView: VideoView, context: Context) {
        uiView.track = track
    }
}
