/**
 * FIREBASE CLOUD FUNCTION CODE
 * 
 * Instructions:
 * 1. cd functions
 * 2. npm install axios
 * 3. firebase deploy --only functions
 * 4. Copy URL to App Settings
 */

const functions = require("firebase-functions");
const axios = require("axios");

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
    
    // 3. Make the Request using Axios
    // Axios automatically handles HTTP/HTTPS and headers better than native fetch in Cloud Functions
    const response = await axios({
      url: url,
      method: method || 'GET',
      headers: headers || {},
      data: body,
      validateStatus: () => true, // Resolve promise for all status codes (don't throw on 4xx/5xx)
      timeout: 10000 // 10s timeout
    });

    // 4. Return Response
    // Axios stores response data in .data
    res.status(response.status).send(response.data);
    
  } catch (error) {
    console.error("Proxy Error:", error.message);
    res.status(500).send({ error: error.message || "Internal Proxy Error" });
  }
});