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

    const waitForClerkLoaded = async (timeoutMs = 5000) => {
      const start = Date.now();
      const c = clerk as unknown as {
        loaded?: boolean;
        addOnLoaded?: (cb: () => void) => void;
      };
      if (c.loaded) return;
      if (typeof c.addOnLoaded === 'function') {
        await new Promise<void>((resolve) => {
          c.addOnLoaded!(() => resolve());
        });
        return;
      }
      // Fallback: poll for clerk.loaded.
      while (!c.loaded && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 50));
      }
    };

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

        // Wait for clerk-js to finish its initial load (it runs in parallel
        // with this bootstrap, kicked off by InternalClerkProvider).
        await waitForClerkLoaded();
        if (cancelled) return;

        const internal = clerk as unknown as {
          client?: { sessions?: Array<{ id: string }> };
          __internal_reloadInitialResources?: () => Promise<void>;
          setActive?: (opts: { session: string }) => Promise<void>;
        };

        // If clerk-js's client doesn't already know about the native session,
        // reload its resources so FAPI returns the new session list (now that
        // the bearer token is in tokenCache and onBeforeRequest can use it).
        const sessionInClient = internal.client?.sessions?.some((s) => s.id === session.sessionId);
        if (!sessionInClient && typeof internal.__internal_reloadInitialResources === 'function') {
          await internal.__internal_reloadInitialResources();
        }
        if (cancelled) return;

        if (internal.setActive) {
          await internal.setActive({ session: session.sessionId });
        }
      } catch (err) {
        if (typeof console !== 'undefined') {
          const msg =
            err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
          console.warn('[capacitor-clerk] native bootstrap failed:', msg, err);
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
