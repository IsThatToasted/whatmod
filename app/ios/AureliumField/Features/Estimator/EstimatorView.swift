import SwiftUI
import RoomPlan

struct EstimatorView: View {
    @Environment(AppModel.self) private var model
    @State private var showingScan = false
    @State private var showingNarration = false
    @State private var speech = SpeechCaptureService()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AI-ASSISTED").font(.caption2.bold()).tracking(1.4).foregroundStyle(.secondary)
                    Text("Capture once. Estimate from evidence.").font(.largeTitle.bold())
                    Text("Spatial measurements, photos, narration, prep conditions, production rates, and reviewable AI scope in one walkthrough.").foregroundStyle(.secondary)
                }
                captureButton("Scan space", "Walls, doors, windows and room geometry", "viewfinder", action: { showingScan = true })
                captureButton("Narrate walkthrough", "Capture timestamped observations as you move", "waveform", action: { showingNarration = true })
                VStack(alignment: .leading, spacing: 12) {
                    HStack { Text(model.activeEstimate.title).font(.title2.bold()); Spacer(); Text("DRAFT").font(.caption2.bold()).foregroundStyle(.secondary) }
                    Divider()
                    if model.activeEstimate.rooms.isEmpty {
                        ContentUnavailableView("No rooms captured", systemImage: "ruler", description: Text("Scan the first space or enter measurements manually."))
                    } else {
                        ForEach(model.activeEstimate.rooms) { room in
                            HStack { VStack(alignment:.leading){Text(room.name).font(.headline);Text("\(room.wallCount) walls · \(room.windowCount) windows · \(room.doorCount) doors").font(.caption).foregroundStyle(.secondary)};Spacer();Image(systemName: room.verificationRequired ? "exclamationmark.triangle" : "checkmark.seal") }
                            Divider()
                        }
                    }
                }.padding().background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20))
            }.padding()
        }
        .navigationTitle("Smart Estimate").navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showingScan) {
            ZStack(alignment: .topTrailing) {
                RoomPlanCaptureView(onComplete: { room in
                    let summary = CapturedRoomSummary(id: UUID(), name: "Room \(model.activeEstimate.rooms.count + 1)", wallCount: room.walls.count, doorCount: room.doors.count, windowCount: room.windows.count, source: .roomPlan, verificationRequired: true)
                    model.activeEstimate.rooms.append(summary); showingScan = false
                }, onCancel: { showingScan = false }).ignoresSafeArea()
                Button("Done") { showingScan = false }.buttonStyle(.borderedProminent).padding()
            }
        }
        .sheet(isPresented: $showingNarration) { narrationSheet }
    }

    private func captureButton(_ title:String,_ subtitle:String,_ icon:String, action:@escaping()->Void)->some View{
        Button(action:action){HStack(spacing:14){Image(systemName:icon).font(.title2).frame(width:36);VStack(alignment:.leading,spacing:3){Text(title).font(.headline);Text(subtitle).font(.caption).foregroundStyle(.secondary)};Spacer();Image(systemName:"chevron.right").foregroundStyle(.secondary)}.padding(16).background(.thinMaterial,in:RoundedRectangle(cornerRadius:18))}.buttonStyle(.plain)
    }

    private var narrationSheet: some View {
        NavigationStack {
            VStack(alignment:.leading,spacing:18){
                Text(speech.transcript.isEmpty ? "Your narration will appear here while you walk the space." : speech.transcript).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.topLeading).padding().background(.quaternary,in:RoundedRectangle(cornerRadius:16))
                Button { Task { if speech.isRecording { speech.stop() } else if await speech.requestPermission() { try? speech.start() } } } label: { Label(speech.isRecording ? "Stop recording" : "Start recording",systemImage:speech.isRecording ? "stop.circle.fill":"mic.circle.fill").frame(maxWidth:.infinity) }.buttonStyle(.borderedProminent).controlSize(.large).tint(.primary)
            }.padding().navigationTitle("Walkthrough Notes").toolbar{ToolbarItem(placement:.confirmationAction){Button("Save"){if !speech.transcript.isEmpty{model.activeEstimate.notes.append(.init(id:UUID(),timestamp:Date(),transcript:speech.transcript))};speech.stop();showingNarration=false}}}
        }
    }
}
