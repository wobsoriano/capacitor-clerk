import type { useClerk } from '@clerk/react';
import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';

export async function syncNativeSession(sessionId: string, clerk: ReturnType<typeof useClerk>): Promise<void> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  }

  const clerkRecord = clerk as unknown as Record<string, unknown>;
  if (typeof clerkRecord.__internal_reloadInitialResources === 'function') {
    console.log('[syncNativeSession] clerk.__internal_reloadInitialResources')
    await (clerkRecord.__internal_reloadInitialResources as () => Promise<void>)();
  }

  await clerk.setActive({ session: sessionId });
}
