import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const publishableKey = 'pk_test_d2FybS10b3VjYW4tNjIuY2xlcmsuYWNjb3VudHMuZGV2JA';
if (!publishableKey) {
  throw new Error('Set VITE_CLERK_PUBLISHABLE_KEY in example-app/.env');
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <React.StrictMode>
    <App publishableKey={publishableKey} />
  </React.StrictMode>,
);
