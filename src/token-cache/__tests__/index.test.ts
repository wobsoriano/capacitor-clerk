import { describe, expect, it, beforeEach } from 'vitest';

import { tokenCache } from '../index';

describe('tokenCache (default)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('roundtrips a token', async () => {
    expect(await tokenCache.getToken('test')).toBeNull();
    await tokenCache.saveToken('test', 'eyJabc');
    expect(await tokenCache.getToken('test')).toBe('eyJabc');
  });

  it('clearToken removes a key', async () => {
    await tokenCache.saveToken('test', 'eyJabc');
    await tokenCache.clearToken!('test');
    expect(await tokenCache.getToken('test')).toBeNull();
  });
});
