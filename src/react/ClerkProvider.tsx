import { Capacitor } from '@capacitor/core';
import { Clerk } from '@clerk/clerk-js';
import { InternalClerkProvider as RawInternalClerkProvider } from '@clerk/react/internal';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import type { TokenCache } from '../definitions';
import { ClerkPlugin } from '../index';
import { tokenCache as defaultTokenCache } from '../token-cache';

import { CLERK_CLIENT_JWT_KEY, createClerkInstance } from './createClerkInstance';
import { NativeSessionSync } from './NativeSessionSync';
import { useNativeAuthEvents } from './useNativeAuthEvents';

export interface ClerkProviderProps {
  publishableKey: string;
  /**
   * Token cache used by the Clerk instance to persist the __client JWT.
   * Defaults to `tokenCache` from `capacitor-clerk/token-cache`, which uses
   * Keychain or EncryptedSharedPreferences on native and localStorage on web.
   */
  tokenCache?: TokenCache;
  children: ReactNode;
}

const buildClerkInstance = createClerkInstance(Clerk);

// `InternalClerkProvider`'s public typing only accepts `Clerk` (the constructor)
// rather than a pre-built `clerk` instance. We pass the latter and cast the
// component to a loose ComponentType to bypass that restriction; tightening
// this is a v2 concern.
const InternalClerkProvider = RawInternalClerkProvider as unknown as ComponentType<
  Record<string, unknown> & { children?: ReactNode }
>;

export function ClerkProvider({
  publishableKey,
  tokenCache = defaultTokenCache,
  children,
}: ClerkProviderProps): JSX.Element {
  const clerk = useMemo(
    () => buildClerkInstance({ publishableKey, tokenCache }),
    [publishableKey, tokenCache],
  );

  return (
    <InternalClerkProvider clerk={clerk} publishableKey={publishableKey}>
      {Capacitor.isNativePlatform() ? (
        <NativeSyncBridge clerk={clerk} publishableKey={publishableKey} tokenCache={tokenCache} />
      ) : (
        <WebConfigure publishableKey={publishableKey} />
      )}
      {children}
    </InternalClerkProvider>
  );
}

/**
 * On web, just push the publishableKey to the plugin so methods like
 * ClerkPlugin.signOut() work. No native-side ordering concern.
 */
function WebConfigure({ publishableKey }: { publishableKey: string }): null {
  useEffect(() => {
    void ClerkPlugin.configure({ publishableKey });
  }, [publishableKey]);
  return null;
}

/**
 * On native, the bootstrap order matters:
 *   1. ClerkPlugin.configure(...) (with any cached JS bearer token)
 *   2. After configure resolves, check if the native SDK already has a session
 *      (e.g. user signed in on a previous launch and Keychain restored it).
 *   3. If yes, push the bearer token to tokenCache and clerk.setActive() so
 *      clerk-js fetches the session and useUser() updates.
 *
 * This is one ordered chain in a single useEffect to avoid the racy useEffect
 * that called getSession() before configure() resolved (which trapped because
 * Clerk.shared isn't accessible until configure runs).
 *
 * Live deltas (sign-in / sign-out happening DURING the app session) are owned
 * by useNativeAuthEvents.
 */
function NativeSyncBridge({
  clerk,
  publishableKey,
  tokenCache,
}: {
  clerk: ReturnType<typeof buildClerkInstance>;
  publishableKey: string;
  tokenCache: TokenCache;
}): JSX.Element | null {
  // Live deltas (sign-in / sign-out events).
  useNativeAuthEvents({ clerk, tokenCache });

  // Initial bootstrap: configure native, then sync the native session into clerk-js.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        // Pre-load any cached JS bearer token so configure can seed native with it.
        const cachedToken = await tokenCache.getToken(CLERK_CLIENT_JWT_KEY);

        await ClerkPlugin.configure({
          publishableKey,
          bearerToken: cachedToken ?? null,
        });
        if (cancelled) return;

        // After configure, check if native has an existing session.
        const session = await ClerkPlugin.getSession();
        if (cancelled || !session?.sessionId) return;

        // Pull the bearer token from native and write to tokenCache so clerk-js's
        // onBeforeRequest hook can use it for FAPI calls.
        const { value: token } = await ClerkPlugin.getClientToken();
        if (token && token.length > 0) {
          await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, token);
        }
        if (cancelled) return;

        // Push the session id into clerk-js.
        const setActive = (
          clerk as unknown as {
            setActive?: (opts: { session: string }) => Promise<void>;
          }
        ).setActive;
        if (setActive) {
          await setActive({ session: session.sessionId });
        }
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[capacitor-clerk] native bootstrap failed:', err);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clerk, publishableKey, tokenCache]);

  return <NativeSessionSync publishableKey={publishableKey} tokenCache={tokenCache} />;
}
