import { Capacitor } from '@capacitor/core';
import { useUser } from '@clerk/react';

import { useUserProfileModal } from './useUserProfileModal';

export interface UserButtonProps {
  style?: React.CSSProperties;
}

export function UserButton({ style }: UserButtonProps) {
  const { user, isLoaded } = useUser();
  const { presentUserProfile } = useUserProfileModal();

  if (!Capacitor.isNativePlatform() || !isLoaded || !user) return null;

  const initial = (
    user.firstName?.[0] ??
    user.emailAddresses[0]?.emailAddress?.[0] ??
    '?'
  ).toUpperCase();

  return (
    <button
      onClick={() => void presentUserProfile()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        ...style,
      }}
      aria-label="Open user profile"
    >
      {user.imageUrl ? (
        <img
          src={user.imageUrl}
          alt={user.fullName ?? 'User avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: '0.5em', fontWeight: 600, userSelect: 'none' }}>{initial}</span>
      )}
    </button>
  );
}
