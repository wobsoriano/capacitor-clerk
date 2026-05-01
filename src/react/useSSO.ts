import { useSignIn, useSignUp } from '@clerk/react/legacy';
import type {
  EnterpriseSSOStrategy,
  OAuthStrategy,
  SetActive,
  SignInResource,
  SignUpResource,
} from '@clerk/shared/types';

export type StartSSOFlowParams = {
  redirectUrl: string;
  unsafeMetadata?: SignUpUnsafeMetadata;
} & ({ strategy: OAuthStrategy } | { strategy: EnterpriseSSOStrategy; identifier: string });

export type StartSSOFlowReturnType = {
  createdSessionId: string | null;
  setActive?: SetActive;
  signIn?: SignInResource;
  signUp?: SignUpResource;
};

export function useSSO() {
  const { signIn, setActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  async function startSSOFlow(params: StartSSOFlowParams): Promise<StartSSOFlowReturnType> {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return { createdSessionId: null, signIn, signUp, setActive };
    }

    let Browser: typeof import('@capacitor/browser').Browser;
    let App: typeof import('@capacitor/app').App;
    try {
      [{ Browser }, { App }] = await Promise.all([
        import('@capacitor/browser'),
        import('@capacitor/app'),
      ]);
    } catch {
      throw new Error(
        '@capacitor/browser and @capacitor/app are required for SSO. ' +
          'Install them: npm install @capacitor/browser @capacitor/app',
      );
    }

    const { redirectUrl, unsafeMetadata } = params;

    await signIn!.create({
      strategy: params.strategy,
      redirectUrl,
      ...(params.strategy === 'enterprise_sso'
        ? { identifier: (params as { identifier: string }).identifier }
        : {}),
    });

    const { externalVerificationRedirectURL } = signIn!.firstFactorVerification;
    if (!externalVerificationRedirectURL) {
      throw new Error('Missing external verification redirect URL for SSO flow');
    }

    // Resolve when the deep-link callback arrives, or null if the browser is
    // dismissed without completing the flow.
    let resolveCallback!: (url: string | null) => void;
    const callbackPromise = new Promise<string | null>((resolve) => {
      resolveCallback = resolve;
    });

    const urlListener = await App.addListener('appUrlOpen', async (event) => {
      if (event.url.startsWith(redirectUrl)) {
        urlListener.remove();
        finishedListener.remove();
        await Browser.close();
        resolveCallback(event.url);
      }
    });

    const finishedListener = await Browser.addListener('browserFinished', () => {
      urlListener.remove();
      finishedListener.remove();
      resolveCallback(null);
    });

    await Browser.open({ url: externalVerificationRedirectURL.toString() });

    const callbackUrl = await callbackPromise;
    if (!callbackUrl) {
      return { createdSessionId: null, setActive, signIn, signUp };
    }

    const rotatingTokenNonce = new URL(callbackUrl).searchParams.get('rotating_token_nonce') ?? '';
    await signIn!.reload({ rotatingTokenNonce });

    if (signIn!.firstFactorVerification.status === 'transferable') {
      await signUp!.create({ transfer: true, unsafeMetadata });
    }

    return {
      createdSessionId: signUp!.createdSessionId ?? signIn!.createdSessionId ?? null,
      setActive,
      signIn,
      signUp,
    };
  }

  return { startSSOFlow };
}
