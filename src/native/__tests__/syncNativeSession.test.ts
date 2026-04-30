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

const mockReload = vi.fn();
vi.stubGlobal('window', { location: { reload: mockReload } });

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { syncNativeSession } from '../syncNativeSession';
import { CLERK_CLIENT_JWT_KEY } from '../../react/createClerkInstance';

afterEach(() => vi.clearAllMocks());

describe('syncNativeSession', () => {
  it('reads client token from native and saves it to the JS token cache', async () => {
    await syncNativeSession();
    expect(mockGetClientToken).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalledWith(CLERK_CLIENT_JWT_KEY, 'native-jwt-xyz');
  });

  it('skips saveToken when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    await syncNativeSession();
    expect(mockSaveToken).not.toHaveBeenCalled();
  });

  it('calls window.location.reload after saving the token', async () => {
    await syncNativeSession();
    expect(mockReload).toHaveBeenCalled();
  });

  it('calls window.location.reload even when token is null', async () => {
    mockGetClientToken.mockResolvedValueOnce({ token: null });
    await syncNativeSession();
    expect(mockReload).toHaveBeenCalled();
  });
});
