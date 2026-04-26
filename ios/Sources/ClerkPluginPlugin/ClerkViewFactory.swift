import UIKit

/// Global registry holding the consumer's factory implementation.
/// The consumer assigns this in their `AppDelegate` after constructing
/// a `ClerkViewFactory` instance.
public var clerkViewFactory: ClerkViewFactoryProtocol?

/// Protocol the consumer implements to bridge clerk-ios into the plugin.
///
/// The plugin source cannot `import ClerkKit` directly because `clerk-ios`
/// is SPM-only and not visible to CocoaPods-distributed plugins. The consumer
/// writes a tiny class that imports `ClerkKit` and conforms to this protocol;
/// the plugin then calls the protocol without ever touching the SDK directly.
public protocol ClerkViewFactoryProtocol {
    /// Configure the underlying clerk-ios SDK. If `bearerToken` is provided,
    /// seed the SDK with a session created elsewhere (e.g., by clerk-js
    /// running in the WebView). Used by Plan 4's bidirectional sync.
    func configure(publishableKey: String, bearerToken: String?) async throws

    /// Build a view controller hosting the SwiftUI sign-in/sign-up screen.
    /// `mode` is one of "signIn", "signUp", or "signInOrUp".
    /// `completion` is called with the result when the user finishes or cancels.
    func createAuthViewController(
        mode: String,
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController?

    /// Build a view controller hosting the SwiftUI user profile screen.
    func createUserProfileViewController(
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController?

    /// Return a `NativeSessionSnapshot`-shaped dictionary for the active
    /// session, or nil if not signed in.
    func getSession() async -> [String: Any]?

    /// Return the current session's JWT, or nil if not signed in.
    func getClientToken() async -> String?

    /// Sign the current user out via clerk-ios.
    func signOut() async throws
}
