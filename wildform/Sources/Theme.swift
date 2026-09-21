import SwiftUI

extension Color {
    static let wfBackground = Color(red: 0.055, green: 0.065, blue: 0.09)
    static let wfPanel = Color(red: 0.10, green: 0.115, blue: 0.15)
    static let wfMint = Color(red: 0.34, green: 0.92, blue: 0.68)
    static let wfPurple = Color(red: 0.62, green: 0.48, blue: 1.0)
}

struct PanelModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(Color.wfPanel.opacity(0.96), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.07)))
    }
}

extension View {
    func panel() -> some View { modifier(PanelModifier()) }
}
