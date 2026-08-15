import Foundation
import LiveKit

@MainActor
final class LiveStreamManager: ObservableObject {
    enum State: String {
        case idle = "OFFLINE"
        case connecting = "CONNECTING"
        case live = "LIVE"
        case stopping = "STOPPING"
        case failed = "ERROR"
    }

    @Published var state: State = .idle
    @Published var errorMessage: String?

    private(set) var room: Room?

    func start(url: String, token: String) async throws {
        state = .connecting
        errorMessage = nil

        do {
            let room = Room()
            self.room = room
            try await room.connect(url: url, token: token)

            // LiveKit manages the underlying WebRTC camera and microphone tracks.
            try await room.localParticipant.setCamera(enabled: true)
            try await room.localParticipant.setMicrophone(enabled: true)

            state = .live
        } catch {
            state = .failed
            errorMessage = error.localizedDescription
            throw error
        }
    }

    func stop() async {
        state = .stopping
        if let room {
            try? await room.localParticipant.setCamera(enabled: false)
            try? await room.localParticipant.setMicrophone(enabled: false)
            await room.disconnect()
        }
        room = nil
        state = .idle
    }
}
