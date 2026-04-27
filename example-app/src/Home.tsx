import { useClerk, useUser } from 'capacitor-clerk';

export function Home(): JSX.Element {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div style={wrap}>
      <h2>Hello, {user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'friend'}.</h2>
      <button onClick={() => void signOut()} style={button}>
        Sign out
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const button: React.CSSProperties = { padding: '10px 16px', fontSize: 16, alignSelf: 'flex-start' };
