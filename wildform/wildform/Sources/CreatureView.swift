import SwiftUI

struct CreatureView: View {
    let species: String
    var size: CGFloat = 170
    var seed: Int = 731_921
    var cosmetics: [CosmeticSlot: String] = [:]
    var animated = true

    @State private var floating = false

    init(species: String, size: CGFloat = 170, seed: Int = 731_921, cosmetics: [CosmeticSlot: String] = [:], animated: Bool = true) {
        self.species = species
        self.size = size
        self.seed = seed
        self.cosmetics = cosmetics
        self.animated = animated
    }

    init(state: PlayerState, size: CGFloat = 170, animated: Bool = true) {
        species = state.species
        self.size = size
        seed = state.genomeSeed
        cosmetics = state.equippedCosmetics
        self.animated = animated
    }

    private var genome: CreatureGenome { CreatureGenome(seed: seed, species: species) }
    private var palette: CreaturePalette { CreaturePalette(species: species, genome: genome) }

    var body: some View {
        ZStack {
            CreatureAura(size: size, palette: palette, cosmetic: cosmetics[.aura])
            CreatureTail(size: size, variant: genome.tailVariant, palette: palette)
            CreatureLegs(size: size, palette: palette)
            CreatureBody(size: size, variant: genome.bodyVariant, palette: palette, marking: cosmetics[.marking], genome: genome)
            CreatureHead(size: size, genome: genome, palette: palette, species: species, headCosmetic: cosmetics[.head])
            CreatureTrail(size: size, cosmetic: cosmetics[.trail])
        }
        .frame(width: size * 1.55, height: size * 1.55)
        .offset(y: animated && floating ? -size * 0.025 : size * 0.018)
        .rotationEffect(.degrees(animated && floating ? 1.2 : -1.2))
        .animation(animated ? .easeInOut(duration: 1.45).repeatForever(autoreverses: true) : nil, value: floating)
        .onAppear { floating = true }
        .accessibilityLabel("\(species) creature")
    }
}

private struct CreaturePalette {
    let primary: Color
    let secondary: Color
    let glow: Color
    let belly: Color

    init(species: String, genome: CreatureGenome) {
        switch species {
        case "Emberling":
            primary = Color(red: 0.96, green: 0.34, blue: 0.20)
            secondary = .orange
            glow = .yellow
            belly = Color(red: 1.0, green: 0.72, blue: 0.38)
        case "Thornling":
            primary = Color(red: 0.24, green: 0.68, blue: 0.38)
            secondary = Color(red: 0.47, green: 0.90, blue: 0.42)
            glow = .green
            belly = Color(red: 0.65, green: 0.88, blue: 0.55)
        case "Stormling":
            primary = Color(red: 0.20, green: 0.68, blue: 0.94)
            secondary = Color(red: 0.50, green: 0.90, blue: 1.0)
            glow = .cyan
            belly = Color(red: 0.66, green: 0.86, blue: 1.0)
        case "Tideling":
            primary = Color(red: 0.16, green: 0.47, blue: 0.92)
            secondary = Color(red: 0.25, green: 0.83, blue: 0.90)
            glow = .cyan
            belly = Color(red: 0.63, green: 0.89, blue: 0.94)
        case "Shadeling":
            primary = Color(red: 0.31, green: 0.22, blue: 0.53)
            secondary = Color(red: 0.64, green: 0.43, blue: 0.92)
            glow = Color.wfPurple
            belly = Color(red: 0.57, green: 0.49, blue: 0.72)
        case "Fangling":
            primary = Color(red: 0.67, green: 0.37, blue: 0.26)
            secondary = Color(red: 0.95, green: 0.60, blue: 0.29)
            glow = .orange
            belly = Color(red: 0.87, green: 0.68, blue: 0.46)
        default:
            let shift = Double(genome.seed % 5) * 0.025
            primary = Color(red: 0.48 + shift, green: 0.36, blue: 0.88)
            secondary = Color(red: 0.35, green: 0.83, blue: 0.70 + shift)
            glow = Color.wfPurple
            belly = Color(red: 0.72, green: 0.66, blue: 0.92)
        }
    }
}

