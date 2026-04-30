import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { useClerk, useUser } from '@clerk/react';

import { getCachedClerkInstance } from '../react/createClerkInstance';
import { ClerkNativePlugin } from './ClerkNativePlugin';

export interface UserButtonProps {
  style?: React.CSSProperties;
}

export function UserButton({ style }: UserButtonProps) {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: PluginListenerHandle | null = null;

    ClerkNativePlugin.addListener('profileDismissed', async () => {
      const instance = getCachedClerkInstance() as unknown as Record<string, unknown>;
      if (instance && typeof instance.__internal_reloadInitialResources === 'function') {
        await (instance.__internal_reloadInitialResources as () => Promise<void>)();
      }
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, []);

  if (!Capacitor.isNativePlatform() || !isLoaded || !user) return null;

  const initial = (
    user.firstName?.[0] ??
    user.emailAddresses[0]?.emailAddress?.[0] ??
    '?'
  ).toUpperCase();

  const handleClick = async () => {
    try {
      const bearerToken = (await clerk.session?.getToken()) ?? null;
      await ClerkNativePlugin.configure({
        publishableKey: clerk.publishableKey!,
        bearerToken,
      });
      await ClerkNativePlugin.presentUserProfile();
    } catch (e) {
      console.error('[UserButton] presentUserProfile error:', e);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        ...style,
      }}
      aria-label="Open user profile"
    >
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.fullName ?? 'User avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: '0.5em', fontWeight: 600, userSelect: 'none' }}>
          {initial}
        </span>
      )}
    </button>
  );
}
