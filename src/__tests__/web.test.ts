import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthStateChangeEvent } from '../definitions';
import { ClerkPluginWeb } from '../web';

// Hoisted mock for @clerk/clerk-js. The factory creates a fake Clerk class
// whose addListener captures the listener so tests can drive it.
const { ClerkMock, listenerRefs } = vi.hoisted(() => {
  const listenerRefs: ((state: { session: any }) => void)[] = [];
  class FakeClerk {
    public session: any = null;
    public addListener = vi.fn((listener: (state: { session: any }) => void) => {
      listenerRefs.push(listener);
      return () => {
        const i = listenerRefs.indexOf(listener);
        if (i >= 0) listenerRefs.splice(i, 1);
      };
    });
    public load = vi.fn().mockResolvedValue(undefined);
  }
  return { ClerkMock: FakeClerk, listenerRefs };
});

vi.mock('@clerk/clerk-js', () => ({ Clerk: ClerkMock }));

afterEach(() => {
  listenerRefs.length = 0;
  vi.clearAllMocks();
});

describe('ClerkPluginWeb.configure', () => {
  it('creates a Clerk instance and calls load()', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    // The mock's load is called once.
    expect(listenerRefs.length).toBe(1);
  });

  it('is idempotent on a second call', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    // Still only one listener subscribed.
    expect(listenerRefs.length).toBe(1);
  });

  it('bridges clerk-js listener to authStateChange event', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    const events: AuthStateChangeEvent[] = [];
    const handle = await plugin.addListener('authStateChange', (e) => events.push(e));

    // Simulate clerk-js emitting "signed in"
    listenerRefs[0]({ session: { id: 'sess_1', user: { id: 'user_1' } } });
    // and "signed out"
    listenerRefs[0]({ session: null });

    expect(events).toEqual([
      { type: 'signedIn', sessionId: 'sess_1', userId: 'user_1' },
      { type: 'signedOut', sessionId: null, userId: null },
    ]);

    await handle.remove();
  });
});

describe('ClerkPluginWeb.presentAuth', () => {
  it('calls openSignIn for signInOrUp mode', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    // Add openSignIn / openSignUp to the mocked instance for this test.
    const internal = plugin as unknown as {
      clerk: { openSignIn: ReturnType<typeof vi.fn>; openSignUp: ReturnType<typeof vi.fn> };
    };
    internal.clerk.openSignIn = vi.fn();
    internal.clerk.openSignUp = vi.fn();

    // Fire-and-forget: the Promise only resolves on session, which we'll trigger.
    const authPromise = plugin.presentAuth({ mode: 'signInOrUp' });

    expect(internal.clerk.openSignIn).toHaveBeenCalledOnce();
    expect(internal.clerk.openSignUp).not.toHaveBeenCalled();

    // Drive the most recent listener (the one presentAuth subscribed) with a session.
    listenerRefs[listenerRefs.length - 1]({
      session: { id: 'sess_2', user: { id: 'user_2' } },
    });

    const result = await authPromise;
    expect(result).toEqual({
      status: 'completed',
      sessionId: 'sess_2',
      userId: 'user_2',
    });
  });

  it('calls openSignUp for signUp mode', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as {
      clerk: { openSignIn: ReturnType<typeof vi.fn>; openSignUp: ReturnType<typeof vi.fn> };
    };
    internal.clerk.openSignIn = vi.fn();
    internal.clerk.openSignUp = vi.fn();

    void plugin.presentAuth({ mode: 'signUp' });

    expect(internal.clerk.openSignUp).toHaveBeenCalledOnce();
    expect(internal.clerk.openSignIn).not.toHaveBeenCalled();
  });
});

describe('ClerkPluginWeb.presentUserProfile', () => {
  it('calls openUserProfile', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as {
      clerk: { openUserProfile: ReturnType<typeof vi.fn> };
    };
    internal.clerk.openUserProfile = vi.fn();

    await plugin.presentUserProfile();

    expect(internal.clerk.openUserProfile).toHaveBeenCalledOnce();
  });
});

describe('ClerkPluginWeb.getSession', () => {
  it('returns null when no session', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as { clerk: { session: unknown } };
    internal.clerk.session = null;
    expect(await plugin.getSession()).toBeNull();
  });

  it('returns a NativeSessionSnapshot when signed in', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as { clerk: { session: unknown } };
    internal.clerk.session = {
      id: 'sess_1',
      user: {
        id: 'user_1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        primaryEmailAddress: { emailAddress: 'ada@example.com' },
        imageUrl: 'https://example.com/ada.png',
      },
    };
    expect(await plugin.getSession()).toEqual({
      sessionId: 'sess_1',
      userId: 'user_1',
      user: {
        id: 'user_1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        primaryEmailAddress: 'ada@example.com',
        imageUrl: 'https://example.com/ada.png',
      },
    });
  });
});

describe('ClerkPluginWeb.getClientToken', () => {
  it('returns null when no session', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as { clerk: { session: unknown } };
    internal.clerk.session = null;
    expect(await plugin.getClientToken()).toBeNull();
  });

  it('returns the JWT from session.getToken()', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as { clerk: { session: { getToken: () => Promise<string> } } };
    internal.clerk.session = { getToken: vi.fn().mockResolvedValue('eyJhbGc...') };
    expect(await plugin.getClientToken()).toBe('eyJhbGc...');
  });
});

describe('ClerkPluginWeb.signOut', () => {
  it('calls clerk.signOut()', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const internal = plugin as unknown as { clerk: { signOut: () => Promise<void> } };
    internal.clerk.signOut = vi.fn().mockResolvedValue(undefined);
    await plugin.signOut();
    expect(internal.clerk.signOut).toHaveBeenCalledOnce();
  });
});

describe('ClerkPluginWeb.secureGet/Set/Remove', () => {
  it('roundtrips via localStorage', async () => {
    const plugin = new ClerkPluginWeb();

    expect(await plugin.secureGet({ key: 'foo' })).toEqual({ value: null });

    await plugin.secureSet({ key: 'foo', value: 'bar' });
    expect(await plugin.secureGet({ key: 'foo' })).toEqual({ value: 'bar' });

    await plugin.secureRemove({ key: 'foo' });
    expect(await plugin.secureGet({ key: 'foo' })).toEqual({ value: null });
  });
});
