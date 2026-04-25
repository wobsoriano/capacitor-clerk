import { WebPlugin } from '@capacitor/core';

import type { ClerkPluginPlugin } from './definitions';

export class ClerkPluginWeb extends WebPlugin implements ClerkPluginPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
