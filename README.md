# capacitor-clerk

Clerk authentication for [Capacitor](https://capacitorjs.com/) apps.

## Install

```sh
npm i capacitor-clerk @aparajita/capacitor-secure-storage
npx cap sync
```

`@aparajita/capacitor-secure-storage` is the storage backend used by the default `tokenCache`. It uses Keychain on iOS and EncryptedSharedPreferences on Android. You can swap it for any storage you want; see [Custom token cache](#custom-token-cache) below.

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

This package re-exports Clerk's hooks (`useSignIn`, `useSignUp`, `useUser`, `useClerk`, `useAuth`, `useSession`, `useOrganization`, etc.) and `<Show>`. UI components (`<UserButton>`, `<SignIn>`, etc.) are intentionally not re-exported because the package runs `clerk-js` headless. Build your own forms.

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
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {errors.global?.[0] && <p>{errors.global[0].message}</p>}
      <button type="submit" disabled={fetchStatus === 'fetching'}>Sign in</button>
    </form>
  );
}
```

Full email + password sign-in and sign-up (with email verification) flows are in [`example-app/src/SignIn.tsx`](./example-app/src/SignIn.tsx) and [`example-app/src/SignUp.tsx`](./example-app/src/SignUp.tsx).

For more flow patterns (OAuth, MFA, passkeys, session tasks), see [Clerk's custom-flows guides](https://clerk.com/docs/guides/development/custom-flows).

## Limitations

- **No Clerk UI components.** `<UserButton>`, `<SignIn>`, `<SignUp>`, `<UserProfile>`, `<OrganizationSwitcher>`, etc. don't work because `clerk-js` runs in `runtimeEnvironment: 'headless'`. Use the hooks.
- **Capacitor v6+ only.** Older Capacitor versions don't expose `CapacitorHttp` and won't intercept fetch the way this package needs.

## Roadmap

- Native UI bridges via `clerk-ios` / `clerk-android` (currently dropped in favor of headless + custom flows; tracked in GitHub issues).
- OAuth-via-browser-tab flows (Google, Apple, etc.) using `@capacitor/browser`.

## License

MIT.
