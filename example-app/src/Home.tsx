import { useClerk, useUser } from 'capacitor-clerk';
import { UserButton } from 'capacitor-clerk/native';

export function Home(): JSX.Element {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div style={wrap}>
      <div style={header}>
        <h2 style={{ margin: 0 }}>Hello, {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'friend'}.</h2>
        <UserButton style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
      <button onClick={() => void signOut()} style={button}>
        Sign out
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const button: React.CSSProperties = { padding: '10px 16px', fontSize: 16, alignSelf: 'flex-start' };
