import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TokenCache } from '../../definitions';
import { __resetForTests, createClerkInstance } from '../createClerkInstance';

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
    const FakeClerk = vi.fn().mockImplementation(function (this: { __internal_onBeforeRequest: () => void; __internal_onAfterResponse: () => void }) {
      this.__internal_onBeforeRequest = vi.fn();
      this.__internal_onAfterResponse = vi.fn();
    });
    const factory = createClerkInstance(FakeClerk as never);
    const instance = factory({ publishableKey: 'pk_test_xxx', tokenCache: memoryTokenCache });
    expect(instance).toBeDefined();
    expect(FakeClerk).toHaveBeenCalledWith('pk_test_xxx');
  });

  it('reuses the same instance on repeated calls with the same key', () => {
    const FakeClerk = vi.fn().mockImplementation(function (this: { __internal_onBeforeRequest: () => void; __internal_onAfterResponse: () => void }) {
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
