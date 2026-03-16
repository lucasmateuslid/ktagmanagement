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
