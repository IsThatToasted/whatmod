import SwiftUI
import MapKit

struct ExploreView: View {
    @EnvironmentObject private var game: GameStore
    @EnvironmentObject private var locationManager: LocationManager

    @State private var enemies: [WildEnemy] = []
    @State private var selectedEnemy: WildEnemy?
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        ZStack(alignment: .bottom) {
            explorationMap
            scanPanel
        }
        .background(Color.wfBackground)
        .navigationTitle("Explore")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: handleAppear)
        .onChange(of: locationManager.location?.coordinate.latitude) { _, _ in
            centerOnPlayer()
        }
        .sheet(item: $selectedEnemy) { enemy in
            BattleView(enemy: enemy) {
                removeEnemy(enemy)
            }
            .presentationDetents([.large])
        }
    }

    private var explorationMap: some View {
        Map(position: $position) {
            UserAnnotation()

            ForEach(enemies) { enemy in
                Annotation(enemy.name, coordinate: enemy.coordinate) {
                    EnemyMapMarker(enemy: enemy) {
                        selectedEnemy = enemy
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .ignoresSafeArea(edges: .bottom)
    }

    private var scanPanel: some View {
        VStack(spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("THE WILD")
                        .font(.caption.bold())
                        .foregroundStyle(Color.wfMint)
                    Text(scanStatusText)
                        .font(.subheadline.weight(.semibold))
                }

                Spacer()

                Text("⚡ \(game.state.bioEnergy)")
                    .font(.subheadline.bold())
            }

            HStack {
                Button(action: spawnEnemies) {
                    Label("Scan Area", systemImage: "scope")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.wfPurple)

                if locationManager.location == nil {
                    Button("Demo Location", action: useDemoLocation)
                        .buttonStyle(.bordered)
                }
            }
        }
        .panel()
        .padding()
    }

    private var scanStatusText: String {
        enemies.isEmpty ? "Scan the area for lifeforms." : "\(enemies.count) lifeforms detected nearby"
    }

    private func handleAppear() {
        centerOnPlayer()
        if enemies.isEmpty {
            spawnEnemies()
        }
    }

    private func useDemoLocation() {
        locationManager.useDemoLocation()
        centerOnPlayer()
        spawnEnemies()
    }

    private func removeEnemy(_ enemy: WildEnemy) {
        enemies.removeAll { $0.id == enemy.id }
        selectedEnemy = nil
    }

    private func centerOnPlayer() {
        guard let coordinate = locationManager.location?.coordinate else { return }
        let span = MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)
        position = .region(MKCoordinateRegion(center: coordinate, span: span))
    }

    private func spawnEnemies() {
        guard let base = locationManager.location?.coordinate else { return }

        let templates: [(String, Affinity, String)] = [
            ("Scrapjaw", .feral, "pawprint.fill"),
            ("Cinderimp", .ember, "flame.fill"),
            ("Mossback", .flora, "leaf.fill"),
            ("Voltwing", .storm, "bolt.fill"),
            ("Gloomlet", .shadow, "moon.fill"),
            ("Ripplefin", .tide, "drop.fill")
        ]

        var spawned: [WildEnemy] = []
        for index in 0..<5 {
            guard let template = templates.randomElement() else { continue }
            let angle = Double(index) * (Double.pi * 2.0 / 5.0) + Double.random(in: -0.35...0.35)
            let distance = Double.random(in: 0.0014...0.0036)
            let enemy = WildEnemy(
                name: template.0,
                level: max(1, game.state.level + Int.random(in: -1...2)),
                affinity: template.1,
                latitude: base.latitude + sin(angle) * distance,
                longitude: base.longitude + cos(angle) * distance,
                symbol: template.2,
                baseHP: 65 + game.state.level * 12
            )
            spawned.append(enemy)
        }
        enemies = spawned
    }
}

private struct EnemyMapMarker: View {
    let enemy: WildEnemy
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(Color.black.opacity(0.82))
                    .frame(width: 48, height: 48)
                    .overlay(Circle().stroke(Color.wfMint, lineWidth: 2))

                Image(systemName: enemy.symbol)
                    .foregroundStyle(Color.wfMint)
            }
            .shadow(radius: 5)
        }
        .buttonStyle(.plain)
    }
}
