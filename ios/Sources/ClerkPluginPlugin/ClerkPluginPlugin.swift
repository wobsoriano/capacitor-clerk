import Capacitor
import Foundation
import UIKit

/// The Capacitor plugin bridge for iOS. Exposes 9 methods to JS, delegating
/// SDK work to the consumer-supplied `clerkViewFactory` and storage work to
/// `KeychainStore`.
@objc(ClerkPluginPlugin)
public class ClerkPluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClerkPluginPlugin"
    public let jsName = "ClerkPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentUserProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getClientToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secureGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secureSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "secureRemove", returnType: CAPPluginReturnPromise),
    ]

    /// On plugin load, if the consumer set a static publishable key in
    /// capacitor.config.ts under `plugins.ClerkPlugin.publishableKey`, kick
    /// off configure() so the SDK is ready before the first method call.
    override public func load() {
        guard let key = getConfig().getString("publishableKey"), !key.isEmpty,
              let factory = clerkViewFactory else { return }
        Task { try? await factory.configure(publishableKey: key, bearerToken: nil) }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.reject(
                "Clerk factory not registered. Set clerkViewFactory in AppDelegate.",
                "E_FACTORY_NOT_REGISTERED"
            )
            return
        }
        let publishableKey = call.getString("publishableKey") ?? ""
        let bearerToken = call.getString("bearerToken")

        Task {
            do {
                try await factory.configure(publishableKey: publishableKey, bearerToken: bearerToken)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription, "E_CONFIGURE_FAILED", error)
            }
        }
    }

    @objc func presentAuth(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.reject("Clerk factory not registered.", "E_FACTORY_NOT_REGISTERED")
            return
        }
        let mode = call.getString("mode") ?? "signInOrUp"
        let dismissable = call.getBool("dismissable") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let vc = factory.createAuthViewController(
                mode: mode,
                dismissable: dismissable,
                completion: { [weak self] result in
                    switch result {
                    case .success(let data):
                        call.resolve(data)
                        self?.emitSignedIn(data)
                    case .failure(let error):
                        call.reject(error.localizedDescription, "E_AUTH_FAILED", error)
                    }
                }
            ) else {
                call.reject("Could not create auth view controller", "E_AUTH_FAILED")
                return
            }
            self?.bridge?.viewController?.present(vc, animated: true)
        }
    }

    @objc func presentUserProfile(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.reject("Clerk factory not registered.", "E_FACTORY_NOT_REGISTERED")
            return
        }
        let dismissable = call.getBool("dismissable") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let vc = factory.createUserProfileViewController(
                dismissable: dismissable,
                completion: { result in
                    switch result {
                    case .success:
                        call.resolve()
                    case .failure(let error):
                        call.reject(error.localizedDescription, "E_PROFILE_FAILED", error)
                    }
                }
            ) else {
                call.reject("Could not create user profile view controller", "E_PROFILE_FAILED")
                return
            }
            self?.bridge?.viewController?.present(vc, animated: true)
        }
    }

    @objc func getSession(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.resolve()
            return
        }
        Task {
            let session = await factory.getSession()
            if let session = session {
                call.resolve(session)
            } else {
                call.resolve()
            }
        }
    }

    @objc func getClientToken(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.resolve(["value": NSNull()])
            return
        }
        Task {
            let token = await factory.getClientToken()
            call.resolve(["value": token ?? NSNull()])
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        guard let factory = clerkViewFactory else {
            call.reject("Clerk factory not registered.", "E_FACTORY_NOT_REGISTERED")
            return
        }
        Task {
            do {
                try await factory.signOut()
                call.resolve()
            } catch {
                call.reject(error.localizedDescription, "E_AUTH_FAILED", error)
            }
        }
    }

    @objc func secureGet(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        let value = KeychainStore.shared.get(key: key)
        call.resolve(["value": value ?? NSNull()])
    }

    @objc func secureSet(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        let value = call.getString("value") ?? ""
        KeychainStore.shared.set(key: key, value: value)
        call.resolve()
    }

    @objc func secureRemove(_ call: CAPPluginCall) {
        let key = call.getString("key") ?? ""
        KeychainStore.shared.remove(key: key)
        call.resolve()
    }

    /// Emits a `signedIn` `authStateChange` event after a successful auth flow.
    /// JS-side consumers subscribe via `ClerkPlugin.addListener('authStateChange', ...)`.
    private func emitSignedIn(_ data: [String: Any]) {
        guard let sessionId = data["sessionId"] as? String,
              let userId = data["userId"] as? String else { return }
        notifyListeners("authStateChange", data: [
            "type": "signedIn",
            "sessionId": sessionId,
            "userId": userId,
        ])
    }
}
