import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Result returned from `presentAuth()`. A discriminated union so consumers
 * are forced to handle both the completed and cancelled cases.
 */
export type AuthResult = { status: 'completed'; sessionId: string; userId: string } | { status: 'cancelled' };

/**
 * The native module's session shape. Distinct from clerk-js's richer
 * Session/User resources; this is what crosses the plugin bridge.
 */
export interface NativeSessionSnapshot {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    primaryEmailAddress: string | null;
    imageUrl: string | null;
  };
}

/**
 * Event payload for the 'authStateChange' plugin event.
 */
export interface AuthStateChangeEvent {
  type: 'signedIn' | 'signedOut' | 'sessionRefreshed';
  sessionId: string | null;
  userId: string | null;
}

/**
 * Token cache used by createClerkInstance to persist the __client JWT.
 * Default impl ships at `capacitor-clerk/token-cache`.
 */
export interface TokenCache {
  getToken(key: string): Promise<string | null | undefined>;
  saveToken(key: string, token: string): Promise<void>;
  clearToken?(key: string): Promise<void>;
}

/**
 * Plugin error codes. Native rejections set these via `call.reject(msg, code)`;
 * web throws standard Errors with these codes accessible via `(err as any).code`.
 */
export const ClerkPluginErrors = {
  NotConfigured: 'E_NOT_CONFIGURED',
  ConfigureFailed: 'E_CONFIGURE_FAILED',
  FactoryNotRegistered: 'E_FACTORY_NOT_REGISTERED',
  AuthFailed: 'E_AUTH_FAILED',
  ProfileFailed: 'E_PROFILE_FAILED',
  NativeApiDisabled: 'E_NATIVE_API_DISABLED',
  NotSupported: 'E_NOT_SUPPORTED',
  Unknown: 'E_UNKNOWN',
} as const;

export type ClerkPluginErrorCode = (typeof ClerkPluginErrors)[keyof typeof ClerkPluginErrors];

/**
 * The Capacitor plugin contract. All three platforms (iOS, Android, web)
 * implement this same interface.
 */
export interface ClerkPluginInterface {
  /**
   * Configure the plugin with a Clerk publishable key. On native, optionally
   * pass a bearer token to seed the native SDK with a clerk-js-acquired session.
   *
   * @since 0.1.0
   */
  configure(options: { publishableKey: string; bearerToken?: string | null }): Promise<void>;

  /**
   * Open the native (or web modal-overlay) sign-in/sign-up flow.
   * Resolves with `{ status: 'completed', sessionId, userId }` on success, or
   * `{ status: 'cancelled' }` when the user dismisses the modal.
   *
   * On the web platform, the Promise resolves only on successful sign-in;
   * if the user closes the modal without signing in, the Promise stays pending.
   * Use `useAuth()` for reactive state on web.
   *
   * @since 0.1.0
   */
  presentAuth(options?: { mode?: 'signIn' | 'signUp' | 'signInOrUp'; dismissable?: boolean }): Promise<AuthResult>;

  /**
   * Open the native (or web modal-overlay) user profile screen.
   *
   * @since 0.1.0
   */
  presentUserProfile(options?: { dismissable?: boolean }): Promise<void>;

  /**
   * Returns the current session snapshot, or null if no session is active.
   *
   * @since 0.1.0
   */
  getSession(): Promise<NativeSessionSnapshot | null>;

  /**
   * Returns the current session's JWT, or null if no session is active.
   *
   * @since 0.1.0
   */
  getClientToken(): Promise<string | null>;

  /**
   * Sign out the current user.
   *
   * @since 0.1.0
   */
  signOut(): Promise<void>;

  /**
   * Read a value from secure storage. iOS: Keychain. Android: EncryptedSharedPreferences.
   * Web: localStorage (NOT secure; web is for dev only).
   *
   * @since 0.1.0
   */
  secureGet(options: { key: string }): Promise<{ value: string | null }>;

  /**
   * Write a value to secure storage.
   *
   * @since 0.1.0
   */
  secureSet(options: { key: string; value: string }): Promise<void>;

  /**
   * Remove a value from secure storage.
   *
   * @since 0.1.0
   */
  secureRemove(options: { key: string }): Promise<void>;

  /**
   * Subscribe to auth state changes. The listener fires when a user signs in,
   * signs out, or the session is refreshed.
   *
   * @since 0.1.0
   */
  addListener(
    eventName: 'authStateChange',
    listener: (event: AuthStateChangeEvent) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Remove all listeners for this plugin.
   *
   * @since 0.1.0
   */
  removeAllListeners(): Promise<void>;
}
