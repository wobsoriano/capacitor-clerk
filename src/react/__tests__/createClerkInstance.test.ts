import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { TokenCache } from '../../definitions';
import { createClerkInstance } from '../createClerkInstance';

const memoryTokenCache = (initial: Record<string, string> = {}): TokenCache => {
  const store = new Map(Object.entries(initial));
  return {
    async getToken(k) {
      return store.get(k) ?? null;
    },
    async saveToken(k, v) {
      store.set(k, v);
    },
    async clearToken(k) {
      store.delete(k);
    },
  };
};

interface FakeClerkSelf {
  publishableKey?: string;
  __internal_onBeforeRequest: (cb: unknown) => void;
  __internal_onAfterResponse: (cb: unknown) => void;
}

const makeFakeClerk = (
  capture: { before?: unknown; after?: unknown } = {},
): { ctor: ReturnType<typeof vi.fn>; capture: typeof capture } => {
  const ctor = vi.fn().mockImplementation(function (this: FakeClerkSelf, pk: string) {
    this.publishableKey = pk;
    this.__internal_onBeforeRequest = (cb) => {
      capture.before = cb;
    };
    this.__internal_onAfterResponse = (cb) => {
      capture.after = cb;
    };
  });
  return { ctor, capture };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('createClerkInstance', () => {
  it('throws when publishableKey is missing', () => {
    const { ctor } = makeFakeClerk();
    const factory = createClerkInstance(ctor as never);
    expect(() => factory({ publishableKey: '', tokenCache: memoryTokenCache() })).toThrow(
      /publishable key/i,
    );
  });

  it('returns a Clerk instance constructed with the publishableKey', () => {
    const { ctor } = makeFakeClerk();
    const factory = createClerkInstance(ctor as never);
    const instance = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache() });
    expect(instance).toBeDefined();
    expect(ctor).toHaveBeenCalledWith('pk_test_xxx');
  });

  it('memoizes the instance per publishableKey', () => {
    const { ctor } = makeFakeClerk();
    const factory = createClerkInstance(ctor as never);
    const a = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache() });
    const b = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache() });
    expect(a).toBe(b);
    expect(ctor).toHaveBeenCalledOnce();
  });

  it('builds a fresh instance when the publishableKey changes', () => {
    const { ctor } = makeFakeClerk();
    const factory = createClerkInstance(ctor as never);
    const a = factory({ publishableKey: 'pk_test_a', tokenCache: memoryTokenCache() });
    const b = factory({ publishableKey: 'pk_test_b', tokenCache: memoryTokenCache() });
    expect(a).not.toBe(b);
    expect(ctor).toHaveBeenCalledTimes(2);
  });
});

describe('request hooks', () => {
  it('onBeforeRequest sets _is_native=1, Authorization (when cached), x-mobile, credentials=omit', async () => {
    const capture: { before?: unknown; after?: unknown } = {};
    const { ctor } = makeFakeClerk(capture);
    const factory = createClerkInstance(ctor as never);
    factory({
      publishableKey: 'pk_test_xxx',
      tokenCache: memoryTokenCache({ __clerk_client_jwt: 'eyJtoken' }),
    });

    const headers = new Headers();
    const url = new URL('https://fapi.clerk.example.com/v1/environment');
    const req = { headers, url } as {
      headers: Headers;
      url: URL;
      credentials?: RequestCredentials;
    };
    await (capture.before as (r: typeof req) => Promise<void>)(req);

    expect(req.credentials).toBe('omit');
    expect(url.searchParams.get('_is_native')).toBe('1');
    expect(headers.get('authorization')).toBe('eyJtoken');
    expect(headers.get('x-mobile')).toBe('1');
  });

  it('onBeforeRequest skips Authorization when no token is cached', async () => {
    const capture: { before?: unknown } = {};
    const { ctor } = makeFakeClerk(capture);
    const factory = createClerkInstance(ctor as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache() });

    const headers = new Headers();
    const url = new URL('https://fapi.clerk.example.com/v1/environment');
    const req = { headers, url } as {
      headers: Headers;
      url: URL;
      credentials?: RequestCredentials;
    };
    await (capture.before as (r: typeof req) => Promise<void>)(req);

    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-mobile')).toBe('1');
  });

  it('onBeforeRequest sets x-capacitor-sdk-version when sdkVersion is provided', async () => {
    const capture: { before?: unknown } = {};
    const { ctor } = makeFakeClerk(capture);
    const factory = createClerkInstance(ctor as never);
    factory({
      publishableKey: 'pk_test_xxx',
      tokenCache: memoryTokenCache(),
      sdkVersion: '1.2.3',
    });

    const headers = new Headers();
    const req = {
      headers,
      url: new URL('https://fapi.clerk.example.com/v1/environment'),
    } as { headers: Headers; url: URL; credentials?: RequestCredentials };
    await (capture.before as (r: typeof req) => Promise<void>)(req);

    expect(headers.get('x-capacitor-sdk-version')).toBe('1.2.3');
  });

  it('onAfterResponse writes the rotated Authorization header to tokenCache', async () => {
    const capture: { after?: unknown } = {};
    const { ctor } = makeFakeClerk(capture);
    const cache = memoryTokenCache();
    const factory = createClerkInstance(ctor as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: cache });

    const res = new Response(null, { headers: { authorization: 'eyJrotated' } });
    await (capture.after as (req: unknown, r: Response) => Promise<void>)({}, res);

    expect(await cache.getToken('__clerk_client_jwt')).toBe('eyJrotated');
  });
});
