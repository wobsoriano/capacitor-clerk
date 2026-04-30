# Native AuthView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `<AuthView>` to `capacitor-clerk/native` — a React component that presents Clerk's native iOS auth UI (clerk-ios) as a full-screen modal, then syncs the resulting session back to the JS Clerk SDK.

**Architecture:** The TypeScript side lives in `src/native/` (plugin interface, React component, session sync helper) and is bundled to `dist/esm/native/`. The iOS native side lives in `ios/Sources/CapacitorClerkNative/` (a `CAPPlugin` subclass + Keychain helper) distributed via `Package.swift`. The component passes its own `clerk` instance from `useClerk()` into `syncNativeSession` to avoid needing a global registry.

**Tech Stack:** Capacitor 8, clerk-ios SPM (`ClerkKit`/`ClerkKitUI`), React 18, TypeScript, Swift, Vitest, @testing-library/react

---

## Key Implementation Notes

**Keychain keys (important):**
- clerk-ios reads/writes its session token under the key `"clerkDeviceToken"` (not `"__clerk_client_jwt"`).
- The JS SDK stores its token under `"__clerk_client_jwt"` (the `CLERK_CLIENT_JWT_KEY` constant in `src/react/createClerkInstance.ts`).
- `configure()` in Swift must write the JS bearer token to `"clerkDeviceToken"` so clerk-ios picks it up.
- `getClientToken()` in Swift reads `"clerkDeviceToken"` and returns it to JS, which then saves it under `"__clerk_client_jwt"`.
- Both use `Bundle.main.bundleIdentifier` as the Keychain service name.

**clerk-ios API (verify before implementing):**
- The auth view is `AuthView(mode:)` from `ClerkKitUI`, with `AuthView.Mode` enum values `.signIn`, `.signUp`, `.signInOrUp`. Confirmed via `ClerkViewFactory.swift` in `@clerk/expo`.
- Session observation uses a polling Task (300 ms interval) checking `Clerk.shared.session?.id` rather than an AsyncStream, since the exact observable API isn't confirmed.

**No `getClerkInstance` needed:** `syncNativeSession` receives the `clerk` instance as a parameter from `AuthView`, which already has it from `useClerk()`. This avoids importing `ClerkProvider.tsx` from the native subpath.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `"./native"` export, add `"ios/"` + `"Package.swift"` to `files` |
| `rollup.config.mjs` | Modify | Add `src/native/index.ts` entry |
| `src/native/ClerkNativePlugin.ts` | Create | Capacitor plugin interface + `registerPlugin` |
| `src/native/syncNativeSession.ts` | Create | Post-auth session sync: Keychain JWT to JS token cache |
| `src/native/AuthView.tsx` | Create | React component: configure + presentAuth on mount, dismiss on unmount |
| `src/native/index.ts` | Create | Subpath re-exports |
| `src/native/__tests__/syncNativeSession.test.ts` | Create | Unit tests for session sync |
| `src/native/__tests__/AuthView.test.tsx` | Create | Unit tests for the React component |
| `Package.swift` | Create | SPM manifest: capacitor-swift-pm + clerk-ios |
| `ios/Sources/CapacitorClerkNative/KeychainHelper.swift` | Create | Read/write `"clerkDeviceToken"` from iOS Keychain |
| `ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift` | Create | `CAPPlugin`: configure, presentAuth, dismissAuth, getClientToken |
| `example-app/src/App.tsx` | Modify | Add native auth route for manual testing |

---

## Task 1: Package config

**Files:**
- Modify: `package.json`
- Modify: `rollup.config.mjs`

- [ ] **Step 1: Add `"./native"` to the exports map in `package.json`**

