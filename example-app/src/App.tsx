import { ClerkProvider, Show } from 'capacitor-clerk';
import { useState } from 'react';

import { Home } from './Home';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

type Route = 'sign-in' | 'sign-up';

export function App({ publishableKey }: { publishableKey: string }): JSX.Element {
  const [route, setRoute] = useState<Route>('sign-in');

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <main style={layout}>
        <h1>capacitor-clerk demo</h1>
        <Show when="signed-out">
          {route === 'sign-in' ? (
            <SignIn onSwitchToSignUp={() => setRoute('sign-up')} />
          ) : (
            <SignUp onSwitchToSignIn={() => setRoute('sign-in')} />
          )}
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
