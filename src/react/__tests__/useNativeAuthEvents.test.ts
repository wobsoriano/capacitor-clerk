import type * as CapacitorCore from '@capacitor/core';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line import/order -- ClerkPlugin/useNativeAuthEvents imports must come AFTER vi.mock calls below.
import type { TokenCache } from '../../definitions';

// Make Capacitor.isNativePlatform() etc. respect vi.stubGlobal in test-setup.
vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof CapacitorCore>('@capacitor/core');
  return {
    ...actual,
    get Capacitor() {
      return (globalThis as { Capacitor?: unknown }).Capacitor ?? actual.Capacitor;
    },
  };
});

// Capture event listeners and return a way to fire them.
const eventCallbacks: Record<string, (e: unknown) => void> = {};
const removeMock = vi.fn();

vi.mock('../../index', () => ({
  ClerkPlugin: {
    addListener: vi.fn(async (eventName: string, cb: (e: unknown) => void) => {
      eventCallbacks[eventName] = cb;
      return { remove: removeMock };
    }),
    getClientToken: vi.fn(),
  },
}));

/* eslint-disable import/first, import/order -- vi.mock calls are hoisted so these imports still resolve to the mocks. */
import { ClerkPlugin } from '../../index';
import { useNativeAuthEvents } from '../useNativeAuthEvents';
/* eslint-enable import/first, import/order */

beforeEach(() => {
  vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', isNativePlatform: () => true });
  for (const k of Object.keys(eventCallbacks)) delete eventCallbacks[k];
  removeMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeMemoryCache(): TokenCache {
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
}

describe('useNativeAuthEvents', () => {
  it('subscribes to authStateChange when clerk is provided', async () => {
    const tokenCache = makeMemoryCache();
    const clerk = { setActive: vi.fn(), signOut: vi.fn() } as unknown as never;

    renderHook(() => useNativeAuthEvents({ clerk, tokenCache }));

    await waitFor(() => {
      expect(eventCallbacks.authStateChange).toBeDefined();
    });
  });

  it('on signedIn: reads token, saves to cache, calls clerk.setActive', async () => {
    const tokenCache = makeMemoryCache();
    const setActive = vi.fn();
    const signOut = vi.fn();
    const clerk = { setActive, signOut } as unknown as never;

    (ClerkPlugin.getClientToken as ReturnType<typeof vi.fn>).mockResolvedValue('eyJtoken');

    renderHook(() => useNativeAuthEvents({ clerk, tokenCache }));
    await waitFor(() => expect(eventCallbacks.authStateChange).toBeDefined());

    await eventCallbacks.authStateChange({
      type: 'signedIn',
      sessionId: 'sess_1',
      userId: 'user_1',
    });

    expect(await tokenCache.getToken('__clerk_client_jwt')).toBe('eyJtoken');
    expect(setActive).toHaveBeenCalledWith({ session: 'sess_1' });
  });

  it('on signedOut: calls clerk.signOut and clears tokenCache', async () => {
    const tokenCache = makeMemoryCache();
    await tokenCache.saveToken('__clerk_client_jwt', 'eyJtoken');
    const signOut = vi.fn();
    const clerk = { setActive: vi.fn(), signOut } as unknown as never;

    renderHook(() => useNativeAuthEvents({ clerk, tokenCache }));
    await waitFor(() => expect(eventCallbacks.authStateChange).toBeDefined());

    await eventCallbacks.authStateChange({
      type: 'signedOut',
      sessionId: null,
      userId: null,
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(await tokenCache.getToken('__clerk_client_jwt')).toBeNull();
  });

  it('no-op when not on native platform', async () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'web', isNativePlatform: () => false });

    const tokenCache = makeMemoryCache();
    const clerk = { setActive: vi.fn(), signOut: vi.fn() } as unknown as never;

    renderHook(() => useNativeAuthEvents({ clerk, tokenCache }));

    expect(eventCallbacks.authStateChange).toBeUndefined();
  });
});