The current exports map ends at `"./token-cache"`. Add the new entry and extend `files`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js"
    },
    "./react": {
      "types": "./dist/esm/react/index.d.ts",
      "import": "./dist/esm/react/index.js"
    },
    "./apple": {
      "types": "./dist/esm/apple/index.d.ts",
      "import": "./dist/esm/apple/index.js"
    },
    "./token-cache": {
      "types": "./dist/esm/token-cache/index.d.ts",
      "import": "./dist/esm/token-cache/index.js"
    },
    "./native": {
      "types": "./dist/esm/native/index.d.ts",
      "import": "./dist/esm/native/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist/",
    "ios/",
    "Package.swift"
  ]
}
```

- [ ] **Step 2: Add the native rollup entry in `rollup.config.mjs`**

The current `export default` array has four entries. Add a fifth:

```js
export default [
  entry('src/index.ts', 'dist/esm/index.js'),
  entry('src/react/index.ts', 'dist/esm/react/index.js'),
  entry('src/apple/index.ts', 'dist/esm/apple/index.js'),
  entry('src/token-cache/index.ts', 'dist/esm/token-cache/index.js'),
  entry('src/native/index.ts', 'dist/esm/native/index.js'),
];
```

Also add `'@capacitor/core'` to the `external` array if not already present (it is — confirm and leave it):

```js
const external = [
  '@aparajita/capacitor-secure-storage',
  '@capawesome/capacitor-apple-sign-in',
  '@capacitor/app',
  '@capacitor/browser',
  '@capacitor/core',          // already here — keep
  '@clerk/clerk-js',
  '@clerk/react',
  '@clerk/react/internal',
  '@clerk/react/legacy',
  '@clerk/shared',
  'react',
  'react-dom',
  'react/jsx-runtime',
];
```

- [ ] **Step 3: Commit**

```bash
git add package.json rollup.config.mjs
git commit -m "chore: add ./native subpath export and package files config"
```

---

## Task 2: TypeScript plugin interface

**Files:**
- Create: `src/native/ClerkNativePlugin.ts`

- [ ] **Step 1: Create `src/native/ClerkNativePlugin.ts`**

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/native/ClerkNativePlugin.ts
git commit -m "feat(native): add ClerkNativePlugin TypeScript interface"
```

---

## Task 3: syncNativeSession with tests

**Files:**
- Create: `src/native/__tests__/syncNativeSession.test.ts`
- Create: `src/native/syncNativeSession.ts`

- [ ] **Step 1: Create the failing test file `src/native/__tests__/syncNativeSession.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockGetClientToken = vi.fn().mockResolvedValue({ token: 'native-jwt-xyz' });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    getClientToken: (...args: unknown[]) => mockGetClientToken(...args),
  },
}));

const mockSaveToken = vi.fn().mockResolvedValue(undefined);

vi.mock('../../token-cache', () => ({
  tokenCache: {
    saveToken: (...args: unknown[]) => mockSaveToken(...args),
  },
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { syncNativeSession } from '../syncNativeSession';
import { CLERK_CLIENT_JWT_KEY } from '../../react/createClerkInstance';

const makeClerk = (overrides: Record<string, unknown> = {}) => ({
  __internal_reloadInitialResources: vi.fn().mockResolvedValue(undefined),
  setActive: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

afterEach(() => vi.clearAllMocks());

describe('syncNativeSession', () => {
  it('reads client token from native and saves it to the JS token cache', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockGetClientToken).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith(CLERK_CLIENT_JWT_KEY, 'native-jwt-xyz');
  });

  it('skips saveToken when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it('calls __internal_reloadInitialResources', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(clerk.__internal_reloadInitialResources).toHaveBeenCalled();
  });

  it('calls setActive with the sessionId', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_456', clerk as never);
    expect(clerk.setActive).toHaveBeenCalledWith({ session: 'sess_456' });
  });

  it('skips __internal_reloadInitialResources when not present', async () => {
    const clerk = makeClerk({ __internal_reloadInitialResources: undefined });
    await expect(syncNativeSession('sess_123', clerk as never)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- syncNativeSession
```

Expected: FAIL — `Cannot find module '../syncNativeSession'`

- [ ] **Step 3: Create `src/native/syncNativeSession.ts`**

