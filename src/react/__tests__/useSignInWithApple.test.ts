import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Module mocks ---

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'ios'),
  },
}));

const mockAuthorize = vi.fn();

vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: {
    authorize: (...args: unknown[]) => mockAuthorize(...args),
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

// eslint-disable-next-line import/first -- vi.mock calls are hoisted; this resolves to the mocks.
import { Capacitor } from '@capacitor/core';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useSignInWithApple } from '../useSignInWithApple';

const makeCredentialResponse = (identityToken = 'apple-id-token-xyz') => ({
  response: {
    user: 'apple-user-id',
    email: 'user@example.com',
    givenName: 'Test',
    familyName: 'User',
    identityToken,
    authorizationCode: 'auth-code',
  },
});

beforeEach(() => {
  mockAuthorize.mockResolvedValue(makeCredentialResponse());
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-nonce-1234') });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useSignInWithApple', () => {
  it('returns null createdSessionId when signIn is not loaded', async () => {
    vi.mocked(useSignIn).mockReturnValueOnce({ isLoaded: false, setActive: mockSetActive, signIn: null } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it('returns null createdSessionId when signUp is not loaded', async () => {
    vi.mocked(useSignUp).mockReturnValueOnce({ isLoaded: false, signUp: null } as never);
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const result = await startAppleAuthenticationFlow();
    expect(result.createdSessionId).toBeNull();
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it('throws on non-iOS platform with actionable message pointing to useSSO', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValueOnce('android');
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    const error = await startAppleAuthenticationFlow().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/only supported on iOS/i);
    expect((error as Error).message).toContain('useSSO');
  });

  it('throws when identityToken is missing from credential', async () => {
    mockAuthorize.mockResolvedValueOnce(makeCredentialResponse(null as unknown as string));
    const { startAppleAuthenticationFlow } = useSignInWithApple();
    await expect(startAppleAuthenticationFlow()).rejects.toThrow(/no identity token/i);
  });

  it('returns null createdSessionId when user cancels Apple sheet', async () => {
    mockAuthorize.mockRejectedValueOnce(Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' }));
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

    expect(mockAuthorize).toHaveBeenCalledWith({
      clientId: '',
      redirectURI: '',
      scopes: 'email name',
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

    expect(mockSignUpCreate).toHaveBeenCalledWith({ transfer: true, unsafeMetadata: { role: 'admin' } });
    expect(result.createdSessionId).toBe('sess_new_user');
  });
});
