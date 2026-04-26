// Per-test setup. Mocks @capacitor/core's Capacitor.getPlatform() to 'web'
// by default; individual tests override as needed.
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  // Reset localStorage between tests to avoid cross-test pollution.
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  // Default platform is 'web'. Tests that need 'ios'/'android' override locally.
  vi.stubGlobal('Capacitor', {
    getPlatform: () => 'web',
    isNativePlatform: () => false,
  });
});
