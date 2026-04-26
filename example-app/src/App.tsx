import { Capacitor } from '@capacitor/core';
import { ClerkPlugin } from 'capacitor-clerk';
import { ClerkProvider, Show, SignInButton, SignOutButton, UserButton, useUser } from 'capacitor-clerk/react';

export function App({ publishableKey }: { publishableKey: string }) {
  const isNative = Capacitor.isNativePlatform();

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <h1>capacitor-clerk demo</h1>
        <p>Plan 4 (native sync), sign in flips state automatically.</p>

        <Show when="signed-out">
           {isNative ? (
             <>
               <button
                 onClick={() => void ClerkPlugin.presentAuth({ mode: 'signInOrUp' })}
                 style={{ padding: '8px 16px', fontSize: 16 }}
               >
                 Sign in / Sign up (native)
               </button>
               <button
                 style={{ padding: '8px 16px', fontSize: 16, marginLeft: 8 }}
                 onClick={async () => {
                   const session = await ClerkPlugin.getSession();
                   const { value: token } = await ClerkPlugin.getClientToken();
                   console.log('[debug] native session:', JSON.stringify(session));
                   console.log('[debug] native token (length):', token?.length ?? 'null');
                   alert(`session: ${JSON.stringify(session)?.slice(0, 200)}\ntoken length: ${token?.length ?? 'null'}`);
                 }}
               >
                 Check native session
               </button>
             </>
           ) : (
             <SignInButton mode="modal">
               <button style={{ padding: '8px 16px', fontSize: 16 }}>Sign in / Sign up (web)</button>
             </SignInButton>
           )}
         </Show>

        <Show when="signed-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserButton />
            <Greeting />
          </div>
          <div style={{ marginTop: 16 }}>
            {isNative ? (
              <button onClick={() => void ClerkPlugin.signOut()}>Sign out (native)</button>
            ) : (
              <SignOutButton>
                <button>Sign out (web)</button>
              </SignOutButton>
            )}
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
