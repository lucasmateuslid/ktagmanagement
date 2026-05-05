
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

async function getUserInfo(userId) {
  if (!userId || userId === 'SYSTEM') {
    return { name: 'Sistema', email: 'system@ktag.com' };
  }
  try {
    const userDoc = await admin.firestore().collection('ktag_users_db').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return { 
        name: data.name || 'Usuário', 
        email: data.email || '' 
      };
    }
  } catch (e) {
    console.error("Error fetching user info:", e);
  }
  return { name: 'Usuário', email: '' };
}

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
    const usersSnapshot = await admin.firestore().collection('ktag_users_db').get();
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
const MAX_REQUESTS_PER_MIN = 300; 

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
 * Helper para registrar logs de auditoria no Firestore
 */
async function logAudit(action, entity, details, entityId = null, userId = 'SYSTEM') {
  try {
    const userInfo = await getUserInfo(userId);

    const logEntry = {
      id: Math.random().toString(36).substring(2, 15),
      userId,
      userName: userInfo.name,
      userEmail: userInfo.email,
      action,
      entity,
      entityId,
      details,
      timestamp: Date.now()
    };

    await admin.firestore().collection('ktag_audit_logs').add(logEntry);
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
}

/**
 * TRIGGER AUTOMÁTICO: Criação de Agendamento
 */
exports.onScheduleCreate = onDocumentCreated(
  'ktag_schedules/{scheduleId}',
  async (event) => {
    const schedule = event.data.data();
    if (!schedule) return null;
    const scheduleId = event.params.scheduleId;

    // Auditoria
    await logAudit('CREATE', 'Schedule', `Nova solicitação de agendamento: ${schedule.serviceType} para ${schedule.vehiclePlate}`, scheduleId, schedule.requesterId);

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
    const scheduleId = event.params.scheduleId;

    if (!newData || !previousData) return null;

    // Auditoria geral de alteração
    await logAudit('UPDATE', 'Schedule', `Agendamento alterado: ${newData.vehiclePlate}`, scheduleId, newData.updatedBy || 'SYSTEM');

    // Auditoria de mudança de status
    if (newData.status !== previousData.status) {
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await logAudit('UPDATE', 'Schedule', `Status alterado de "${previousData.status}" para "${newData.status}" por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');
        
        // Notifica administradores sobre qualquer mudança de status importante
        await sendNotificationToPref('schedulingUpdates', {
          title: 'Atualização de Agendamento 📋',
          body: `Placa ${plate}: Status alterado para "${status}" por ${updaterInfo.name}`,
          url: '/schedules'
        }, newData.updatedBy);
    }

    if (newData.status === previousData.status) return null;

    const requesterId = newData.requesterId;
    if (!requesterId) return null;

    const status = newData.status;
    const plate = newData.vehiclePlate;

    try {
      if (status === 'Concluída') {
        // Auditoria de conclusão
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await logAudit('UPDATE', 'Schedule', `Agendamento concluído: ${plate} por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');

        await sendNotificationToUser(requesterId, {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado por ${updaterInfo.name}.`,
          url: '/schedules'
        });
        await sendNotificationToPref('serviceCompleted', {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado por ${updaterInfo.name}.`,
          url: '/schedules'
        }, requesterId);
      } else if (status === 'Autorizada' || status === 'Em orçamento') {
        await sendNotificationToPref('schedulingNeedsConfirmation', {
          title: 'Aguardando Confirmação ⏳',
          body: `O agendamento para ${plate} (${status}) precisa ser confirmado.`,
          url: '/schedules'
        });
      } else if (status === 'Técnico no local' || status === 'Cliente no local') {
        await sendNotificationToPref('schedulingNeedsCompletion', {
          title: status === 'Cliente no local' ? 'Cliente no Local 📍' : 'Técnico no Local 📍',
          body: status === 'Cliente no local' ? `O técnico informou que o cliente chegou para o veículo ${plate}.` : `O técnico informou chegada para atender o veículo ${plate}.`,
          url: '/schedules'
        });
      } else if (status === 'Cancelada') {
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await sendNotificationToUser(requesterId, {
          title: 'Solicitação Cancelada ❌',
          body: `O serviço para ${plate} foi cancelado por ${updaterInfo.name}. Motivo: ${newData.cancellationReason || 'Não informado'}`,
          url: '/schedules'
        });
      } else if (status === 'Confirmada') {
        // Auditoria de confirmação
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await logAudit('UPDATE', 'Schedule', `Agendamento confirmado para ${newData.confirmedDate} às ${newData.confirmedTime} por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');

        await sendNotificationToUser(requesterId, {
          title: 'Agendamento Confirmado! ✅',
          body: `Sua solicitação para a placa ${plate} foi agendada para ${newData.confirmedDate} às ${newData.confirmedTime}.`,
          url: '/schedules'
        });
      } else if (status === 'Reagendada') {
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await sendNotificationToUser(requesterId, {
          title: 'Agendamento Alterado 🕒',
          body: `Nova data/hora definida para o veículo ${plate} por ${updaterInfo.name}: ${newData.confirmedDate} às ${newData.confirmedTime}.`,
          url: '/schedules'
        });
      } else if (status === 'Em análise') {
        const updaterInfo = await getUserInfo(newData.updatedBy);
        await sendNotificationToUser(requesterId, {
          title: 'Em Análise 🔍',
          body: `${updaterInfo.name} está analisando sua solicitação para ${plate}.`,
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
    const vehicleId = event.params.vehicleId;

    if (!newData || !previousData) return null;

    // Auditoria geral de alteração
    const updaterInfo = await getUserInfo(newData.updatedBy);
    await logAudit('UPDATE', 'Vehicle', `Veículo alterado: ${newData.plate} por ${updaterInfo.name}`, vehicleId, newData.updatedBy || 'SYSTEM');

    if (newData.status === 'stolen' && previousData.status !== 'stolen') {
      // Auditoria de sinistro
      await logAudit('REPORT', 'Vehicle', `ALERTA: Veículo marcado como roubado/furtado: ${newData.plate} por ${updaterInfo.name}`, vehicleId, newData.updatedBy || 'SYSTEM');

      try {
        await sendNotificationToPref('theftRegistered', {
          title: '🚨 Roubo Cadastrado',
          body: `O veículo ${newData.plate} foi marcado como roubado por ${updaterInfo.name}!`,
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
    const feedbackId = event.params.feedbackId;

    // Auditoria
    await logAudit('CREATE', 'Feedback', `Novo feedback enviado por ${feedback.userName}: ${feedback.type}`, feedbackId, feedback.userId);

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

// --- HELPERS PARA RASTREIO AGENDADO ---

const ktagBatteryStatus = (status) => {
  // API K-TAG: 0=Normal, 3=Muito baixo
  switch (status) {
    case 0: return { level: 100, label: 'Normal', color: '#10b981' };
    case 1: return { level: 60, label: 'Médio', color: '#eab308' };
    case 2: return { level: 30, label: 'Baixo', color: '#f97316' };
    case 3: return { level: 10, label: 'Muito baixo', color: '#ef4444' };
    default: return { level: 0, label: 'Desconhecido', color: '#71717a' };
  }
};

const xadtagBatteryToInfo = (battery) => {
  // API XADTAG (Traqcare): 0=Normal, 3=Muito baixo (mesma semântica do K-TAG)
  switch (battery) {
    case 0: return { level: 100, label: 'Alto', color: '#10b981' };
    case 1: return { level: 60, label: 'Médio', color: '#eab308' };
    case 2: return { level: 30, label: 'Baixo', color: '#f97316' };
    case 3: return { level: 10, label: 'Crítico', color: '#ef4444' };
    default: return { level: 0, label: 'N/A', color: '#71717a' };
  }
};

async function fetchKtagLocation(tag, settings) {
  const payload = {
    accessoryId: tag.accessoryId,
    hashed_keys: [tag.hashedAdvKey],
    priv_keys: [tag.privateKey]
  };

  const authHeader = `Basic ${Buffer.from(`${settings.ktagUser}:${settings.ktagPass}`).toString('base64')}`;
  
  try {
    const response = await axios({
      url: settings.ktagUrl,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': authHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      data: payload,
      timeout: 20000
    });

    if (response.data && Array.isArray(response.data.results) && response.data.results.length > 0) {
      const p = response.data.results[0];
      return {
        id: Math.random().toString(36).substring(2, 15),
        tagId: tag.id,
        lat: p.lat,
        lon: p.lon,
        conf: p.conf,
        status: p.status,
        battery: ktagBatteryStatus(p.status),
        timestamp: p.timestamp,
        isodatetime: p.isodatetime
      };
    }
  } catch (e) {
    console.error(`K-Tag API Error for ${tag.accessoryId}:`, e.message);
  }
  return null;
}

async function fetchXadtagLocation(tag, settings) {
  if (!tag.traqcareId || !settings.traqcareToken) return null;

  try {
    const response = await axios({
      url: `http://www.brgps.com/open/tag?ids=${tag.traqcareId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api_token': settings.traqcareToken,
        'timestamp': Math.floor(Date.now() / 1000).toString(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });

    if (response.data && response.data.statusCode === 200 && Array.isArray(response.data.data) && response.data.data.length > 0) {
      const loc = response.data.data[0];
      return {
        id: Math.random().toString(36).substring(2, 15),
        tagId: tag.id,
        lat: loc.lat ?? 0,
        lon: loc.lng ?? 0,
        conf: 100,
        status: 1,
        battery: xadtagBatteryToInfo(loc.battery),
        timestamp: loc.timestamp * 1000,
        isodatetime: new Date(loc.timestamp * 1000).toISOString()
      };
    }
  } catch (e) {
    console.error(`XADTAG API Error for ${tag.traqcareId}:`, e.message);
  }
  return null;
}

/**
 * RASTREIO AGENDADO: Atualiza todos os equipamentos a cada 3 horas
 */
exports.scheduledTagUpdate = onSchedule("every 3 hours", async (event) => {
  const db = admin.firestore();
  
  try {
    // 1. Get Settings
    const settingsDoc = await db.collection('ktag_settings_v3').doc('config').get();
    if (!settingsDoc.exists) {
      console.warn("Settings not found. Skipping scheduled update.");
      return;
    }
    const settings = settingsDoc.data();
    
    // 2. Get All Tags
    const tagsSnapshot = await db.collection('ktag_tags').get();
    const allTags = [];
    tagsSnapshot.forEach(doc => allTags.push({ ...doc.data(), id: doc.id }));
    
    if (allTags.length === 0) {
      console.log("No tags found to update.");
      return;
    }
    
    console.log(`[Scheduled Update] Updating ${allTags.length} tags`);
    
    // 3. Fetch and Update all tags
    let updatedCount = 0;
    for (const tag of allTags) {
      try {
        let locationResult = null;
        
        if (tag.type === 'XADTAG') {
          locationResult = await fetchXadtagLocation(tag, settings);
        } else {
          locationResult = await fetchKtagLocation(tag, settings);
        }
        
        if (locationResult) {
          // Find vehicle associated with this tag
          const vehiclesSnapshot = await db.collection('ktag_vehicles')
            .where('tagId', '==', tag.id)
            .limit(1)
            .get();
            
          if (!vehiclesSnapshot.empty) {
            const vehicleDoc = vehiclesSnapshot.docs[0];
            await vehicleDoc.ref.update({ lastPosition: locationResult });
            
            // Add to history subcollection
            await vehicleDoc.ref.collection('history').doc(locationResult.id || Math.random().toString(36).substring(2, 15)).set({
                ...locationResult,
                tagId: tag.id,
                vehicleId: vehicleDoc.id,
                savedAt: Date.now()
            });

            updatedCount++;
          }
        }
        
        // Delay de 2 segundos entre requisições para evitar 429
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error updating tag ${tag.accessoryId || tag.traqcareId}:`, error.message);
      }
    }
    
    console.log(`[Scheduled Update] Successfully updated ${updatedCount} vehicles.`);
    
  } catch (error) {
    console.error('Critical error in scheduledTagUpdate:', error);
  }
});

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
