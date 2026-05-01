import { CLERK_CLIENT_JWT_KEY, getCachedClerkInstance } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';

import { ClerkNativePlugin } from './ClerkNativePlugin';

export async function syncNativeSession(sessionId?: string): Promise<boolean> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  } else if (!sessionId) {
    return false;
  }

  const clerk = getCachedClerkInstance() as unknown as Record<string, unknown>;
  if (!clerk) return false;

  if (typeof clerk.__internal_reloadInitialResources === 'function') {
    await (clerk.__internal_reloadInitialResources as () => Promise<void>)();
  }

  const sid = sessionId ?? ((clerk as any).session?.id as string | undefined);
  if (!sid) return false;

  if (typeof clerk.setActive === 'function') {
    await (clerk.setActive as (opts: { session: string }) => Promise<void>)({ session: sid });
  }

  return true;
}
