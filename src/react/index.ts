// Hooks and small helpers from @clerk/react. UI components (UserButton,
// SignIn, SignInButton, etc.) are intentionally NOT re-exported: this package
// runs clerk-js in headless mode, so those components throw at runtime.
// Build sign-in / sign-up UI yourself using the hooks below.
export {
  useClerk,
  useAuth,
  useUser,
  useSession,
  useSessionList,
  useSignIn,
  useSignUp,
  useOrganization,
  useOrganizationList,
  useReverification,
  ClerkLoaded,
  ClerkLoading,
  // <Show when="signed-in"> | <Show when="signed-out"> | <Show when={{ permission: '...' }}>
  Show,
} from '@clerk/react';
export type { ShowProps } from '@clerk/react';

export { ClerkProvider } from './ClerkProvider';
export type { ClerkProviderProps } from './ClerkProvider';

export type { TokenCache } from '../definitions';
