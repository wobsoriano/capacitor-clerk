import { Capacitor } from '@capacitor/core';
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
  /**
   * Optional: a string identifier for this consumer; sent as
   * `x-capacitor-sdk-version` for telemetry. Defaults to undefined.
   */
  sdkVersion?: string;
}

export const CLERK_CLIENT_JWT_KEY = '__clerk_client_jwt';

/**
 * Higher-order factory that takes the Clerk class and returns a function for
 * creating singleton Clerk instances.
 *
 * On native platforms (iOS, Android), wires `__internal_onBeforeRequest` and
 * `__internal_onAfterResponse` hooks so clerk-js can talk to Clerk's FAPI in
 * "native mode": Bearer-token auth via `?_is_native=1`, no cookies.
 * Verified against `clerk_go/api/fapi/v1/router/cors.go` (CORS allows any
 * origin) and `client_type_middleware.go:22-24` (Capacitor explicitly supported).
 */
export function createClerkInstance(ClerkClass: typeof ClerkType): (options: CreateClerkInstanceOptions) => ClerkType {
  return (options: CreateClerkInstanceOptions): ClerkType => {
    const { publishableKey, tokenCache, sdkVersion } = options;

    const existing = getClerkSingleton();
    const existingKey = getClerkSingletonPublishableKey();
    if (!existing && !publishableKey) {
      throw new Error('Missing Clerk publishable key');
    }

    if (existing && existingKey === publishableKey) {
      return existing;
    }

    const clerk = new ClerkClass(publishableKey);

    if (Capacitor.isNativePlatform()) {
      attachNativeRequestHooks(clerk, tokenCache, sdkVersion);
    }

    setClerkSingleton(clerk, publishableKey);
    return clerk;
  };
}

/**
 * Wire `__internal_onBeforeRequest` and `__internal_onAfterResponse` hooks
 * to enable Bearer-token auth and `_is_native=1` mode. Only call on native
 * platforms; on web this would break cookie-based auth.
 */
function attachNativeRequestHooks(clerk: ClerkType, tokenCache: TokenCache, sdkVersion: string | undefined): void {
  const onBeforeRequest = (
    clerk as unknown as {
      __internal_onBeforeRequest: (
        cb: (req: { credentials?: RequestCredentials; url?: URL; headers?: Headers }) => Promise<void>,
      ) => void;
    }
  ).__internal_onBeforeRequest;
  const onAfterResponse = (
    clerk as unknown as {
      __internal_onAfterResponse: (cb: (req: unknown, res: Response) => Promise<void>) => void;
    }
  ).__internal_onAfterResponse;

  onBeforeRequest(async (req) => {
    req.credentials = 'omit';
    req.url?.searchParams.append('_is_native', '1');
    const jwt = await tokenCache.getToken(CLERK_CLIENT_JWT_KEY);
    if (jwt) {
      (req.headers as Headers).set('authorization', jwt);
    }
    (req.headers as Headers).set('x-mobile', '1');
    if (sdkVersion) {
      (req.headers as Headers).set('x-capacitor-sdk-version', sdkVersion);
    }
  });

  onAfterResponse(async (_req, res) => {
    const auth = res.headers.get('authorization');
    if (auth) {
      await tokenCache.saveToken(CLERK_CLIENT_JWT_KEY, auth);
    }
  });
}

/**
 * Test-only: reset the singleton between tests. Not exported from the
 * package's public surface.
 */
export function __resetForTests(): void {
  clearClerkSingleton();
}
