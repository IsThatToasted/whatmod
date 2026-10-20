import SwiftUI
import UIKit

/// Identifiable wrapper so a gallery can be presented with `.fullScreenCover(item:)`.
struct EvidenceGalleryItem: Identifiable {
    let id = UUID()
    var captures: [TaggedCapture]
    var startIndex: Int
}

/// Full-screen viewer for tagged evidence photos (PAINT, COVER, DAMAGE, ...).
/// Swipe left/right to move through every photo, pinch or double-tap to zoom, Close to leave.
struct EvidenceGalleryView: View {
    let item: EvidenceGalleryItem
    @Environment(\.dismiss) private var dismiss
    @State private var index: Int

    init(item: EvidenceGalleryItem) {
        self.item = item
        _index = State(initialValue: min(max(0, item.startIndex), max(0, item.captures.count - 1)))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            TabView(selection: $index) {
                ForEach(Array(item.captures.enumerated()), id: \.element.id) { i, capture in
                    page(for: capture).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            VStack {
                HStack {
                    Button { dismiss() } label: {
                        Label("Close", systemImage: "xmark")
                            .font(.subheadline.bold()).padding(.horizontal, 14).padding(.vertical, 9)
                            .background(.black.opacity(0.65), in: Capsule()).foregroundStyle(.white)
                    }
                    Spacer()
                    Text("\(index + 1) of \(item.captures.count)")
                        .font(.subheadline.bold()).padding(.horizontal, 14).padding(.vertical, 9)
                        .background(.black.opacity(0.65), in: Capsule()).foregroundStyle(.white)
                }
                .padding(.horizontal).padding(.top, 8)
                Spacer()
                if item.captures.indices.contains(index) { caption(for: item.captures[index]) }
            }
            .padding(.bottom, 12)
        }
        .statusBarHidden(false)
    }

    @ViewBuilder
    private func page(for capture: TaggedCapture) -> some View {
        if let data = try? Data(contentsOf: AppMediaStore.url(for: capture.imageFileName)), let image = UIImage(data: data) {
            ZoomableImageView(image: image).ignoresSafeArea()
        } else {
            VStack(spacing: 8) {
                Image(systemName: "photo.badge.exclamationmark").font(.largeTitle)
                Text("Photo not available on this device").font(.subheadline)
            }.foregroundStyle(.white.opacity(0.8))
        }
    }

    private func caption(for capture: TaggedCapture) -> some View {
        VStack(spacing: 4) {
            Label(capture.tag.rawValue, systemImage: capture.tag.icon).font(.headline)
            if let note = capture.note, !note.isEmpty { Text(note).font(.subheadline) }
            Text(capture.capturedAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).opacity(0.75)
        }
        .foregroundStyle(.white).padding(.horizontal, 16).padding(.vertical, 10)
        .background(.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 14))
    }
}

/// UIScrollView-backed zoom: pinch, pan while zoomed, double-tap to toggle.
struct ZoomableImageView: UIViewRepresentable {
    let image: UIImage

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.minimumZoomScale = 1
        scroll.maximumZoomScale = 6
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.backgroundColor = .black
        let imageView = UIImageView(image: image)
        imageView.contentMode = .scaleAspectFit
        imageView.frame = scroll.bounds
        imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        scroll.addSubview(imageView)
        context.coordinator.imageView = imageView
        context.coordinator.scrollView = scroll
        let doubleTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTapped(_:)))
        doubleTap.numberOfTapsRequired = 2
        scroll.addGestureRecognizer(doubleTap)
        return scroll
    }

    func updateUIView(_ uiView: UIScrollView, context: Context) {}

    final class Coordinator: NSObject, UIScrollViewDelegate {
        weak var imageView: UIImageView?
        weak var scrollView: UIScrollView?

        func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

        @objc func doubleTapped(_ gesture: UITapGestureRecognizer) {
            guard let scroll = scrollView else { return }
            if scroll.zoomScale > 1.01 {
                scroll.setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: imageView)
                let target: CGFloat = 3
                let size = CGSize(width: scroll.bounds.width / target, height: scroll.bounds.height / target)
                let rect = CGRect(x: point.x - size.width / 2, y: point.y - size.height / 2, width: size.width, height: size.height)
                scroll.zoom(to: rect, animated: true)
            }
        }
    }
}
