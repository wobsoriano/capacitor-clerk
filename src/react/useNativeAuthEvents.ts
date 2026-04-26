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
 * Subscribes to ClerkPlugin's `authStateChange` events and pushes native
 * auth state into the JS clerk-js instance:
 *
 * - On `signedIn`: reads the bearer token from native via getClientToken(),
 *   saves it to the tokenCache (so onBeforeRequest in createClerkInstance
 *   sees it), then calls clerk.setActive({ session: sessionId }) to trigger
 *   clerk-js to fetch the session and update its listeners.
 *
 * - On `signedOut`: calls clerk.signOut() (idempotent if already signed out).
 *
 * No-op on web platforms.
 */
export function useNativeAuthEvents({ clerk, tokenCache }: UseNativeAuthEventsOptions): void {
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !clerk) return;

    isMountedRef.current = true;
    let listener: PluginListenerHandle | null = null;

    const setActiveOnClerk = (sessionId: string) => {
      const setActive = (
        clerk as unknown as {
          setActive?: (opts: { session: string }) => Promise<void>;
        }
      ).setActive;
      return setActive ? setActive({ session: sessionId }) : Promise.resolve();
    };

    const syncFromNative = async (sessionId: string) => {
      const { value: token } = await ClerkPlugin.getClientToken();
      if (token && token.length > 0) {
        await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, token);
      }
      await setActiveOnClerk(sessionId);
    };

    const subscribe = async () => {
      // Initial sync: if the native SDK has a session at mount-time (e.g., user
      // signed in on a previous app launch and the session is restored from
      // Keychain), push it into clerk-js so useUser() reflects it without a
      // fresh sign-in event.
      try {
        const session = await ClerkPlugin.getSession();
        if (isMountedRef.current && session?.sessionId) {
          await syncFromNative(session.sessionId);
        }
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[capacitor-clerk] initial native sync failed:', err);
        }
      }

      // Then subscribe to live auth-state changes for sign-in / sign-out.
      listener = await ClerkPlugin.addListener('authStateChange', async (event: AuthStateChangeEvent) => {
        if (!isMountedRef.current) return;
        try {
          if (event.type === 'signedIn' && event.sessionId) {
            await syncFromNative(event.sessionId);
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
