# Native AuthView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `<ClerkAuthView>` React component to `capacitor-clerk` that presents Clerk's native iOS auth UI (from `clerk-ios`) as a full-screen modal over the Capacitor WebView, with session sync back to the JS SDK on completion.

**Architecture:** A new `capacitor-clerk/native` subpath export contains the TypeScript Capacitor plugin wrapper and the React component. The native iOS code lives in `ios/Sources/CapacitorClerkNative/` and is distributed via SPM (`Package.swift`). Android is deferred. The inline embedding approach (Google Maps pattern) is also deferred for later use with `UserButton` and `UserProfileView`.

**Tech Stack:** Capacitor 8, clerk-ios (SPM), ClerkKit, ClerkKitUI, React, TypeScript, Swift

---

## Scope and Constraints

- **iOS only.** Android (`clerk-android`) is deferred to a follow-up.
- **Full-screen modal.** Not inline embedded. Embedding a `UIHostingController` as a child of a WebView-backed view breaks `ASWebAuthenticationSession` callbacks during OAuth flows inside the auth UI. Modal presentation gives ClerkKit an isolated SwiftUI lifecycle where OAuth works correctly.
- **SPM only.** `clerk-ios` is SPM-only (no CocoaPod), so `capacitor-clerk/native` requires SPM for iOS. Capacitor 8 makes SPM the default, so this is acceptable. A podspec is not provided.
- **Subpath export pattern.** Follows the same pattern as `capacitor-clerk/apple`: only consumers who import `capacitor-clerk/native` pay the cost of the plugin registration. The main bundle is unaffected.
- **Session sync.** After the native auth sheet completes, the native client JWT is read from Keychain and written into capacitor-clerk's token cache, then `__internal_reloadInitialResources()` and `setActive()` are called on the JS Clerk instance. This mirrors Clerk Expo's `syncNativeSession` pattern exactly.

---

## File Structure

### New files

| Path | Purpose |
|------|---------|
| `Package.swift` | SPM manifest declaring clerk-ios + capacitor-swift-pm dependencies |
| `ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift` | CAPPlugin subclass: configure, presentAuth, dismissAuth, getClientToken |
| `ios/Sources/CapacitorClerkNative/KeychainHelper.swift` | Reads/writes the `__clerk_client_jwt` Keychain slot that clerk-ios uses |
| `src/native/ClerkNativePlugin.ts` | TypeScript plugin interface + `registerPlugin` call |
| `src/native/ClerkAuthView.tsx` | React component: calls configure+presentAuth on mount, syncs session on authCompleted event |
| `src/native/syncNativeSession.ts` | Mirrors Clerk Expo's syncNativeSession: reads client JWT, saves to token cache, reloads resources, sets active session |
| `src/native/index.ts` | Subpath entry point re-exporting ClerkAuthView and its types |

### Modified files

| Path | Change |
|------|--------|
| `package.json` | Add `"./native"` to exports map; add `"ios/"` and `"Package.swift"` to `files` |
| `rollup.config.mjs` | Add `entry('src/native/index.ts', 'dist/esm/native/index.js')` |

---

## Section 1: TypeScript Plugin Interface

**`src/native/ClerkNativePlugin.ts`:**

```ts
import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface ClerkNativePlugin {
  configure(options: { publishableKey: string; bearerToken?: string | null }): Promise<void>;
  presentAuth(options: { mode?: 'signIn' | 'signUp' | 'signInOrUp' }): Promise<void>;
  dismissAuth(): Promise<void>;
  getClientToken(): Promise<{ token: string | null }>;
  addListener(
    event: 'authCompleted',
    handler: (data: { sessionId: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const ClerkNativePlugin = registerPlugin<ClerkNativePlugin>('ClerkNative');
```

No web fallback is provided. The component guards against non-native environments.

---

## Section 2: React Component

**`src/native/ClerkAuthView.tsx`:**

