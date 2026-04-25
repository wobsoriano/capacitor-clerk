export interface ClerkPluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
