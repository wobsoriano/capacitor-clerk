import { Capacitor } from '@capacitor/core';
import { Clerk } from '@clerk/clerk-js';
import { InternalClerkProvider as RawInternalClerkProvider } from '@clerk/react/internal';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import type { TokenCache } from '../definitions';
import { ClerkPlugin } from '../index';
import { tokenCache as defaultTokenCache } from '../token-cache';

import { NativeSessionSync } from './NativeSessionSync';
import { createClerkInstance } from './createClerkInstance';
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

  // Initialize ClerkPlugin (the platform-agnostic facade) so calls like
  // ClerkPlugin.presentUserProfile() / signOut() work. On web this builds a
  // second clerk-js instance inside ClerkPluginWeb; both instances share the
  // same cookie session on the same origin, so they stay in sync at load time.
  // On native, the plugin's configure delegates to the registered factory.
  useEffect(() => {
    void ClerkPlugin.configure({ publishableKey });
  }, [publishableKey]);

  return (
    <InternalClerkProvider clerk={clerk} publishableKey={publishableKey}>
      {Capacitor.isNativePlatform() ? (
        <NativeSyncBridge clerk={clerk} publishableKey={publishableKey} tokenCache={tokenCache} />
      ) : null}
      {children}
    </InternalClerkProvider>
  );
}

/**
 * Internal helper: mounts the native auth-event listener and the JS-to-native
 * session sync. Must live inside InternalClerkProvider because NativeSessionSync
 * uses useAuth() which requires the provider context.
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
  useNativeAuthEvents({ clerk, tokenCache });
  return <NativeSessionSync publishableKey={publishableKey} tokenCache={tokenCache} />;
}
