# capacitor-clerk

Clerk authentication for [Capacitor](https://capacitorjs.com/) apps, with native UI components.

## Install

```sh
npm i capacitor-clerk @aparajita/capacitor-secure-storage
npx cap sync
```

`@aparajita/capacitor-secure-storage` is the storage backend used by the default `tokenCache`. It uses Keychain on iOS and EncryptedSharedPreferences on Android.

## Required Capacitor config

Enable `CapacitorHttp` in your `capacitor.config.json` (or `.ts`):

```json
{
  "plugins": {
    "CapacitorHttp": { "enabled": true }
  }
}
```

This routes `clerk-js`'s requests through Capacitor's native HTTP bridge, which avoids WebView CORS preflight problems for cross-origin Authorization-header POSTs to Clerk's frontend API.

## Setup

Wrap your root component in `<ClerkProvider>`:

```tsx
import { ClerkProvider } from 'capacitor-clerk';

export function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      {/* your app */}
    </ClerkProvider>
  );
}
```

## Custom flows

This package re-exports Clerk's hooks (`useSignIn`, `useSignUp`, `useUser`, `useClerk`, `useAuth`, `useSession`, `useOrganization`, etc.) and `<Show>`. UI components (`<SignIn>`, `<UserProfile>`, etc.) are intentionally not re-exported because the package runs `clerk-js` headless. Build your own forms.

A minimal sign-in:

```tsx
import { useSignIn } from 'capacitor-clerk';
import { useState } from 'react';

export function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => undefined });
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {errors.global?.[0] && <p>{errors.global[0].message}</p>}
      <button type="submit" disabled={fetchStatus === 'fetching'}>
        Sign in
      </button>
    </form>
  );
}
```

Full email + password sign-in and sign-up (with email verification) flows are in [`example-app/src/SignIn.tsx`](./example-app/src/SignIn.tsx) and [`example-app/src/SignUp.tsx`](./example-app/src/SignUp.tsx).

### OAuth / SSO (Google, GitHub, etc.)

Use `useSSO` from `capacitor-clerk` for browser-based OAuth flows. It opens the provider in an in-app browser tab via `@capacitor/browser` and handles the deep-link callback:

```tsx
import { useSSO } from 'capacitor-clerk';

const { startSSOFlow } = useSSO();

const { createdSessionId, setActive } = await startSSOFlow({
  strategy: 'oauth_google',
  redirectUrl: 'myapp://sso-callback', // your app's deep-link scheme
});
if (createdSessionId && setActive) {
  await setActive({ session: createdSessionId });
}
```

Requires `@capacitor/browser` and `@capacitor/app`. Register your redirect URL scheme in `Info.plist` (iOS) and `AndroidManifest.xml` (Android).

### Sign in with Apple

Use `useSignInWithApple` from `capacitor-clerk/apple` for native iOS Sign in with Apple. This uses Apple's native sheet instead of a browser redirect:

```tsx
import { useSignInWithApple } from 'capacitor-clerk/apple';

const { startAppleAuthenticationFlow } = useSignInWithApple();

const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
if (createdSessionId && setActive) {
  await setActive({ session: createdSessionId });
}
```

Requires `@capawesome/capacitor-apple-sign-in` and the **Sign in with Apple** capability enabled in your Xcode project (Signing & Capabilities tab). iOS only — use `useSSO({ strategy: 'oauth_apple' })` on Android.

For more flow patterns (OAuth, MFA, passkeys, session tasks), see [Clerk's custom-flows guides](https://clerk.com/docs/guides/development/custom-flows).

## Native components

`<AuthView>`, `<UserButton>`, `<UserProfileView>`, and `useUserProfileModal` are iOS-only components powered by [clerk-ios](https://github.com/clerk/clerk-ios). They require one extra step after `npm install`: open your project in Xcode and add `capacitor-clerk` as a local Swift Package via **File > Add Package Dependencies**, pointing to `node_modules/capacitor-clerk`. Re-run this after updating the package.

Requires iOS 17+. All other hooks and `<ClerkProvider>` work without this step.

### `<AuthView>`

Presents Clerk's native iOS auth UI as a full-screen modal. Handles the full flow: configure, present, dismiss, and sync the resulting session back to the JS SDK. Also restores an existing clerk-ios session transparently on app reload, so the user stays signed in across WebView refreshes.

```tsx
import { AuthView } from 'capacitor-clerk/native';

// Render when the user is not signed in. The sheet appears automatically,
// and once auth completes the session is synced and the component unmounts.
export function AuthScreen() {
  return <AuthView mode="signInOrUp" />;
}
```

`mode` accepts `"signIn"`, `"signUp"`, or `"signInOrUp"` (default). On non-iOS platforms the component renders nothing.

### `<UserButton>`

Renders a circular avatar button. Tapping it presents the native `UserProfileView` as a full-screen modal. When the user dismisses the sheet, the JS Clerk session is automatically refreshed.

```tsx
import { UserButton } from 'capacitor-clerk/native';

// Control size and shape via `style`.
<UserButton style={{ width: 36, height: 36, borderRadius: '50%' }} />;
```

Renders the user's profile photo (`user.imageUrl`) or an initial letter fallback. On non-iOS platforms it renders nothing.

### `<UserProfileView>`

Embeds the native `UserProfileView` directly in your layout (not as a modal). The native view tracks the div's position and size, so you control placement entirely with CSS. Unmounting the component removes the native view.

**Fullscreen** (dedicated profile screen, no dismiss button):

```tsx
import { UserProfileView } from 'capacitor-clerk/native';
import { useAuth } from 'capacitor-clerk';

export function ProfilePage() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) navigate('/sign-in');
  }, [isSignedIn]);

  return <UserProfileView style={{ position: 'fixed', inset: 0 }} />;
}
```

**Inline** (embedded in a page, with a dismiss button):

```tsx
<UserProfileView isDismissable style={{ width: '100%', height: 600 }} />
```

Props:

- `style?: React.CSSProperties`: controls the placeholder div size and position; the native view matches it
- `isDismissable?: boolean`: when `true`, shows a native "Done" button — use this when the view is in a sheet or panel the user can close. When `false` (default), no button is shown, suitable for fullscreen usage where navigation replaces dismissal
- `onProfileEvent?: (event: { type: string; data: string }) => void`: called on native events; `type` is `"signedOut"` when the user signs out or deletes their account from within the view

### `useUserProfileModal()`

The hook powering `<UserButton>`. Use it directly when you want to trigger the native `UserProfileView` modal from a custom UI element.

```tsx
import { useUserProfileModal } from 'capacitor-clerk/native';

function SettingsButton() {
  const { presentUserProfile } = useUserProfileModal();
  return <button onClick={() => void presentUserProfile()}>Manage profile</button>;
}
```

The returned promise resolves when the modal is dismissed. Sign-out from within the modal is detected and synced automatically.

## Limitations

- **Clerk's prebuilt web UI components not supported.** `clerk-js` runs headless, so `<SignIn>`, `<SignUp>`, `<UserProfile>`, etc. don't render. Use the hooks to build your own flows, or use the native components above.
- **Native components are iOS only.** Android native auth (`clerk-android`) is not yet supported.
- **Capacitor v6+ only.** Older Capacitor versions don't expose `CapacitorHttp` and won't intercept fetch the way this package needs.

## Roadmap

- Native components for Android via `clerk-android`.
- Android testing for Sign in with Apple via `useSSO({ strategy: 'oauth_apple' })`.

## License

MIT.
