import { useUser } from '@clerk/react';
import type { CSSProperties } from 'react';

import { ClerkPlugin } from '../index';

export interface UserButtonProps {
  /** Width and height in pixels. Defaults to 32. */
  size?: number;
}

function getInitials(user: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!user) return '?';
  const first = user.firstName?.charAt(0)?.toUpperCase() ?? '';
  const last = user.lastName?.charAt(0)?.toUpperCase() ?? '';
  const initials = first + last;
  return initials || '?';
}

/**
 * Tappable avatar that opens the native, or web modal, user profile screen.
 *
 * Avatar reactivity comes from `useUser()` (clerk-js state). On native the
 * native session is synced into clerk-js by NativeSessionSync (Plan 4), so
 * this component reflects the native session too without any extra wiring.
 */
export function UserButton({ size = 32 }: UserButtonProps = {}): JSX.Element {
  const { user } = useUser();

  const handleClick = () => {
    void ClerkPlugin.presentUserProfile();
  };

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '1px solid #ddd',
    background: '#6366f1',
    color: 'white',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontWeight: 600,
    cursor: 'pointer',
    overflow: 'hidden',
  };

  return (
    <button onClick={handleClick} style={style} aria-label="Open user profile">
      {user?.imageUrl ? (
        <img src={user.imageUrl} alt="User avatar" style={{ width: '100%', height: '100%' }} />
      ) : (
        <span>{getInitials(user)}</span>
      )}
    </button>
  );
}