```tsx
import { useEffect } from 'react';
import { useClerk } from '@clerk/react';
import { Capacitor } from '@capacitor/core';
import { ClerkNativePlugin } from './ClerkNativePlugin';
import { syncNativeSession } from './syncNativeSession';

export type AuthViewMode = 'signIn' | 'signUp' | 'signInOrUp';

export interface ClerkAuthViewProps {
  mode?: AuthViewMode;
}

export function ClerkAuthView({ mode = 'signInOrUp' }: ClerkAuthViewProps) {
  const clerk = useClerk();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: Awaited<ReturnType<typeof ClerkNativePlugin.addListener>> | null = null;

    const setup = async () => {
      const bearerToken = (await clerk.session?.getToken()) ?? null;

      await ClerkNativePlugin.configure({
        publishableKey: clerk.publishableKey!,
        bearerToken,
      });

      listenerHandle = await ClerkNativePlugin.addListener('authCompleted', async ({ sessionId }) => {
        await syncNativeSession(sessionId);
      });

      await ClerkNativePlugin.presentAuth({ mode });
    };

    setup();

    return () => {
      listenerHandle?.remove();
      ClerkNativePlugin.dismissAuth();
    };
  }, [mode]);

  return null;
}
```

---

## Section 3: Session Sync

**`src/native/syncNativeSession.ts`:**

```ts
import { getClerkInstance } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';

const CLERK_CLIENT_JWT_KEY = '__clerk_client_jwt';

export async function syncNativeSession(sessionId: string): Promise<void> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  }

  const clerk = getClerkInstance();
  const clerkRecord = clerk as unknown as Record<string, unknown>;
  if (typeof clerkRecord.__internal_reloadInitialResources === 'function') {
    await (clerkRecord.__internal_reloadInitialResources as () => Promise<void>)();
  }
  if (typeof clerk.setActive === 'function') {
    await clerk.setActive({ session: sessionId });
  }
}
```

**Flow:**
1. Native auth completes, Swift emits `authCompleted` with `{ sessionId }`.
2. JS reads client JWT from Keychain via `getClientToken()`.
3. JWT saved to token cache under `__clerk_client_jwt` (same key the JS SDK uses).
4. `__internal_reloadInitialResources()` rebuilds the JS SDK's client state from the token.
5. `setActive({ session: sessionId })` sets the active session.

---

## Section 4: iOS Swift Plugin

**`ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift`:**

```swift
import Capacitor
import SwiftUI
import ClerkKit
import ClerkKitUI

@objc(ClerkNativePlugin)
public class ClerkNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ClerkNativePlugin"
    public let jsName = "ClerkNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure",      returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentAuth",    returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissAuth",    returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getClientToken", returnType: CAPPluginReturnPromise),
    ]

    private var authHostingController: UIViewController?
    private var sessionObserverTask: Task<Void, Never>?
    private var initialSessionId: String?

    @objc func configure(_ call: CAPPluginCall) {
        guard let publishableKey = call.getString("publishableKey") else {
            call.reject("publishableKey is required"); return
        }
        let bearerToken = call.getString("bearerToken")

        Task { @MainActor in
            // Write the JS SDK's client JWT into the Keychain slot clerk-ios reads,
            // so both SDKs share the same session from the start.
            if let token = bearerToken, !token.isEmpty {
                KeychainHelper.write(key: "__clerk_client_jwt", value: token)
            }
            Clerk.configure(publishableKey: publishableKey)
            call.resolve()
        }
    }

    @objc func presentAuth(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? "signInOrUp"

        DispatchQueue.main.async {
            self.initialSessionId = Clerk.shared.session?.id

            let rootView = self.makeAuthView(mode: mode)
            let hc = UIHostingController(rootView: rootView)
            hc.modalPresentationStyle = .fullScreen
            self.authHostingController = hc

            // Observe session changes to detect auth completion.
            // NOTE: verify the exact async sequence name on Clerk.shared against
            // the clerk-ios source (likely `sessionStream` or a Combine publisher).
            self.sessionObserverTask = Task {
                for await session in Clerk.shared.sessionStream {
                    guard let session, session.id != self.initialSessionId else { continue }
                    self.notifyListeners("authCompleted", data: ["sessionId": session.id])
                    self.sessionObserverTask?.cancel()
                    break
                }
            }

            guard let rootVC = self.topViewController() else {
                call.reject("No root view controller found"); return
            }
            rootVC.present(hc, animated: true) { call.resolve() }
        }
    }

    @objc func dismissAuth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.sessionObserverTask?.cancel()
            self.authHostingController?.dismiss(animated: true)
            self.authHostingController = nil
            call.resolve()
        }
    }

    @objc func getClientToken(_ call: CAPPluginCall) {
        let token = KeychainHelper.read(key: "__clerk_client_jwt")
        call.resolve(["token": token as Any])
    }

    // NOTE: verify exact ClerkKitUI type names (SignInView, SignUpView, AuthView or similar)
    // against the clerk-ios public API before implementing.
    private func makeAuthView(mode: String) -> AnyView {
        switch mode {
        case "signIn": return AnyView(SignInView())
        case "signUp": return AnyView(SignUpView())
        default:       return AnyView(AuthView())
        }
    }

    private func topViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else { return nil }
        var top = root
        while let presented = top.presentedViewController { top = presented }
        return top
    }
}
```

