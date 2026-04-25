import { registerPlugin } from '@capacitor/core';

import type { ClerkPluginPlugin } from './definitions';

const ClerkPlugin = registerPlugin<ClerkPluginPlugin>('ClerkPlugin', {
  web: () => import('./web').then((m) => new m.ClerkPluginWeb()),
});

export * from './definitions';
export { ClerkPlugin };
