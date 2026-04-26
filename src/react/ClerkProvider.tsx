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

  const isNative = Capacitor.isNativePlatform();

  return (
    <InternalClerkProvider
      // capital `Clerk` is the prop name InternalClerkProvider expects when you
      // hand it a pre-built instance (matching @clerk/expo's pattern).
      Clerk={clerk}
      publishableKey={publishableKey}
      // Critical on native: turns off browser-mode behavior (cookies, dev_browser
      // handshake, the things that trigger CORS preflights with Authorization
      // headers that the WebView cannot complete).
      standardBrowser={!isNative}
      experimental={{
        ...(isNative ? { runtimeEnvironment: 'headless' as const } : {}),
      }}
    >
      {isNative ? (
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

    const log = (msg: string, ...args: unknown[]) => {
      if (typeof console !== 'undefined') {
        console.log('[capacitor-clerk bootstrap]', msg, ...args);
      }
    };

    const bootstrap = async () => {
      try {
        log('1. reading cached JS token');
        const cachedToken = await tokenCache.getToken(CLERK_CLIENT_JWT_KEY);
        log('1. cached token length:', cachedToken?.length ?? 0);

        log('2. ClerkPlugin.configure');
        await ClerkPlugin.configure({
          publishableKey,
          bearerToken: cachedToken ?? null,
        });
        if (cancelled) return;

        log('3. ClerkPlugin.getSession');
        const session = await ClerkPlugin.getSession();
        log('3. native session:', session?.sessionId ?? 'null');
        if (cancelled || !session?.sessionId) {
          log('done (no native session)');
          return;
        }

        log('4. ClerkPlugin.getClientToken');
        const { value: token } = await ClerkPlugin.getClientToken();
        log('4. token length:', token?.length ?? 0);
        if (token && token.length > 0) {
          log('5. saving token to cache');
          await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, token);
        }
        if (cancelled) return;

        const internal = clerk as unknown as {
          loaded?: boolean;
          client?: { sessions?: Array<{ id: string }> };
          __internal_reloadInitialResources?: () => Promise<void>;
          setActive?: (opts: { session: string }) => Promise<void>;
        };

        // Wait for InternalClerkProvider to finish its clerk.load(). We do NOT
        // call clerk.load() ourselves: explicit double-load triggered a CORS
        // preflight rejection on the retry path.
        log('6. waiting for clerk.loaded (driven by InternalClerkProvider)');
        const start = Date.now();
        while (!internal.loaded && Date.now() - start < 10_000) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 100));
        }
        log('6. clerk.loaded after wait:', internal.loaded);
        if (!internal.loaded) {
          log('bootstrap aborted: clerk-js never finished loading within 10s');
          return;
        }
        if (cancelled) return;

        const sessionInClient = internal.client?.sessions?.some((s) => s.id === session.sessionId);
        log('7. session in client.sessions:', sessionInClient, 'sessions count:', internal.client?.sessions?.length ?? 0);

        if (!internal.setActive) {
          log('8. setActive missing on clerk instance!');
          return;
        }

        // Just call setActive. clerk-js will fetch the session if it doesn't
        // have it. Skipping __internal_reloadInitialResources because that has
        // been observed to throw a generic network error in WebKit even when
        // the underlying FAPI call would succeed.
        log('8. setActive', session.sessionId);
        await internal.setActive({ session: session.sessionId });
        log('8. setActive done; clerk.session?.id:', (clerk as any).session?.id);
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
