import { useSignIn, useSignInWithApple, useSSO } from 'capacitor-clerk';
import { useState } from 'react';

const SSO_REDIRECT_URL = 'capacitorclerk://sso-callback';

interface SignInProps {
  onSwitchToSignUp: () => void;
}

export function SignIn({ onSwitchToSignUp }: SignInProps): JSX.Element {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => undefined });
    }
  };

  const onGoogleSignIn = async () => {
    setSsoError(null);
    setSsoLoading(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: SSO_REDIRECT_URL,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : 'SSO failed');
    } finally {
      setSsoLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    setSsoError(null);
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : 'Apple Sign-In failed');
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={form}>
      <h2>Sign in</h2>
      <label>
        Email
        <input
          type="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
      </label>
      {errors.fields.identifier && (
        <p style={errorStyle}>{errors.fields.identifier.message}</p>
      )}
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={input}
        />
      </label>
      {errors.fields.password && (
        <p style={errorStyle}>{errors.fields.password.message}</p>
      )}
      {errors.global?.[0] && <p style={errorStyle}>{errors.global[0].message}</p>}
      <button type="submit" disabled={fetchStatus === 'fetching'} style={button}>
        {fetchStatus === 'fetching' ? 'Signing in...' : 'Sign in'}
      </button>
      <div style={divider}>
        <hr style={dividerLine} />
        <span style={dividerText}>or</span>
        <hr style={dividerLine} />
      </div>
      <button type="button" onClick={onGoogleSignIn} disabled={ssoLoading || appleLoading} style={oauthButton}>
        {ssoLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>
      <button type="button" onClick={onAppleSignIn} disabled={ssoLoading || appleLoading} style={appleButton}>
        {appleLoading ? 'Signing in...' : ' Sign in with Apple'}
      </button>
      {ssoError && <p style={errorStyle}>{ssoError}</p>}
      <button type="button" onClick={onSwitchToSignUp} style={linkButton}>
        Need an account? Sign up
      </button>
    </form>
  );
}

const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 4 };
const button: React.CSSProperties = { padding: '10px 16px', fontSize: 16 };
const oauthButton: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 16,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 4,
  cursor: 'pointer',
};
const appleButton: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 16,
  background: '#000',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};
const divider: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const dividerLine: React.CSSProperties = { flex: 1, border: 'none', borderTop: '1px solid #ddd' };
const dividerText: React.CSSProperties = { color: '#888', fontSize: 13 };
const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#06c',
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};
const errorStyle: React.CSSProperties = { color: '#c00', margin: 0 };
