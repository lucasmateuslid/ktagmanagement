const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const regexFuncs = /async function performGeocoding[\s\S]*?async function startServer\(\) \{/m;

const newLogic = `
// --- MULTI-PROVIDER GEOCODING LOGIC ---
const DEFAULT_GEOCODER_PREFS = {
  priority_order: ['geoapify', 'here', 'photon', 'google_maps', 'radar', 'openstreetmap'],
  providers: {
    geoapify: { enabled: false, api_key: null },
    here: { enabled: false, api_key: null },
    photon: { enabled: true, api_key: null },
    google_maps: { enabled: false, api_key: null },
    radar: { enabled: false, api_key: null },
    openstreetmap: { enabled: true, api_key: null }
  },
  confidence_threshold: 0.7,
  fallback_on_empty: true,
  fallback_on_low_confidence: true,
  country_filter: 'br',
  default_language: 'pt'
};

const USER_AGENT = process.env.GEOCODING_USER_AGENT || 'KTagManagerPro/1.0';

async function executeMultiProvider(type, queryOrCoords, prefs) {
  const preferences = prefs && prefs.priority_order ? prefs : DEFAULT_GEOCODER_PREFS;
  const order = preferences.priority_order || [];
  const providers = preferences.providers || {};
  const threshold = preferences.confidence_threshold || 0.7;

  let providers_tried = [];
  let fallback_used = false;

  for (let i = 0; i < order.length; i++) {
    const providerName = order[i];
    const config = providers[providerName];

    if (!config || !config.enabled) continue;

    providers_tried.push(providerName);
    if (providers_tried.length > 1) fallback_used = true;

    try {
      let result = null;
      const apiKey = config.api_key || '';

      if (type === 'forward') {
        const query = queryOrCoords;
        if (providerName === 'geoapify') {
          const res = await fetchWithTimeout(\`https://api.geoapify.com/v1/geocode/search?text=\${encodeURIComponent(query)}&apiKey=\${apiKey}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0].properties;
              result = { lat: f.lat, lng: f.lon, address: f.formatted, confidence: f.rank?.confidence || 1.0, raw: data.features[0] };
            }
          }
        } else if (providerName === 'here') {
          const res = await fetchWithTimeout(\`https://geocode.search.hereapi.com/v1/geocode?q=\${encodeURIComponent(query)}&apiKey=\${apiKey}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              result = { lat: data.items[0].position.lat, lng: data.items[0].position.lng, address: data.items[0].address.label, confidence: 1.0, raw: data.items[0] };
            }
          }
        } else if (providerName === 'photon') {
          const res = await fetchWithTimeout(\`https://photon.komoot.io/api/?q=\${encodeURIComponent(query)}&limit=1&lang=pt\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0];
              const addr = f.properties.name || f.properties.street || f.properties.city;
              result = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], address: addr, confidence: 1.0, raw: f };
            }
          }
        } else if (providerName === 'google_maps' || providerName === 'google') {
          const keyToUse = apiKey || process.env.GEOCODING_GOOGLE_API_KEY;
          const res = await fetchWithTimeout(\`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(query)}&region=br&language=pt-BR&key=\${keyToUse}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              result = { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng, address: data.results[0].formatted_address, confidence: 1.0, raw: data.results[0] };
            }
          }
        } else if (providerName === 'radar') {
          const res = await fetchWithTimeout(\`https://api.radar.io/v1/geocode/forward?query=\${encodeURIComponent(query)}\`, { headers: { 'Authorization': apiKey } });
          if (res.ok) {
            const data = await res.json();
            if (data.addresses && data.addresses.length > 0) {
              result = { lat: data.addresses[0].latitude, lng: data.addresses[0].longitude, address: data.addresses[0].formattedAddress, confidence: data.addresses[0].confidence === 'exact' ? 1.0 : 0.5, raw: data.addresses[0] };
            }
          }
        } else if (providerName === 'openstreetmap' || providerName === 'osm') {
          const res = await fetchWithTimeout(\`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}&addressdetails=1&limit=1&countrycodes=br\`, { headers: { 'User-Agent': USER_AGENT } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), address: data[0].display_name, confidence: 1.0, raw: data[0] };
            }
          }
        }
      } else {
        const { lat, lng } = queryOrCoords;
        if (providerName === 'geoapify') {
          const res = await fetchWithTimeout(\`https://api.geoapify.com/v1/geocode/reverse?lat=\${lat}&lon=\${lng}&apiKey=\${apiKey}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0].properties;
              result = { lat: f.lat, lng: f.lon, address: f.formatted, confidence: f.rank?.confidence || 1.0, raw: data.features[0] };
            }
          }
        } else if (providerName === 'here') {
          const res = await fetchWithTimeout(\`https://revgeocode.search.hereapi.com/v1/revgeocode?at=\${lat},\${lng}&apiKey=\${apiKey}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.length > 0) {
              result = { lat: data.items[0].position.lat, lng: data.items[0].position.lng, address: data.items[0].address.label, confidence: 1.0, raw: data.items[0] };
            }
          }
        } else if (providerName === 'photon') {
          const res = await fetchWithTimeout(\`https://photon.komoot.io/reverse?lon=\${lng}&lat=\${lat}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.features && data.features.length > 0) {
              const f = data.features[0];
              const addrItems = [f.properties.street, f.properties.housenumber, f.properties.city, f.properties.state].filter(Boolean);
              const addr = addrItems.join(', ') || f.properties.name;
              result = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], address: addr, confidence: 1.0, raw: f };
            }
          }
        } else if (providerName === 'google_maps' || providerName === 'google') {
          const keyToUse = apiKey || process.env.GEOCODING_GOOGLE_API_KEY;
          const res = await fetchWithTimeout(\`https://maps.googleapis.com/maps/api/geocode/json?latlng=\${lat},\${lng}&language=pt-BR&key=\${keyToUse}\`, {});
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              result = { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng, address: data.results[0].formatted_address, confidence: 1.0, raw: data.results[0] };
            }
          }
        } else if (providerName === 'radar') {
          const res = await fetchWithTimeout(\`https://api.radar.io/v1/geocode/reverse?coordinates=\${lat},\${lng}\`, { headers: { 'Authorization': apiKey } });
          if (res.ok) {
            const data = await res.json();
            if (data.addresses && data.addresses.length > 0) {
              result = { lat: data.addresses[0].latitude, lng: data.addresses[0].longitude, address: data.addresses[0].formattedAddress, confidence: 1.0, raw: data.addresses[0] };
            }
          }
        } else if (providerName === 'openstreetmap' || providerName === 'osm') {
          const res = await fetchWithTimeout(\`https://nominatim.openstreetmap.org/reverse?format=json&lat=\${lat}&lon=\${lng}&addressdetails=1\`, { headers: { 'User-Agent': USER_AGENT } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              result = { lat: parseFloat(data.lat), lng: parseFloat(data.lon), address: data.display_name, confidence: 1.0, raw: data };
            }
          }
        }
      }

      if (result) {
        if (result.confidence >= threshold || !preferences.fallback_on_low_confidence) {
          return {
            provider_used: providerName,
            providers_tried,
            fallback_used,
            query: type === 'forward' ? queryOrCoords : \`\${queryOrCoords.lat},\${queryOrCoords.lng}\`,
            result
          };
        }
      }
    } catch (e) {
      console.warn(\`[GEOCODING] Provider \${providerName} failed: \${e.message}\`);
    }
  }

  throw new GeocodingError("Todos os provedores falharam: " + JSON.stringify(providers_tried));
}

async function performGeocoding(address, geocoderPreferences) {
  return await executeMultiProvider('forward', address, geocoderPreferences);
}

async function performReverseGeocoding(lat, lng, geocoderPreferences) {
  return await executeMultiProvider('reverse', { lat, lng }, geocoderPreferences);
}

async function startServer() {`;

code = code.replace(regexFuncs, newLogic);
code = code.replace(/const { address, providerPreference } = req\.body;/, 'const { address, geocoderPreferences } = req.body;');
code = code.replace(/performGeocoding\(address, providerPreference\)/, 'performGeocoding(address, geocoderPreferences)');
code = code.replace(/const { lat, lng, providerPreference } = req\.body;/, 'const { lat, lng, geocoderPreferences } = req.body;');
code = code.replace(/performReverseGeocoding\(lat, lng, providerPreference\)/, 'performReverseGeocoding(lat, lng, geocoderPreferences)');

fs.writeFileSync('server.ts', code);
console.log('Update complete');
