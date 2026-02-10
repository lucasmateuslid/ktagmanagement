
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const webpush = require("web-push");

// Inicializa o Admin SDK se ainda não estiver inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- CONFIGURAÇÃO VAPID (PUSH NOTIFICATIONS) ---
const vapidKeys = {
  publicKey: "SUA_PUBLIC_KEY_AQUI", 
  privateKey: "SUA_PRIVATE_KEY_AQUI"
};

try {
  webpush.setVapidDetails(
    "mailto:admin@ktag.com.br", 
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
} catch (e) {
  console.warn("VAPID Keys not configured properly.");
}

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
exports.proxyApi = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    
    // Set CORS headers for all responses
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type, api_token, timestamp, Authorization, x-goog-api-key, x-goog-api-client, x-goog-user-project');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
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
      const response = await axios({
        url: url,
        method: method || 'GET',
        headers: safeHeaders, 
        data: body || undefined,
        validateStatus: () => true, // Permite capturar erros 4xx/5xx sem throw
        timeout: 25000 // Aumentado para APIs lentas
      });

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
 * TRIGGER AUTOMÁTICO: Atualização de Status de Agendamento
 */
exports.onScheduleUpdate = functions.firestore
  .document('ktag_schedules/{scheduleId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    if (newData.status === previousData.status) return null;

    const requesterId = newData.requesterId;
    if (!requesterId) return null;

    let title = '';
    let body = '';
    const status = newData.status;
    const plate = newData.vehiclePlate;

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

    try {
      const subscriptionsSnapshot = await admin.firestore()
        .collection('ktag_push_subscriptions')
        .where('userId', '==', requesterId)
        .get();

      if (subscriptionsSnapshot.empty) {
        return null;
      }

      const notifications = [];
      const payload = JSON.stringify({
        title: title,
        body: body,
        url: '/',
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
      return { success: true };

    } catch (error) {
      console.error('Error in onScheduleUpdate trigger:', error);
      return null;
    }
});

exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  const { userId, title, body, url } = data;

  if (!userId || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing userId, title, or body');
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
    throw new functions.https.HttpsError('internal', 'Error sending notifications');
  }
});
