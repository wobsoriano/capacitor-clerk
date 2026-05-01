import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

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
const mockSetActive = vi.fn().mockResolvedValue(undefined);
const mockGetCachedClerkInstance = vi.fn().mockReturnValue({
  __internal_reloadInitialResources: (...args: unknown[]) => mockReloadInitialResources(...args),
  setActive: (...args: unknown[]) => mockSetActive(...args),
  session: { id: 'sess_from_instance' },
});

vi.mock('../../react/createClerkInstance', () => ({
  CLERK_CLIENT_JWT_KEY: '__clerk_client_jwt',
  getCachedClerkInstance: (...args: unknown[]) => mockGetCachedClerkInstance(...args),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { syncNativeSession } from '../syncNativeSession';

afterEach(() => vi.clearAllMocks());

describe('syncNativeSession', () => {
  it('reads client token from native and saves it to the JS token cache', async () => {
    await syncNativeSession('sess_123');
    expect(mockGetClientToken).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith('__clerk_client_jwt', 'native-jwt-xyz');
  });

  it('skips saveToken when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    await syncNativeSession('sess_123');
    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it('calls __internal_reloadInitialResources on the raw clerk instance', async () => {
    await syncNativeSession('sess_123');
    expect(mockReloadInitialResources).toHaveBeenCalled();
  });

  it('calls setActive with the explicit sessionId when provided', async () => {
    await syncNativeSession('sess_456');
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_456' });
  });

  it('uses session id from the clerk instance when no sessionId is provided', async () => {
    await syncNativeSession();
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_from_instance' });
  });

  it('returns false with no native token and no sessionId', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    await expect(syncNativeSession()).resolves.toBe(false);
    expect(mockReloadInitialResources).not.toHaveBeenCalled();
  });

  it('returns true after successfully setting the session', async () => {
    await expect(syncNativeSession('sess_123')).resolves.toBe(true);
  });

  it('returns false when getCachedClerkInstance returns null', async () => {
    mockGetCachedClerkInstance.mockReturnValueOnce(null);
    await expect(syncNativeSession('sess_123')).resolves.toBe(false);
  });
});
