// Re-exports from @clerk/react. clerk-js runs in the JS thread on web; on
// native (Plan 4) we share the same instance via the singleton in src/singleton.ts
// so these hooks and components reflect the same session as the native bridge.
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
  // Pre-built UI components from clerk-react. We re-export them rather than
  // wrap them so consumers get the canonical Clerk experience on web. On
  // native (Plan 4), an override layer can swap these for native-bridge
  // variants when running on iOS/Android.
  UserButton,
  UserProfile,
  SignIn,
  SignUp,
  SignInButton,
  SignUpButton,
  SignOutButton,
  OrganizationProfile,
  OrganizationSwitcher,
  OrganizationList,
  CreateOrganization,
} from '@clerk/react';
export type { ShowProps } from '@clerk/react';

// Capacitor-specific exports.
export { ClerkProvider } from './ClerkProvider';
export type { ClerkProviderProps } from './ClerkProvider';

// Useful types from the plugin core, re-exported here so consumers do not
// need a second import path for them.
export type { TokenCache, AuthResult, NativeSessionSnapshot } from '../definitions';
