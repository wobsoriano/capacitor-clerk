import { Capacitor } from '@capacitor/core';
import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

// eslint-disable-next-line import/first -- vi.mock calls are hoisted

import { UserProfileView } from '../UserProfileView';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

const mockRemove = vi.fn();
const mockConfigure = vi.fn().mockResolvedValue(undefined);
const mockCreateUserProfile = vi.fn().mockResolvedValue(undefined);
const mockUpdateUserProfile = vi.fn().mockResolvedValue(undefined);
const mockDestroyUserProfile = vi.fn().mockResolvedValue(undefined);
const mockAddListener = vi.fn().mockResolvedValue({ remove: mockRemove });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    createUserProfile: (...args: unknown[]) => mockCreateUserProfile(...args),
    updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
    destroyUserProfile: (...args: unknown[]) => mockDestroyUserProfile(...args),
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

// ResizeObserver mock — captures the callback so tests can trigger it
let resizeCallback: ResizeObserverCallback | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  resizeCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        resizeCallback = cb;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
      unobserve = vi.fn();
    },
  );

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 10,
    top: 20,
    width: 300,
    height: 600,
    right: 310,
    bottom: 620,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('<UserProfileView>', () => {
  it('renders null on non-native platform', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    const { container } = render(<UserProfileView />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a div on native platform', () => {
    const { container } = render(<UserProfileView />);
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('calls configure then createUserProfile with bounding rect on mount', async () => {
    render(<UserProfileView />);
    await vi.waitFor(() => expect(mockCreateUserProfile).toHaveBeenCalled());
    expect(mockConfigure).toHaveBeenCalledWith({
      publishableKey: 'pk_test_xxx',
      bearerToken: 'cached-client-jwt',
    });
    expect(mockCreateUserProfile).toHaveBeenCalledWith({
      boundingRect: { x: 10, y: 20, width: 300, height: 600 },
      isDismissable: false,
    });
  });

  it('passes isDismissable prop to createUserProfile', async () => {
    render(<UserProfileView isDismissable />);
    await vi.waitFor(() => expect(mockCreateUserProfile).toHaveBeenCalled());
    expect(mockCreateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isDismissable: true }),
    );
  });

  it('registers a profileEvent listener on mount', async () => {
    render(<UserProfileView />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    expect(mockAddListener).toHaveBeenCalledWith('profileEvent', expect.any(Function));
  });

  it('calls onProfileEvent when profileEvent fires', async () => {
    let eventHandler: ((data: { type: string; data: string }) => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: typeof eventHandler) => {
      eventHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    const onProfileEvent = vi.fn();
    render(<UserProfileView onProfileEvent={onProfileEvent} />);
    await vi.waitFor(() => expect(eventHandler).toBeDefined());

    act(() => eventHandler!({ type: 'profileUpdated', data: '{}' }));
    expect(onProfileEvent).toHaveBeenCalledWith({ type: 'profileUpdated', data: '{}' });
  });

  it('calls syncNativeSession when profileEvent type is signedOut', async () => {
    let eventHandler: ((data: { type: string; data: string }) => void) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: typeof eventHandler) => {
      eventHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    render(<UserProfileView />);
    await vi.waitFor(() => expect(eventHandler).toBeDefined());

    await act(async () => eventHandler!({ type: 'signedOut', data: '{}' }));
    expect(mockSyncNativeSession).toHaveBeenCalled();
  });

  it('calls updateUserProfile when ResizeObserver fires', async () => {
    render(<UserProfileView />);
    await vi.waitFor(() => expect(mockCreateUserProfile).toHaveBeenCalled());

    act(() => resizeCallback!([], {} as ResizeObserver));
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      boundingRect: { x: 10, y: 20, width: 300, height: 600 },
    });
  });

  it('calls updateUserProfile when window scroll fires', async () => {
    render(<UserProfileView />);
    await vi.waitFor(() => expect(mockCreateUserProfile).toHaveBeenCalled());

    void act(() => window.dispatchEvent(new Event('scroll')));
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      boundingRect: { x: 10, y: 20, width: 300, height: 600 },
    });
  });

  it('does not leak native view when unmounted before createUserProfile resolves', async () => {
    let resolveConfigure!: () => void;
    mockConfigure.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveConfigure = resolve;
        }),
    );

    const { unmount } = render(<UserProfileView />);
    // Wait until configure has been called so resolveConfigure is assigned
    await vi.waitFor(() => expect(mockConfigure).toHaveBeenCalled());

    // Unmount while configure promise is still pending (before createUserProfile)
    unmount();

    // Clear counts from any previous-test teardown before asserting
    mockCreateUserProfile.mockClear();
    mockDestroyUserProfile.mockClear();

    // Now resolve configure — setup should bail out due to cancelled flag
    await act(async () => {
      resolveConfigure();
    });

    expect(mockCreateUserProfile).not.toHaveBeenCalled();
    expect(mockDestroyUserProfile).not.toHaveBeenCalled();
  });

  it('calls destroyUserProfile and removes listener on unmount', async () => {
    const { unmount } = render(<UserProfileView />);
    await vi.waitFor(() => expect(mockCreateUserProfile).toHaveBeenCalled());
    unmount();
    expect(mockDestroyUserProfile).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('disconnects ResizeObserver on unmount', async () => {
    const { unmount } = render(<UserProfileView />);
    await vi.waitFor(() => expect(mockObserve).toHaveBeenCalled());
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
