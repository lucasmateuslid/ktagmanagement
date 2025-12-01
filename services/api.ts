
import { Tag, KTagLocationResult } from '../types';
import { storage } from './storage';

// Proxy Definitions
// Public proxies often block non-standard ports (like 6176).
// The most reliable method is using the Custom Cloud Function.
const PUBLIC_PROXIES = [
  { base: 'https://cors-anywhere.herokuapp.com/', type: 'path' }, // Requires visiting to activate
  { base: 'https://api.allorigins.win/raw?url=', type: 'query' },
  { base: 'https://corsproxy.io/?', type: 'plain' }, 
  { base: 'https://api.codetabs.com/v1/proxy?quest=', type: 'query' },
];

/**
 * Fetches location data from the K-Tag API.
 * Uses settings from storage for URL and Auth.
 */
export const fetchTagLocation = async (tag: Tag): Promise<KTagLocationResult[]> => {
  // 1. Get Settings
  const settings = await storage.getSettings();
  
  // 2. Prepare Payload
  const payload = {
    accessoryId: tag.accessoryId,
    hashed_keys: [tag.hashedAdvKey], 
    priv_keys: [tag.privateKey],     
  };

  // 3. Prepare Auth Header
  const authHeader = `Basic ${btoa(`${settings.ktagUser}:${settings.ktagPass}`)}`;
  
  // --- STRATEGY 1: Use Custom Cloud Function (Preferred) ---
  if (settings.customProxyUrl) {
    try {
      console.log("Using Custom Cloud Function Proxy...");
      const response = await fetch(settings.customProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.ktagUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: payload
        })
      });

      if (!response.ok) throw new Error(`Cloud Function Error: ${response.status} ${response.statusText}`);
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data && Array.isArray(data.results)) return data.results;
        if (data && !data.results) return []; // Empty result set is valid
        return [];
      } catch (jsonErr) {
        console.error("Cloud Proxy returned non-JSON:", text);
        throw new Error("Invalid response from proxy");
      }

    } catch (e: any) {
      console.error("Custom Proxy Failed:", e);
      throw new Error(`Custom Proxy Failed: ${e.message}`);
    }
  }

  // --- STRATEGY 2: Fallback to Public Proxies ---
  let lastError: any;

  for (const proxy of PUBLIC_PROXIES) {
    try {
      let url = '';
      const targetUrl = settings.ktagUrl; // e.g. http://47.113.127.14:6176

      if (proxy.type === 'query') {
        url = `${proxy.base}${encodeURIComponent(targetUrl)}`;
      } else if (proxy.type === 'path') {
        url = `${proxy.base}${targetUrl}`;
      } else {
        // Plain concatenation for some proxies that handle it
        url = `${proxy.base}${encodeURIComponent(targetUrl)}`; 
      }

      console.log(`Attempting Public Proxy ${proxy.base}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'X-Requested-With': 'XMLHttpRequest' // Required by cors-anywhere
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // specific check for cors-anywhere demand
        if (response.status === 403 && proxy.base.includes('cors-anywhere')) {
           console.warn("CORS Anywhere requires activation. Visit https://cors-anywhere.herokuapp.com/corsdemo");
        }
        throw new Error(`Proxy status ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.results)) return data.results;
      return [];

    } catch (error: any) {
      console.warn(`Request failed via ${proxy.base}:`, error.message);
      lastError = error;
    }
  }

  // If we get here, all proxies failed.
  let errorMessage = "All connection methods failed.";
  
  if (lastError instanceof Error) {
      errorMessage = `${lastError.message}.`;
  }
  
  // Append helpful instruction
  errorMessage += " The K-TAG API uses Port 6176 which is blocked by most public proxies. Please deploy the Cloud Function (Code in functions/index.js) and configure it in Settings.";

  throw new Error(errorMessage);
};

export const exportToCSV = (locations: KTagLocationResult[]) => {
  const headers = ['Timestamp', 'ISO Date', 'Latitude', 'Longitude', 'Confidence', 'Status'];
  const rows = locations.map(l => 
    [l.timestamp, l.isodatetime, l.lat, l.lon, l.conf, l.status].join(',')
  );
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows].join('\n');
    
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "tag_history.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
