import Capacitor
import SwiftUI
import ClerkKit
import ClerkKitUI

@objc(ClerkNativePlugin)
public class ClerkNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClerkNativePlugin"
    public let jsName = "ClerkNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure",          returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentAuth",        returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissAuth",        returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getClientToken",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentUserProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissUserProfile", returnType: CAPPluginReturnPromise),
    ]

    private let clerkDeviceTokenKey = "clerkDeviceToken"
    private var authHostingController: UIViewController?
    private var profileHostingController: UIViewController?
    private var sessionObserverTask: Task<Void, Never>?
    private var initialSessionId: String?

    // MARK: - configure

    @objc func configure(_ call: CAPPluginCall) {
        guard let publishableKey = call.getString("publishableKey") else {
            call.reject("publishableKey is required")
            return
        }
        let bearerToken = call.getString("bearerToken")

        Task { @MainActor in
            // Write JS SDK token to the Keychain slot clerk-ios reads ("clerkDeviceToken"),
            // so both SDKs share the same session from the start.
            if let token = bearerToken, !token.isEmpty {
                KeychainHelper.write(key: self.clerkDeviceTokenKey, value: token)
            }
            Clerk.configure(publishableKey: publishableKey)
            call.resolve()
        }
    }

    // MARK: - presentAuth

    @objc func presentAuth(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "signInOrUp"

        DispatchQueue.main.async {
            self.initialSessionId = Clerk.shared.session?.id

            let rootView = AnyView(ClerkAuthSheetView(mode: self.authMode(from: mode)))
            let hc = UIHostingController(rootView: rootView)
            hc.modalPresentationStyle = .fullScreen
            self.authHostingController = hc

            self.startSessionObserver()

            guard let rootVC = self.topViewController() else {
                call.reject("No root view controller found")
                return
            }
            rootVC.present(hc, animated: true) { call.resolve() }
        }
    }

    // MARK: - dismissAuth

    @objc func dismissAuth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.sessionObserverTask?.cancel()
            self.sessionObserverTask = nil
            guard let hc = self.authHostingController else {
                call.resolve()
                return
            }
            self.authHostingController = nil
            hc.dismiss(animated: true) { call.resolve() }
        }
    }

    // MARK: - getClientToken

    @objc func getClientToken(_ call: CAPPluginCall) {
        let token = KeychainHelper.read(key: clerkDeviceTokenKey)
        call.resolve(["token": token as Any])
    }

    // MARK: - presentUserProfile

    @objc func presentUserProfile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let hc = ProfileHostingController(
                rootView: AnyView(UserProfileSheetView()),
                onDismiss: { [weak self] in
                    self?.profileHostingController = nil
                    self?.notifyListeners("profileDismissed", data: [:])
                }
            )
            hc.modalPresentationStyle = .fullScreen
            self.profileHostingController = hc

            guard let rootVC = self.topViewController() else {
                call.reject("No root view controller found")
                return
            }
            rootVC.present(hc, animated: true) { call.resolve() }
        }
    }

    // MARK: - dismissUserProfile

    @objc func dismissUserProfile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let hc = self.profileHostingController else {
                call.resolve()
                return
            }
            self.profileHostingController = nil
            hc.dismiss(animated: true) { call.resolve() }
        }
    }

    // MARK: - Helpers

    private func startSessionObserver() {
        sessionObserverTask?.cancel()
        sessionObserverTask = Task { @MainActor in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 300_000_000) // 300 ms
                if let id = Clerk.shared.session?.id, id != self.initialSessionId {
                    self.notifyListeners("authCompleted", data: ["sessionId": id])
                    self.sessionObserverTask = nil
                    break
                }
            }
        }
    }

    private func authMode(from mode: String) -> AuthView.Mode {
        switch mode {
        case "signIn": return .signIn
        case "signUp": return .signUp
        default:       return .signInOrUp
        }
    }

    private func topViewController() -> UIViewController? {
        guard
            let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
            let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else { return nil }

        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}

// MARK: - SwiftUI wrapper

private struct ClerkAuthSheetView: View {
    let mode: AuthView.Mode

    var body: some View {
        AuthView(mode: mode)
            .environment(Clerk.shared)
    }
}

// MARK: - ProfileHostingController

private final class ProfileHostingController: UIHostingController<AnyView> {
    private let onDismiss: () -> Void

    init(rootView: AnyView, onDismiss: @escaping () -> Void) {
        self.onDismiss = onDismiss
        super.init(rootView: rootView)
    }

    @MainActor required dynamic init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed {
            onDismiss()
        }
    }
}

// MARK: - UserProfileSheetView

private struct UserProfileSheetView: View {
    var body: some View {
        UserProfileView()
            .environment(Clerk.shared)
    }
}
