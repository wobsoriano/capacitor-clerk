//
// ClerkViewFactory.swift
//
// COPY this file into your iOS app target (e.g., `ios/App/App/ClerkViewFactory.swift`).
//
// Setup steps:
// 1. Add the Clerk iOS SDK to your iOS app target via Swift Package Manager:
//    Xcode > File > Add Packages > https://github.com/clerk/clerk-ios
//    Pin to an exact version (e.g., 0.x.y).
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
import SwiftUI
import UIKit

class ClerkViewFactory: ClerkViewFactoryProtocol {
    func configure(publishableKey: String, bearerToken: String?) async throws {
        try await Clerk.shared.configure(publishableKey: publishableKey)
        // Plan 4 will use bearerToken to seed the SDK with a JS-acquired session
        // (see capacitor-clerk's NativeSessionSync). Until then, this is a hint.
        _ = bearerToken
    }

    func createAuthViewController(
        mode: String,
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController? {
        let view = AuthView(
            mode: parseMode(mode),
            isDismissable: dismissable
        )
        .onAuthCompleted { result in
            let payload: [String: Any] = [
                "status": "completed",
                "sessionId": result.sessionId,
                "userId": result.userId,
            ]
            completion(.success(payload))
        }
        .onCancel {
            completion(.success(["status": "cancelled"]))
        }

        return UIHostingController(rootView: view)
    }

    func createUserProfileViewController(
        dismissable: Bool,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> UIViewController? {
        let view = UserProfileView(isDismissable: dismissable)
            .onSignedOut {
                completion(.success(["status": "signedOut"]))
            }
            .onDismiss {
                completion(.success(["status": "dismissed"]))
            }
        return UIHostingController(rootView: view)
    }

    func getSession() async -> [String: Any]? {
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

    func getClientToken() -> String? {
        return Clerk.shared.session?.lastActiveToken?.jwt
    }

    func signOut() async throws {
        try await Clerk.shared.signOut()
    }

    private func parseMode(_ s: String) -> AuthView.Mode {
        switch s {
        case "signIn": return .signIn
        case "signUp": return .signUp
        default: return .signInOrUp
        }
    }
}