**`ios/Sources/CapacitorClerkNative/KeychainHelper.swift`:**

```swift
import Security
import Foundation

enum KeychainHelper {
    static func write(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: Bundle.main.bundleIdentifier ?? "",
            kSecAttrAccount as String: key,
            kSecValueData as String:   data,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      Bundle.main.bundleIdentifier ?? "",
            kSecAttrAccount as String:      key,
            kSecReturnData as String:       true,
            kSecMatchLimit as String:       kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
```

---

## Section 5: SPM Manifest

**`Package.swift`** (at package root):

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorClerk",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "CapacitorClerk", targets: ["CapacitorClerkNative"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm", from: "8.0.0"),
        .package(url: "https://github.com/clerk/clerk-ios", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "CapacitorClerkNative",
            dependencies: [
                .product(name: "Capacitor",  package: "capacitor-swift-pm"),
                .product(name: "Cordova",    package: "capacitor-swift-pm"),
                .product(name: "ClerkKit",   package: "clerk-ios"),
                .product(name: "ClerkKitUI", package: "clerk-ios"),
            ],
            path: "ios/Sources/CapacitorClerkNative"
        ),
    ]
)
```

**NOTE:** Verify the minimum clerk-ios version and the exact product names (`ClerkKit`, `ClerkKitUI`) against the clerk-ios `Package.swift` before implementing.

---

## Section 6: Package Config Changes

**`package.json` additions:**

```json
{
  "exports": {
    "./native": {
      "types": "./dist/esm/native/index.d.ts",
      "import": "./dist/esm/native/index.js"
    }
  },
  "files": [
    "dist/",
    "ios/",
    "Package.swift"
  ]
}
```

**`rollup.config.mjs` addition:**

```js
entry('src/native/index.ts', 'dist/esm/native/index.js'),
```

**`src/native/index.ts`:**

```ts
export { ClerkAuthView } from './ClerkAuthView';
export type { ClerkAuthViewProps, AuthViewMode } from './ClerkAuthView';
```

---

## Open Items (verify before implementing)

1. **`Clerk.shared.sessionStream`**: Verify the exact name of the async sequence or Combine publisher on `Clerk.shared` for observing session changes in clerk-ios. The Android SDK uses `Clerk.sessionFlow`; iOS may differ.
2. **ClerkKitUI view names**: Verify `SignInView()`, `SignUpView()`, and `AuthView()` (or their actual names) from the clerk-ios public API / README.
3. **clerk-ios SPM version**: Confirm the minimum required version of `https://github.com/clerk/clerk-ios` and the exact product names in its `Package.swift`.
4. **Keychain access group**: Confirm clerk-ios uses `Bundle.main.bundleIdentifier` as the Keychain service (not an app group). If it uses an app group, `KeychainHelper` needs updating.

---

## Consumer Usage

```sh
npm i capacitor-clerk
npx cap sync
```

```tsx
import { ClerkAuthView } from 'capacitor-clerk/native';

// Renders nothing in the WebView. On iOS, presents Clerk's native
// auth sheet full-screen. Session is automatically synced on completion.
export function AuthScreen() {
  return <ClerkAuthView mode="signInOrUp" />;
}
```

Requires SPM for iOS (no CocoaPods). Works on Capacitor 8+.
