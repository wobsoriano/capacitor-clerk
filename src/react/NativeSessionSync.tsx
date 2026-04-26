import { Capacitor } from '@capacitor/core';
import { useAuth } from '@clerk/react';
import { useEffect, useRef } from 'react';

import type { TokenCache } from '../definitions';
import { ClerkPlugin } from '../index';

import { CLERK_CLIENT_JWT_KEY } from './createClerkInstance';

interface NativeSessionSyncProps {
  publishableKey: string;
  tokenCache: TokenCache;
}

/**
 * Watches useAuth().isSignedIn and pushes the bearer token to the native SDK
 * via ClerkPlugin.configure({ publishableKey, bearerToken }) when the JS-side
 * session changes. This lets native modals (UserProfile, etc.) see the session
 * created by JS forms (useSignIn, useSignUp).
 *
 * No-op on web platforms.
 */
export function NativeSessionSync({ publishableKey, tokenCache }: NativeSessionSyncProps): null {
  const { isSignedIn } = useAuth();
  const lastSyncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sync = async () => {
      if (isSignedIn) {
        const token = await tokenCache.getToken(CLERK_CLIENT_JWT_KEY);
        if (token && token !== lastSyncedTokenRef.current) {
          try {
            await ClerkPlugin.configure({ publishableKey, bearerToken: token });
            lastSyncedTokenRef.current = token;
          } catch (err) {
            if (typeof console !== 'undefined') {
              console.warn('[capacitor-clerk] NativeSessionSync configure failed:', err);
            }
          }
        }
      } else {
        if (lastSyncedTokenRef.current) {
          try {
            await ClerkPlugin.signOut();
          } catch {
            // already signed out
          }
          lastSyncedTokenRef.current = null;
        }
      }
    };

    void sync();
  }, [isSignedIn, publishableKey, tokenCache]);

  return null;
}
