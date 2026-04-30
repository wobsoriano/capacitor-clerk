import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const publishableKey = 'pk_test_b3B0aW11bS1ob25leWJlZS01NS5jbGVyay5hY2NvdW50cy5kZXYk';
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
