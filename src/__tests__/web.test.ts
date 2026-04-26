import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthStateChangeEvent } from '../definitions';
import { clearClerkSingleton, getClerkSingleton } from '../singleton';
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

// Reset the singleton between tests so each test gets a fresh FakeClerk.
beforeEach(() => {
  clearClerkSingleton();
});

afterEach(() => {
  listenerRefs.length = 0;
  vi.clearAllMocks();
});

function getMockClerk(): {
  session: any;
  addListener: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  openSignIn?: ReturnType<typeof vi.fn>;
  openSignUp?: ReturnType<typeof vi.fn>;
  openUserProfile?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
} {
  const c = getClerkSingleton();
  if (!c) throw new Error('singleton not populated; did configure() run?');
  return c as any;
}

describe('ClerkPluginWeb.configure', () => {
  it('creates a Clerk instance and calls load()', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    expect(listenerRefs.length).toBe(1);
    expect(getMockClerk().load).toHaveBeenCalled();
  });

  it('reuses the singleton on a second call', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const first = getClerkSingleton();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const second = getClerkSingleton();
    expect(first).toBe(second);
  });

  it('bridges clerk-js listener to authStateChange event', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    const events: AuthStateChangeEvent[] = [];
    const handle = await plugin.addListener('authStateChange', (e) => events.push(e));

    listenerRefs[0]({ session: { id: 'sess_1', user: { id: 'user_1' } } });
    listenerRefs[0]({ session: null });

    expect(events).toEqual([
      { type: 'signedIn', sessionId: 'sess_1', userId: 'user_1' },
      { type: 'signedOut', sessionId: null, userId: null },
    ]);

    await handle.remove();
  });
});

describe('ClerkPluginWeb.presentAuth', () => {
  it('throws unimplemented; consumers should use <SignInButton> instead', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    await expect(plugin.presentAuth()).rejects.toThrow(/not supported on web/);
  });
});

describe('ClerkPluginWeb.presentUserProfile', () => {
  it('throws unimplemented; consumers should use <UserButton> instead', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });

    await expect(plugin.presentUserProfile()).rejects.toThrow(/not supported on web/);
  });
});

describe('ClerkPluginWeb.getSession', () => {
  it('returns null when no session', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    getMockClerk().session = null;
    expect(await plugin.getSession()).toBeNull();
  });

  it('returns a NativeSessionSnapshot when signed in', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    getMockClerk().session = {
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
  it('returns { value: null } when no session', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    getMockClerk().session = null;
    expect(await plugin.getClientToken()).toEqual({ value: null });
  });

  it('returns the JWT wrapped in { value }', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    getMockClerk().session = { getToken: vi.fn().mockResolvedValue('eyJhbGc...') };
    expect(await plugin.getClientToken()).toEqual({ value: 'eyJhbGc...' });
  });
});

describe('ClerkPluginWeb.signOut', () => {
  it('calls clerk.signOut()', async () => {
    const plugin = new ClerkPluginWeb();
    await plugin.configure({ publishableKey: 'pk_test_xxx' });
    const mock = getMockClerk();
    mock.signOut = vi.fn().mockResolvedValue(undefined);
    await plugin.signOut();
    expect(mock.signOut).toHaveBeenCalledOnce();
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
