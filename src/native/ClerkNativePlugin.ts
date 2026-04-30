import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClerkNativePlugin {
  configure(options: { publishableKey: string; bearerToken?: string | null }): Promise<void>;
  presentAuth(options: { mode?: 'signIn' | 'signUp' | 'signInOrUp' }): Promise<void>;
  dismissAuth(): Promise<void>;
  getClientToken(): Promise<{ token: string | null }>;
  presentUserProfile(): Promise<void>;
  dismissUserProfile(): Promise<void>;
  createUserProfile(options: { boundingRect: BoundingRect; isDismissable?: boolean }): Promise<void>;
  updateUserProfile(options: { boundingRect: BoundingRect }): Promise<void>;
  destroyUserProfile(): Promise<void>;
  addListener(
    event: 'authCompleted',
    handler: (data: { sessionId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'profileDismissed',
    handler: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'profileEvent',
    handler: (event: { type: string; data: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const ClerkNativePlugin = registerPlugin<ClerkNativePlugin>('ClerkNative');
