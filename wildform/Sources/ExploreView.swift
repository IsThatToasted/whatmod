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
            Map(position: $position) {
                UserAnnotation()
                ForEach(enemies) { enemy in
                    Annotation(enemy.name, coordinate: enemy.coordinate) {
                        Button {
                            selectedEnemy = enemy
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(.black.opacity(0.82))
                                    .frame(width: 48, height: 48)
                                    .overlay(Circle().stroke(.wfMint, lineWidth: 2))
                                Image(systemName: enemy.symbol)
                                    .foregroundStyle(.wfMint)
                            }
                            .shadow(radius: 5)
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

            VStack(spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("THE WILD")
                            .font(.caption.bold())
                            .foregroundStyle(.wfMint)
                        Text(enemies.isEmpty ? "Scan the area for lifeforms." : "\(enemies.count) lifeforms detected nearby")
                            .font(.subheadline.weight(.semibold))
                    }
                    Spacer()
                    Text("⚡ \(game.state.bioEnergy)")
                        .font(.subheadline.bold())
                }

                HStack {
                    Button {
                        spawnEnemies()
                    } label: {
                        Label("Scan Area", systemImage: "scope")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.wfPurple)

                    if locationManager.location == nil {
                        Button("Demo Location") {
                            locationManager.useDemoLocation()
                            centerOnPlayer()
                            spawnEnemies()
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .panel()
            .padding()
        }
        .background(Color.wfBackground)
        .navigationTitle("Explore")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            centerOnPlayer()
            if enemies.isEmpty { spawnEnemies() }
        }
        .onChange(of: locationManager.location?.coordinate.latitude) { _, _ in
            centerOnPlayer()
        }
        .sheet(item: $selectedEnemy) { enemy in
            BattleView(enemy: enemy) {
                enemies.removeAll { $0.id == enemy.id }
                selectedEnemy = nil
            }
            .presentationDetents([.large])
        }
    }

    private func centerOnPlayer() {
        guard let coordinate = locationManager.location?.coordinate else { return }
        position = .region(MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.012, longitudeDelta: 0.012)
        ))
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

        enemies = (0..<5).map { index in
            let template = templates.randomElement()!
            let angle = Double(index) * (Double.pi * 2 / 5) + Double.random(in: -0.35...0.35)
            let distance = Double.random(in: 0.0014...0.0036)
            return WildEnemy(
                name: template.0,
                level: max(1, game.state.level + Int.random(in: -1...2)),
                affinity: template.1,
                latitude: base.latitude + sin(angle) * distance,
                longitude: base.longitude + cos(angle) * distance,
                symbol: template.2,
                baseHP: 65 + game.state.level * 12
            )
        }
    }
}
