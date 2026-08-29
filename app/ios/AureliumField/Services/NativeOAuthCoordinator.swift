import AuthenticationServices
import Foundation
import UIKit
import Supabase

@MainActor
final class AFNativeOAuthCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AFNativeOAuthCoordinator()

    static let callbackScheme = "aureliumfield"
    static let callbackHost = "auth-callback"
    static let webReturnURL = URL(string: "https://whatmod.com/app/")!
    static let nativeStartURL = URL(string: "https://whatmod.com/app/native-auth-start.html")!

    private var activeSession: ASWebAuthenticationSession?

    func signIn(client: SupabaseClient) async throws -> Session {
        let authorizationURL: URL
        do {
            authorizationURL = try await client.auth.getOAuthSignInURL(
                provider: .google,
                redirectTo: Self.webReturnURL
            )
        } catch {
            AFPublicError.capture(error, code: .nativeAuthStart)
            throw AFPublicError.error(.nativeAuthStart, "We couldn't start sign in.")
        }

        let callbackURL = try await authenticate(using: try Self.nativeStartURL(for: authorizationURL))
        guard Self.isExpectedCallback(callbackURL) else {
            throw AFPublicError.error(.nativeAuthCallback, "We couldn't finish sign in.")
        }

        do {
            return try await client.auth.session(from: callbackURL)
        } catch {
            AFPublicError.capture(error, code: .nativeAuthExchange)
            throw AFPublicError.error(.nativeAuthExchange, "We couldn't finish sign in.")
        }
    }


    private static func nativeStartURL(for authorizationURL: URL) throws -> URL {
        guard var components = URLComponents(url: nativeStartURL, resolvingAgainstBaseURL: false) else {
            throw AFPublicError.error(.nativeAuthStart, "We couldn't start sign in.")
        }
        components.queryItems = [URLQueryItem(name: "oauth", value: authorizationURL.absoluteString)]
        guard let url = components.url else {
            throw AFPublicError.error(.nativeAuthStart, "We couldn't start sign in.")
        }
        return url
    }

    func importExternalCallback(_ url: URL, client: SupabaseClient) async throws -> Session? {
        guard Self.isExpectedCallback(url) else { return nil }
        do {
            return try await client.auth.session(from: url)
        } catch {
            AFPublicError.capture(error, code: .nativeAuthExchange)
            throw AFPublicError.error(.nativeAuthExchange, "We couldn't finish sign in.")
        }
    }

    func cancel() {
        activeSession?.cancel()
        activeSession = nil
    }

    private func authenticate(using authorizationURL: URL) async throws -> URL {
        cancel()

        return try await withCheckedThrowingContinuation { continuation in
            var completed = false
            let session = ASWebAuthenticationSession(
                url: authorizationURL,
                callbackURLScheme: Self.callbackScheme
            ) { [weak self] callbackURL, error in
                Task { @MainActor in
                    self?.activeSession = nil
                    guard !completed else { return }
                    completed = true

                    if let callbackURL {
                        continuation.resume(returning: callbackURL)
                        return
                    }

                    if let error {
                        let nsError = error as NSError
                        if nsError.domain == ASWebAuthenticationSessionErrorDomain &&
                           nsError.code == ASWebAuthenticationSessionError.Code.canceledLogin.rawValue {
                            continuation.resume(throwing: AFNativeOAuthCancellation())
                            return
                        }
                        AFPublicError.capture(error, code: .nativeAuthCallback)
                    }
                    continuation.resume(throwing: AFPublicError.error(.nativeAuthCallback, "We couldn't finish sign in."))
                }
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            activeSession = session

            guard session.start() else {
                activeSession = nil
                if !completed {
                    completed = true
                    continuation.resume(throwing: AFPublicError.error(.nativeAuthStart, "We couldn't open sign in."))
                }
                return
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }

        if let keyWindow = scenes.flatMap(\.windows).first(where: \.isKeyWindow) {
            return keyWindow
        }
        if let firstWindow = scenes.flatMap(\.windows).first {
            return firstWindow
        }
        return ASPresentationAnchor()
    }

    private static func isExpectedCallback(_ url: URL) -> Bool {
        url.scheme?.lowercased() == callbackScheme && url.host?.lowercased() == callbackHost
    }
}

struct AFNativeOAuthCancellation: Error {}
