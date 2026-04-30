import { useEffect } from 'react';
import { useClerk } from '@clerk/react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
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
      const bearerToken = (await clerk.session?.getToken()) ?? null;

      await ClerkNativePlugin.configure({
        publishableKey: clerk.publishableKey!,
        bearerToken,
      });

      listenerHandle = await ClerkNativePlugin.addListener('authCompleted', async ({ sessionId }) => {
        await syncNativeSession(sessionId, clerk);
      });

      await ClerkNativePlugin.presentAuth({ mode });
    };

    setup();

    return () => {
      listenerHandle?.remove();
      ClerkNativePlugin.dismissAuth();
    };
  }, [mode]);

  return null;
}
