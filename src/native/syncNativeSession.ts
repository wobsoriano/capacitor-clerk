import type { useClerk } from '@clerk/react';
import { CLERK_CLIENT_JWT_KEY, getCachedClerkInstance } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';

export async function syncNativeSession(sessionId: string, clerk: ReturnType<typeof useClerk>): Promise<void> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  }

  const rawClerk = getCachedClerkInstance() as unknown as Record<string, unknown>;
  if (rawClerk && typeof rawClerk.__internal_reloadInitialResources === 'function') {
    await (rawClerk.__internal_reloadInitialResources as () => Promise<void>)();
  }

  await clerk.setActive({ session: sessionId });
}