```ts
import type { LoadedClerk } from '@clerk/types';
import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';

export async function syncNativeSession(sessionId: string, clerk: LoadedClerk): Promise<void> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  }

  const clerkRecord = clerk as unknown as Record<string, unknown>;
  if (typeof clerkRecord.__internal_reloadInitialResources === 'function') {
    await (clerkRecord.__internal_reloadInitialResources as () => Promise<void>)();
  }

  await clerk.setActive({ session: sessionId });
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- syncNativeSession
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/native/__tests__/syncNativeSession.test.ts src/native/syncNativeSession.ts
git commit -m "feat(native): add syncNativeSession with tests"
```

---

## Task 4: AuthView component with tests

**Files:**
- Create: `src/native/__tests__/AuthView.test.tsx`
- Create: `src/native/AuthView.tsx`

- [ ] **Step 1: Create the failing test file `src/native/__tests__/AuthView.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

const mockRemove = vi.fn();
const mockConfigure = vi.fn().mockResolvedValue(undefined);
const mockPresentAuth = vi.fn().mockResolvedValue(undefined);
const mockDismissAuth = vi.fn().mockResolvedValue(undefined);
const mockAddListener = vi.fn().mockResolvedValue({ remove: mockRemove });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    presentAuth: (...args: unknown[]) => mockPresentAuth(...args),
    dismissAuth: (...args: unknown[]) => mockDismissAuth(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

vi.mock('../syncNativeSession', () => ({
  syncNativeSession: vi.fn().mockResolvedValue(undefined),
}));

const mockGetToken = vi.fn().mockResolvedValue('test-bearer-token');
vi.mock('@clerk/react', () => ({
  useClerk: vi.fn().mockReturnValue({
    publishableKey: 'pk_test_xxx',
    session: { getToken: () => mockGetToken() },
    setActive: vi.fn(),
  }),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { Capacitor } from '@capacitor/core';
import { AuthView } from '../AuthView';

afterEach(() => vi.clearAllMocks());

describe('<AuthView>', () => {
  it('renders null — no DOM output', () => {
    const { container } = render(<AuthView />);
    expect(container.firstChild).toBeNull();
  });

  it('calls configure then presentAuth on mount', async () => {
    render(<AuthView mode="signIn" />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    expect(mockConfigure).toHaveBeenCalledWith({
      publishableKey: 'pk_test_xxx',
      bearerToken: 'test-bearer-token',
    });
    expect(mockPresentAuth).toHaveBeenCalledWith({ mode: 'signIn' });
  });

  it('uses signInOrUp as default mode', async () => {
    render(<AuthView />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    expect(mockPresentAuth).toHaveBeenCalledWith({ mode: 'signInOrUp' });
  });

  it('registers an authCompleted listener on mount', async () => {
    render(<AuthView />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    expect(mockAddListener).toHaveBeenCalledWith('authCompleted', expect.any(Function));
  });

  it('calls dismissAuth on unmount', async () => {
    const { unmount } = render(<AuthView />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    unmount();
    expect(mockDismissAuth).toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    const { unmount } = render(<AuthView />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('does nothing on non-native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    render(<AuthView />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockPresentAuth).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- AuthView
```

Expected: FAIL — `Cannot find module '../AuthView'`

- [ ] **Step 3: Create `src/native/AuthView.tsx`**

```tsx
import { useEffect } from 'react';
import { useClerk } from '@clerk/react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { ClerkNativePlugin } from './ClerkNativePlugin';
import { syncNativeSession } from './syncNativeSession';

export type AuthViewMode = 'signIn' | 'signUp' | 'signInOrUp';

export interface AuthViewProps {
  mode?: AuthViewMode;
}

export function AuthView({ mode = 'signInOrUp' }: AuthViewProps) {
  const clerk = useClerk();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: PluginListenerHandle | null = null;

    const setup = async () => {
      const bearerToken = (await clerk.session?.getToken()) ?? null;

      await ClerkNativePlugin.configure({
        publishableKey: clerk.publishableKey!,
        bearerToken,
      });

      listenerHandle = await ClerkNativePlugin.addListener('authCompleted', async ({ sessionId }) => {
        await syncNativeSession(sessionId, clerk);
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

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- AuthView
```

