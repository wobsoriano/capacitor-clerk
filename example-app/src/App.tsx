import { ClerkPlugin } from 'capacitor-clerk';
import {
  ClerkProvider,
  Show,
  UserButton,
  useUser,
} from 'capacitor-clerk/react';

export function App({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <h1>capacitor-clerk demo</h1>
        <p>Plan 1: web platform smoke test.</p>

        <Show when="signed-out">
          <button
            onClick={() => void ClerkPlugin.presentAuth({ mode: 'signInOrUp' })}
            style={{ padding: '8px 16px', fontSize: 16 }}
          >
            Sign in / Sign up
          </button>
        </Show>

        <Show when="signed-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserButton />
            <Greeting />
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => void ClerkPlugin.signOut()}>Sign out</button>
          </div>
        </Show>
      </main>
    </ClerkProvider>
  );
}

function Greeting() {
  const { user } = useUser();
  return <span>Hello, {user?.firstName ?? 'friend'}.</span>;
}
