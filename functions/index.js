
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 * SECURITY ENHANCED VERSION - GEN 2
 */

const admin = require("firebase-admin");
const axios = require("axios");
const webpush = require("web-push");
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const {
  FirestoreRateLimitStore,
  createRateLimiter,
  enforceHttps,
  securityHeaders,
  validateRequest,
  auditLog
} = require("./middleware/security");

// Inicializa o Admin SDK se ainda não estiver inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const rateLimitStore = new FirestoreRateLimitStore(db);

// --- CONFIGURAÇÃO VAPID (PUSH NOTIFICATIONS) ---
// Chaves geradas: 28/01/2026
// Para regenerar: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: "BMcoYBADX62CIf3ThyaB0dyE5RlRqgADg9nUKNz19jR4IIND8P-Av4-xamj6dXCwlc3P_CU0cC8IjM-lCqG4q40",
  privateKey: "FTA9bngl0c2fcXyiUsUgznNj0T2S4yzXgONcqpXeZ8A"
};

// Initialize VAPID with try-catch to handle any configuration issues
try {
  webpush.setVapidDetails(
    "mailto:admin@ktag.com.br",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('✓ VAPID keys initialized successfully');
} catch (error) {
  console.warn('⚠️ VAPID configuration warning:', error.message);
  console.warn('Push notifications may not work. Please verify keys.');
}

// --- RATE LIMITING CONFIGURATION ---
// Distributed rate limiting using Firestore
const loginRateLimiter = createRateLimiter(rateLimitStore, {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  action: 'login'
});

const apiRateLimiter = createRateLimiter(rateLimitStore, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  action: 'api'
});

// Cleanup old rate limit entries (runs once per day)
exports.cleanupRateLimits = onSchedule('every 24 hours', async (context) => {
  await rateLimitStore.cleanup();
  console.log('Rate limit cleanup completed');
  return null;
});

// --- IN-MEMORY RATE LIMITING FOR PROXY API ---
const requestCounts = new Map();
const MAX_REQUESTS_PER_MIN = 60;
const BLOCK_DURATION_MS = 60 * 1000; // 60 seconds

/**
 * PROXY API: Contorna CORS e protege credenciais
 */
exports.proxyApi = onRequest(async (req, res) => {
    // CORS Headers
    const allowedOrigins = [
      'https://ktag-manager.web.app',
      'https://ktag-manager.firebaseapp.com',
      'https://k-tag-manager-pro-192841108882.us-west1.run.app'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
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

/**
 * TRIGGER AUTOMÁTICO: Atualização de Status de Agendamento
 * Envia notificação Push para o solicitante quando o status muda.
 */
exports.onScheduleUpdate = onDocumentUpdated('ktag_schedules/{scheduleId}', async (event) => {
  const change = event.data;
  const newData = change.after.data();
  const previousData = change.before.data();

    // Se o status não mudou, não faz nada
    if (newData.status === previousData.status) return null;

    const requesterId = newData.requesterId;
    if (!requesterId) return null;

    // Define a mensagem baseada no status
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
        return null; // Não notifica outros status
    }

    try {
      // Busca assinaturas push do usuário solicitante
      const subscriptionsSnapshot = await admin.firestore()
        .collection('ktag_push_subscriptions')
        .where('userId', '==', requesterId)
        .get();

      if (subscriptionsSnapshot.empty) {
        console.log(`User ${requesterId} has no push subscriptions.`);
        return null;
      }

      const notifications = [];
      const payload = JSON.stringify({
        title: title,
        body: body,
        url: '/', // Abre a home/app
        icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png'
      });

      subscriptionsSnapshot.forEach(doc => {
        const subscription = doc.data().subscription;
        
        const pushPromise = webpush.sendNotification(subscription, payload)
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              // Assinatura expirou, limpa do banco
              console.log(`Deleting expired subscription: ${doc.id}`);
              return doc.ref.delete();
            }
            console.error('Error sending push:', err);
          });
          
        notifications.push(pushPromise);
      });

      await Promise.all(notifications);
      console.log(`Notifications sent to user ${requesterId} for status ${status}`);
      return { success: true };

    } catch (error) {
      console.error('Error in onScheduleUpdate trigger:', error);
      return null;
    }
});

/**
 * Função Manual (Callable) para Testes ou Envios Específicos
 */
exports.sendPushNotification = onCall(async (request) => {
  const { userId, title, body, url } = request.data;

  if (!userId || !title || !body) {
    throw new Error('invalid-argument: Missing userId, title, or body');
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
    throw new Error('internal: Error sending notifications');
  }
});
