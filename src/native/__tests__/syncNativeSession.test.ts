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

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { syncNativeSession } from '../syncNativeSession';
import { CLERK_CLIENT_JWT_KEY } from '../../react/createClerkInstance';

const makeClerk = (overrides: Record<string, unknown> = {}) => ({
  __internal_reloadInitialResources: vi.fn().mockResolvedValue(undefined),
  setActive: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

afterEach(() => vi.clearAllMocks());

describe('syncNativeSession', () => {
  it('reads client token from native and saves it to the JS token cache', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockGetClientToken).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith(CLERK_CLIENT_JWT_KEY, 'native-jwt-xyz');
  });

  it('skips saveToken when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it('calls __internal_reloadInitialResources', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_123', clerk as never);
    expect(clerk.__internal_reloadInitialResources).toHaveBeenCalled();
  });

  it('calls setActive with the sessionId', async () => {
    const clerk = makeClerk();
    await syncNativeSession('sess_456', clerk as never);
    expect(clerk.setActive).toHaveBeenCalledWith({ session: 'sess_456' });
  });

  it('skips __internal_reloadInitialResources when not present', async () => {
    const clerk = makeClerk({ __internal_reloadInitialResources: undefined });
    await expect(syncNativeSession('sess_123', clerk as never)).resolves.toBeUndefined();
  });
});