private struct CreatureAura: View {
    let size: CGFloat
    let palette: CreaturePalette
    let cosmetic: String?
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .fill(palette.glow.opacity(0.14))
                .frame(width: size * 1.18)
                .blur(radius: 5)
                .scaleEffect(pulse ? 1.07 : 0.94)

            if cosmetic == "aura.fireflies" {
                ForEach(0..<6, id: \.self) { index in
                    Circle()
                        .fill(index.isMultiple(of: 2) ? Color.wfMint : .yellow)
                        .frame(width: size * 0.035)
                        .offset(x: cos(Double(index) * .pi / 3) * size * 0.58,
                                y: sin(Double(index) * .pi / 3) * size * 0.48)
                        .blur(radius: 0.4)
                }
            } else if cosmetic == "aura.storm" {
                Image(systemName: "bolt.fill")
                    .font(.system(size: size * 0.23, weight: .bold))
                    .foregroundStyle(.cyan.opacity(0.7))
                    .offset(x: -size * 0.48, y: -size * 0.24)
                Image(systemName: "bolt.fill")
                    .font(.system(size: size * 0.16, weight: .bold))
                    .foregroundStyle(.white.opacity(0.65))
                    .offset(x: size * 0.49, y: size * 0.08)
            } else if cosmetic == "aura.cosmic" {
                Circle()
                    .stroke(AngularGradient(colors: [.purple, .cyan, .pink, .purple], center: .center), lineWidth: size * 0.035)
                    .frame(width: size * 1.14)
                    .blur(radius: 2)
                    .opacity(0.75)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true)) {
                pulse.toggle()
            }
        }
    }
}

private struct CreatureTail: View {
    let size: CGFloat
    let variant: Int
    let palette: CreaturePalette

    var body: some View {
        Group {
            if variant == 0 {
                Capsule()
                    .fill(palette.primary.gradient)
                    .frame(width: size * 0.17, height: size * 0.66)
                    .rotationEffect(.degrees(-58))
            } else if variant == 1 {
                Capsule()
                    .fill(palette.secondary.gradient)
                    .frame(width: size * 0.13, height: size * 0.74)
                    .overlay(Capsule().stroke(.white.opacity(0.12)))
                    .rotationEffect(.degrees(-72))
            } else if variant == 2 {
                ZStack {
                    Capsule().fill(palette.primary).frame(width: size * 0.14, height: size * 0.54)
                    Circle().fill(palette.glow).frame(width: size * 0.24)
                        .offset(y: -size * 0.28)
                }
                .rotationEffect(.degrees(-52))
            } else {
                Image(systemName: "leaf.fill")
                    .font(.system(size: size * 0.44))
                    .foregroundStyle(palette.secondary.gradient)
                    .rotationEffect(.degrees(-28))
            }
        }
        .offset(x: size * 0.43, y: size * 0.26)
    }
}

private struct CreatureLegs: View {
    let size: CGFloat
    let palette: CreaturePalette

    var body: some View {
        HStack(spacing: size * 0.36) {
            Capsule().fill(palette.primary.gradient).frame(width: size * 0.15, height: size * 0.47).rotationEffect(.degrees(7))
            Capsule().fill(palette.primary.gradient).frame(width: size * 0.15, height: size * 0.47).rotationEffect(.degrees(-7))
        }
        .offset(y: size * 0.39)
    }
}

private struct CreatureBody: View {
    let size: CGFloat
    let variant: Int
    let palette: CreaturePalette
    let marking: String?
    let genome: CreatureGenome

    var widthScale: CGFloat { variant == 0 ? 0.72 : (variant == 1 ? 0.82 : 0.66) }
    var heightScale: CGFloat { variant == 2 ? 0.70 : 0.62 }

