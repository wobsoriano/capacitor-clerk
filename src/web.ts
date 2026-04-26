import { WebPlugin } from '@capacitor/core';

import type { AuthResult, AuthStateChangeEvent, ClerkPluginInterface, NativeSessionSnapshot } from './definitions';
import { getClerkSingleton, setClerkSingleton } from './singleton';

const CLIENT_JWT_STORAGE_KEY = '__clerk_client_jwt';

export class ClerkPluginWeb extends WebPlugin implements ClerkPluginInterface {
  private unsubscribeFromClerk: (() => void) | null = null;

  async configure({ publishableKey }: { publishableKey: string; bearerToken?: string | null }): Promise<void> {
    let clerk = getClerkSingleton();
    if (!clerk) {
      const { Clerk } = await import('@clerk/clerk-js');
      clerk = new Clerk(publishableKey);
      setClerkSingleton(clerk, publishableKey);
    }

    // load() is idempotent inside clerk-js; calling it twice is safe and gives
    // us a guarantee that the UI bundle is mounted before presentAuth() etc.
    await clerk.load();

    // Bridge clerk-js's listener to our plugin event so consumers using
    // ClerkPlugin.addListener('authStateChange', ...) see the same updates.
    if (this.unsubscribeFromClerk) this.unsubscribeFromClerk();
    this.unsubscribeFromClerk = clerk.addListener(
      ({ session }) => {
        const event: AuthStateChangeEvent = {
          type: session ? 'signedIn' : 'signedOut',
          sessionId: session?.id ?? null,
          userId: session?.user?.id ?? null,
        };
        this.notifyListeners('authStateChange', event);
      },
      { skipInitialEmit: true },
    );
  }

  async presentAuth(options?: {
    mode?: 'signIn' | 'signUp' | 'signInOrUp';
    dismissable?: boolean;
  }): Promise<AuthResult> {
    const clerk = getClerkSingleton();
    if (!clerk) throw new Error('configure() must be called first');

    const mode = options?.mode ?? 'signInOrUp';
    // forceRedirectUrl (not fallbackRedirectUrl) so we always return to the
    // current page after sign-in. fallback would defer to URL params or env
    // defaults, which in a Capacitor WebView could navigate the host page out
    // from under us.
    const props = {
      forceRedirectUrl: window.location.href,
    };

    if (mode === 'signUp') {
      clerk.openSignUp(props);
    } else {
      clerk.openSignIn(props);
    }

    // Wait for a session to materialize. We skip the initial emit so we
    // don't resolve immediately if the user is already signed in.
    // Known limitation, documented in spec section 6.1: clerk-js does not
    // emit a "modal closed" event, so this Promise stays pending if the user
    // closes the modal without signing in. Consumers should rely on
    // useAuth() reactivity for web; native bridges Plan 4 surface a real
    // cancellation callback.
    return new Promise<AuthResult>((resolve) => {
      const stop = clerk.addListener(
        ({ session }) => {
          if (session?.user) {
            stop();
            resolve({
              status: 'completed',
              sessionId: session.id,
              userId: session.user.id,
            });
          }
        },
        { skipInitialEmit: true },
      );
    });
  }

  async presentUserProfile(_options?: { dismissable?: boolean }): Promise<void> {
    const clerk = getClerkSingleton();
    if (!clerk) throw new Error('configure() must be called first');
    clerk.openUserProfile();
  }

  async getSession(): Promise<NativeSessionSnapshot | null> {
    const clerk = getClerkSingleton();
    if (!clerk) throw new Error('configure() must be called first');
    const s = clerk.session;
    if (!s?.user) return null;
    const u = s.user;
    return {
      sessionId: s.id,
      userId: u.id,
      user: {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        primaryEmailAddress: u.primaryEmailAddress?.emailAddress ?? null,
        imageUrl: u.imageUrl,
      },
    };
  }

  async getClientToken(): Promise<string | null> {
    const clerk = getClerkSingleton();
    if (!clerk) throw new Error('configure() must be called first');
    const session = clerk.session;
    if (!session) return null;
    return (await session.getToken()) ?? null;
  }

  async signOut(): Promise<void> {
    const clerk = getClerkSingleton();
    if (!clerk) throw new Error('configure() must be called first');
    await clerk.signOut();
  }

  async secureGet({ key }: { key: string }): Promise<{ value: string | null }> {
    return { value: localStorage.getItem(key) };
  }

  async secureSet({ key, value }: { key: string; value: string }): Promise<void> {
    localStorage.setItem(key, value);
  }

  async secureRemove({ key }: { key: string }): Promise<void> {
    localStorage.removeItem(key);
  }
}

// Suppress unused-warnings for symbols we'll need in later tasks.
void CLIENT_JWT_STORAGE_KEY;
