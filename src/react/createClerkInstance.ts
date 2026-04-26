import type { Clerk as ClerkType } from '@clerk/clerk-js';

import type { TokenCache } from '../definitions';

export interface CreateClerkInstanceOptions {
  publishableKey: string;
  tokenCache: TokenCache;
}

let __internal_clerk: ClerkType | undefined;
let __internal_publishableKey: string | undefined;

/**
 * Higher-order factory that takes the Clerk class and returns a function for
 * creating singleton Clerk instances. Mirrors @clerk/expo's pattern of passing
 * the class so tests can inject a fake.
 *
 * In Plan 1 we keep the structure but do not yet wire __internal_onBeforeRequest
 * for _is_native=1; that is added in Plan 4 once native bridges exist to sync with.
 */
export function createClerkInstance(
  ClerkClass: typeof ClerkType,
): (options: CreateClerkInstanceOptions) => ClerkType {
  return (options: CreateClerkInstanceOptions): ClerkType => {
    const { publishableKey, tokenCache } = options;

    if (!__internal_clerk && !publishableKey) {
      throw new Error('Missing Clerk publishable key');
    }

    if (!__internal_clerk || __internal_publishableKey !== publishableKey) {
      __internal_publishableKey = publishableKey;
      __internal_clerk = new ClerkClass(publishableKey);
      // Plan 4 will add __internal_onBeforeRequest hook here that injects
      // _is_native=1, Authorization, x-mobile, x-capacitor-sdk-version when
      // running on native. tokenCache is captured for that purpose.
      // Plan 4 will also add __internal_onAfterResponse hook to save rotated
      // JWT back to tokenCache.
      void tokenCache;
    }

    return __internal_clerk;
  };
}

/**
 * Test-only: reset the singleton between tests. Not exported from the
 * package's public surface.
 */
export function __resetForTests(): void {
  __internal_clerk = undefined;
  __internal_publishableKey = undefined;
}
