import { useAuth, useUser } from 'capacitor-clerk';
import { UserProfileView } from 'capacitor-clerk/native';

export function Home(): JSX.Element {
  const { user } = useUser();
  const { signOut } = useAuth();

  return (
    <>
      <div style={topBar}>
        <span style={greeting}>Hello, {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'friend'}.</span>
        <button onClick={() => void signOut()} style={signOutButton}>Sign out</button>
      </div>
      <UserProfileView isDismissable={false} style={{ position: 'fixed', inset: 0, top: 48 }} />
    </>
  );
}

const topBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 16px', borderBottom: '1px solid #e5e7eb' };
const greeting: React.CSSProperties = { fontSize: 15, fontWeight: 500 };
const signOutButton: React.CSSProperties = { padding: '6px 12px', fontSize: 14, cursor: 'pointer' };
