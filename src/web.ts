import { WebPlugin } from '@capacitor/core';
import type { Clerk as ClerkType } from '@clerk/clerk-js';

import type {
  AuthResult,
  AuthStateChangeEvent,
  ClerkPluginInterface,
  NativeSessionSnapshot,
} from './definitions';

const CLIENT_JWT_STORAGE_KEY = '__clerk_client_jwt';

export class ClerkPluginWeb extends WebPlugin implements ClerkPluginInterface {
  private clerk: ClerkType | null = null;
  private unsubscribeFromClerk: (() => void) | null = null;

  async configure({ publishableKey }: { publishableKey: string; bearerToken?: string | null }): Promise<void> {
    if (this.clerk) return; // idempotent, second call is a no-op

    const { Clerk } = await import('@clerk/clerk-js');
    this.clerk = new Clerk(publishableKey);
    await this.clerk.load();

    // Bridge clerk-js's listener to our plugin event so consumers using
    // ClerkPlugin.addListener('authStateChange', ...) see the same updates.
    this.unsubscribeFromClerk = this.clerk.addListener(
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

    // Reference the field to satisfy noUnusedLocals; later tasks call it on teardown.
    void this.unsubscribeFromClerk;
  }

  async presentAuth(_options?: {
    mode?: 'signIn' | 'signUp' | 'signInOrUp';
    dismissable?: boolean;
  }): Promise<AuthResult> {
    throw this.unimplemented('presentAuth not implemented yet');
  }

  async presentUserProfile(_options?: { dismissable?: boolean }): Promise<void> {
    throw this.unimplemented('presentUserProfile not implemented yet');
  }

  async getSession(): Promise<NativeSessionSnapshot | null> {
    throw this.unimplemented('getSession not implemented yet');
  }

  async getClientToken(): Promise<string | null> {
    throw this.unimplemented('getClientToken not implemented yet');
  }

  async signOut(): Promise<void> {
    throw this.unimplemented('signOut not implemented yet');
  }

  async secureGet(_options: { key: string }): Promise<{ value: string | null }> {
    throw this.unimplemented('secureGet not implemented yet');
  }

  async secureSet(_options: { key: string; value: string }): Promise<void> {
    throw this.unimplemented('secureSet not implemented yet');
  }

  async secureRemove(_options: { key: string }): Promise<void> {
    throw this.unimplemented('secureRemove not implemented yet');
  }
}

// Suppress unused-warnings for symbols we'll need in later tasks.
void CLIENT_JWT_STORAGE_KEY;