Expected: 7 tests pass.

- [ ] **Step 5: Run the full test suite to make sure nothing regressed**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/native/__tests__/AuthView.test.tsx src/native/AuthView.tsx
git commit -m "feat(native): add AuthView component with tests"
```

---

## Task 5: Subpath index and full build verification

**Files:**
- Create: `src/native/index.ts`

- [ ] **Step 1: Create `src/native/index.ts`**

```ts
export { AuthView } from './AuthView';
export type { AuthViewProps, AuthViewMode } from './AuthView';
```

- [ ] **Step 2: Run the full build**

```bash
npm run build
```

Expected: no errors. `dist/esm/native/index.js` and `dist/esm/native/index.d.ts` are created.

- [ ] **Step 3: Verify the output file exists**

```bash
ls dist/esm/native/
```

Expected: `index.d.ts  index.d.ts.map  index.js  index.js.map`

- [ ] **Step 4: Commit**

```bash
git add src/native/index.ts
git commit -m "feat(native): add capacitor-clerk/native subpath index"
```

---

## Task 6: Package.swift (iOS SPM manifest)

**Files:**
- Create: `Package.swift` (at repo root, alongside `package.json`)

- [ ] **Step 1: Verify the clerk-ios SPM product names**

Before writing `Package.swift`, confirm the exact product names by checking the clerk-ios repository's own `Package.swift`. The expected products are `ClerkKit` and `ClerkKitUI`, but verify the exact package name (`clerk-ios`) and minimum version. Open:

```
https://github.com/clerk/clerk-ios/blob/main/Package.swift
```

Note the minimum version for features used in this plan (especially `AuthView` with `mode` parameter).

- [ ] **Step 2: Create `Package.swift`**

Replace `2.0.0` with the confirmed minimum version from step 1:

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

- [ ] **Step 3: Commit**

```bash
git add Package.swift
git commit -m "feat(native): add Package.swift for iOS SPM distribution"
```

---

## Task 7: iOS KeychainHelper

**Files:**
- Create: `ios/Sources/CapacitorClerkNative/KeychainHelper.swift`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ios/Sources/CapacitorClerkNative
```

- [ ] **Step 2: Create `ios/Sources/CapacitorClerkNative/KeychainHelper.swift`**

This matches the Keychain access pattern used by `@clerk/expo`'s `ExpoKeychain`, using `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` and `Bundle.main.bundleIdentifier` as the service name. Reads/writes the `"clerkDeviceToken"` key that clerk-ios uses internally.

```swift
import Security
import Foundation

enum KeychainHelper {
    private static var service: String {
        Bundle.main.bundleIdentifier ?? ""
    }

    private static func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    static func write(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        var query = baseQuery(for: key)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        query[kSecValueData as String] = data

        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let attrs: [String: Any] = [
                kSecValueData as String:   data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
            SecItemUpdate(baseQuery(for: key) as CFDictionary, attrs as CFDictionary)
        }
    }

    static func read(key: String) -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String]  = true
        query[kSecMatchLimit as String]  = kSecMatchLimitOne

        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add ios/Sources/CapacitorClerkNative/KeychainHelper.swift
git commit -m "feat(native/ios): add KeychainHelper for clerkDeviceToken access"
```

---

## Task 8: iOS ClerkNativePlugin

**Files:**
- Create: `ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift`

- [ ] **Step 1: Create `ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift`**

