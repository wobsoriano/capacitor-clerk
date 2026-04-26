import { registerPlugin } from '@capacitor/core';

import type { ClerkPluginInterface } from './definitions';

const ClerkPlugin = registerPlugin<ClerkPluginInterface>('ClerkPlugin', {
  web: () => import('./web').then((m) => new m.ClerkPluginWeb()),
});

export * from './definitions';
export { ClerkPlugin };
