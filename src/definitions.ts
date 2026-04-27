/**
 * Token cache used by `createClerkInstance` to persist the rotating Clerk JWT.
 * Default implementation ships at `capacitor-clerk/token-cache`.
 */
export interface TokenCache {
  getToken(key: string): Promise<string | null | undefined>;
  saveToken(key: string, token: string): Promise<void>;
  clearToken?(key: string): Promise<void>;
}
