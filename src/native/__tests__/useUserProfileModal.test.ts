import { Capacitor } from '@capacitor/core';
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

// eslint-disable-next-line import/first -- vi.mock calls are hoisted

import { useUserProfileModal } from '../useUserProfileModal';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

const mockRemove = vi.fn();
const mockConfigure = vi.fn().mockResolvedValue(undefined);
const mockPresentUserProfile = vi.fn().mockResolvedValue(undefined);
const mockAddListener = vi.fn().mockResolvedValue({ remove: mockRemove });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    presentUserProfile: (...args: unknown[]) => mockPresentUserProfile(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

const mockSyncNativeSession = vi.fn().mockResolvedValue(true);

vi.mock('../syncNativeSession', () => ({
  syncNativeSession: (...args: unknown[]) => mockSyncNativeSession(...args),
}));

const mockGetTokenFromCache = vi.fn().mockResolvedValue('cached-client-jwt');

vi.mock('../../token-cache', () => ({
  tokenCache: { getToken: (...args: unknown[]) => mockGetTokenFromCache(...args) },
}));

vi.mock('../../react/createClerkInstance', () => ({
  CLERK_CLIENT_JWT_KEY: '__clerk_client_jwt',
}));

vi.mock('@clerk/react', () => ({
  useClerk: vi.fn().mockReturnValue({ publishableKey: 'pk_test_xxx' }),
}));

afterEach(() => vi.clearAllMocks());

describe('useUserProfileModal', () => {
  it('does nothing on non-native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    const { result } = renderHook(() => useUserProfileModal());
    await act(() => result.current.presentUserProfile());
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockPresentUserProfile).not.toHaveBeenCalled();
  });

  it('calls configure with publishable key and bearer token', async () => {
    let dismissedHandler: (() => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: () => void) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const { result } = renderHook(() => useUserProfileModal());
    const promise = act(() => result.current.presentUserProfile());
    await vi.waitFor(() => expect(mockConfigure).toHaveBeenCalled());

    expect(mockConfigure).toHaveBeenCalledWith({
      publishableKey: 'pk_test_xxx',
      bearerToken: 'cached-client-jwt',
    });

    dismissedHandler!();
    await promise;
  });

  it('registers a profileDismissed listener then calls presentUserProfile', async () => {
    let dismissedHandler: (() => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: () => void) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const { result } = renderHook(() => useUserProfileModal());
    const promise = act(() => result.current.presentUserProfile());

    await vi.waitFor(() =>
      expect(mockAddListener).toHaveBeenCalledWith('profileDismissed', expect.any(Function)),
    );
    await vi.waitFor(() => expect(mockPresentUserProfile).toHaveBeenCalled());

    dismissedHandler!();
    await promise;
  });

  it('calls syncNativeSession and removes listener when profileDismissed fires', async () => {
    let dismissedHandler: (() => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: () => void) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const { result } = renderHook(() => useUserProfileModal());
    const promise = act(() => result.current.presentUserProfile());
    await vi.waitFor(() => expect(dismissedHandler).toBeDefined());

    dismissedHandler!();
    await promise;

    expect(mockSyncNativeSession).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('resolves the presentUserProfile promise after dismiss', async () => {
    let dismissedHandler: (() => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: () => void) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const { result } = renderHook(() => useUserProfileModal());
    let resolved = false;
    const promise = act(async () => {
      await result.current.presentUserProfile();
      resolved = true;
    });

    await vi.waitFor(() => expect(dismissedHandler).toBeDefined());
    expect(resolved).toBe(false);

    dismissedHandler!();
    await promise;
    expect(resolved).toBe(true);
  });

  it('prevents concurrent invocations', async () => {
    let dismissedHandler: (() => void) | undefined;
    mockAddListener.mockImplementation((_event: string, handler: () => void) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const { result } = renderHook(() => useUserProfileModal());

    const p1 = act(() => result.current.presentUserProfile());
    const p2 = act(() => result.current.presentUserProfile());

    await vi.waitFor(() => expect(dismissedHandler).toBeDefined());
    dismissedHandler!();
    await Promise.all([p1, p2]);

    expect(mockPresentUserProfile).toHaveBeenCalledTimes(1);
  });
});
