import type { Clerk as ClerkType } from '@clerk/clerk-js';

import type { TokenCache } from '../definitions';

export interface CreateClerkInstanceOptions {
  publishableKey: string;
  tokenCache: TokenCache;
  /**
   * Optional consumer SDK identifier; sent as `x-capacitor-sdk-version`. Defaults
   * to undefined, in which case the header is not set.
   */
  sdkVersion?: string;
}

export const CLERK_CLIENT_JWT_KEY = '__clerk_client_jwt';

/**
 * Higher-order factory: takes the Clerk class and returns a function that
 * builds (and memoizes) a singleton Clerk instance for a given publishable
 * key. Mirrors the @clerk/expo pattern.
 *
 * Always wires `__internal_onBeforeRequest` and `__internal_onAfterResponse`
 * to drive Bearer-token auth via `?_is_native=1`..
 */
export function createClerkInstance(
  ClerkClass: typeof ClerkType,
): (options: CreateClerkInstanceOptions) => ClerkType {
  let cached: { key: string; instance: ClerkType } | null = null;

  return (options: CreateClerkInstanceOptions): ClerkType => {
    const { publishableKey, tokenCache, sdkVersion } = options;

    if (!publishableKey) {
      throw new Error('Missing Clerk publishable key');
    }

    if (cached && cached.key === publishableKey) {
      return cached.instance;
    }

    const clerk = new ClerkClass(publishableKey);
    attachRequestHooks(clerk, tokenCache, sdkVersion);
    cached = { key: publishableKey, instance: clerk };
    return clerk;
  };
}

interface ClerkInternalRequestHooks {
  __internal_onBeforeRequest: (
    cb: (req: { credentials?: RequestCredentials; url?: URL; headers?: Headers }) => Promise<void>,
  ) => void;
  __internal_onAfterResponse: (cb: (req: unknown, res: Response) => Promise<void>) => void;
}

function attachRequestHooks(clerk: ClerkType, tokenCache: TokenCache, sdkVersion: string | undefined): void {
  const hooks = clerk as unknown as ClerkInternalRequestHooks;

  hooks.__internal_onBeforeRequest(async (req) => {
    req.credentials = 'omit';
    req.url?.searchParams.append('_is_native', '1');

    const jwt = (await tokenCache.getToken(CLERK_CLIENT_JWT_KEY)) ?? null;
    if (jwt) {
      (req.headers as Headers).set('authorization', jwt);
    }
    (req.headers as Headers).set('x-mobile', '1');
    if (sdkVersion) {
      (req.headers as Headers).set('x-capacitor-sdk-version', sdkVersion);
    }
  });

  hooks.__internal_onAfterResponse(async (_req, res) => {
    const auth = res.headers.get('authorization');
    if (auth) {
      await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, auth);
    }
  });
}
