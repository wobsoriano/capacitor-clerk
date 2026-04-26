/// <reference types="@capacitor/cli" />

declare module '@capacitor/cli' {
  export interface PluginsConfig {
    ClerkPlugin?: {
      /**
       * Clerk publishable key. Optional. Most apps configure at runtime via
       * <ClerkProvider publishableKey={...}>.
       *
       * @example "pk_test_xxx"
       */
      publishableKey?: string;
    };
  }
}
