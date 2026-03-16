
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");
const corsFactory = require("cors");
const webpush = require("web-push");
const { GoogleAuth } = require("google-auth-library");

const parseCsv = (value) =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const allowedOrigins = parseCsv(process.env.PROXY_ALLOWED_ORIGINS);
const allowedDestinationHosts = parseCsv(process.env.PROXY_ALLOWED_HOSTS).map((host) => host.toLowerCase());
const proxyServiceToken = process.env.PROXY_SERVICE_TOKEN || '';

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!allowedOrigins.length) return true;
  return allowedOrigins.includes(origin);
};

const isDestinationAllowed = (targetUrl) => {
  if (!allowedDestinationHosts.length) return true;

  try {
    const parsed = new URL(targetUrl);
    const host = (parsed.hostname || '').toLowerCase();
    return allowedDestinationHosts.includes(host);
  } catch (e) {
    return false;
  }
};

const cors = corsFactory({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin denied by proxy policy'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'api_token', 'timestamp', 'Authorization', 'x-goog-api-key', 'x-goog-api-client', 'x-goog-user-project', 'x-proxy-token']
});

// Inicializa o Admin SDK se ainda não estiver inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- CONFIGURAÇÃO VAPID (PUSH NOTIFICATIONS) ---
const gcpProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const googleAuth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

let vapidSetupPromise = null;

