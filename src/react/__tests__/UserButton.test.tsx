import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { presentUserProfile } = vi.hoisted(() => ({ presentUserProfile: vi.fn() }));
vi.mock('../../index', () => ({
  ClerkPlugin: { presentUserProfile },
}));

vi.mock('@clerk/react', () => ({
  useUser: vi.fn(() => ({
    user: {
      id: 'user_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      imageUrl: 'https://example.com/ada.png',
    },
  })),
}));

// eslint-disable-next-line import/first -- vi.mock calls are hoisted so this import still resolves to the mock.
import { UserButton } from '../UserButton';

describe('<UserButton>', () => {
  it('renders the user image when available', () => {
    render(<UserButton />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/ada.png');
  });

  it('calls presentUserProfile on click', () => {
    render(<UserButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(presentUserProfile).toHaveBeenCalledOnce();
  });
});
