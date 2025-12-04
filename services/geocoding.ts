import { storage } from './storage';

export const geocodingService = {
  /**
   * Converts Lat/Lon to a human-readable address.
   * Prioritizes Google Maps API if key is present, falls back to OpenStreetMap Nominatim.
   */
  reverseGeocode: async (lat: number, lon: number): Promise<string> => {
    const settings = await storage.getSettings();

    // Strategy 1: Google Maps
    if (settings.googleMapsKey) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${settings.googleMapsKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
          return data.results[0].formatted_address;
        }
      } catch (e) {
        console.warn("Google Geocoding failed:", e);
      }
    }

    // Strategy 2: OpenStreetMap Nominatim (Free, requires User-Agent)
    try {
      // Throttle slightly to respect OSM policy
      await new Promise(r => setTimeout(r, 1000)); 
      
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'KTagManagerPro/1.0'
        }
      });
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (e) {
      console.warn("OSM Geocoding failed:", e);
    }

    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
};