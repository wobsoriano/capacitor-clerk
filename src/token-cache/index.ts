import type { TokenCache } from '../definitions';
import { ClerkPlugin } from '../index';

/**
 * Default token cache implementation.
 *
 * On native (iOS/Android, Plans 2 and 3): uses the plugin's secureGet/secureSet/
 * secureRemove which are backed by Keychain / EncryptedSharedPreferences.
 * On web: falls through to the same plugin methods, which use localStorage.
 *
 * Consumers can substitute their own TokenCache (e.g., backed by another
 * secure storage primitive) by passing it to <ClerkProvider tokenCache={...}>.
 */
export const tokenCache: TokenCache = {
  async getToken(key) {
    const { value } = await ClerkPlugin.secureGet({ key });
    return value;
  },
  async saveToken(key, token) {
    await ClerkPlugin.secureSet({ key, value: token });
  },
  async clearToken(key) {
    await ClerkPlugin.secureRemove({ key });
  },
};
