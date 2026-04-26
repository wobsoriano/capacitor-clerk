import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TokenCache } from '../../definitions';
import { __resetForTests, createClerkInstance } from '../createClerkInstance';

// Make the Capacitor import in source live-bind to the test's stubGlobal('Capacitor').
// Without this mock, @capacitor/core's exported Capacitor object is captured at module
// load and ignores subsequent vi.stubGlobal calls.
vi.mock('@capacitor/core', () => ({
  get Capacitor() {
    return (globalThis as { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor;
  },
}));

const memoryTokenCache: TokenCache = (() => {
  const store = new Map<string, string>();
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
})();

beforeEach(() => {
  __resetForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createClerkInstance', () => {
  it('throws when publishableKey is missing on first call', () => {
    const FakeClerk = vi.fn();
    const factory = createClerkInstance(FakeClerk as never);
    expect(() => factory({ publishableKey: '', tokenCache: memoryTokenCache })).toThrow();
  });

  it('returns a Clerk instance when given a publishableKey', () => {
    const FakeClerk = vi.fn().mockImplementation(function (this: {
      __internal_onBeforeRequest: () => void;
      __internal_onAfterResponse: () => void;
    }) {
      this.__internal_onBeforeRequest = vi.fn();
      this.__internal_onAfterResponse = vi.fn();
    });
    const factory = createClerkInstance(FakeClerk as never);
    const instance = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });
    expect(instance).toBeDefined();
    expect(FakeClerk).toHaveBeenCalledWith('pk_test_xxx');
  });

  it('reuses the same instance on repeated calls with the same key', () => {
    const FakeClerk = vi.fn().mockImplementation(function (this: {
      __internal_onBeforeRequest: () => void;
      __internal_onAfterResponse: () => void;
    }) {
      this.__internal_onBeforeRequest = vi.fn();
      this.__internal_onAfterResponse = vi.fn();
    });
    const factory = createClerkInstance(FakeClerk as never);
    const a = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });
    const b = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });
    expect(a).toBe(b);
    expect(FakeClerk).toHaveBeenCalledOnce();
  });
});

describe('createClerkInstance native mode', () => {
  beforeEach(() => {
    __resetForTests();
  });

  it('attaches __internal_onBeforeRequest when on native platform', () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', isNativePlatform: () => true });

    const onBeforeRequest = vi.fn();
    const onAfterResponse = vi.fn();
    const FakeClerk = vi.fn().mockImplementation(function (this: {
      __internal_onBeforeRequest: typeof onBeforeRequest;
      __internal_onAfterResponse: typeof onAfterResponse;
    }) {
      this.__internal_onBeforeRequest = onBeforeRequest;
      this.__internal_onAfterResponse = onAfterResponse;
    });
    const factory = createClerkInstance(FakeClerk as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });

    expect(onBeforeRequest).toHaveBeenCalledOnce();
    expect(onAfterResponse).toHaveBeenCalledOnce();
  });

  it('does NOT attach hooks on web platform', () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'web', isNativePlatform: () => false });

    const onBeforeRequest = vi.fn();
    const onAfterResponse = vi.fn();
    const FakeClerk = vi.fn().mockImplementation(function (this: {
      __internal_onBeforeRequest: typeof onBeforeRequest;
      __internal_onAfterResponse: typeof onAfterResponse;
    }) {
      this.__internal_onBeforeRequest = onBeforeRequest;
      this.__internal_onAfterResponse = onAfterResponse;
    });
    const factory = createClerkInstance(FakeClerk as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });

    expect(onBeforeRequest).not.toHaveBeenCalled();
    expect(onAfterResponse).not.toHaveBeenCalled();
  });

  it('onBeforeRequest hook injects _is_native=1 and Authorization header', async () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', isNativePlatform: () => true });

    const localStore = new Map<string, string>([['__clerk_client_jwt', 'eyJtoken']]);
    const localTokenCache = {
      async getToken(k: string) {
        return localStore.get(k) ?? null;
      },
      async saveToken(k: string, v: string) {
        localStore.set(k, v);
      },
    };

    let capturedHook: ((req: any) => Promise<void>) | undefined;
    const FakeClerk = vi.fn().mockImplementation(function (this: any) {
      this.__internal_onBeforeRequest = (cb: any) => {
        capturedHook = cb;
      };
      this.__internal_onAfterResponse = vi.fn();
    });
    const factory = createClerkInstance(FakeClerk as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: localTokenCache });

    const headers = new Headers();
    const url = new URL('https://fapi.clerk.example.com/v1/environment');
    const req: any = { headers, url };
    await capturedHook!(req);

    expect(req.credentials).toBe('omit');
    expect(url.searchParams.get('_is_native')).toBe('1');
    expect(headers.get('authorization')).toBe('eyJtoken');
    expect(headers.get('x-mobile')).toBe('1');
  });

  it('onAfterResponse hook saves rotated Authorization header to tokenCache', async () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', isNativePlatform: () => true });

    const saved: Record<string, string> = {};
    const localTokenCache = {
      async getToken() {
        return null;
      },
      async saveToken(k: string, v: string) {
        saved[k] = v;
      },
    };

    let capturedHook: ((req: unknown, res: Response) => Promise<void>) | undefined;
    const FakeClerk = vi.fn().mockImplementation(function (this: any) {
      this.__internal_onBeforeRequest = vi.fn();
      this.__internal_onAfterResponse = (cb: any) => {
        capturedHook = cb;
      };
    });
    const factory = createClerkInstance(FakeClerk as never);
    factory({ publishableKey: 'pk_test_xxx', tokenCache: localTokenCache });

    const res = new Response(null, { headers: { authorization: 'eyJrotated' } });
    await capturedHook!({}, res);

    expect(saved.__clerk_client_jwt).toBe('eyJrotated');
  });
});