    var body: some View {
        ZStack {
            Capsule()
                .fill(LinearGradient(colors: [palette.secondary, palette.primary], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: size * widthScale, height: size * heightScale)
                .overlay(Capsule().stroke(.white.opacity(0.11), lineWidth: 1))

            Ellipse()
                .fill(palette.belly.opacity(0.7))
                .frame(width: size * 0.40, height: size * 0.38)
                .offset(y: size * 0.07)

            if marking == "mark.speckles" || (marking == nil && genome.markingVariant == 1) {
                HStack(spacing: size * 0.06) {
                    Circle().frame(width: size * 0.04)
                    Circle().frame(width: size * 0.028)
                    Circle().frame(width: size * 0.038)
                }
                .foregroundStyle(.white.opacity(0.6))
                .offset(y: size * 0.02)
            } else if marking == "mark.runes" {
                Image(systemName: "scribble.variable")
                    .font(.system(size: size * 0.25, weight: .bold))
                    .foregroundStyle(Color.wfMint.opacity(0.75))
                    .offset(y: size * 0.03)
            }
        }
        .offset(y: size * 0.22)
    }
}

private struct CreatureHead: View {
    let size: CGFloat
    let genome: CreatureGenome
    let palette: CreaturePalette
    let species: String
    let headCosmetic: String?

    var body: some View {
        ZStack {
            CreatureEars(size: size, variant: genome.earVariant, palette: palette)
            CreatureHorns(size: size, variant: genome.hornVariant, palette: palette, species: species)

            Ellipse()
                .fill(LinearGradient(colors: [palette.secondary, palette.primary], startPoint: .top, endPoint: .bottomTrailing))
                .frame(width: size * 0.63, height: size * 0.56)
                .overlay(Ellipse().stroke(.white.opacity(0.12), lineWidth: 1))

            CreatureFace(size: size, eyeVariant: genome.eyeVariant, palette: palette)
            HeadCosmetic(size: size, cosmetic: headCosmetic)
        }
        .offset(y: -size * 0.17)
    }
}

private struct CreatureEars: View {
    let size: CGFloat
    let variant: Int
    let palette: CreaturePalette

    var body: some View {
        HStack(spacing: size * 0.33) {
            ear(rotation: -18)
            ear(rotation: 18)
        }
        .offset(y: -size * 0.23)
    }

    @ViewBuilder private func ear(rotation: Double) -> some View {
        if variant == 0 {
            Capsule().fill(palette.primary).frame(width: size * 0.14, height: size * 0.34).rotationEffect(.degrees(rotation))
        } else if variant == 1 {
            Circle().fill(palette.secondary).frame(width: size * 0.20)
        } else if variant == 2 {
            Image(systemName: "leaf.fill").font(.system(size: size * 0.22)).foregroundStyle(palette.secondary).rotationEffect(.degrees(rotation))
        } else {
            Capsule().fill(palette.secondary).frame(width: size * 0.11, height: size * 0.28).rotationEffect(.degrees(rotation * 1.7))
        }
    }
}

private struct CreatureHorns: View {
    let size: CGFloat
    let variant: Int
    let palette: CreaturePalette
    let species: String

    var body: some View {
        Group {
            if variant == 1 || species == "Fangling" {
                HStack(spacing: size * 0.27) {
                    Image(systemName: "triangle.fill").rotationEffect(.degrees(-12))
                    Image(systemName: "triangle.fill").rotationEffect(.degrees(12))
                }
                .font(.system(size: size * 0.18))
                .foregroundStyle(palette.glow)
            } else if variant == 2 || species == "Stormling" {
                Image(systemName: "bolt.fill")
                    .font(.system(size: size * 0.25, weight: .bold))
                    .foregroundStyle(palette.glow)
            } else if variant == 3 || species == "Thornling" {
                HStack(spacing: size * 0.30) {
                    Capsule().frame(width: size * 0.065, height: size * 0.23).rotationEffect(.degrees(-24))
                    Capsule().frame(width: size * 0.065, height: size * 0.23).rotationEffect(.degrees(24))
                }
                .foregroundStyle(palette.glow)
            }
        }
        .offset(y: -size * 0.33)
    }
}

private struct CreatureFace: View {
    let size: CGFloat
    let eyeVariant: Int
    let palette: CreaturePalette

