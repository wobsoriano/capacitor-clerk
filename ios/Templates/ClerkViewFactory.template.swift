//
// ClerkViewFactory.swift
//
// COPY this file into your iOS app target (e.g., `ios/App/App/ClerkViewFactory.swift`).
//
// Setup steps:
// 1. Add the Clerk iOS SDK to your iOS app target via Swift Package Manager:
//    Xcode > File > Add Packages > https://github.com/clerk/clerk-ios
//    Pin to an exact version (e.g., 1.1.0).
// 2. Copy this file into your iOS app target.
// 3. In your `AppDelegate.swift`'s `application(_:didFinishLaunchingWithOptions:)`,
//    add: `clerkViewFactory = ClerkViewFactory()`
// 4. Make sure `import CapacitorClerk` is present at the top of `AppDelegate.swift`.
//
// After these steps, capacitor-clerk's iOS bridge calls will route through this
// file and into the Clerk iOS SDK.
//

import CapacitorClerk
import ClerkKit
import ClerkKitUI
import SwiftUI
import UIKit

class ClerkViewFactory: ClerkViewFactoryProtocol {
    func configure(publishableKey: String, bearerToken: String?) async throws {
        // `Clerk.configure` is synchronous in clerk-ios 1.x, MainActor-isolated,
        // and idempotent (subsequent calls log a warning and return the existing
        // instance).
        await MainActor.run {
            _ = Clerk.configure(publishableKey: publishableKey)
        }
        // Plan 4 will use bearerToken to seed the SDK with a JS-acquired session
        // (see capacitor-clerk's NativeSessionSync). Until then, this is a hint.
        _ = bearerToken
    }

    func createAuthViewController(
        mode: String,
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController? {
        // The plugin always invokes this on the main thread.
        MainActor.assumeIsolated {
            let parsedMode = parseMode(mode)
            let root = AuthHost(
                mode: parsedMode,
                isDismissable: dismissable,
                completion: completion
            )
            .environment(Clerk.shared)
            return UIHostingController(rootView: root)
        }
    }

    func createUserProfileViewController(
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController? {
        MainActor.assumeIsolated {
            let root = UserProfileHost(
                isDismissable: dismissable,
                completion: completion
            )
            .environment(Clerk.shared)
            return UIHostingController(rootView: root)
        }
    }

    func getSession() async -> [String: Any]? {
        await MainActor.run {
            guard let session = Clerk.shared.session,
                  let user = session.user else { return nil }
            return [
                "sessionId": session.id,
                "userId": user.id,
                "user": [
                    "id": user.id,
                    "firstName": user.firstName as Any,
                    "lastName": user.lastName as Any,
                    "primaryEmailAddress": user.primaryEmailAddress?.emailAddress as Any,
                    "imageUrl": user.imageUrl,
                ],
            ]
        }
    }

    func getClientToken() async -> String? {
        guard let session = await MainActor.run(body: { Clerk.shared.session }) else {
            return nil
        }
        // Session.getToken() is async; lastActiveToken is only populated after
        // a token has been fetched, so go through the canonical API.
        return try? await session.getToken()
    }

    func signOut() async throws {
        try await Clerk.shared.auth.signOut()
    }

    @MainActor
    private func parseMode(_ s: String) -> AuthView.Mode {
        switch s {
        case "signIn": return .signIn
        case "signUp": return .signUp
        default: return .signInOrUp
        }
    }
}

// MARK: - SwiftUI hosts that bridge clerk-ios state into completion callbacks.

/// Wraps `AuthView` and reports completion when the SDK's session becomes
/// active. Reports cancellation on dismiss when no session was created.
private struct AuthHost: View {
    @Environment(Clerk.self) private var clerk

    let mode: AuthView.Mode
    let isDismissable: Bool
    let completion: (Result<[String: Any], Error>) -> Void

    @State private var didReportCompletion = false

    var body: some View {
        AuthView(mode: mode, isDismissable: isDismissable)
            .onChange(of: clerk.session?.id) { _, newId in
                guard !didReportCompletion,
                      let session = clerk.session,
                      session.id == newId,
                      session.status == .active,
                      let user = session.user else { return }
                didReportCompletion = true
                completion(.success([
                    "status": "completed",
                    "sessionId": session.id,
                    "userId": user.id,
                ]))
            }
            .onDisappear {
                guard !didReportCompletion else { return }
                didReportCompletion = true
                completion(.success(["status": "cancelled"]))
            }
    }
}

/// Wraps `UserProfileView` and reports a `dismissed` status when the user
/// dismisses the sheet. A `signedOut` status is reported if the user signs out
/// while the profile is still on screen.
private struct UserProfileHost: View {
    @Environment(Clerk.self) private var clerk

    let isDismissable: Bool
    let completion: (Result<[String: Any], Error>) -> Void

    @State private var didReportCompletion = false

    var body: some View {
        UserProfileView(isDismissable: isDismissable)
            .onChange(of: clerk.user?.id) { oldId, newId in
                guard !didReportCompletion, oldId != nil, newId == nil else { return }
                didReportCompletion = true
                completion(.success(["status": "signedOut"]))
            }
            .onDisappear {
                guard !didReportCompletion else { return }
                didReportCompletion = true
                completion(.success(["status": "dismissed"]))
            }
    }
}
