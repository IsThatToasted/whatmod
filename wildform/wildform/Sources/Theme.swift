import SwiftUI

extension Color {
    static let wfBackground = Color(red: 0.035, green: 0.045, blue: 0.075)
    static let wfPanel = Color(red: 0.075, green: 0.095, blue: 0.14)
    static let wfPanel2 = Color(red: 0.105, green: 0.13, blue: 0.19)
    static let wfMint = Color(red: 0.34, green: 0.92, blue: 0.68)
    static let wfPurple = Color(red: 0.62, green: 0.48, blue: 1.0)
    static let wfGold = Color(red: 1.0, green: 0.78, blue: 0.28)
    static let wfPink = Color(red: 1.0, green: 0.43, blue: 0.74)
}

struct PanelModifier: ViewModifier {
    var emphasized = false

    func body(content: Content) -> some View {
        content
            .padding()
            .background(
                LinearGradient(
                    colors: emphasized
                        ? [Color.wfPanel2.opacity(0.98), Color.wfPanel.opacity(0.98)]
                        : [Color.wfPanel.opacity(0.96), Color.wfPanel.opacity(0.88)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(.white.opacity(emphasized ? 0.12 : 0.07), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.18), radius: 14, y: 7)
    }
}

extension View {
    func panel(emphasized: Bool = false) -> some View { modifier(PanelModifier(emphasized: emphasized)) }
}

struct WildBackground: View {
    @State private var animate = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.wfBackground, Color(red: 0.055, green: 0.045, blue: 0.10), Color.wfBackground],
                startPoint: animate ? .topLeading : .bottomTrailing,
                endPoint: animate ? .bottomTrailing : .topLeading
            )

            GeometryReader { proxy in
                Circle()
                    .fill(Color.wfPurple.opacity(0.14))
                    .frame(width: proxy.size.width * 0.9)
                    .blur(radius: 44)
                    .offset(x: animate ? proxy.size.width * 0.36 : -proxy.size.width * 0.30,
                            y: animate ? -80 : proxy.size.height * 0.45)

                Circle()
                    .fill(Color.wfMint.opacity(0.10))
                    .frame(width: proxy.size.width * 0.75)
                    .blur(radius: 56)
                    .offset(x: animate ? -proxy.size.width * 0.20 : proxy.size.width * 0.55,
                            y: animate ? proxy.size.height * 0.55 : 80)
            }
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                animate.toggle()
            }
        }
    }
}

struct CurrencyChip: View {
    let icon: String
    let value: Int
    var tint: Color = .wfGold

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.caption.bold())
                .foregroundStyle(tint)
            Text(value.formatted())
                .font(.caption.bold().monospacedDigit())
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(.black.opacity(0.24), in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.08)))
    }
}
