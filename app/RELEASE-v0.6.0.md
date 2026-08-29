# Aurelium Field v0.6.0 — iOS Authentication Reset

This release deletes the accumulated native login experiments and establishes one supported architecture:

- Web: existing browser Google OAuth remains unchanged.
- iOS: GoogleSignIn-iOS presents the native Google sign-in flow.
- iOS passes Google's ID token + access token to the native auth client via `signInWithIdToken`.
- The app root alone handles Google's reversed-client callback URL.
- No hosted OAuth browser, ASWebAuthenticationSession, WKWebView login, web bridge, or `aureliumfield://auth-callback` remains in the native target.
- `SupabaseService` owns only the application session and organization membership state.
- `AFNativeGoogleAuth` owns only Google SDK configuration/presentation/token retrieval.

No SQL migration is required.
