import { Clerk } from '@clerk/clerk-js';
import { InternalClerkProvider } from '@clerk/react/internal';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import type { TokenCache } from '../definitions';
import { tokenCache as defaultTokenCache } from '../token-cache';

import { createClerkInstance } from './createClerkInstance';

export interface ClerkProviderProps {
  publishableKey: string;
  /**
   * Token cache used to persist the rotating Clerk JWT across launches.
   * Defaults to `tokenCache` from `capacitor-clerk/token-cache`, backed by
   * `@aparajita/capacitor-secure-storage`.
   */
  tokenCache?: TokenCache;
  children: ReactNode;
}

/**
 * Access or create a Clerk instance outside of a React component.
 * @example
 * import { getClerkInstance } from "capacitor-clerk"
 *
 * const clerkInstance = getClerkInstance({ publishableKey: 'xxxx' })
 *
 * // Always pass the `publishableKey` to `ClerkProvider`
 * <ClerkProvider publishableKey={'xxxx'}>
 *     ...
 * </ClerkProvider>
 *
 * // Somewhere in your code, outside of React you can do
 * const token = await clerkInstance.session?.getToken();
 * fetch('http://example.com/', {headers: {Authorization: token })
 *
 * @throws MissingPublishableKeyError publishableKey is missing and Clerk has not been initialized yet
 * @returns HeadlessBrowserClerk | BrowserClerk
 */
export const getClerkInstance = createClerkInstance(Clerk);

// `InternalClerkProvider`'s public typing doesn't accept a pre-built `clerk`
// via `Clerk=` cleanly; cast to a permissive component type. This is the
// same pattern @clerk/expo uses.
const InnerClerkProvider = InternalClerkProvider as unknown as ComponentType<
  Record<string, unknown> & { children?: ReactNode }
>;

export function ClerkProvider({
  publishableKey,
  tokenCache = defaultTokenCache,
  children,
}: ClerkProviderProps): JSX.Element {
  const clerk = useMemo(
    () => getClerkInstance({ publishableKey, tokenCache }),
    [publishableKey, tokenCache],
  );

  return (
    <InnerClerkProvider
      Clerk={clerk}
      publishableKey={publishableKey}
      // Disable cookie-based auth, dev_browser handshake, and Authorization-
      // header CORS preflights. Bearer auth via __internal_onBeforeRequest.
      standardBrowser={false}
      // Skip loading the Clerk UI bundle; this package is hooks-only.
      experimental={{ runtimeEnvironment: 'headless' }}
    >
      {children}
    </InnerClerkProvider>
  );
}
