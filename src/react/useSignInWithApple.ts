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

    let SignInWithApple: typeof import('@capacitor-community/apple-sign-in').SignInWithApple;
    try {
      ({ SignInWithApple } = await import('@capacitor-community/apple-sign-in'));
    } catch {
      throw new Error(
        '@capacitor-community/apple-sign-in is required to use Sign in with Apple. ' +
          'Install it: npm install @capacitor-community/apple-sign-in',
      );
    }

    const nonce = crypto.randomUUID();

    let credential: Awaited<ReturnType<typeof SignInWithApple.authorize>>['response'];
    try {
      ({ response: credential } = await SignInWithApple.authorize({
        clientId: '',
        redirectURI: '',
        scopes: 'email name',
        nonce,
      }));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_CANCELED') {
        return { createdSessionId: null, setActive, signIn, signUp };
      }
      throw error;
    }

    const { identityToken } = credential;
    if (!identityToken) {
      throw new Error('No identity token received from Apple Sign-In.');
    }

    await signIn!.create({ strategy: 'oauth_token_apple', token: identityToken });

    if (signIn!.firstFactorVerification.status === 'transferable') {
      await signUp!.create({ transfer: true, unsafeMetadata: params?.unsafeMetadata });
      return { createdSessionId: signUp!.createdSessionId ?? null, setActive, signIn, signUp };
    }

    return { createdSessionId: signIn!.createdSessionId ?? null, setActive, signIn, signUp };
  }

  return { startAppleAuthenticationFlow };
}
