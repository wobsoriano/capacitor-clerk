# capacitor-clerk

Capacitor plugin for [Clerk](https://clerk.com) authentication. Bridges Clerk's native iOS and Android SDKs into Capacitor apps and exposes a `@clerk/react`-compatible JS surface in the WebView.

> **Status**: v0.1.0, web platform working, iOS bridge with native ↔ JS state sync working, Android bridge in progress (Plan 3).

## Install

```bash
npm install capacitor-clerk
npx cap sync
```

## Usage on the web platform (current capability)

Set your Clerk publishable key:

```bash
# In your app's .env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Wrap your app:

```tsx
import { ClerkPlugin } from 'capacitor-clerk';
import {
  ClerkProvider,
  Show,
  UserButton,
  useUser,
} from 'capacitor-clerk/react';

function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <Show when="signed-out">
        <button onClick={() => ClerkPlugin.presentAuth()}>Sign in</button>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </ClerkProvider>
  );
}
```

`<ClerkProvider>` wraps `@clerk/react`'s provider so all `@clerk/react` hooks are available: `useUser`, `useAuth`, `useSession`, `useSignIn`, `useSignUp`, `useOrganization`, etc.

## iOS support

After installing the package and running `npx cap sync`, complete these steps to enable native iOS auth.

### 1. Add `clerk-ios` via Swift Package Manager

In Xcode, open your iOS app's Xcode project (`ios/App/App.xcodeproj`).

Note: Capacitor 8's iOS template uses an `.xcodeproj` (not an `.xcworkspace`). The Swift Package Manager workflow integrates directly with the project.

Go to **File > Add Package Dependencies...**, paste `https://github.com/clerk/clerk-ios`, and add **ClerkKit** to your **App** target. Pin to an exact version range (e.g., **Up to Next Major Version** from the latest release).

Set the **App** target's **Minimum Deployments** to **iOS 17.0** (this is what `clerk-ios` requires).

### 2. Copy the factory template

```bash
cp node_modules/capacitor-clerk/ios/Templates/ClerkViewFactory.template.swift \
   ios/App/App/ClerkViewFactory.swift
```

In Xcode, right-click the **App** group in the Project Navigator and choose **Add Files to "App"...**. Select the new `ClerkViewFactory.swift` file. Make sure **App** is checked under "Add to targets". Click **Add**.