    var body: some View {
        VStack(spacing: size * 0.06) {
            HStack(spacing: size * 0.12) {
                eye
                eye
            }
            Capsule()
                .fill(.black.opacity(0.65))
                .frame(width: size * 0.14, height: size * 0.045)
                .overlay(alignment: .bottom) {
                    Capsule().fill(Color.wfPink).frame(width: size * 0.07, height: size * 0.022).offset(y: size * 0.01)
                }
        }
        .offset(y: size * 0.025)
    }

    private var eye: some View {
        ZStack {
            if eyeVariant == 2 {
                Capsule().fill(.white).frame(width: size * 0.11, height: size * 0.14)
            } else {
                Circle().fill(.white).frame(width: size * 0.125)
            }
            Circle().fill(.black).frame(width: size * 0.055)
            Circle().fill(palette.glow).frame(width: size * 0.020).offset(x: size * 0.012, y: -size * 0.012)
        }
    }
}

private struct HeadCosmetic: View {
    let size: CGFloat
    let cosmetic: String?

    var body: some View {
        Group {
            if cosmetic == "head.crownleaf" {
                HStack(spacing: -size * 0.025) {
                    Image(systemName: "leaf.fill").rotationEffect(.degrees(-30))
                    Image(systemName: "leaf.fill")
                    Image(systemName: "leaf.fill").rotationEffect(.degrees(30))
                }
                .font(.system(size: size * 0.15))
                .foregroundStyle(Color.wfMint)
                .offset(y: -size * 0.34)
            } else if cosmetic == "head.stargoggles" {
                HStack(spacing: size * 0.02) {
                    Circle().stroke(.yellow, lineWidth: size * 0.025).frame(width: size * 0.19)
                    Circle().stroke(.yellow, lineWidth: size * 0.025).frame(width: size * 0.19)
                }
                .background(Capsule().fill(.black.opacity(0.25)).frame(width: size * 0.42, height: size * 0.10))
                .offset(y: -size * 0.02)
            } else if cosmetic == "head.crystalcrest" {
                HStack(spacing: -size * 0.025) {
                    Image(systemName: "diamond.fill").rotationEffect(.degrees(-18))
                    Image(systemName: "diamond.fill").scaleEffect(1.35)
                    Image(systemName: "diamond.fill").rotationEffect(.degrees(18))
                }
                .font(.system(size: size * 0.13))
                .foregroundStyle(LinearGradient(colors: [.cyan, .purple, .pink], startPoint: .leading, endPoint: .trailing))
                .offset(y: -size * 0.35)
            }
        }
    }
}

private struct CreatureTrail: View {
    let size: CGFloat
    let cosmetic: String?

    var body: some View {
        Group {
            if cosmetic == "trail.mint" {
                HStack(spacing: size * 0.05) {
                    Circle().frame(width: size * 0.07)
                    Circle().frame(width: size * 0.045)
                    Circle().frame(width: size * 0.025)
                }
                .foregroundStyle(Color.wfMint.opacity(0.45))
                .blur(radius: 1)
            } else if cosmetic == "trail.embers" {
                HStack(spacing: size * 0.05) {
                    Image(systemName: "sparkle")
                    Image(systemName: "flame.fill")
                    Image(systemName: "sparkle")
                }
                .font(.system(size: size * 0.08))
                .foregroundStyle(.orange.opacity(0.7))
            }
        }
        .offset(x: -size * 0.55, y: size * 0.38)
    }
}
