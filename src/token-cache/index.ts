import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import type { TokenCache } from '../definitions';

export const tokenCache: TokenCache = {
  async getToken(key) {
    return SecureStorage.getItem(key);
  },
  async saveToken(key, value) {
    await SecureStorage.setItem(key, value);
  },
  async clearToken(key) {
    await SecureStorage.removeItem(key);
  },
};
