import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { useClerk } from '@clerk/react';

import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';
import { syncNativeSession } from './syncNativeSession';

export interface UserProfileViewProps {
  isDismissable?: boolean;
  style?: React.CSSProperties;
  onProfileEvent?: (event: { type: string; data: string }) => void;
}

export function UserProfileView({ isDismissable = false, style, onProfileEvent }: UserProfileViewProps) {
  const clerk = useClerk();
  const containerRef = useRef<HTMLDivElement>(null);
  const onProfileEventRef = useRef(onProfileEvent);

  useEffect(() => {
    onProfileEventRef.current = onProfileEvent;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: PluginListenerHandle | null = null;
    let created = false;

    const setup = async () => {
      if (!containerRef.current) return;
      try {
        const bearerToken = (await tokenCache.getToken(CLERK_CLIENT_JWT_KEY)) ?? null;
        await ClerkNativePlugin.configure({ publishableKey: clerk.publishableKey!, bearerToken });

        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        await ClerkNativePlugin.createUserProfile({
          boundingRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
          isDismissable,
        });
        created = true;

        handle = await ClerkNativePlugin.addListener('profileEvent', (event) => {
          onProfileEventRef.current?.(event);
          if (event.type === 'signedOut') {
            void syncNativeSession();
          }
        });
      } catch (e) {
        console.error('[UserProfileView] setup error:', e);
      }
    };

    setup();

    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !created) return;
      const rect = containerRef.current.getBoundingClientRect();
      void ClerkNativePlugin.updateUserProfile({
        boundingRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      handle?.remove();
      if (created) {
        void ClerkNativePlugin.destroyUserProfile();
      }
    };
  }, [isDismissable]);

  if (!Capacitor.isNativePlatform()) return null;

  return <div ref={containerRef} style={{ width: '100%', height: '100%', ...style }} />;
}
