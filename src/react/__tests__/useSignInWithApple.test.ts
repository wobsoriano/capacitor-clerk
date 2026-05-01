// eslint-disable-next-line import/first -- vi.mock calls are hoisted; this resolves to the mocks.
import { Capacitor } from '@capacitor/core';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useSignInWithApple } from '../useSignInWithApple';

// --- Module mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'ios'),
  },
}));

const mockSignIn = vi.fn();

vi.mock('@capawesome/capacitor-apple-sign-in', () => ({
  AppleSignIn: {
    signIn: (...args: unknown[]) => mockSignIn(...args),
  },
  SignInScope: {
    Email: 'EMAIL',
    FullName: 'FULL_NAME',
  },
}));

// --- Clerk mocks ---

const mockSetActive = vi.fn();
const mockSignInCreate = vi.fn().mockResolvedValue({});
const mockSignUpCreate = vi.fn().mockResolvedValue({});

type FakeSignIn = {
  firstFactorVerification?: { status: string };
  createdSessionId?: string | null;
};

type FakeSignUp = { createdSessionId?: string | null };

const makeSignIn = (overrides: FakeSignIn = {}) => ({
  firstFactorVerification: {
    status: 'complete',
    ...overrides.firstFactorVerification,
  },
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignInCreate,
});

const makeSignUp = (overrides: FakeSignUp = {}) => ({
  createdSessionId: overrides.createdSessionId ?? null,
  create: mockSignUpCreate,
});

vi.mock('@clerk/react/legacy', () => ({
  useSignIn: vi.fn(() => ({ isLoaded: true, setActive: mockSetActive, signIn: makeSignIn() })),
  useSignUp: vi.fn(() => ({ isLoaded: true, signUp: makeSignUp() })),
}));

const makeSignInResult = (idToken: string | null = 'apple-id-token-xyz') => ({
  idToken,
  user: 'apple-user-id',
  email: 'user@example.com',
  givenName: 'Test',
  familyName: 'User',
  authorizationCode: 'auth-code',
  realUserStatus: 1,
  state: null,
});

beforeEach(() => {
  mockSignIn.mockResolvedValue(makeSignInResult());
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-nonce-1234') });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useSignInWithApple', () => {
  it('returns null createdSessionId when signIn is not loaded', async () => {
    vi.mocked(useSignIn).mockReturnValueOnce({
      isLoaded: false,
      setActive: mockSetActive,
      signIn: null,
    } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('returns null createdSessionId when signUp is not loaded', async () => {
    vi.mocked(useSignUp).mockReturnValueOnce({ isLoaded: false, signUp: null } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('throws on non-iOS platform with actionable message pointing to useSSO', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValueOnce('android');
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const error = await startAppleAuthenticationFlow().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/only supported on iOS/i);
    expect((error as Error).message).toContain('useSSO');
  });

  it('throws when idToken is missing from result', async () => {
    mockSignIn.mockResolvedValueOnce(makeSignInResult(null));
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    await expect(startAppleAuthenticationFlow()).rejects.toThrow(/no identity token/i);
  });

  it('returns null createdSessionId when user cancels Apple sheet', async () => {
    mockSignIn.mockRejectedValueOnce(
      Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }),
    );
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockSignInCreate).not.toHaveBeenCalled();
  });

  it('completes sign-in and returns createdSessionId', async () => {
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ createdSessionId: 'sess_apple_123' }),
    } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();

    expect(mockSignIn).toHaveBeenCalledWith({
      scopes: ['EMAIL', 'FULL_NAME'],
      nonce: 'test-nonce-1234',
    });
    expect(mockSignInCreate).toHaveBeenCalledWith({
      strategy: 'oauth_token_apple',
      token: 'apple-id-token-xyz',
    });
    expect(result.createdSessionId).toBe('sess_apple_123');
    expect(result.setActive).toBe(mockSetActive);
  });

  it('transfers to sign-up when firstFactorVerification is transferable', async () => {
    vi.mocked(useSignIn).mockReturnValue({
      isLoaded: true,
      setActive: mockSetActive,
      signIn: makeSignIn({ firstFactorVerification: { status: 'transferable' } }),
    } as never);
    vi.mocked(useSignUp).mockReturnValue({
      isLoaded: true,
      signUp: makeSignUp({ createdSessionId: 'sess_new_user' }),
    } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow({ unsafeMetadata: { role: 'admin' } });

    expect(mockSignUpCreate).toHaveBeenCalledWith({
      transfer: true,
      unsafeMetadata: { role: 'admin' },
    });
    expect(result.createdSessionId).toBe('sess_new_user');
  });
});
