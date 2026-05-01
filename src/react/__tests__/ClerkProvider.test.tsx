import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

const recordedProps: Record<string, unknown>[] = [];
vi.mock('@clerk/react/internal', () => ({
  InternalClerkProvider: ({
    children,
    ...rest
  }: { children: React.ReactNode } & Record<string, unknown>) => {
    recordedProps.push(rest);
    return <>{children}</>;
  },
}));

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));

vi.mock('@clerk/clerk-js', () => ({
  Clerk: vi.fn().mockImplementation(function (
    this: {
      publishableKey: string;
      __internal_onBeforeRequest: () => void;
      __internal_onAfterResponse: () => void;
    },
    pk: string,
  ) {
    this.publishableKey = pk;
    this.__internal_onBeforeRequest = vi.fn();
    this.__internal_onAfterResponse = vi.fn();
  }),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted; this resolves to the mocks.
import { ClerkProvider } from '../ClerkProvider';

describe('<ClerkProvider>', () => {
  it('renders children', () => {
    render(
      <ClerkProvider publishableKey="pk_test_xxx">
        <span>hello</span>
      </ClerkProvider>,
    );
    expect(screen.getByText('hello')).toBeDefined();
  });

  it('passes Clerk instance, standardBrowser:false, runtimeEnvironment:headless', () => {
    recordedProps.length = 0;
    render(
      <ClerkProvider publishableKey="pk_test_xxx">
        <span />
      </ClerkProvider>,
    );
    const last = recordedProps[recordedProps.length - 1];
    expect(last.publishableKey).toBe('pk_test_xxx');
    expect(last.Clerk).toBeDefined();
    expect(last.standardBrowser).toBe(false);
    expect(last.experimental).toEqual({ runtimeEnvironment: 'headless' });
  });
});
