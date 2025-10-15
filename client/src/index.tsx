import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AmadinProvider } from './context/AmadinContext.js';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <AmadinProvider>
      <App />
    </AmadinProvider>
  </StrictMode>
);
