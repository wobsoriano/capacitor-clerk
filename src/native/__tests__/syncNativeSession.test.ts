import { afterEach, describe, expect, it, vi } from 'vitest';

// --- Mocks ---

const mockGetClientToken = vi.fn().mockResolvedValue({ token: 'native-jwt-xyz' });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    getClientToken: (...args: unknown[]) => mockGetClientToken(...args),
  },
}));

const mockSaveToken = vi.fn().mockResolvedValue(undefined);

vi.mock('../../token-cache', () => ({
  tokenCache: {
    saveToken: (...args: unknown[]) => mockSaveToken(...args),
  },
}));

const mockReloadInitialResources = vi.fn().mockResolvedValue(undefined);

vi.mock('../../react/createClerkInstance', () => ({
  CLERK_CLIENT_JWT_KEY: '__clerk_client_jwt',
  getCachedClerkInstance: () => ({
    __internal_reloadInitialResources: (...args: unknown[]) => mockReloadInitialResources(...args),
  }),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { syncNativeSession } from '../syncNativeSession';

const makeClerk = (overrides: Record<string, unknown> = {}) => ({
  setActive: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

afterEach(() => vi.clearAllMocks());

describe('syncNativeSession', () => {
  it('reads client token from native and saves it to the JS token cache', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockGetClientToken).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith('__clerk_client_jwt', 'native-jwt-xyz');
  });

  it('skips saveToken when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it('calls __internal_reloadInitialResources on the raw clerk instance', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockReloadInitialResources).toHaveBeenCalled();
  });

  it('calls setActive with the sessionId', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_456', clerk as never);
    expect(clerk.setActive).toHaveBeenCalledWith({ session: 'sess_456' });
  });

  it('skips __internal_reloadInitialResources when getCachedClerkInstance returns null', async () => {
    vi.doMock('../../react/createClerkInstance', () => ({
      CLERK_CLIENT_JWT_KEY: '__clerk_client_jwt',
      getCachedClerkInstance: () => null,
    }));
    const clerk = makeClerk();
    await expect(syncNativeSession('sess_123', clerk as never)).resolves.toBeUndefined();
  });
});
