import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { afterEach, describe, expect, it, vi } from 'vitest';


import { tokenCache } from '../index';

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const mocked = SecureStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('default tokenCache', () => {
  it('reads via SecureStorage.getItem on getToken', async () => {
    mocked.getItem.mockResolvedValueOnce('eyJtoken');
    const value = await tokenCache.getToken('__clerk_client_jwt');
    expect(mocked.getItem).toHaveBeenCalledWith('__clerk_client_jwt');
    expect(value).toBe('eyJtoken');
  });

  it('returns null when the key does not exist', async () => {
    mocked.getItem.mockResolvedValueOnce(null);
    const value = await tokenCache.getToken('missing');
    expect(value).toBeNull();
  });

  it('writes via SecureStorage.setItem on saveToken', async () => {
    await tokenCache.saveToken('__clerk_client_jwt', 'eyJrotated');
    expect(mocked.setItem).toHaveBeenCalledWith('__clerk_client_jwt', 'eyJrotated');
  });

  it('removes via SecureStorage.removeItem on clearToken', async () => {
    await tokenCache.clearToken!('__clerk_client_jwt');
    expect(mocked.removeItem).toHaveBeenCalledWith('__clerk_client_jwt');
  });
});
