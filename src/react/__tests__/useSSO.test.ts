import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Listener capture slots (written to by mocks, read by tests) ---
let capturedAppUrlOpen: ((event: { url: string }) => void) | null = null;
let capturedBrowserFinished: (() => void) | null = null;

const mockBrowserOpen = vi.fn().mockResolvedValue(undefined);
const mockBrowserClose = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'appUrlOpen') capturedAppUrlOpen = cb as (e: { url: string }) => void;
      return Promise.resolve({ remove: vi.fn() });
    },
  },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    addListener: (event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'browserFinished') capturedBrowserFinished = cb as () => void;
      return Promise.resolve({ remove: vi.fn() });
    },
    open: (...args: unknown[]) => mockBrowserOpen(...args),
    close: (...args: unknown[]) => mockBrowserClose(...args),
  },
}));

// --- Clerk mocks ---

const mockSetActive = vi.fn();
const mockSignInCreate = vi.fn().mockResolvedValue({});
const mockSignInReload = vi.fn().mockResolvedValue({});
const mockSignUpCreate = vi.fn().mockResolvedValue({});

type FakeSignIn = {
  firstFactorVerification?: { externalVerificationRedirectURL: URL | null; status: string };
  createdSessionId?: string | null;
};

type FakeSignUp = { createdSessionId?: string | null };

const makeSignIn = (overrides: FakeSignIn = {}) => ({
  firstFactorVerification: {
    externalVerificationRedirectURL: new URL('https://accounts.google.com/oauth'),
    status: 'pending',
    ...overrides.firstFactorVerification,
  },
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignInCreate,
  reload: mockSignInReload,
});

const makeSignUp = (overrides: FakeSignUp = {}) => ({
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignUpCreate,
});

vi.mock('@clerk/react/legacy', () => ({
  useSignIn: vi.fn(() => ({ isLoaded: true, setActive: mockSetActive, signIn: makeSignIn() })),
  useSignUp: vi.fn(() => ({ isLoaded: true, signUp: makeSignUp() })),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted; this resolves to the mocks.
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useSSO } from '../useSSO';

beforeEach(() => {
  capturedAppUrlOpen = null;
  capturedBrowserFinished = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useSSO', () => {
  it('returns null createdSessionId when signIn is not loaded', async () => {
    vi.mocked(useSignIn).mockReturnValueOnce({ isLoaded: false, setActive: mockSetActive, signIn: null } as never);
    const { startSSOFlow } = useSSO();
    const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl: 'myapp://sso-callback' });
    expect(result.createdSessionId).toBeNull();
  });

  it('returns null createdSessionId when signUp is not loaded', async () => {
    vi.mocked(useSignUp).mockReturnValueOnce({ isLoaded: false, signUp: null } as never);
    const { startSSOFlow } = useSSO();
    const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl: 'myapp://sso-callback' });
    expect(result.createdSessionId).toBeNull();
  });

  it('throws when externalVerificationRedirectURL is missing', async () => {
    vi.mocked(useSignIn).mockReturnValueOnce({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ firstFactorVerification: { externalVerificationRedirectURL: null, status: 'pending' } }),
    } as never);
    const { startSSOFlow } = useSSO();
    await expect(startSSOFlow({ strategy: 'oauth_google', redirectUrl: 'myapp://sso-callback' })).rejects.toThrow(
      /external verification redirect URL/i,
    );
  });

  it('returns null createdSessionId when browser is dismissed without completing the flow', async () => {
    const { startSSOFlow } = useSSO();
    const flowPromise = startSSOFlow({ strategy: 'oauth_google', redirectUrl: 'myapp://sso-callback' });

    await vi.waitFor(() => expect(capturedBrowserFinished).not.toBeNull());
    capturedBrowserFinished!();

    const result = await flowPromise;
    expect(result.createdSessionId).toBeNull();
    expect(mockSignInReload).not.toHaveBeenCalled();
  });

  it('completes sign-in and returns createdSessionId on successful OAuth callback', async () => {
    const redirectUrl = 'myapp://sso-callback';
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ createdSessionId: 'sess_123' }),
    } as never);

    const { startSSOFlow } = useSSO();
    const flowPromise = startSSOFlow({ strategy: 'oauth_google', redirectUrl });

    await vi.waitFor(() => expect(capturedAppUrlOpen).not.toBeNull());
    capturedAppUrlOpen!({ url: `${redirectUrl}?rotating_token_nonce=abc123` });

    const result = await flowPromise;
    expect(mockSignInReload).toHaveBeenCalledWith({ rotatingTokenNonce: 'abc123' });
    expect(result.createdSessionId).toBe('sess_123');
    expect(result.setActive).toBe(mockSetActive);
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it('transfers to sign-up when firstFactorVerification is transferable', async () => {
    const redirectUrl = 'myapp://sso-callback';
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ firstFactorVerification: { externalVerificationRedirectURL: new URL('https://accounts.google.com/oauth'), status: 'transferable' } }),
    } as never);
    vi.mocked(useSignUp).mockReturnValue({
      isLoaded: true,
      signUp: makeSignUp({ createdSessionId: 'sess_new' }),
    } as never);

    const { startSSOFlow } = useSSO();
    const flowPromise = startSSOFlow({ strategy: 'oauth_google', redirectUrl });

    await vi.waitFor(() => expect(capturedAppUrlOpen).not.toBeNull());
    capturedAppUrlOpen!({ url: `${redirectUrl}?rotating_token_nonce=xyz` });

    const result = await flowPromise;
    expect(mockSignUpCreate).toHaveBeenCalledWith({ transfer: true, unsafeMetadata: undefined });
    expect(result.createdSessionId).toBe('sess_new');
  });
});