(Capacitor's iOS template uses an explicit-PBXGroup project, not synchronized folder groups. Files placed in the source directory must be explicitly added to the target via Xcode UI for them to compile.)

### 3. Register the factory in `AppDelegate`

In `ios/App/App/AppDelegate.swift`, add:

```swift
import CapacitorClerk

// inside application(_:didFinishLaunchingWithOptions:)
clerkViewFactory = ClerkViewFactory()
```

The full method should look approximately like:

```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    clerkViewFactory = ClerkViewFactory()
    return true
}
```

### 4. Enable Native API in Clerk Dashboard

The Clerk instance must have **Native API enabled** (Dashboard > Configure > Native applications). Without it, the iOS SDK rejects requests with `native_api_disabled`.

After these four steps, calling `ClerkPlugin.presentAuth()` from JS will open a native SwiftUI sign-in sheet on iOS.

## Android support

(Coming in Plan 3.)

## API

<docgen-index>

* [`configure(...)`](#configure)
* [`presentAuth(...)`](#presentauth)
* [`presentUserProfile(...)`](#presentuserprofile)
* [`getSession()`](#getsession)
* [`getClientToken()`](#getclienttoken)
* [`signOut()`](#signout)
* [`secureGet(...)`](#secureget)
* [`secureSet(...)`](#secureset)
* [`secureRemove(...)`](#secureremove)
* [`addListener('authStateChange', ...)`](#addlistenerauthstatechange-)
* [`removeAllListeners()`](#removealllisteners)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

The Capacitor plugin contract. All three platforms (iOS, Android, web)
implement this same interface.

### configure(...)

```typescript
configure(options: { publishableKey: string; bearerToken?: string | null; }) => Promise<void>
```

Configure the plugin with a Clerk publishable key. On native, optionally
pass a bearer token to seed the native SDK with a clerk-js-acquired session.

| Param         | Type                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| **`options`** | <code>{ publishableKey: string; bearerToken?: string \| null; }</code> |

**Since:** 0.1.0

--------------------


### presentAuth(...)

```typescript
presentAuth(options?: { mode?: "signIn" | "signUp" | "signInOrUp" | undefined; dismissable?: boolean | undefined; } | undefined) => Promise<AuthResult>
```

Open the native (or web modal-overlay) sign-in/sign-up flow.
Resolves with `{ status: 'completed', sessionId, userId }` on success, or
`{ status: 'cancelled' }` when the user dismisses the modal.

On the web platform, the Promise resolves only on successful sign-in;
if the user closes the modal without signing in, the Promise stays pending.
Use `useAuth()` for reactive state on web.

| Param         | Type                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| **`options`** | <code>{ mode?: 'signIn' \| 'signUp' \| 'signInOrUp'; dismissable?: boolean; }</code> |

**Returns:** <code>Promise&lt;<a href="#authresult">AuthResult</a>&gt;</code>

**Since:** 0.1.0

--------------------


### presentUserProfile(...)

```typescript
presentUserProfile(options?: { dismissable?: boolean | undefined; } | undefined) => Promise<void>
```

Open the native (or web modal-overlay) user profile screen.

| Param         | Type                                    |
| ------------- | --------------------------------------- |
| **`options`** | <code>{ dismissable?: boolean; }</code> |

**Since:** 0.1.0

--------------------


### getSession()

```typescript
getSession() => Promise<NativeSessionSnapshot | null>
```

Returns the current session snapshot, or null if no session is active.

**Returns:** <code>Promise&lt;<a href="#nativesessionsnapshot">NativeSessionSnapshot</a> | null&gt;</code>

**Since:** 0.1.0

--------------------


### getClientToken()

```typescript
getClientToken() => Promise<string | null>
```

Returns the current session's JWT, or null if no session is active.

**Returns:** <code>Promise&lt;string | null&gt;</code>

**Since:** 0.1.0

--------------------


### signOut()

```typescript
signOut() => Promise<void>
```

Sign out the current user.

**Since:** 0.1.0

--------------------


### secureGet(...)

```typescript
secureGet(options: { key: string; }) => Promise<{ value: string | null; }>
```

Read a value from secure storage. iOS: Keychain. Android: EncryptedSharedPreferences.
Web: localStorage (NOT secure; web is for dev only).

| Param         | Type                          |
| ------------- | ----------------------------- |
| **`options`** | <code>{ key: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string | null; }&gt;</code>

**Since:** 0.1.0

--------------------


### secureSet(...)

```typescript
secureSet(options: { key: string; value: string; }) => Promise<void>
```

Write a value to secure storage.

| Param         | Type                                         |
| ------------- | -------------------------------------------- |
| **`options`** | <code>{ key: string; value: string; }</code> |

**Since:** 0.1.0

--------------------


### secureRemove(...)

```typescript
secureRemove(options: { key: string; }) => Promise<void>
```

Remove a value from secure storage.

| Param         | Type                          |
| ------------- | ----------------------------- |
| **`options`** | <code>{ key: string; }</code> |

**Since:** 0.1.0

--------------------


### addListener('authStateChange', ...)

```typescript
addListener(eventName: 'authStateChange', listener: (event: AuthStateChangeEvent) => void) => Promise<PluginListenerHandle>
```

Subscribe to auth state changes. The listener fires when a user signs in,
signs out, or the session is refreshed.

| Param           | Type                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| **`eventName`** | <code>'authStateChange'</code>                                                            |
| **`listener`**  | <code>(event: <a href="#authstatechangeevent">AuthStateChangeEvent</a>) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

**Since:** 0.1.0

--------------------


### removeAllListeners()

```typescript
removeAllListeners() => Promise<void>
```

Remove all listeners for this plugin.

**Since:** 0.1.0

--------------------


### Interfaces


#### NativeSessionSnapshot

The native module's session shape. Distinct from clerk-js's richer
Session/User resources; this is what crosses the plugin bridge.

| Prop            | Type                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`sessionId`** | <code>string</code>                                                                                                                              |
| **`userId`**    | <code>string</code>                                                                                                                              |
| **`user`**      | <code>{ id: string; firstName: string \| null; lastName: string \| null; primaryEmailAddress: string \| null; imageUrl: string \| null; }</code> |


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |


#### AuthStateChangeEvent

Event payload for the 'authStateChange' plugin event.

| Prop            | Type                                                         |
| --------------- | ------------------------------------------------------------ |
| **`type`**      | <code>'signedIn' \| 'signedOut' \| 'sessionRefreshed'</code> |
| **`sessionId`** | <code>string \| null</code>                                  |
| **`userId`**    | <code>string \| null</code>                                  |


### Type Aliases


#### AuthResult

Result returned from `presentAuth()`. A discriminated union so consumers
are forced to handle both the completed and cancelled cases.

<code>{ status: 'completed'; sessionId: string; userId: string } | { status: 'cancelled' }</code>

</docgen-api>
