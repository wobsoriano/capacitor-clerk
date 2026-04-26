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

  async presentAuth(_options?: {
    mode?: 'signIn' | 'signUp' | 'signInOrUp';
    dismissable?: boolean;
  }): Promise<AuthResult> {
    // presentAuth is a native-only API. On web, the UI bundle's lifecycle is
    // owned by @clerk/react (InternalClerkProvider). Wrapping clerk.openSignIn()
    // here fights that lifecycle (the bundle state changes on sign-in/out and
    // breaks standalone calls). Use the clerk-react components instead:
    //   import { SignInButton, SignUpButton } from 'capacitor-clerk/react';
    //   <SignInButton />
    throw this.unimplemented(
      'presentAuth is not supported on web. Use <SignInButton> or <SignUpButton> from capacitor-clerk/react instead.',
    );
  }

  async presentUserProfile(_options?: { dismissable?: boolean }): Promise<void> {
    // Same reasoning as presentAuth above. Use:
    //   import { UserButton, UserProfile } from 'capacitor-clerk/react';
    //   <UserButton /> or <UserProfile />
    throw this.unimplemented(
      'presentUserProfile is not supported on web. Use <UserButton> or <UserProfile> from capacitor-clerk/react instead.',
    );
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
