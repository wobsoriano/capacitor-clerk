import { CLERK_CLIENT_JWT_KEY } from '../react/createClerkInstance';
import { tokenCache } from '../token-cache';
import { ClerkNativePlugin } from './ClerkNativePlugin';

export async function syncNativeSession(): Promise<void> {
  const { token } = await ClerkNativePlugin.getClientToken();
  if (token) {
    await tokenCache?.saveToken(CLERK_CLIENT_JWT_KEY, token);
  }
  window.location.reload();
}
