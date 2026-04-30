import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

const mockRemove = vi.fn();
const mockConfigure = vi.fn().mockResolvedValue(undefined);
const mockPresentAuth = vi.fn().mockResolvedValue(undefined);
const mockDismissAuth = vi.fn().mockResolvedValue(undefined);
const mockAddListener = vi.fn().mockResolvedValue({ remove: mockRemove });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    presentAuth: (...args: unknown[]) => mockPresentAuth(...args),
    dismissAuth: (...args: unknown[]) => mockDismissAuth(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

vi.mock('../syncNativeSession', () => ({
  syncNativeSession: vi.fn().mockResolvedValue(undefined),
}));

const mockGetToken = vi.fn().mockResolvedValue('test-bearer-token');
vi.mock('@clerk/react', () => ({
  useClerk: vi.fn().mockReturnValue({
    publishableKey: 'pk_test_xxx',
    session: { getToken: () => mockGetToken() },
    setActive: vi.fn(),
  }),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { Capacitor } from '@capacitor/core';
import { AuthView } from '../AuthView';

afterEach(() => vi.clearAllMocks());

describe('<AuthView>', () => {
  it('renders null — no DOM output', () => {
    const { container } = render(<AuthView />);
    expect(container.firstChild).toBeNull();
  });

  it('calls configure then presentAuth on mount', async () => {
    render(<AuthView mode="signIn" />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    expect(mockConfigure).toHaveBeenCalledWith({
      publishableKey: 'pk_test_xxx',
      bearerToken: 'test-bearer-token',
    });
    expect(mockPresentAuth).toHaveBeenCalledWith({ mode: 'signIn' });
  });

  it('uses signInOrUp as default mode', async () => {
    render(<AuthView />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    expect(mockPresentAuth).toHaveBeenCalledWith({ mode: 'signInOrUp' });
  });

  it('registers an authCompleted listener on mount', async () => {
    render(<AuthView />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    expect(mockAddListener).toHaveBeenCalledWith('authCompleted', expect.any(Function));
  });

  it('calls dismissAuth on unmount', async () => {
    const { unmount } = render(<AuthView />);
    await vi.waitFor(() => expect(mockPresentAuth).toHaveBeenCalled());
    unmount();
    expect(mockDismissAuth).toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    const { unmount } = render(<AuthView />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('does nothing on non-native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    render(<AuthView />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockPresentAuth).not.toHaveBeenCalled();
  });
});
