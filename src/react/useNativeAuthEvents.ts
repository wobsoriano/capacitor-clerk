import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Clerk as ClerkType } from '@clerk/clerk-js';
import { useEffect, useRef } from 'react';

import type { AuthStateChangeEvent, TokenCache } from '../definitions';
import { ClerkPlugin } from '../index';

import { CLERK_CLIENT_JWT_KEY } from './createClerkInstance';

interface UseNativeAuthEventsOptions {
  clerk: ClerkType | null;
  tokenCache: TokenCache;
}

/**
 * Subscribes to ClerkPlugin's `authStateChange` events (live deltas) and
 * pushes native auth state into the JS clerk-js instance:
 *
 * - On `signedIn`: reads the bearer token from native via getClientToken(),
 *   saves it to the tokenCache, then calls clerk.setActive({ session }) so
 *   clerk-js fetches the session and updates listeners.
 *
 * - On `signedOut`: calls clerk.signOut() (idempotent if already signed out).
 *
 * Initial-state sync (e.g. app launch with an existing native session) is
 * NOT handled here; that's owned by the bootstrap effect in NativeSyncBridge
 * because it needs to be ordered after configure() resolves and before
 * subscriptions start. This hook only handles deltas.
 *
 * No-op on web platforms.
 */
export function useNativeAuthEvents({ clerk, tokenCache }: UseNativeAuthEventsOptions): void {
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !clerk) return;

    isMountedRef.current = true;
    let listener: PluginListenerHandle | null = null;

    const subscribe = async () => {
      listener = await ClerkPlugin.addListener('authStateChange', async (event: AuthStateChangeEvent) => {
        if (!isMountedRef.current) return;
        try {
          if (event.type === 'signedIn' && event.sessionId) {
            const { value: token } = await ClerkPlugin.getClientToken();
            if (token && token.length > 0) {
              await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, token);
            }
            const setActive = (
              clerk as unknown as {
                setActive?: (opts: { session: string }) => Promise<void>;
              }
            ).setActive;
            if (setActive) {
              await setActive({ session: event.sessionId });
            }
          } else if (event.type === 'signedOut') {
            try {
              await clerk.signOut();
            } catch {
              // already signed out; safe to ignore
            }
            if (tokenCache.clearToken) {
              await tokenCache.clearToken(CLERK_CLIENT_JWT_KEY);
            }
          }
        } catch (err) {
          if (typeof console !== 'undefined') {
            console.warn('[capacitor-clerk] useNativeAuthEvents failed:', err);
          }
        }
      });
    };

    void subscribe();

    return () => {
      isMountedRef.current = false;
      void listener?.remove();
    };
  }, [clerk, tokenCache]);
}
