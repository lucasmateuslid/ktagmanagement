
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ 
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'api_token', 'timestamp', 'Authorization', 'x-goog-api-key', 'x-goog-api-client', 'x-goog-user-project']
});
const webpush = require("web-push");

// Inicializa o Admin SDK se ainda não estiver inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- CONFIGURAÇÃO VAPID (PUSH NOTIFICATIONS) ---
const vapidKeys = {
  publicKey: "BPeLenAfveHRZomoae7lEJgkVXoV40wiqGYiaDg6itNL6t-0HzhyVS_LkP13BDgy-UVUB0ctKde-e3aPdT3xn9o", 
  privateKey: "7U_Yyn_NkWjIt8IyjjydcwkcNOP5p6a9b1YqBAwqEEY"
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

// --- HELPERS PARA NOTIFICAÇÕES PUSH ---

async function sendNotificationToUser(userId, payload) {
  try {
    const subscriptionsSnapshot = await admin.firestore()
      .collection('ktag_push_subscriptions')
      .where('userId', '==', userId)
      .get();

    if (subscriptionsSnapshot.empty) return;

    const notifications = [];
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
    });

    subscriptionsSnapshot.forEach(doc => {
      const subscription = doc.data().subscription;
      const pushPromise = webpush.sendNotification(subscription, pushPayload)
        .catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            return doc.ref.delete();
          }
        });
      notifications.push(pushPromise);
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

async function sendNotificationToPref(prefKey, payload, excludeUserId = null) {
  try {
    const usersSnapshot = await admin.firestore().collection('ktag_users').get();
    const targetUserIds = [];
    
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (user.id === excludeUserId) return;
      
      const prefs = user.notificationPreferences || {};
      // Se não estiver definido, assume true como padrão
      if (prefs[prefKey] !== false) {
        targetUserIds.push(user.id);
      }
    });

    if (targetUserIds.length === 0) return;

    // Busca inscrições em lotes de 30 (limite do 'in' no firestore) ou busca todas e filtra
    const subscriptionsSnapshot = await admin.firestore().collection('ktag_push_subscriptions').get();
    
    const notifications = [];
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
    });

    subscriptionsSnapshot.forEach(doc => {
      const sub = doc.data();
      if (targetUserIds.includes(sub.userId)) {
        const pushPromise = webpush.sendNotification(sub.subscription, pushPayload)
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              return doc.ref.delete();
            }
          });
        notifications.push(pushPromise);
      }
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error(`Error sending notification for pref ${prefKey}:`, error);
  }
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
exports.proxyApi = onRequest((req, res) => {
  return cors(req, res, async () => {
    // The cors middleware already handles headers and preflight (OPTIONS) requests.
    // If we reach this point, the request is allowed by CORS.
    
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
      
      let errorMsg = message;
      if (typeof message === 'object') {
        try {
          errorMsg = JSON.stringify(message);
        } catch (e) {
          errorMsg = String(message);
        }
      }
      res.status(status).json({ 
          error: errorMsg,
          proxyError: true 
      });
    }
  });
});

/**
 * TRIGGER AUTOMÁTICO: Criação de Agendamento
 */
exports.onScheduleCreate = onDocumentCreated(
  'ktag_schedules/{scheduleId}',
  async (event) => {
    const schedule = event.data.data();
    if (!schedule) return null;

    try {
      await sendNotificationToPref('newTechnicalRequest', {
        title: 'Nova Solicitação Técnica 🛠️',
        body: `Placa ${schedule.vehiclePlate} (${schedule.serviceType}) solicitada por ${schedule.requesterName}`,
        url: '/schedules'
      }, schedule.requesterId);
      return { success: true };
    } catch (error) {
      console.error('Error in onScheduleCreate trigger:', error);
      return null;
    }
  }
);

/**
 * TRIGGER AUTOMÁTICO: Atualização de Status de Agendamento
 */
exports.onScheduleUpdate = onDocumentUpdated(
  'ktag_schedules/{scheduleId}',
  async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();

    if (newData.status === previousData.status) return null;

    const requesterId = newData.requesterId;
    if (!requesterId) return null;

    const status = newData.status;
    const plate = newData.vehiclePlate;

    try {
      if (status === 'Concluída') {
        await sendNotificationToUser(requesterId, {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado.`,
          url: '/schedules'
        });
        await sendNotificationToPref('serviceCompleted', {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado.`,
          url: '/schedules'
        }, requesterId);
      } else if (status === 'Autorizada' || status === 'Em orçamento') {
        await sendNotificationToPref('schedulingNeedsConfirmation', {
          title: 'Aguardando Confirmação ⏳',
          body: `O agendamento para ${plate} precisa ser confirmado.`,
          url: '/schedules'
        });
      } else if (status === 'Técnico no local') {
        await sendNotificationToPref('schedulingNeedsCompletion', {
          title: 'Técnico no Local 📍',
          body: `O técnico chegou para atender o veículo ${plate}.`,
          url: '/schedules'
        });
      } else if (status === 'Cancelada') {
        await sendNotificationToUser(requesterId, {
          title: 'Solicitação Cancelada ❌',
          body: `O serviço para ${plate} foi cancelado.`,
          url: '/schedules'
        });
      } else if (status === 'Confirmada') {
        await sendNotificationToUser(requesterId, {
          title: 'Agendamento Confirmado! ✅',
          body: `Sua solicitação para a placa ${plate} foi agendada.`,
          url: '/schedules'
        });
      } else if (status === 'Reagendada') {
        await sendNotificationToUser(requesterId, {
          title: 'Agendamento Alterado 🕒',
          body: `Nova data/hora definida para o veículo ${plate}.`,
          url: '/schedules'
        });
      } else if (status === 'Em análise') {
        await sendNotificationToUser(requesterId, {
          title: 'Em Análise 🔍',
          body: `Estamos analisando sua solicitação para ${plate}.`,
          url: '/schedules'
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error in onScheduleUpdate trigger:', error);
      return null;
    }
});

/**
 * TRIGGER AUTOMÁTICO: Atualização de Veículo (Roubo)
 */
exports.onVehicleUpdate = onDocumentUpdated(
  'ktag_vehicles/{vehicleId}',
  async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();

    if (newData.status === 'stolen' && previousData.status !== 'stolen') {
      try {
        await sendNotificationToPref('theftRegistered', {
          title: '🚨 Roubo Cadastrado',
          body: `O veículo ${newData.plate} foi marcado como roubado!`,
          url: '/security'
        });
        return { success: true };
      } catch (error) {
        console.error('Error in onVehicleUpdate trigger:', error);
        return null;
      }
    }
    return null;
  }
);

/**
 * TRIGGER AUTOMÁTICO: Criação de Feedback/Comentário
 */
exports.onFeedbackCreate = onDocumentCreated(
  'ktag_feedbacks/{feedbackId}',
  async (event) => {
    const feedback = event.data.data();
    if (!feedback) return null;

    try {
      await sendNotificationToPref('newComment', {
        title: 'Novo Comentário/Feedback 💬',
        body: `${feedback.userName} enviou um novo comentário.`,
        url: '/feedback'
      }, feedback.userId);
      return { success: true };
    } catch (error) {
      console.error('Error in onFeedbackCreate trigger:', error);
      return null;
    }
  }
);

exports.sendPushNotification = onCall(
  async (request) => {

    webpush.setVapidDetails(
      "mailto:monitoramento@lockprotecao.com.br",
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    const { userId, title, body, url } = request.data;

    if (!userId || !title || !body) {
      throw new HttpsError("invalid-argument", "Missing userId, title or body");
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
