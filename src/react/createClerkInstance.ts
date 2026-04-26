import type { Clerk as ClerkType } from '@clerk/clerk-js';

import type { TokenCache } from '../definitions';
import {
  clearClerkSingleton,
  getClerkSingleton,
  getClerkSingletonPublishableKey,
  setClerkSingleton,
} from '../singleton';

export interface CreateClerkInstanceOptions {
  publishableKey: string;
  tokenCache: TokenCache;
}

/**
 * Higher-order factory that takes the Clerk class and returns a function for
 * creating singleton Clerk instances. Mirrors @clerk/expo's pattern of passing
 * the class so tests can inject a fake.
 *
 * The instance is shared with ClerkPluginWeb via `src/singleton.ts`, so plugin
 * methods like ClerkPlugin.signOut() and React hooks like useUser() always
 * reference the same clerk-js, the same UI bundle, and the same listeners.
 *
 * In Plan 1 we keep the structure but do not yet wire __internal_onBeforeRequest
 * for _is_native=1; that is added in Plan 4 once native bridges exist to sync with.
 */
export function createClerkInstance(
  ClerkClass: typeof ClerkType,
): (options: CreateClerkInstanceOptions) => ClerkType {
  return (options: CreateClerkInstanceOptions): ClerkType => {
    const { publishableKey, tokenCache } = options;

    const existing = getClerkSingleton();
    const existingKey = getClerkSingletonPublishableKey();
    if (!existing && !publishableKey) {
      throw new Error('Missing Clerk publishable key');
    }

    if (!existing || existingKey !== publishableKey) {
      const clerk = new ClerkClass(publishableKey);
      // Plan 4 will add __internal_onBeforeRequest hook here that injects
      // _is_native=1, Authorization, x-mobile, x-capacitor-sdk-version when
      // running on native. tokenCache is captured for that purpose.
      // Plan 4 will also add __internal_onAfterResponse hook to save rotated
      // JWT back to tokenCache.
      void tokenCache;
      setClerkSingleton(clerk, publishableKey);
      return clerk;
    }

    return existing;
  };
}

/**
 * Test-only: reset the singleton between tests. Not exported from the
 * package's public surface.
 */
export function __resetForTests(): void {
  clearClerkSingleton();
}
