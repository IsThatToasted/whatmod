import Foundation
import GoogleSignIn
import UIKit

struct AFGoogleTokens: Sendable {
    let idToken: String
    let accessToken: String
}

@MainActor
enum AFNativeGoogleAuth {
    static func handleOpenURL(_ url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    static func signIn() async throws -> AFGoogleTokens {
        guard let iosClientID = AFRuntimeConfig.googleIOSClientID,
              let webClientID = AFRuntimeConfig.googleWebClientID,
              iosClientID.hasSuffix(".apps.googleusercontent.com"),
              webClientID.hasSuffix(".apps.googleusercontent.com") else {
            throw AFPublicError.error(.nativeGoogleConfig, "Sign in is temporarily unavailable.")
        }

        guard let presenter = UIApplication.shared.afAuthenticationPresenter else {
            throw AFPublicError.error(.nativeGooglePresentation, "We couldn't open sign in.")
        }

        // One explicit configuration path. The iOS client identifies the app;
        // the web/server client requests an ID token suitable for backend verification.
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: iosClientID,
            serverClientID: webClientID
        )

        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
        } catch {
            AFPublicError.capture(error, code: .nativeGooglePresentation)
            throw AFPublicError.error(.nativeGooglePresentation, "We couldn't complete Google sign in.")
        }

        guard let idToken = result.user.idToken?.tokenString,
              !idToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AFPublicError.error(.nativeGoogleToken, "We couldn't verify sign in.")
        }

        let accessToken = result.user.accessToken.tokenString
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AFPublicError.error(.nativeGoogleToken, "We couldn't verify sign in.")
        }

        return AFGoogleTokens(idToken: idToken, accessToken: accessToken)
    }

    static func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }
}

private extension UIApplication {
    var afAuthenticationPresenter: UIViewController? {
        let scenes = connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows) + scenes.flatMap(\.windows)

        guard let root = windows.first(where: \.isKeyWindow)?.rootViewController
                ?? windows.first?.rootViewController else { return nil }

        var presenter = root
        while let shown = presenter.presentedViewController { presenter = shown }
        if let navigation = presenter as? UINavigationController {
            presenter = navigation.visibleViewController ?? navigation
        }
        if let tab = presenter as? UITabBarController {
            presenter = tab.selectedViewController ?? tab
        }
        return presenter
    }
}
