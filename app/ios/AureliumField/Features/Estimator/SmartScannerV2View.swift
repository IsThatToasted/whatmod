import SwiftUI

struct SmartScannerV2View: View {
    let project: ProjectSummary
    let roomCount: Int
    let onInterior: () -> Void
    let onExterior: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 8) {
                Image(systemName: "viewfinder.circle.fill").font(.system(size: 48))
                Text("Smart Scanner").font(.largeTitle.bold())
                Text("One walkthrough experience, with a capture engine optimized for where you're working.")
                    .multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .padding(.top, 24)

            modeCard(title: "Interior", subtitle: "RoomPlan + LiDAR · walls, doors, windows, ceiling and trim", icon: "house.fill", action: onInterior)
            modeCard(title: "Exterior", subtitle: "Mark the footprint, then measure walls, gables and openings on known wall planes · works with or without LiDAR", icon: "building.2.fill", action: onExterior)

            VStack(alignment: .leading, spacing: 6) {
                Label("Every correction improves the scanner", systemImage: "brain.head.profile")
                    .font(.subheadline.bold())
                Text("Corrections become labeled examples for future model training. Aurelium never silently changes measurements from learned behavior without confidence and review.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(14).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
            Spacer()
        }
        .padding()
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func modeCard(title: String, subtitle: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title2).frame(width: 42, height: 42).background(.primary.opacity(0.08), in: Circle())
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.title3.bold()); Text(subtitle).font(.caption).foregroundStyle(.secondary) }
                Spacer(); Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding(16).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20))
        }.buttonStyle(.plain)
    }
}
