
/**
 * Generic Proxy Function to bypass CORS with RATE LIMITING
 * Deploy with: firebase deploy --only functions
 */

const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// --- RATE LIMIT MEMORY STORE (Instance-level) ---
// Note: Cloud Functions instances are reused. This works for basic throttling.
// For distributed strict limiting, Redis would be needed.
const requestCounts = new Map();
const BLOCK_DURATION_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_MIN = 60; // 60 requests per minute per IP

const cleanupOldRecords = () => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.startTime > BLOCK_DURATION_MS) {
      requestCounts.delete(ip);
    }
  }
};

// Garbage collect every 5 mins (approx)
setInterval(cleanupOldRecords, 300000);

exports.proxyApi = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    
    // 1. RATE LIMIT CHECK
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let clientData = requestCounts.get(clientIp);
    
    if (!clientData) {
      clientData = { count: 1, startTime: now };
      requestCounts.set(clientIp, clientData);
    } else {
      // Reset window if expired
      if (now - clientData.startTime > BLOCK_DURATION_MS) {
        clientData.count = 1;
        clientData.startTime = now;
      } else {
        clientData.count++;
      }
    }

    if (clientData.count > MAX_REQUESTS_PER_MIN) {
      res.status(429).send({ error: "Too Many Requests. Please slow down." });
      return;
    }

    // 2. Extract Data from Request Body
    const { url, method, headers, body } = req.body;

    if (!url) {
      res.status(400).send({ error: "Missing 'url' in request body" });
      return;
    }

    // Sanitize Headers
    const safeHeaders = { ...headers };
    delete safeHeaders['host'];
    delete safeHeaders['content-length'];
    delete safeHeaders['connection'];

    try {
      // 3. Make the Request using Axios
      const response = await axios({
        url: url,
        method: method || 'GET',
        headers: safeHeaders, 
        data: body || undefined,
        validateStatus: () => true, 
        timeout: 20000 
      });

      res.status(response.status).send(response.data);

    } catch (error) {
      console.error("[Proxy Error]", error.message);
      
      const status = error.response ? error.response.status : 500;
      const message = error.response ? error.response.data : error.message;
      
      res.status(status).send({ error: message || "Internal Proxy Error" });
    }
  });
});
