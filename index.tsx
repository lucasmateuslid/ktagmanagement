
// Fix for "Cannot set property fetch of #<Window> which has only a getter"
// This happens when some polyfills (like formdata-polyfill) try to monkey-patch fetch
// in environments where window.fetch is read-only.
if (typeof window !== 'undefined') {
  try {
    if (window.fetch) {
      const originalFetch = window.fetch;
      try {
        Object.defineProperty(window, 'fetch', {
          value: originalFetch,
          writable: true,
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
    }
  } catch (e) {}

  // Some libraries expect 'global' to be defined in the browser
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import global styles (Tailwind)

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
