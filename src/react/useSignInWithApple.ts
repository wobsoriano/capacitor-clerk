import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { Capacitor } from '@capacitor/core';
import type { SetActive, SignInResource, SignUpResource } from '@clerk/shared/types';

export type StartAppleAuthenticationFlowParams = {
  unsafeMetadata?: SignUpUnsafeMetadata;
};

export type StartAppleAuthenticationFlowReturnType = {
  createdSessionId: string | null;
  setActive?: SetActive;
  signIn?: SignInResource;
  signUp?: SignUpResource;
};

export function useSignInWithApple() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  async function startAppleAuthenticationFlow(
    params?: StartAppleAuthenticationFlowParams,
  ): Promise<StartAppleAuthenticationFlowReturnType> {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return { createdSessionId: null, signIn, signUp, setActive };
    }

    if (Capacitor.getPlatform() !== 'ios') {
      throw new Error(
        "Sign in with Apple is only supported on iOS. Use useSSO({ strategy: 'oauth_apple' }) on Android.",
      );
    }

    let pkg: typeof import('@capawesome/capacitor-apple-sign-in');
    try {
      pkg = await import('@capawesome/capacitor-apple-sign-in');
    } catch {
      throw new Error(
        '@capawesome/capacitor-apple-sign-in is required to use Sign in with Apple. ' +
          'Install it: npm install @capawesome/capacitor-apple-sign-in',
      );
    }

    const { AppleSignIn, SignInScope } = pkg;
    const nonce = crypto.randomUUID();

    let result: Awaited<ReturnType<typeof AppleSignIn.signIn>>;
    try {
      result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce,
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_CANCELED') {
        return { createdSessionId: null, setActive, signIn, signUp };
      }
      throw error;
    }

    const { idToken } = result;
    if (!idToken) {
      throw new Error('No identity token received from Apple Sign-In.');
    }

    await signIn!.create({ strategy: 'oauth_token_apple', token: idToken });

    if (signIn!.firstFactorVerification.status === 'transferable') {
      await signUp!.create({ transfer: true, unsafeMetadata: params?.unsafeMetadata });
      return { createdSessionId: signUp!.createdSessionId ?? null, setActive, signIn, signUp };
    }

    return { createdSessionId: signIn!.createdSessionId ?? null, setActive, signIn, signUp };
  }

  return { startAppleAuthenticationFlow };
}
