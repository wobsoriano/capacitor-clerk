import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Clerk as ClerkType } from '@clerk/clerk-js';

import type { AuthStateChangeEvent } from '../definitions';
import { ClerkPluginWeb } from '../web';

// Hoisted mock for @clerk/clerk-js. The factory creates a fake Clerk class
// whose addListener captures the listener so tests can drive it.
const { ClerkMock, listenerRefs } = vi.hoisted(() => {
  const listenerRefs: Array<(state: { session: any }) => void> = [];
  class FakeClerk {
    public session: any = null;
    public addListener = vi.fn((listener: (state: { session: any }) => void) => {
      listenerRefs.push(listener);
      return () => {
        const i = listenerRefs.indexOf(listener);
        if (i >= 0) listenerRefs.splice(i, 1);
      };
    });
    public load = vi.fn(async () => {});
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

// Suppress unused-import warning for ClerkType (used in mock typing only).
void ({} as ClerkType);