const readSecretFromGcp = async (secretName) => {
  if (!gcpProjectId || !secretName) return null;

  try {
    const client = await googleAuth.getClient();
    const token = await client.getAccessToken();
    const url = `https://secretmanager.googleapis.com/v1/projects/${gcpProjectId}/secrets/${secretName}/versions/latest:access`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token.token || token}`
      },
      timeout: 10000
    });

    const base64Value = response?.data?.payload?.data;
    if (!base64Value) return null;

    return Buffer.from(base64Value, "base64").toString("utf8").trim();
  } catch (error) {
    console.warn(`Unable to read secret ${secretName}:`, error?.response?.status || error?.message || error);
    return null;
  }
};

const setupVapid = async () => {
  const directPublicKey = process.env.VAPID_PUBLIC_KEY;
  const directPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const directSubject = process.env.VAPID_SUBJECT || "mailto:admin@ktag.com.br";

  const publicKeySecretName =
    process.env.VAPID_PUBLIC_KEY_SECRET ||
    "VAPID_PUBLIC_KEY";

  const privateKeySecretName =
    process.env.VAPID_PRIVATE_KEY_SECRET ||
    "VAPID_PRIVATE_KEY";

  const subjectSecretName =
    process.env.VAPID_SUBJECT_SECRET ||
    "VAPID_SUBJECT";

  const publicKey = directPublicKey || await readSecretFromGcp(publicKeySecretName);
  const privateKey = directPrivateKey || await readSecretFromGcp(privateKeySecretName);
  const subject = directSubject || await readSecretFromGcp(subjectSecretName) || "mailto:admin@ktag.com.br";

  if (!publicKey || !privateKey) {
    console.warn("VAPID keys are missing in env/GCP Secret Manager.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch (error) {
    console.warn("VAPID configuration is invalid:", error?.message || error);
    return false;
  }
};

const ensureVapidConfigured = async () => {
  if (!vapidSetupPromise) {
    vapidSetupPromise = setupVapid();
  }

  return vapidSetupPromise;
};

const getAdminAndModeratorUserIds = async () => {
  try {
    const usersSnapshot = await admin.firestore()
      .collection('ktag_users_db')
      .where('role', 'in', ['admin', 'moderator'])
      .get();

    if (usersSnapshot.empty) return [];

    const ids = new Set();
    usersSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const id = data.id || doc.id;
      if (id) ids.add(id);
    });

    return Array.from(ids);
  } catch (error) {
    console.error('Error fetching admin/moderator users:', error);
    return [];
  }
};

const dispatchPushToUserIds = async (userIds, payload) => {
  try {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { success: true, count: 0 };
    }

    const notifications = [];
    for (const userId of userIds) {
      const subscriptionsSnapshot = await admin.firestore()
        .collection('ktag_push_subscriptions')
        .where('userId', '==', userId)
        .get();

      subscriptionsSnapshot.forEach((doc) => {
        const subscription = doc.data().subscription;
        if (!subscription) return;

        const pushPromise = webpush.sendNotification(subscription, payload)
          .catch((err) => {
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              return doc.ref.delete();
            }
            console.error(`Push send failed for user ${userId}:`, err?.message || err);
            return null;
          });

        notifications.push(pushPromise);
      });
    }

    if (notifications.length > 0) {
      await Promise.all(notifications);
    }

    return { success: true, count: notifications.length };
  } catch (error) {
    console.error('Error dispatching push notifications:', error);
    return { success: false, count: 0, error: error?.message || String(error) };
  }
};

// --- RATE LIMIT MEMORY STORE (Instance-level) ---
const requestCounts = new Map();
const BLOCK_DURATION_MS = 60000; 
const MAX_REQUESTS_PER_MIN = 60; 

const cleanupOldRecords = () => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now - data.startTime > BLOCK_DURATION_MS) {
      requestCounts.delete(ip);
    }
  }
};

setInterval(cleanupOldRecords, 300000);

/**
 * PROXY API: Contorna CORS e protege credenciais
 */
exports.proxyApi = onRequest((req, res) => {
  return cors(req, res, async () => {
    // The cors middleware already handles headers and preflight (OPTIONS) requests.
    // If we reach this point, the request is allowed by CORS.

    if (proxyServiceToken) {
      const incomingToken = req.headers['x-proxy-token'];
      if (incomingToken !== proxyServiceToken) {
        res.status(401).send({ error: "Unauthorized proxy request." });
        return;
      }
    }
    
    // 1. RATE LIMIT CHECK
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let clientData = requestCounts.get(clientIp);
    
    if (!clientData) {
      clientData = { count: 1, startTime: now };
      requestCounts.set(clientIp, clientData);
    } else {
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

    if (!isDestinationAllowed(url)) {
      res.status(403).send({ error: "Destination host is not allowed by proxy policy." });
      return;
    }

    console.log(`Proxying request to: ${url}`);

    // Sanitize Headers & Inject User-Agent
    const safeHeaders = { ...headers };
    
    // Remove headers que causam problemas em repasse
    delete safeHeaders['host'];
    delete safeHeaders['content-length'];
    delete safeHeaders['connection'];
    delete safeHeaders['origin'];
    delete safeHeaders['referer'];
    delete safeHeaders['accept-encoding']; // Importante: Deixa o axios/node negociar a compressão

    // Mimetiza um navegador real para evitar bloqueios de API (Essencial para Hinova/SGA)
    if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
        safeHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    try {
      // 3. Make the Request using Axios
      const axiosConfig = {
        url: url,
        method: method || 'GET',
        headers: safeHeaders, 
        validateStatus: () => true, // Permite capturar erros 4xx/5xx sem throw
        timeout: 25000 // Aumentado para APIs lentas
      };

      // Adiciona o body apenas se o método não for GET/HEAD e se houver um body
      const upperMethod = (method || 'GET').toUpperCase();
      if (body && upperMethod !== 'GET' && upperMethod !== 'HEAD') {
        axiosConfig.data = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await axios(axiosConfig);

      // Repassa dados e status exatos
      res.status(response.status).send(response.data);

    } catch (error) {
      console.error("[Proxy Error]", error.message, url);
      
      const status = error.response ? error.response.status : 500;
      const message = error.response ? error.response.data : error.message;
      
      res.status(status).json({ 
          error: typeof message === 'object' ? JSON.stringify(message) : message,
          proxyError: true 
      });
    }
  });
});

/**
 * TRIGGER AUTOMÁTICO: Nova Solicitação de Agendamento
 */
exports.onScheduleCreated = onDocumentCreated('ktag_schedules/{scheduleId}', async (event) => {
  try {
    if (!await ensureVapidConfigured()) {
      console.warn("Skipping onScheduleCreated push dispatch: missing VAPID configuration.");
      return null;
    }

    const schedule = event.data?.data();
    if (!schedule) return null;

    const adminAndModeratorUserIds = await getAdminAndModeratorUserIds();
    if (!adminAndModeratorUserIds.length) return null;

    const plate = schedule.vehiclePlate || 'sem placa';
    const serviceType = schedule.serviceType || 'Serviço';
    const requesterName = schedule.requesterName || 'Solicitante';

    const payload = JSON.stringify({
      title: 'Nova Solicitação 🆕',
      body: `Placa ${plate} | ${serviceType} | Solicitante: ${requesterName}`,
      url: '/',
      icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
    });

    await dispatchPushToUserIds(adminAndModeratorUserIds, payload);
    return { success: true };
  } catch (error) {
    console.error('Error in onScheduleCreated trigger:', error);
    return null;
  }
});

/**
 * TRIGGER AUTOMÁTICO: Atualização de Status de Agendamento
 */
exports.onScheduleUpdate = onDocumentUpdated('ktag_schedules/{scheduleId}', async (event) => {
    try {
      if (!await ensureVapidConfigured()) {
        console.warn("Skipping onScheduleUpdate push dispatch: missing VAPID configuration.");
        return null;
      }

      const newData = event.data?.after?.data();
      const previousData = event.data?.before?.data();

      if (!newData || !previousData) return null;
      if (newData.status === previousData.status) return null;

      const requesterId = newData.requesterId;
      const status = newData.status;
      const plate = newData.vehiclePlate || 'sem placa';

      let title = '';
      let body = '';

      switch (status) {
        case 'Confirmada':
          title = 'Agendamento Confirmado! ✅';
          body = `Sua solicitação para a placa ${plate} foi agendada.`;
          break;
        case 'Reagendada':
          title = 'Agendamento Alterado 🕒';
          body = `Nova data/hora definida para o veículo ${plate}.`;
          break;
        case 'Técnico no local':
          title = 'Técnico no Local 📍';
          body = `O técnico chegou para atender o veículo ${plate}.`;
          break;
        case 'Concluída':
          title = 'Serviço Concluído 🎉';
          body = `O serviço no veículo ${plate} foi finalizado com sucesso.`;
          break;
        case 'Cancelada':
          title = 'Solicitação Cancelada ❌';
          body = `O serviço para ${plate} foi cancelado. Verifique os detalhes.`;
          break;
        case 'Em análise':
          title = 'Em Análise 🔍';
          body = `Estamos analisando sua solicitação para ${plate}.`;
          break;
        default:
          return null;
      }

      if (requesterId) {
        const requesterPayload = JSON.stringify({
          title,
          body,
          url: '/',
          icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
        });
        await dispatchPushToUserIds([requesterId], requesterPayload);
      }

      const adminAndModeratorUserIds = await getAdminAndModeratorUserIds();
      if (adminAndModeratorUserIds.length > 0) {
        const adminPayload = JSON.stringify({
          title: 'Atualização de Agendamento',
          body: `Placa ${plate}: status alterado para ${status}.`,
          url: '/',
          icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
        });
        await dispatchPushToUserIds(adminAndModeratorUserIds, adminPayload);
      }

      return { success: true };
    } catch (error) {
      console.error('Error in onScheduleUpdate trigger:', error);
      return null;
    }
});

exports.sendPushNotification = onCall(async (request) => {
  if (!await ensureVapidConfigured()) {
    throw new HttpsError(
      'failed-precondition',
      'Push notifications are not configured on server (missing VAPID keys)'
    );
  }

  const data = request.data || {};
  const { userId, title, body, url } = data;

  if (!userId || !title || !body) {
    throw new HttpsError('invalid-argument', 'Missing userId, title, or body');
  }

  try {
    const subscriptionsSnapshot = await admin.firestore()
      .collection('ktag_push_subscriptions')
      .where('userId', '==', userId)
      .get();

    if (subscriptionsSnapshot.empty) {
      return { success: false, message: 'User has no push subscriptions' };
    }

    const notifications = [];
    const payload = JSON.stringify({
      title: title,
      body: body,
      url: url || '/',
      icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
    });

    subscriptionsSnapshot.forEach(doc => {
      const subscription = doc.data().subscription;
      const pushPromise = webpush.sendNotification(subscription, payload)
        .catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            return doc.ref.delete();
          }
        });
      notifications.push(pushPromise);
    });

    await Promise.all(notifications);
    return { success: true, count: notifications.length };

  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    throw new HttpsError('internal', 'Error sending notifications');
  }
});
