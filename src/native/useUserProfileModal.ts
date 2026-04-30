import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useClerk } from '@clerk/react';

import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';
import { syncNativeSession } from './syncNativeSession';

export interface UseUserProfileModalReturn {
  presentUserProfile: () => Promise<void>;
}

export function useUserProfileModal(): UseUserProfileModalReturn {
  const clerk = useClerk();
  const presentingRef = useRef(false);

  const presentUserProfile = useCallback(async () => {
    if (presentingRef.current || !Capacitor.isNativePlatform()) return;
    presentingRef.current = true;

    try {
      const bearerToken = (await tokenCache.getToken(CLERK_CLIENT_JWT_KEY)) ?? null;
      await ClerkNativePlugin.configure({ publishableKey: clerk.publishableKey!, bearerToken });

      let resolvePromise!: () => void;
      const dismissPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const handle = await ClerkNativePlugin.addListener('profileDismissed', async () => {
        handle.remove();
        await syncNativeSession();
        resolvePromise();
      });

      try {
        await ClerkNativePlugin.presentUserProfile();
      } catch (e) {
        handle.remove();
        console.error('[useUserProfileModal] presentUserProfile error:', e);
        resolvePromise();
      }

      await dismissPromise;
    } catch (e) {
      console.error('[useUserProfileModal] error:', e);
    } finally {
      presentingRef.current = false;
    }
  }, [clerk]);

  return { presentUserProfile };
}
