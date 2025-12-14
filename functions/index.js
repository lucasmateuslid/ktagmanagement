
/**
 * Generic Proxy Function to bypass CORS
 * Deploy with: firebase deploy --only functions
 */

const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true }); // Automatically allow all origins

exports.proxyApi = functions.https.onRequest((req, res) => {
  // Wrap logic in CORS middleware to handle Preflight (OPTIONS) requests automatically
  return cors(req, res, async () => {
    
    // 1. Extract Data from Request Body
    const { url, method, headers, body } = req.body;

    if (!url) {
      res.status(400).send({ error: "Missing 'url' in request body" });
      return;
    }

    // Sanitize Headers: Remove headers that might conflict or be invalid for the upstream request
    const safeHeaders = { ...headers };
    delete safeHeaders['host'];
    delete safeHeaders['content-length'];
    delete safeHeaders['connection'];

    try {
      console.log(`[Proxy] Forwarding ${method || 'GET'} to: ${url}`);

      // 2. Make the Request using Axios (Server-side)
      const response = await axios({
        url: url,
        method: method || 'GET',
        headers: safeHeaders, 
        data: body || undefined,
        validateStatus: () => true, // Do not throw error on 4xx/5xx status
        timeout: 20000 // 20s timeout
      });

      // 3. Return Response to Client
      res.status(response.status).send(response.data);

    } catch (error) {
      console.error("[Proxy Error]", error.message);
      
      // Handle Network Errors (Timeout, DNS, etc)
      const status = error.response ? error.response.status : 500;
      const message = error.response ? error.response.data : error.message;
      
      res.status(status).send({ error: message || "Internal Proxy Error" });
    }
  });
});
