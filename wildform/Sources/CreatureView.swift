import SwiftUI

struct CreatureView: View {
    let species: String
    var size: CGFloat = 170

    private var accent: Color {
        switch species {
        case "Emberling": return .orange
        case "Thornling": return .green
        case "Stormling": return .cyan
        default: return Color.wfPurple
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(accent.opacity(0.18))
                .frame(width: size * 1.18, height: size * 1.18)
                .blur(radius: 2)

            if species == "Stormling" {
                Image(systemName: "bolt.fill")
                    .font(.system(size: size * 0.35, weight: .bold))
                    .foregroundStyle(accent.opacity(0.22))
                    .offset(x: -size * 0.35, y: -size * 0.18)
            }

            VStack(spacing: -size * 0.08) {
                ZStack {
                    if species == "Thornling" {
                        HStack(spacing: size * 0.34) {
                            Capsule().fill(accent).frame(width: size * 0.13, height: size * 0.40).rotationEffect(.degrees(-28))
                            Capsule().fill(accent).frame(width: size * 0.13, height: size * 0.40).rotationEffect(.degrees(28))
                        }
                        .offset(y: -size * 0.20)
                    }

                    Circle()
                        .fill(accent.gradient)
                        .frame(width: size * 0.58, height: size * 0.55)

                    HStack(spacing: size * 0.12) {
                        Circle().fill(.white).frame(width: size * 0.11)
                            .overlay(Circle().fill(.black).frame(width: size * 0.045))
                        Circle().fill(.white).frame(width: size * 0.11)
                            .overlay(Circle().fill(.black).frame(width: size * 0.045))
                    }
                    .offset(y: -size * 0.03)

                    Capsule()
                        .fill(.black.opacity(0.60))
                        .frame(width: size * 0.14, height: size * 0.045)
                        .offset(y: size * 0.12)
                }

                ZStack {
                    Capsule()
                        .fill(accent.gradient)
                        .frame(width: size * 0.72, height: size * 0.62)

                    HStack(spacing: size * 0.48) {
                        Capsule().fill(accent).frame(width: size * 0.12, height: size * 0.44).rotationEffect(.degrees(13))
                        Capsule().fill(accent).frame(width: size * 0.12, height: size * 0.44).rotationEffect(.degrees(-13))
                    }
                    .offset(y: size * 0.12)
                }
            }

            if species == "Emberling" {
                Image(systemName: "flame.fill")
                    .font(.system(size: size * 0.25))
                    .foregroundStyle(.yellow, .orange)
                    .offset(x: size * 0.36, y: size * 0.23)
            }
        }
        .frame(width: size * 1.35, height: size * 1.45)
        .accessibilityLabel("\(species) creature")
    }
}
