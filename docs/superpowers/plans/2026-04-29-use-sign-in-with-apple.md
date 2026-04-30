# useSignInWithApple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `useSignInWithApple` hook to capacitor-clerk that performs native iOS Apple Sign-In via `@capacitor-community/apple-sign-in` and exchanges the identity token directly with Clerk (no browser redirect).

**Architecture:** Dynamically import `@capacitor-community/apple-sign-in` at call time (same pattern as `useSSO` with `@capacitor/browser`). Use `crypto.randomUUID()` for the nonce (built into WKWebView, no extra dep). Guard against non-iOS platforms at call time using `Capacitor.getPlatform()` from `@capacitor/core`. Pass the Apple identity token to Clerk with strategy `oauth_token_apple` and handle the transferable sign-up path identically to `useSSO`.

**Tech Stack:** TypeScript, `@clerk/react/legacy` (useSignIn/useSignUp), `@capacitor/core` (Capacitor.getPlatform), `@capacitor-community/apple-sign-in`, Vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/react/useSignInWithApple.ts` | The hook: platform guard, dynamic import, nonce, token exchange, transferable sign-up |
| Create | `src/react/__tests__/useSignInWithApple.test.ts` | 7 tests covering all branches |
| Modify | `src/react/index.ts` | Export the hook and its types |
| Modify | `rollup.config.mjs` | Add `@capacitor-community/apple-sign-in` to externals |
| Modify | `package.json` | Add `@capacitor-community/apple-sign-in` as optional peer dep and devDep |
| Modify | `example-app/src/SignIn.tsx` | Add Apple Sign-In button below Google button |

---

## Task 1: Install dev dependency and update package metadata

**Files:**
- Modify: `package.json`
- Modify: `rollup.config.mjs`

- [ ] **Step 1: Install the package as a dev dependency**

```bash
npm install --save-dev @capacitor-community/apple-sign-in
```

Expected: package appears in `node_modules/@capacitor-community/apple-sign-in` and `package.json` `devDependencies`.

- [ ] **Step 2: Add to peerDependencies and peerDependenciesMeta in package.json**

In `package.json`, add to the `"peerDependencies"` block:

```json
"@capacitor-community/apple-sign-in": ">=6.0.0"
```

And add to the `"peerDependenciesMeta"` block:

```json
"@capacitor-community/apple-sign-in": {
  "optional": true
}
```

- [ ] **Step 3: Add to rollup externals**

In `rollup.config.mjs`, add `'@capacitor-community/apple-sign-in'` to the `external` array (alphabetical order, after `@capacitor/core`):

```js
const external = [
  '@aparajita/capacitor-secure-storage',
  '@capacitor-community/apple-sign-in',
  '@capacitor/app',
  '@capacitor/browser',
  '@capacitor/core',
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

- [ ] **Step 4: Verify the build still passes with no new warnings**

```bash
npm run build
```

Expected: exits 0, no "Unresolved dependency" warnings.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json rollup.config.mjs
git commit -m "chore: add @capacitor-community/apple-sign-in as optional peer dep"
```

---

## Task 2: Write the failing tests

**Files:**
- Create: `src/react/__tests__/useSignInWithApple.test.ts`

- [ ] **Step 1: Create the test file with all mocks and 7 failing tests**

Create `src/react/__tests__/useSignInWithApple.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'ios'),
  },
}));

const mockAuthorize = vi.fn();

vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: {
    authorize: (...args: unknown[]) => mockAuthorize(...args),
  },
}));

// --- Clerk mocks ---

const mockSetActive = vi.fn();
const mockSignInCreate = vi.fn().mockResolvedValue({});
const mockSignUpCreate = vi.fn().mockResolvedValue({});

type FakeSignIn = {
  firstFactorVerification?: { status: string };
  createdSessionId?: string | null;
};

type FakeSignUp = { createdSessionId?: string | null };

const makeSignIn = (overrides: FakeSignIn = {}) => ({
  firstFactorVerification: {
    status: 'complete',
    ...overrides.firstFactorVerification,
  },
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignInCreate,
});

