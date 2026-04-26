import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock @clerk/react/internal: capture the props passed to InternalClerkProvider.
const recordedProps: Record<string, unknown>[] = [];
vi.mock('@clerk/react/internal', () => ({
  InternalClerkProvider: ({ children, ...rest }: { children: React.ReactNode } & Record<string, unknown>) => {
    recordedProps.push(rest);
    return <>{children}</>;
  },
}));

vi.mock('@clerk/clerk-js', () => ({
  Clerk: vi.fn().mockImplementation(function (this: { publishableKey: string; __internal_onBeforeRequest: () => void; __internal_onAfterResponse: () => void }, pk: string) {
    this.publishableKey = pk;
    this.__internal_onBeforeRequest = vi.fn();
    this.__internal_onAfterResponse = vi.fn();
  }),
}));

// Mock the plugin facade so ClerkProvider's useEffect doesn't reach into the
// real registerPlugin chain during tests.
const { configureMock } = vi.hoisted(() => ({ configureMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../index', () => ({
  ClerkPlugin: { configure: configureMock },
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted so this import still resolves to the mock.
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

  it('passes publishableKey and a clerk instance to InternalClerkProvider', () => {
    recordedProps.length = 0;
    render(
      <ClerkProvider publishableKey="pk_test_xxx">
        <span />
      </ClerkProvider>,
    );
    const last = recordedProps[recordedProps.length - 1];
    expect(last.publishableKey).toBe('pk_test_xxx');
    expect(last.Clerk).toBeDefined();
  });

  it('calls ClerkPlugin.configure on mount with the publishableKey', () => {
    configureMock.mockClear();
    render(
      <ClerkProvider publishableKey="pk_test_xxx">
        <span />
      </ClerkProvider>,
    );
    expect(configureMock).toHaveBeenCalledWith({ publishableKey: 'pk_test_xxx' });
  });
});
