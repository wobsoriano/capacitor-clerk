import { useSignUp } from 'capacitor-clerk';
import { useState } from 'react';

interface SignUpProps {
  onSwitchToSignIn: () => void;
}

export function SignUp({ onSwitchToSignIn }: SignUpProps): JSX.Element {
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => undefined });
    }
  };

  if (
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address')
  ) {
    return (
      <form onSubmit={onVerify} style={form}>
        <h2>Verify your email</h2>
        <p>We sent a code to {email}.</p>
        <label>
          Verification code
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={input}
          />
        </label>
        {errors.fields.code && <p style={errorStyle}>{errors.fields.code.message}</p>}
        {errors.global?.[0] && <p style={errorStyle}>{errors.global[0].message}</p>}
        <button type="submit" disabled={fetchStatus === 'fetching'} style={button}>
          {fetchStatus === 'fetching' ? 'Verifying...' : 'Verify'}
        </button>
        <button
          type="button"
          onClick={() => void signUp.verifications.sendEmailCode()}
          style={linkButton}
        >
          Resend code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onCreate} style={form}>
      <h2>Sign up</h2>
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
      {errors.fields.emailAddress && (
        <p style={errorStyle}>{errors.fields.emailAddress.message}</p>
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
        {fetchStatus === 'fetching' ? 'Creating account...' : 'Create account'}
      </button>
      <button type="button" onClick={onSwitchToSignIn} style={linkButton}>
        Already have an account? Sign in
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
