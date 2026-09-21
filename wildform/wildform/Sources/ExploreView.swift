import SwiftUI
import MapKit

struct ExploreView: View {
    @EnvironmentObject private var game: GameStore
    @EnvironmentObject private var locationManager: LocationManager

    @State private var enemies: [WildEnemy] = []
    @State private var selectedEnemy: WildEnemy?
    @State private var position: MapCameraPosition = .automatic
    @State private var scanPulse = false

    var body: some View {
        ZStack(alignment: .bottom) {
            explorationMap
            mapAtmosphere
            scanPanel
        }
        .background(Color.wfBackground)
        .navigationTitle("Explore")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: handleAppear)
        .onChange(of: locationManager.location?.coordinate.latitude) { _, _ in centerOnPlayer() }
        .sheet(item: $selectedEnemy) { enemy in
            BattleView(enemy: enemy) { removeEnemy(enemy) }
                .presentationDetents([.large])
        }
    }

    private var explorationMap: some View {
        Map(position: $position) {
            UserAnnotation()
            ForEach(enemies) { enemy in
                Annotation(enemy.name, coordinate: enemy.coordinate) {
                    EnemyMapMarker(enemy: enemy) { selectedEnemy = enemy }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic, emphasis: .automatic, pointsOfInterest: .excludingAll, showsTraffic: false))
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
        .ignoresSafeArea(edges: .bottom)
    }

    private var mapAtmosphere: some View {
        LinearGradient(colors: [.clear, Color.wfBackground.opacity(0.06), Color.wfBackground.opacity(0.28)], startPoint: .top, endPoint: .bottom)
            .allowsHitTesting(false)
            .ignoresSafeArea()
    }

    private var scanPanel: some View {
        VStack(spacing: 11) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Circle().fill(Color.wfMint).frame(width: 7, height: 7)
                        Text("THE WILD IS ACTIVE")
                            .font(.caption2.bold())
                            .tracking(1.3)
                            .foregroundStyle(Color.wfMint)
                    }
                    Text(scanStatusText)
                        .font(.subheadline.weight(.semibold))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    CurrencyChip(icon: "bolt.fill", value: game.state.bioEnergy, tint: .wfMint)
                    Text("Nearby biome: Mixed")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 9) {
                Button(action: scan) {
                    Label("Pulse Scan", systemImage: "scope")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.wfPurple)
                .scaleEffect(scanPulse ? 0.97 : 1)

                if locationManager.location == nil {
                    Button("Demo Location", action: useDemoLocation)
                        .buttonStyle(.bordered)
                }
            }

            if !enemies.isEmpty {
                HStack(spacing: 14) {
                    Label("\(rarityCount(.rare) + rarityCount(.aberrant)) rare signals", systemImage: "sparkles")
                    Spacer()
                    Label("\(enemies.count) targets", systemImage: "dot.radiowaves.left.and.right")
                }
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            }
        }
        .panel(emphasized: true)
        .padding()
    }

    private var scanStatusText: String {
        enemies.isEmpty ? "Send out a pulse to reveal nearby lifeforms." : "\(enemies.count) lifeforms are resonating nearby."
    }

    private func handleAppear() {
        centerOnPlayer()
        if enemies.isEmpty { spawnEnemies() }
    }

    private func scan() {
        FeedbackManager.shared.play(.scan, enabled: game.state.soundEnabled)
        game.recordScan()
        withAnimation(.spring(response: 0.25, dampingFraction: 0.55)) { scanPulse = true }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 180_000_000)
            scanPulse = false
        }
        spawnEnemies()
    }

    private func useDemoLocation() {
        locationManager.useDemoLocation()
        centerOnPlayer()
        scan()
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
            ("Ripplefin", .tide, "drop.fill"),
            ("Bramblebit", .flora, "tree.fill"),
            ("Duskmote", .shadow, "sparkle"),
            ("Rivetusk", .feral, "shield.fill")
        ]

        var spawned: [WildEnemy] = []
        for index in 0..<6 {
            guard let template = templates.randomElement() else { continue }
            let angle = Double(index) * (Double.pi * 2.0 / 6.0) + Double.random(in: -0.40...0.40)
            let distance = Double.random(in: 0.0014...0.0042)
            let rarity = rollRarity()
            let multiplier = rarity.rewardMultiplier
            spawned.append(
                WildEnemy(
                    name: template.0,
                    level: max(1, game.state.level + Int.random(in: -1...2) + max(0, multiplier - 2)),
                    affinity: template.1,
                    latitude: base.latitude + sin(angle) * distance,
                    longitude: base.longitude + cos(angle) * distance,
                    symbol: template.2,
                    baseHP: 58 + game.state.level * 11 + multiplier * 9,
                    seed: Int.random(in: 10_000...999_999),
                    rarity: rarity
                )
            )
        }
        enemies = spawned
    }

    private func rollRarity() -> EncounterRarity {
        let roll = Int.random(in: 1...100)
        if roll <= 4 { return .aberrant }
        if roll <= 15 { return .rare }
        if roll <= 42 { return .uncommon }
        return .common
    }

    private func rarityCount(_ rarity: EncounterRarity) -> Int {
        enemies.filter { $0.rarity == rarity }.count
    }
}

private struct EnemyMapMarker: View {
    let enemy: WildEnemy
    let action: () -> Void
    @State private var pulse = false

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .stroke(markerColor.opacity(0.35), lineWidth: 2)
                    .frame(width: 58, height: 58)
                    .scaleEffect(pulse ? 1.22 : 0.82)
                    .opacity(pulse ? 0 : 0.9)

                Circle()
                    .fill(Color.wfBackground.opacity(0.92))
                    .frame(width: 46, height: 46)
                    .overlay(Circle().stroke(markerColor, lineWidth: 2))

                Image(systemName: enemy.symbol)
                    .foregroundStyle(markerColor)
            }
            .shadow(color: markerColor.opacity(0.30), radius: 6)
        }
        .buttonStyle(.plain)
        .onAppear {
            withAnimation(.easeOut(duration: 1.35).repeatForever(autoreverses: false)) { pulse = true }
        }
    }

    private var markerColor: Color {
        switch enemy.rarity {
        case .common: return .wfMint
        case .uncommon: return .cyan
        case .rare: return .wfPurple
        case .aberrant: return .wfPink
        }
    }
}
