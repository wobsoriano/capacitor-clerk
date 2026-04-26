// Per-test setup. Mocks @capacitor/core's Capacitor.getPlatform() to 'web'
// by default; individual tests override as needed.
import { cleanup } from '@testing-library/react';
import { vi, beforeEach, afterEach } from 'vitest';

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

afterEach(() => {
  // Unmount React components rendered by @testing-library/react so the DOM
  // is reset between tests. Without `globals: true` vitest does not auto-call
  // cleanup, so we wire it up explicitly.
  cleanup();
});
