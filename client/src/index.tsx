import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AmadinProvider } from './context/AmadinContext.js';
import { WindowManagerProvider } from './context/WindowManagerContext.js';
import { App } from './App.js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <BrowserRouter>
      <AmadinProvider>
        <WindowManagerProvider>
          <App />
        </WindowManagerProvider>
      </AmadinProvider>
    </BrowserRouter>
  </StrictMode>
);
