import type { Clerk as ClerkType } from '@clerk/clerk-js';

/**
 * Module-level singleton holding the one clerk-js instance shared by
 * ClerkPluginWeb (plugin methods) and createClerkInstance (React hooks).
 *
 * Mirrors @clerk/expo's `provider/singleton/` pattern. Having a single
 * instance ensures methods like ClerkPlugin.signOut() and useUser() see the
 * same session, the UI bundle is mounted once, and listeners agree.
 */
let _clerk: ClerkType | null = null;
let _publishableKey: string | null = null;

export function getClerkSingleton(): ClerkType | null {
  return _clerk;
}

export function setClerkSingleton(clerk: ClerkType, publishableKey: string): void {
  _clerk = clerk;
  _publishableKey = publishableKey;
}

export function getClerkSingletonPublishableKey(): string | null {
  return _publishableKey;
}

export function clearClerkSingleton(): void {
  _clerk = null;
  _publishableKey = null;
}