Session observation uses a 300 ms polling Task so it works regardless of whether `Clerk.shared` is `@Observable` or `ObservableObject`. If you confirm clerk-ios uses `@Observable` (Swift Observation, iOS 17+), replace the polling block with `.onChange(of: Clerk.shared.session?.id)` in the SwiftUI wrapper view.

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

    private let clerkDeviceTokenKey = "clerkDeviceToken"
    private var authHostingController: UIViewController?
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
            self.authHostingController?.dismiss(animated: true)
            self.authHostingController = nil
            call.resolve()
        }
    }

    // MARK: - getClientToken

    @objc func getClientToken(_ call: CAPPluginCall) {
        let token = KeychainHelper.read(key: clerkDeviceTokenKey)
        call.resolve(["token": token as Any])
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

// MARK: - SwiftUI wrapper view

private struct ClerkAuthSheetView: View {
    let mode: AuthView.Mode

    var body: some View {
        AuthView(mode: mode)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add ios/Sources/CapacitorClerkNative/ClerkNativePlugin.swift
git commit -m "feat(native/ios): add ClerkNativePlugin Swift implementation"
```

- [ ] **Step 3: Run `npx cap sync` in the example app to pick up the new SPM package**

```bash
cd example-app && npx cap sync ios
```

Expected: Xcode resolves the `CapacitorClerk` SPM package including `clerk-ios`. Fix any package resolution errors before proceeding.

- [ ] **Step 4: Open Xcode and verify the build compiles**

```bash
cd example-app && npx cap open ios
```

Build the scheme (`Cmd+B`). Expected: build succeeds with no Swift errors. If `AuthView.Mode` or `Clerk.configure` don't exist, check the clerk-ios version in `Package.swift` and consult the clerk-ios README for the correct API.

---

## Task 9: Example app — add native auth screen for manual testing

**Files:**
- Modify: `example-app/src/App.tsx`

- [ ] **Step 1: Add a native auth route to `example-app/src/App.tsx`**

```tsx
import { ClerkProvider, Show } from 'capacitor-clerk';
import { AuthView } from 'capacitor-clerk/native';
import { useState } from 'react';

import { Home } from './Home';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

type Route = 'sign-in' | 'sign-up' | 'native-auth';

export function App({ publishableKey }: { publishableKey: string }): JSX.Element {
  const [route, setRoute] = useState<Route>('sign-in');

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <main style={layout}>
        <h1>capacitor-clerk demo</h1>
        <Show when="signed-out">
          {route === 'native-auth' ? (
            <AuthView mode="signInOrUp" />
          ) : route === 'sign-in' ? (
            <SignIn onSwitchToSignUp={() => setRoute('sign-up')} />
          ) : (
            <SignUp onSwitchToSignIn={() => setRoute('sign-in')} />
          )}
          <div style={routeSwitcher}>
            <button onClick={() => setRoute('native-auth')}>Native Auth</button>
            <button onClick={() => setRoute('sign-in')}>Custom Sign In</button>
          </div>
        </Show>
        <Show when="signed-in">
          <Home />
        </Show>
      </main>
    </ClerkProvider>
  );
}

const layout: React.CSSProperties = {
  fontFamily: 'system-ui',
  padding: 24,
  maxWidth: 480,
  margin: '0 auto',
};

const routeSwitcher: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
};
```

- [ ] **Step 2: Build the example app and sync**

```bash
cd example-app && npm run build && npx cap sync ios
```

Expected: no errors.

- [ ] **Step 3: Run on iOS simulator**

```bash
cd example-app && npx cap run ios --livereload --external
```

Tap "Native Auth" in the signed-out state. Expected: Clerk's native iOS auth sheet appears full-screen. Sign in. Expected: sheet dismisses, `Show when="signed-in"` renders `<Home />`.

- [ ] **Step 4: Commit**

```bash
git add example-app/src/App.tsx
git commit -m "chore(example): add Native Auth route to test AuthView"
```

---

## Verification checklist

After all tasks:

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — produces `dist/esm/native/index.js` and `.d.ts`
- [ ] Xcode build succeeds with no errors
- [ ] iOS simulator: tapping "Native Auth" shows Clerk auth sheet
- [ ] iOS simulator: completing sign-in dismisses sheet and renders Home
- [ ] iOS simulator: `getToken()` in Home returns a valid JWT (confirms session sync worked)
