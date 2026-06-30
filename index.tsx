
import './polyfill-fix';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // Import global styles (Tailwind)

// --- CIRCULAR JSON STRIPPER ---
const originalStringify = JSON.stringify;
JSON.stringify = function(value: any, replacer?: any, space?: any): string {
  try {
    return originalStringify(value, replacer, space);
  } catch(e) {
    if (e instanceof TypeError && e.message.includes('circular')) {
        const cache = new Set();
        return originalStringify(value, (k, v) => {
           if (typeof v === 'object' && v !== null) {
               if (cache.has(v)) return '[Circular]';
               cache.add(v);
           }
           if (replacer && typeof replacer === 'function') {
               return replacer(k, v);
           }
           return v;
        }, space);
    }
    throw e;
  }
} as any;
// --- END DEBUG ---

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
