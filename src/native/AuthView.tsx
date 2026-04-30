import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { useClerk } from '@clerk/react';

import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';
import { syncNativeSession } from './syncNativeSession';

export type AuthViewMode = 'signIn' | 'signUp' | 'signInOrUp';

export interface AuthViewProps {
  mode?: AuthViewMode;
}

export function AuthView({ mode = 'signInOrUp' }: AuthViewProps) {
  const clerk = useClerk();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: PluginListenerHandle | null = null;

    const setup = async () => {
      try {
        // Restore a clerk-ios session that survived a JS reload before showing auth.
        if (!clerk.session) {
          const restored = await syncNativeSession();
          if (restored) return;
          // Native session expired; clear any stale JS token.
          await tokenCache.clearToken?.(CLERK_CLIENT_JWT_KEY);
        }

        const bearerToken = (await clerk.session?.getToken()) ?? null;
        await ClerkNativePlugin.configure({
          publishableKey: clerk.publishableKey!,
          bearerToken,
        });

        listenerHandle = await ClerkNativePlugin.addListener('authCompleted', async ({ sessionId }) => {
          listenerHandle?.remove();
          listenerHandle = null;
          await ClerkNativePlugin.dismissAuth();
          await syncNativeSession(sessionId);
        });

        await ClerkNativePlugin.presentAuth({ mode });
      } catch (e) {
        console.error('[AuthView] setup error:', e);
      }
    };

    setup();

    return () => {
      listenerHandle?.remove();
      ClerkNativePlugin.dismissAuth();
    };
  }, [mode]);

  return null;
}
