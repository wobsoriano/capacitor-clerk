import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

// --- Mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

const mockRemove = vi.fn();
const mockPresentUserProfile = vi.fn().mockResolvedValue(undefined);
const mockDismissUserProfile = vi.fn().mockResolvedValue(undefined);
const mockAddListener = vi.fn().mockResolvedValue({ remove: mockRemove });

vi.mock('../ClerkNativePlugin', () => ({
  ClerkNativePlugin: {
    presentUserProfile: (...args: unknown[]) => mockPresentUserProfile(...args),
    dismissUserProfile: (...args: unknown[]) => mockDismissUserProfile(...args),
    addListener: (...args: unknown[]) => mockAddListener(...args),
  },
}));

const mockSyncNativeSession = vi.fn().mockResolvedValue(true);

vi.mock('../syncNativeSession', () => ({
  syncNativeSession: (...args: unknown[]) => mockSyncNativeSession(...args),
}));

const mockUser = vi.hoisted(() => ({
  imageUrl: 'https://example.com/avatar.jpg',
  fullName: 'Test User',
  firstName: 'Test',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
}));

vi.mock('@clerk/react', () => ({
  useUser: vi.fn().mockReturnValue({ user: mockUser, isLoaded: true }),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted
import { Capacitor } from '@capacitor/core';
import { useUser } from '@clerk/react';
import { UserButton } from '../UserButton';


afterEach(() => vi.clearAllMocks());

describe('<UserButton>', () => {
  it('renders null on non-native platforms', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    const { container } = render(<UserButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when user is not loaded', () => {
    vi.mocked(useUser).mockReturnValueOnce({ user: mockUser, isLoaded: false } as any);
    const { container } = render(<UserButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when user is null', () => {
    vi.mocked(useUser).mockReturnValueOnce({ user: null, isLoaded: true } as any);
    const { container } = render(<UserButton />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an img when user has imageUrl', () => {
    render(<UserButton />);
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('renders initials fallback when imageUrl is empty', () => {
    vi.mocked(useUser).mockReturnValueOnce({
      user: { ...mockUser, imageUrl: '' },
      isLoaded: true,
    } as any);
    render(<UserButton />);
    expect(screen.getByText('T')).toBeDefined();
  });

  it('falls back to email initial when firstName is absent', () => {
    vi.mocked(useUser).mockReturnValueOnce({
      user: { ...mockUser, imageUrl: '', firstName: null, emailAddresses: [{ emailAddress: 'alice@example.com' }] },
      isLoaded: true,
    } as any);
    render(<UserButton />);
    expect(screen.getByText('A')).toBeDefined();
  });

  it('calls presentUserProfile on click', async () => {
    render(<UserButton />);
    fireEvent.click(screen.getByRole('button'));
    await vi.waitFor(() => expect(mockPresentUserProfile).toHaveBeenCalled());
  });

  it('registers a profileDismissed listener on mount', async () => {
    render(<UserButton />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    expect(mockAddListener).toHaveBeenCalledWith('profileDismissed', expect.any(Function));
  });

  it('calls syncNativeSession when profileDismissed fires', async () => {
    let dismissedHandler: (() => Promise<void>) | undefined;
    mockAddListener.mockImplementationOnce((_event: string, handler: () => Promise<void>) => {
      dismissedHandler = handler;
      return Promise.resolve({ remove: mockRemove });
    });

    render(<UserButton />);
    await vi.waitFor(() => expect(dismissedHandler).toBeDefined());
    await dismissedHandler!();
    expect(mockSyncNativeSession).toHaveBeenCalled();
  });

  it('removes listener and calls dismissUserProfile on unmount', async () => {
    const { unmount } = render(<UserButton />);
    await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalled());
    unmount();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockDismissUserProfile).toHaveBeenCalled();
  });

  it('applies consumer style to the button', () => {
    render(<UserButton style={{ width: 36, height: 36, borderRadius: '50%' }} />);
    const btn = screen.getByRole('button');
    expect(btn.style.width).toBe('36px');
    expect(btn.style.height).toBe('36px');
    expect(btn.style.borderRadius).toBe('50%');
  });
});
