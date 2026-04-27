import { useSignIn } from 'capacitor-clerk';
import { useState } from 'react';

interface SignInProps {
  onSwitchToSignUp: () => void;
}

export function SignIn({ onSwitchToSignUp }: SignInProps): JSX.Element {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn.password({ identifier: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => undefined });
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
      <button type="button" onClick={onSwitchToSignUp} style={linkButton}>
        Need an account? Sign up
      </button>
    </form>
  );
}

const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 4 };
const button: React.CSSProperties = { padding: '10px 16px', fontSize: 16 };
const linkButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#06c',
  cursor: 'pointer',
  padding: 0,
  textAlign: 'left',
};
const errorStyle: React.CSSProperties = { color: '#c00', margin: 0 };
