
/**
 * FIREBASE CLOUD FUNCTION CODE
 * 
 * Instructions:
 * 1. Initialize Firebase Functions in your local project: `firebase init functions`
 * 2. Select "JavaScript"
 * 3. Make sure to select Node.js 18 or later in package.json engines.
 * 4. Copy this code into your local `functions/index.js`
 * 5. Deploy: `firebase deploy --only functions`
 * 6. Copy the Function URL (e.g. https://us-central1-xyz.cloudfunctions.net/proxyApi)
 * 7. Paste it into the App Settings > Cloud Function URL
 */

const functions = require("firebase-functions");

// Node 18+ has native fetch. If on older node, npm install node-fetch and uncomment next line:
// const fetch = require("node-fetch"); 

exports.proxyApi = functions.https.onRequest(async (req, res) => {
  // 1. Handle CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // 2. Extract Data
  const { url, method, headers, body } = req.body;

  if (!url) {
    res.status(400).send("Missing 'url' in request body");
    return;
  }

  try {
    console.log(`Proxying request to: ${url}`);
    
    // 3. Make the Request
    // Note: We deliberately strip some headers to avoid conflicts
    const response = await fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.text();
    
    // 4. Return Response
    // We pass back the status code from the target API
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).send({ error: error.toString() });
  }
});
