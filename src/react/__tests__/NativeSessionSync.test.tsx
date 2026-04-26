import type * as CapacitorCore from '@capacitor/core';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line import/order -- ClerkPlugin/NativeSessionSync imports must come AFTER vi.mock calls below.
import type { TokenCache } from '../../definitions';

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof CapacitorCore>('@capacitor/core');
  return {
    ...actual,
    get Capacitor() {
      return (globalThis as { Capacitor?: unknown }).Capacitor ?? actual.Capacitor;
    },
  };
});

const useAuthMock = vi.fn();
vi.mock('@clerk/react', () => ({
  useAuth: () => useAuthMock(),
}));

const configureMock = vi.fn();
const signOutMock = vi.fn();
vi.mock('../../index', () => ({
  ClerkPlugin: {
    configure: (opts: unknown) => configureMock(opts),
    signOut: () => signOutMock(),
  },
}));

/* eslint-disable import/first, import/order */
import { NativeSessionSync } from '../NativeSessionSync';
/* eslint-enable import/first, import/order */

beforeEach(() => {
  vi.stubGlobal('Capacitor', { getPlatform: () => 'ios', isNativePlatform: () => true });
  configureMock.mockResolvedValue(undefined);
  signOutMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeMemoryCache(initial: Record<string, string> = {}): TokenCache {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async getToken(k) { return store.get(k) ?? null; },
    async saveToken(k, v) { store.set(k, v); },
    async clearToken(k) { store.delete(k); },
  };
}

describe('<NativeSessionSync>', () => {
  it('on signed-in: pushes bearer token to native via configure()', async () => {
    useAuthMock.mockReturnValue({ isSignedIn: true });
    const tokenCache = makeMemoryCache({ __clerk_client_jwt: 'eyJtoken' });

    render(<NativeSessionSync publishableKey="pk_test_xxx" tokenCache={tokenCache} />);

    await waitFor(() => {
      expect(configureMock).toHaveBeenCalledWith({
        publishableKey: 'pk_test_xxx',
        bearerToken: 'eyJtoken',
      });
    });
  });

  it('on signed-out after sign-in: calls native signOut', async () => {
    useAuthMock.mockReturnValue({ isSignedIn: true });
    const tokenCache = makeMemoryCache({ __clerk_client_jwt: 'eyJtoken' });

    const { rerender } = render(<NativeSessionSync publishableKey="pk_test_xxx" tokenCache={tokenCache} />);
    await waitFor(() => expect(configureMock).toHaveBeenCalled());

    useAuthMock.mockReturnValue({ isSignedIn: false });
    rerender(<NativeSessionSync publishableKey="pk_test_xxx" tokenCache={tokenCache} />);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledOnce();
    });
  });

  it('no-op on web platform', async () => {
    vi.stubGlobal('Capacitor', { getPlatform: () => 'web', isNativePlatform: () => false });
    useAuthMock.mockReturnValue({ isSignedIn: true });

    render(<NativeSessionSync publishableKey="pk_test_xxx" tokenCache={makeMemoryCache()} />);

    await new Promise((r) => setTimeout(r, 10));
    expect(configureMock).not.toHaveBeenCalled();
  });
});
