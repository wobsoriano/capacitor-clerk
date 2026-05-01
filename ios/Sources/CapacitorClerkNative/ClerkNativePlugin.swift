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
        CAPPluginMethod(name: "createUserProfile",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateUserProfile",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroyUserProfile", returnType: CAPPluginReturnPromise),
    ]

    private let clerkDeviceTokenKey = "clerkDeviceToken"
    private var authHostingController: UIViewController?
    private var profileHostingController: UIViewController?
    private var inlineProfileHostingController: UIViewController?

    // MARK: - configure

    @objc func configure(_ call: CAPPluginCall) {
        guard let publishableKey = call.getString("publishableKey") else {
            call.reject("publishableKey is required")
            return
        }
        let bearerToken = call.getString("bearerToken")

        Task { @MainActor in
            // Write the current JS client JWT to the keychain slot clerk-ios reads.
            // This must happen on every configure call so that any token rotation that
            // occurred on the JS side is reflected before clerk-ios makes API calls.
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
            let initialSessionId = Clerk.shared.session?.id

            let rootView = AnyView(ClerkAuthSheetView(
                mode: self.authMode(from: mode),
                initialSessionId: initialSessionId,
                onAuthCompleted: { [weak self] sessionId in
                    self?.notifyListeners("authCompleted", data: ["sessionId": sessionId])
                }
            ))
            let hc = UIHostingController(rootView: rootView)
            hc.modalPresentationStyle = .fullScreen
            self.authHostingController = hc

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

    // MARK: - createUserProfile (inline)

    @objc func createUserProfile(_ call: CAPPluginCall) {
        guard let rectObj = call.getObject("boundingRect") else {
            call.reject("boundingRect is required")
            return
        }
        let x      = rectObj["x"]      as? Double ?? 0
        let y      = rectObj["y"]      as? Double ?? 0
        let width  = rectObj["width"]  as? Double ?? 0
        let height = rectObj["height"] as? Double ?? 0
        let isDismissable = call.getBool("isDismissable") ?? false

        DispatchQueue.main.async {
            self.inlineProfileHostingController?.willMove(toParent: nil)
            self.inlineProfileHostingController?.view.removeFromSuperview()
            self.inlineProfileHostingController?.removeFromParent()
            self.inlineProfileHostingController = nil

            guard let parentVC = self.bridge?.viewController else {
                call.reject("View controller not available")
                return
            }

            let hc = UIHostingController(rootView: AnyView(
                InlineUserProfileView(isDismissable: isDismissable) { [weak self] type in
                    self?.notifyListeners("profileEvent", data: ["type": type, "data": [:] as [String: Any]])
                }
            ))
            hc.view.frame = CGRect(x: x, y: y, width: width, height: height)
            hc.view.autoresizingMask = []
            hc.view.backgroundColor = .systemBackground
            parentVC.addChild(hc)
            parentVC.view.addSubview(hc.view)
            hc.didMove(toParent: parentVC)
            self.inlineProfileHostingController = hc
            call.resolve()
        }
    }

    // MARK: - updateUserProfile (inline)

    @objc func updateUserProfile(_ call: CAPPluginCall) {
        guard let rectObj = call.getObject("boundingRect") else {
            call.resolve()
            return
        }
        let x      = rectObj["x"]      as? Double ?? 0
        let y      = rectObj["y"]      as? Double ?? 0
        let width  = rectObj["width"]  as? Double ?? 0
        let height = rectObj["height"] as? Double ?? 0

        DispatchQueue.main.async {
            self.inlineProfileHostingController?.view.frame = CGRect(x: x, y: y, width: width, height: height)
            call.resolve()
        }
    }

    // MARK: - destroyUserProfile (inline)

    @objc func destroyUserProfile(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.inlineProfileHostingController?.willMove(toParent: nil)
            self.inlineProfileHostingController?.view.removeFromSuperview()
            self.inlineProfileHostingController?.removeFromParent()
            self.inlineProfileHostingController = nil
            call.resolve()
        }
    }

    // MARK: - Helpers

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
    let initialSessionId: String?
    let onAuthCompleted: (String) -> Void

    var body: some View {
        AuthView(mode: mode)
            .environment(Clerk.shared)
            .onChange(of: Clerk.shared.session?.id) { _, newId in
                if let id = newId, id != initialSessionId {
                    onAuthCompleted(id)
                }
            }
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
        // Clerk.shared is @Observable; accessing .session here creates a dependency so the
        // view re-renders once the session loads after Clerk.configure reinitializes.
        if Clerk.shared.session != nil {
            UserProfileView()
                .environment(Clerk.shared)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

// MARK: - InlineUserProfileView

private struct InlineUserProfileView: View {
    let isDismissable: Bool
    let onEvent: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            if isDismissable {
                HStack {
                    Spacer()
                    Button("Done") { onEvent("dismissed") }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                }
            }
            if Clerk.shared.session != nil {
                UserProfileView()
                    .environment(Clerk.shared)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onChange(of: Clerk.shared.session == nil) { wasNil, isNilNow in
            if isNilNow && !wasNil {
                onEvent("signedOut")
            }
        }
    }
}
