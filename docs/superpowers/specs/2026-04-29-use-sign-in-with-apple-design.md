# useSignInWithApple Hook Design

**Date:** 2026-04-29
**Project:** capacitor-clerk
**Branch:** main

## Overview

Add a `useSignInWithApple` hook for native iOS Apple Sign-In. Unlike `useSSO` (which opens a browser and handles a deep-link callback), Apple Sign-In uses a direct token exchange: the native Apple sheet returns an identity token (JWT) that is passed straight to Clerk's FAPI with strategy `oauth_token_apple`. No browser, no redirect, no `rotating_token_nonce`.

## Architecture

The hook lives alongside `useSSO` in `src/react/`. It follows the same structure: call hooks at the top level, expose a single async function, dynamically import the native dep only when called.

```
src/react/
  useSignInWithApple.ts          <- new hook
  __tests__/
    useSignInWithApple.test.ts   <- new tests
  index.ts                       <- add exports
rollup.config.mjs                <- add externals
package.json                     <- add peer dep
```

## Flow

1. Consumer calls `startAppleAuthenticationFlow()`
2. Hook checks `Capacitor.getPlatform()` - throws with actionable message on non-iOS
3. Dynamically imports `@capacitor-community/apple-sign-in`
4. Generates nonce via `crypto.randomUUID()` (available in WKWebView, no extra dep)
5. Calls `SignInWithApple.authorize({ clientId: '', redirectURI: '', scopes: 'email name', nonce })`
   - `clientId` and `redirectURI` are unused by the plugin on iOS native; bundle ID is implicit
6. Extracts `identityToken` from the credential; throws if missing
7. Calls `signIn.create({ strategy: 'oauth_token_apple', token: identityToken })`
8. Checks `signIn.firstFactorVerification.status`:
   - `'transferable'`: calls `signUp.create({ transfer: true, unsafeMetadata })`, returns `signUp.createdSessionId`
   - otherwise: returns `signIn.createdSessionId`
9. On user cancellation (plugin throws with `ERR_CANCELED`): returns `{ createdSessionId: null, ... }`

## API

```ts
export type StartAppleAuthenticationFlowParams = {
  unsafeMetadata?: SignUpUnsafeMetadata;
};

export type StartAppleAuthenticationFlowReturnType = {
  createdSessionId: string | null;
  setActive?: SetActive;
  signIn?: SignInResource;
  signUp?: SignUpResource;
};

export function useSignInWithApple(): {
  startAppleAuthenticationFlow: (
    params?: StartAppleAuthenticationFlowParams,
  ) => Promise<StartAppleAuthenticationFlowReturnType>;
}
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Not loaded | Returns `{ createdSessionId: null }` early (same as `useSSO`) |
| Non-iOS platform | Throws: "Sign in with Apple is only supported on iOS. Use `useSSO({ strategy: 'oauth_apple' })` on Android." |
| Plugin not installed | Throws with install instructions |
| No identity token returned | Throws: "No identity token received from Apple Sign-In." |
| User cancels | Returns `{ createdSessionId: null }` |
| Other Apple errors | Re-throws |

## Dependencies

- `@capacitor-community/apple-sign-in`: optional peer dep, dynamic import inside hook
- `@capacitor/core`: already a peer dep; used for `Capacitor.getPlatform()` platform check
- `crypto.randomUUID()`: built-in to WKWebView, no extra package needed

## Package Changes

**`package.json`:**
- Add `@capacitor-community/apple-sign-in` to `devDependencies` and `peerDependencies`
- Add `@capacitor-community/apple-sign-in: { optional: true }` to `peerDependenciesMeta`

**`rollup.config.mjs`:**
- Add `@capacitor-community/apple-sign-in` to externals

## Testing

Six tests following the same mock pattern as `useSSO.test.ts` (capture-slot pattern for async listeners is not needed here since there are no listeners):

1. Returns `null` when `signIn` not loaded
2. Returns `null` when `signUp` not loaded
3. Throws on non-iOS platform (mock `Capacitor.getPlatform()` to return `'android'`)
4. Throws when `identityToken` is missing from credential
5. User cancellation (`ERR_CANCELED`) returns `null` createdSessionId
6. Successful sign-in returns `createdSessionId`
7. Transferable sign-up calls `signUp.create({ transfer: true })` and returns `signUp.createdSessionId`

## Comparison with Expo

| | Expo `useSignInWithApple` | Capacitor `useSignInWithApple` |
|---|---|---|
| Native dep | `expo-apple-authentication` | `@capacitor-community/apple-sign-in` |
| Nonce | `expo-crypto` `randomUUID()` | `crypto.randomUUID()` (built-in) |
| Clerk strategy | `oauth_token_apple` | `oauth_token_apple` (same) |
| Platform guard | `.ios.ts` file split | `Capacitor.getPlatform()` check |
| clientId needed | No | No (empty string passed, ignored natively) |
