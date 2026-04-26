// Re-exports from @clerk/react. Available everywhere because clerk-js runs in
// the JS thread on web; on native (Plans 2-4) the same hooks read from a
// clerk-js instance synced bidirectionally with the native module.
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
  useEmailLink,
  ClerkLoaded,
  ClerkLoading,
  RedirectToSignIn,
  // <Show> replaces v5's <SignedIn>, <SignedOut>, and <Protect>:
  // <Show when="signed-in"> ... </Show>
  // <Show when="signed-out"> ... </Show>
  // <Show when={{ permission: "..." }}> ... </Show>
  Show,
} from '@clerk/react';
export type { ShowProps } from '@clerk/react';

// Capacitor-specific exports.
export { ClerkProvider } from './ClerkProvider';
export type { ClerkProviderProps } from './ClerkProvider';
export { UserButton } from './UserButton';
export type { UserButtonProps } from './UserButton';

// Useful types from the plugin core, re-exported here so consumers do not
// need a second import path for them.
export type { TokenCache, AuthResult, NativeSessionSnapshot } from '../definitions';
