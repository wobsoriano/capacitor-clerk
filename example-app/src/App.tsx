import { ClerkProvider, Show } from 'capacitor-clerk';
import { AuthView } from 'capacitor-clerk/native';
import { useState } from 'react';

import { Home } from './Home';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

type Route = 'sign-in' | 'sign-up' | 'native-auth';

export function App({ publishableKey }: { publishableKey: string }): JSX.Element {
  const [route, setRoute] = useState<Route>('sign-in');

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <main style={layout}>
        <h1>capacitor-clerk demo</h1>
        <Show when="signed-out">
          {route === 'native-auth' ? (
            <AuthView mode="signInOrUp" />
          ) : route === 'sign-in' ? (
            <SignIn onSwitchToSignUp={() => setRoute('sign-up')} />
          ) : (
            <SignUp onSwitchToSignIn={() => setRoute('sign-in')} />
          )}
          <div style={routeSwitcher}>
            <button onClick={() => setRoute('native-auth')}>Native Auth</button>
            <button onClick={() => setRoute('sign-in')}>Custom Sign In</button>
          </div>
        </Show>
        <Show when="signed-in">
          <Home />
        </Show>
      </main>
    </ClerkProvider>
  );
}

const layout: React.CSSProperties = {
  fontFamily: 'system-ui',
  padding: 24,
  maxWidth: 480,
  margin: '0 auto',
};

const routeSwitcher: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 16,
};