const makeSignUp = (overrides: FakeSignUp = {}) => ({
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignUpCreate,
});

vi.mock('@clerk/react/legacy', () => ({
  useSignIn: vi.fn(() => ({ isLoaded: true, setActive: mockSetActive, signIn: makeSignIn() })),
  useSignUp: vi.fn(() => ({ isLoaded: true, signUp: makeSignUp() })),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted; this resolves to the mocks.
import { Capacitor } from '@capacitor/core';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useSignInWithApple } from '../useSignInWithApple';

const makeCredentialResponse = (identityToken = 'apple-id-token-xyz') => ({
  response: {
    user: 'apple-user-id',
    email: 'user@example.com',
    givenName: 'Test',
    familyName: 'User',
    identityToken,
    authorizationCode: 'auth-code',
  },
});

beforeEach(() => {
  mockAuthorize.mockResolvedValue(makeCredentialResponse());
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-nonce-1234') });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useSignInWithApple', () => {
  it('returns null createdSessionId when signIn is not loaded', async () => {
    vi.mocked(useSignIn).mockReturnValueOnce({ isLoaded: false, setActive: mockSetActive, signIn: null } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it('returns null createdSessionId when signUp is not loaded', async () => {
    vi.mocked(useSignUp).mockReturnValueOnce({ isLoaded: false, signUp: null } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it('throws on non-iOS platform with actionable message pointing to useSSO', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValueOnce('android');
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const error = await startAppleAuthenticationFlow().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/only supported on iOS/i);
    expect((error as Error).message).toContain('useSSO');
  });

  it('throws when identityToken is missing from credential', async () => {
    mockAuthorize.mockResolvedValueOnce(makeCredentialResponse(null as unknown as string));
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    await expect(startAppleAuthenticationFlow()).rejects.toThrow(/no identity token/i);
  });

  it('returns null createdSessionId when user cancels Apple sheet', async () => {
    mockAuthorize.mockRejectedValueOnce(Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }));
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockSignInCreate).not.toHaveBeenCalled();
  });

  it('completes sign-in and returns createdSessionId', async () => {
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ createdSessionId: 'sess_apple_123' }),
    } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();

    expect(mockAuthorize).toHaveBeenCalledWith({
      clientId: '',
      redirectURI: '',
      scopes: 'email name',
      nonce: 'test-nonce-1234',
    });
    expect(mockSignInCreate).toHaveBeenCalledWith({
      strategy: 'oauth_token_apple',
      token: 'apple-id-token-xyz',
    });
    expect(result.createdSessionId).toBe('sess_apple_123');
    expect(result.setActive).toBe(mockSetActive);
  });

  it('transfers to sign-up when firstFactorVerification is transferable', async () => {
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ firstFactorVerification: { status: 'transferable' } }),
    } as never);
    vi.mocked(useSignUp).mockReturnValue({
      isLoaded: true,
      signUp: makeSignUp({ createdSessionId: 'sess_new_user' }),
    } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow({ unsafeMetadata: { role: 'admin' } });

    expect(mockSignUpCreate).toHaveBeenCalledWith({ transfer: true, unsafeMetadata: { role: 'admin' } });
    expect(result.createdSessionId).toBe('sess_new_user');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they all fail with "module not found" or similar**

```bash
npm run test -- --reporter=verbose src/react/__tests__/useSignInWithApple.test.ts
```

Expected: 7 tests fail (the hook file doesn't exist yet).

---

## Task 3: Implement the hook

**Files:**
- Create: `src/react/useSignInWithApple.ts`

- [ ] **Step 1: Create the hook**

Create `src/react/useSignInWithApple.ts`:

```ts
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { Capacitor } from '@capacitor/core';
import type { SetActive, SignInResource, SignUpResource } from '@clerk/shared/types';

export type StartAppleAuthenticationFlowParams = {
  unsafeMetadata?: SignUpUnsafeMetadata;
};

export type StartAppleAuthenticationFlowReturnType = {
  createdSessionId: string | null;
  setActive?: SetActive;
  signIn?: SignInResource;
  signUp?: SignUpResource;
};

export function useSignInWithApple() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  async function startAppleAuthenticationFlow(
    params?: StartAppleAuthenticationFlowParams,
  ): Promise<StartAppleAuthenticationFlowReturnType> {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return { createdSessionId: null, signIn, signUp, setActive };
    }

    if (Capacitor.getPlatform() !== 'ios') {
      throw new Error(
        "Sign in with Apple is only supported on iOS. Use useSSO({ strategy: 'oauth_apple' }) on Android.",
      );
    }

    let SignInWithApple: typeof import('@capacitor-community/apple-sign-in').SignInWithApple;
    try {
      ({ SignInWithApple } = await import('@capacitor-community/apple-sign-in'));
    } catch {
      throw new Error(
        '@capacitor-community/apple-sign-in is required to use Sign in with Apple. ' +
          'Install it: npm install @capacitor-community/apple-sign-in',
      );
    }

    const nonce = crypto.randomUUID();

    let credential: Awaited<ReturnType<typeof SignInWithApple.authorize>>['response'];
    try {
      ({ response: credential } = await SignInWithApple.authorize({
        clientId: '',
        redirectURI: '',
        scopes: 'email name',
        nonce,
      }));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_CANCELED') {
        return { createdSessionId: null, setActive, signIn, signUp };
      }
      throw error;
    }

    const { identityToken } = credential;
    if (!identityToken) {
      throw new Error('No identity token received from Apple Sign-In.');
    }

    await signIn!.create({ strategy: 'oauth_token_apple', token: identityToken });

    if (signIn!.firstFactorVerification.status === 'transferable') {
      await signUp!.create({ transfer: true, unsafeMetadata: params?.unsafeMetadata });
      return { createdSessionId: signUp!.createdSessionId ?? null, setActive, signIn, signUp };
    }

    return { createdSessionId: signIn!.createdSessionId ?? null, setActive, signIn, signUp };
  }

  return { startAppleAuthenticationFlow };
}
```

- [ ] **Step 2: Run the tests and confirm all 7 pass**

```bash
npm run test -- --reporter=verbose src/react/__tests__/useSignInWithApple.test.ts
```

Expected: 7/7 pass.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
npm run test
```

Expected: all 22 existing tests plus 7 new = 29 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/react/useSignInWithApple.ts src/react/__tests__/useSignInWithApple.test.ts
git commit -m "feat(react): add useSignInWithApple hook for native iOS Apple Sign-In"
```

---

## Task 4: Export from the public API

**Files:**
- Modify: `src/react/index.ts`

- [ ] **Step 1: Add exports to src/react/index.ts**

Add after the `useSSO` export block:

```ts
export { useSignInWithApple } from './useSignInWithApple';
export type { StartAppleAuthenticationFlowParams, StartAppleAuthenticationFlowReturnType } from './useSignInWithApple';
```

The full relevant section of `src/react/index.ts` should look like:

```ts
export { useSSO } from './useSSO';
export type { StartSSOFlowParams, StartSSOFlowReturnType } from './useSSO';

export { useSignInWithApple } from './useSignInWithApple';
export type { StartAppleAuthenticationFlowParams, StartAppleAuthenticationFlowReturnType } from './useSignInWithApple';
```

- [ ] **Step 2: Build to verify types emit correctly**

```bash
npm run build
```

Expected: exits 0. Check that `dist/esm/react/index.d.ts` contains `useSignInWithApple`.

```bash
grep 'useSignInWithApple' dist/esm/react/index.d.ts
```

Expected: two lines (the function export and the type exports).

- [ ] **Step 3: Commit**

```bash
git add src/react/index.ts
git commit -m "feat(react): export useSignInWithApple from public API"
```

---

## Task 5: Add Apple Sign-In button to example-app

**Files:**
- Modify: `example-app/src/SignIn.tsx`

The example-app's `SignIn.tsx` already has a Google SSO button (`onGoogleSignIn`). We add an Apple button using the same loading/error state pattern, placed directly below the Google button.

- [ ] **Step 1: Update example-app/src/SignIn.tsx**

Replace the entire file content with:

```tsx
import { useSignIn, useSignInWithApple, useSSO } from 'capacitor-clerk';
import { useState } from 'react';

const SSO_REDIRECT_URL = 'capacitorclerk://sso-callback';

interface SignInProps {
  onSwitchToSignUp: () => void;
}

export function SignIn({ onSwitchToSignUp }: SignInProps): JSX.Element {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => undefined });
    }
  };

  const onGoogleSignIn = async () => {
    setSsoError(null);
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: SSO_REDIRECT_URL,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : 'SSO failed');
    } finally {
      setSsoLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    setSsoError(null);
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : 'Apple Sign-In failed');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={form}>
      <h2>Sign in</h2>
      <label>
        Email
        <input
          type="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
      </label>
      {errors.fields.identifier && (
        <p style={errorStyle}>{errors.fields.identifier.message}</p>
      )}
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={input}
        />
      </label>
      {errors.fields.password && (
        <p style={errorStyle}>{errors.fields.password.message}</p>
      )}
      {errors.global?.[0] && <p style={errorStyle}>{errors.global[0].message}</p>}
      <button type="submit" disabled={fetchStatus === 'fetching'} style={button}>
        {fetchStatus === 'fetching' ? 'Signing in...' : 'Sign in'}
      </button>
      <div style={divider}>
        <hr style={dividerLine} />
        <span style={dividerText}>or</span>
        <hr style={dividerLine} />
      </div>
      <button type="button" onClick={onGoogleSignIn} disabled={ssoLoading || appleLoading} style={oauthButton}>
        {ssoLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>
      <button type="button" onClick={onAppleSignIn} disabled={ssoLoading || appleLoading} style={appleButton}>
        {appleLoading ? 'Signing in...' : ' Sign in with Apple'}
      </button>
      {ssoError && <p style={errorStyle}>{ssoError}</p>}
      <button type="button" onClick={onSwitchToSignUp} style={linkButton}>
        Need an account? Sign up
      </button>
    </form>
  );
}

const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 4 };
const button: React.CSSProperties = { padding: '10px 16px', fontSize: 16 };
const oauthButton: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 16,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 4,
  cursor: 'pointer',
};
const appleButton: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 16,
  background: '#000',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};
const divider: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const dividerLine: React.CSSProperties = { flex: 1, border: 'none', borderTop: '1px solid #ddd' };
const dividerText: React.CSSProperties = { color: '#888', fontSize: 13 };
const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#06c',
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};
const errorStyle: React.CSSProperties = { color: '#c00', margin: 0 };
```

- [ ] **Step 2: Install the plugin in example-app**

```bash
cd example-app && npm install @capacitor-community/apple-sign-in && cd ..
```

- [ ] **Step 3: Sync the Capacitor native project**

```bash
cd example-app && npx cap sync ios && cd ..
```

Expected: Capacitor prints "Sync finished." with no errors.

- [ ] **Step 4: Commit**

```bash
git add example-app/src/SignIn.tsx example-app/package.json example-app/package-lock.json
git commit -m "feat(example-app): add Sign in with Apple button"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: 29 tests pass, 0 failures.

- [ ] **Step 2: Run the full build**

```bash
npm run build
```

Expected: exits 0, no warnings.

- [ ] **Step 3: Verify the public exports are present in the build**

```bash
grep 'useSignInWithApple\|StartAppleAuthentication' dist/esm/react/index.d.ts
```

Expected: 3 lines (hook, params type, return type).

- [ ] **Step 4: Commit if anything was left unstaged**

Only commit if there are uncommitted changes:

```bash
git status
```

If clean: nothing to do. If not:

```bash
git add -p
git commit -m "chore: final cleanup for useSignInWithApple"
```
