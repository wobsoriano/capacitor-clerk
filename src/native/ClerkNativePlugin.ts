import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface ClerkNativePlugin {
  configure(options: { publishableKey: string; bearerToken?: string | null }): Promise<void>;
  presentAuth(options: { mode?: 'signIn' | 'signUp' | 'signInOrUp' }): Promise<void>;
  dismissAuth(): Promise<void>;
  getClientToken(): Promise<{ token: string | null }>;
  addListener(
    event: 'authCompleted',
    handler: (data: { sessionId: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const ClerkNativePlugin = registerPlugin<ClerkNativePlugin>('ClerkNative');
