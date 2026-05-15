
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

// --- HELPERS TENANT-AWARE ---
//
// Convenção: todas as funções abaixo recebem tenantId como 1º arg. Coleções
// de domínio vivem em /tenants/{tenantId}/<entity>. push_subscriptions é a
// única coleção flat (cross-tenant) e cada doc carrega seu próprio tenantId.

async function getUserInfo(tenantId, userId) {
  if (!userId || userId === 'SYSTEM') {
    return { name: 'Sistema', email: 'system@ktag.com' };
  }
  if (!tenantId) {
    return { name: 'Usuário', email: '' };
  }
  try {
    const userDoc = await admin.firestore()
      .collection('tenants').doc(tenantId)
      .collection('users').doc(userId)
      .get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        name: data.name || 'Usuário',
        email: data.email || ''
      };
    }
  } catch (e) {
    console.error('Error fetching user info:', e);
  }
  return { name: 'Usuário', email: '' };
}

async function sendNotificationToUser(tenantId, userId, payload) {
  try {
    // push_subscriptions é flat; filtra por userId + tenantId.
    const subscriptionsSnapshot = await admin.firestore()
      .collection('push_subscriptions')
      .where('userId', '==', userId)
      .where('tenantId', '==', tenantId)
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
    console.error(`Error sending notification to user ${userId}@${tenantId}:`, error);
  }
}

async function sendNotificationToPref(tenantId, prefKey, payload, excludeUserId = null) {
  if (!tenantId) {
    console.warn('sendNotificationToPref chamado sem tenantId — abortando.');
    return;
  }
  try {
    const usersSnapshot = await admin.firestore()
      .collection('tenants').doc(tenantId)
      .collection('users').get();
    const targetUserIds = [];

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (user.id === excludeUserId) return;
      const prefs = user.notificationPreferences || {};
      // Default true se não definido (mesmo comportamento anterior).
      if (prefs[prefKey] !== false) {
        targetUserIds.push(user.id);
      }
    });

    if (targetUserIds.length === 0) return;

    // Subs do tenant inteiro (flat, filtradas por tenantId).
    const subscriptionsSnapshot = await admin.firestore()
      .collection('push_subscriptions')
      .where('tenantId', '==', tenantId)
      .get();

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
    console.error(`Error sending notification for pref ${prefKey} (${tenantId}):`, error);
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
 * Helper tenant-aware para registrar audit logs em /tenants/{tid}/audit_logs.
 * Se tenantId não estiver disponível (chamadores antigos), faz fallback em
 * /system_audit_logs (coleção de sistema usada pelo painel super admin).
 */
async function logAudit(tenantId, action, entity, details, entityId = null, userId = 'SYSTEM') {
  try {
    const userInfo = await getUserInfo(tenantId, userId);

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

    const target = tenantId
      ? admin.firestore().collection('tenants').doc(tenantId).collection('audit_logs')
      : admin.firestore().collection('system_audit_logs');
    await target.add(logEntry);
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
}

/**
 * TRIGGER AUTOMÁTICO: Criação de Agendamento
 */
exports.onScheduleCreate = onDocumentCreated(
  'tenants/{tenantId}/schedules/{scheduleId}',
  async (event) => {
    const schedule = event.data.data();
    if (!schedule) return null;
    const { tenantId, scheduleId } = event.params;

    await logAudit(
      tenantId,
      'CREATE',
      'Schedule',
      `Nova solicitação de agendamento: ${schedule.serviceType} para ${schedule.vehiclePlate}`,
      scheduleId,
      schedule.requesterId
    );

    try {
      await sendNotificationToPref(tenantId, 'newTechnicalRequest', {
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
  'tenants/{tenantId}/schedules/{scheduleId}',
  async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();
    const { tenantId, scheduleId } = event.params;

    if (!newData || !previousData) return null;

    await logAudit(tenantId, 'UPDATE', 'Schedule', `Agendamento alterado: ${newData.vehiclePlate}`, scheduleId, newData.updatedBy || 'SYSTEM');

    const status = newData.status;
    const plate = newData.vehiclePlate;

    if (status !== previousData.status) {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await logAudit(tenantId, 'UPDATE', 'Schedule', `Status alterado de "${previousData.status}" para "${status}" por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');

        await sendNotificationToPref(tenantId, 'schedulingUpdates', {
          title: 'Atualização de Agendamento 📋',
          body: `Placa ${plate}: Status alterado para "${status}" por ${updaterInfo.name}`,
          url: '/schedules'
        }, newData.updatedBy);
    }

    if (status === previousData.status) return null;

    const requesterId = newData.requesterId;
    if (!requesterId) return null;

    try {
      if (status === 'Concluída') {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await logAudit(tenantId, 'UPDATE', 'Schedule', `Agendamento concluído: ${plate} por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');

        await sendNotificationToUser(tenantId, requesterId, {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado por ${updaterInfo.name}.`,
          url: '/schedules'
        });
        await sendNotificationToPref(tenantId, 'serviceCompleted', {
          title: 'Serviço Concluído 🎉',
          body: `O serviço no veículo ${plate} foi finalizado por ${updaterInfo.name}.`,
          url: '/schedules'
        }, requesterId);
      } else if (status === 'Autorizada' || status === 'Em orçamento') {
        await sendNotificationToPref(tenantId, 'schedulingNeedsConfirmation', {
          title: 'Aguardando Confirmação ⏳',
          body: `O agendamento para ${plate} (${status}) precisa ser confirmado.`,
          url: '/schedules'
        });
      } else if (status === 'Técnico no local' || status === 'Cliente no local') {
        await sendNotificationToPref(tenantId, 'schedulingNeedsCompletion', {
          title: status === 'Cliente no local' ? 'Cliente no Local 📍' : 'Técnico no Local 📍',
          body: status === 'Cliente no local' ? `O técnico informou que o cliente chegou para o veículo ${plate}.` : `O técnico informou chegada para atender o veículo ${plate}.`,
          url: '/schedules'
        });
      } else if (status === 'Cancelada') {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await sendNotificationToUser(tenantId, requesterId, {
          title: 'Solicitação Cancelada ❌',
          body: `O serviço para ${plate} foi cancelado por ${updaterInfo.name}. Motivo: ${newData.cancellationReason || 'Não informado'}`,
          url: '/schedules'
        });
      } else if (status === 'Confirmada') {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await logAudit(tenantId, 'UPDATE', 'Schedule', `Agendamento confirmado para ${newData.confirmedDate} às ${newData.confirmedTime} por ${updaterInfo.name}`, scheduleId, newData.updatedBy || 'SYSTEM');

        await sendNotificationToUser(tenantId, requesterId, {
          title: 'Agendamento Confirmado! ✅',
          body: `Sua solicitação para a placa ${plate} foi agendada para ${newData.confirmedDate} às ${newData.confirmedTime}.`,
          url: '/schedules'
        });
      } else if (status === 'Reagendada') {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await sendNotificationToUser(tenantId, requesterId, {
          title: 'Agendamento Alterado 🕒',
          body: `Nova data/hora definida para o veículo ${plate} por ${updaterInfo.name}: ${newData.confirmedDate} às ${newData.confirmedTime}.`,
          url: '/schedules'
        });
      } else if (status === 'Em análise') {
        const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
        await sendNotificationToUser(tenantId, requesterId, {
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
  'tenants/{tenantId}/vehicles/{vehicleId}',
  async (event) => {
    const newData = event.data.after.data();
    const previousData = event.data.before.data();
    const { tenantId, vehicleId } = event.params;

    if (!newData || !previousData) return null;

    const updaterInfo = await getUserInfo(tenantId, newData.updatedBy);
    await logAudit(tenantId, 'UPDATE', 'Vehicle', `Veículo alterado: ${newData.plate} por ${updaterInfo.name}`, vehicleId, newData.updatedBy || 'SYSTEM');

    if (newData.status === 'stolen' && previousData.status !== 'stolen') {
      await logAudit(tenantId, 'REPORT', 'Vehicle', `ALERTA: Veículo marcado como roubado/furtado: ${newData.plate} por ${updaterInfo.name}`, vehicleId, newData.updatedBy || 'SYSTEM');

      try {
        await sendNotificationToPref(tenantId, 'theftRegistered', {
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
  'tenants/{tenantId}/feedbacks/{feedbackId}',
  async (event) => {
    const feedback = event.data.data();
    if (!feedback) return null;
    const { tenantId, feedbackId } = event.params;

    await logAudit(tenantId, 'CREATE', 'Feedback', `Novo feedback enviado por ${feedback.userName}: ${feedback.type}`, feedbackId, feedback.userId);

    try {
      await sendNotificationToPref(tenantId, 'newComment', {
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
 * RASTREIO AGENDADO: Atualiza equipamentos a cada 3h.
 *
 * Tenant-aware: itera /tenants/* ativos e, para cada um, lê settings/tags/vehicles
 * do PRÓPRIO tenant. Credenciais K-TAG/XADTAG nunca vazam entre tenants.
 *
 * Custo: cada tenant adiciona ~N tags * (1 req externa + 1 vehicle write).
 * 3h é confortável até ~50 tenants. Acima disso, mover para fila (Cloud Tasks).
 */
exports.scheduledTagUpdate = onSchedule("every 3 hours", async (event) => {
  const db = admin.firestore();

  let totalUpdated = 0;
  let totalTenantsProcessed = 0;

  try {
    const tenantsSnap = await db.collection('tenants').where('active', '==', true).get();
    if (tenantsSnap.empty) {
      console.log('[Scheduled Update] Nenhum tenant ativo. Encerrando.');
      return;
    }

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      try {
        const tenantUpdated = await updateTagsForTenant(db, tenantId);
        totalUpdated += tenantUpdated;
        totalTenantsProcessed++;
      } catch (e) {
        console.error(`[Scheduled Update] tenant=${tenantId} falhou:`, e.message);
      }
    }

    console.log(`[Scheduled Update] ${totalUpdated} veículos atualizados em ${totalTenantsProcessed} tenants.`);
  } catch (error) {
    console.error('Critical error in scheduledTagUpdate:', error);
  }
});

async function updateTagsForTenant(db, tenantId) {
  const tenantRef = db.collection('tenants').doc(tenantId);

  // 1. Settings do tenant — credenciais K-TAG/XADTAG isoladas.
  const settingsDoc = await tenantRef.collection('settings').doc('config').get();
  if (!settingsDoc.exists) {
    console.log(`[${tenantId}] settings/config ausente — pulando.`);
    return 0;
  }
  const settings = settingsDoc.data();

  // 2. Tags do tenant.
  const tagsSnapshot = await tenantRef.collection('tags').get();
  if (tagsSnapshot.empty) {
    return 0;
  }
  const allTags = [];
  tagsSnapshot.forEach(doc => allTags.push({ ...doc.data(), id: doc.id }));

  console.log(`[${tenantId}] Atualizando ${allTags.length} tags`);

  let updatedCount = 0;
  for (const tag of allTags) {
    try {
      let locationResult = null;
      if (tag.type === 'XADTAG') {
        if (!settings.traqcareToken) continue;
        locationResult = await fetchXadtagLocation(tag, settings);
      } else {
        if (!settings.ktagUrl || !settings.ktagUser) continue;
        locationResult = await fetchKtagLocation(tag, settings);
      }

      if (locationResult) {
        const vehiclesSnapshot = await tenantRef
          .collection('vehicles')
          .where('tagId', '==', tag.id)
          .limit(1)
          .get();

        if (!vehiclesSnapshot.empty) {
          const vehicleDoc = vehiclesSnapshot.docs[0];
          await vehicleDoc.ref.update({ lastPosition: locationResult });

          await vehicleDoc.ref.collection('history')
            .doc(locationResult.id || Math.random().toString(36).substring(2, 15))
            .set({
              ...locationResult,
              tagId: tag.id,
              vehicleId: vehicleDoc.id,
              tenantId,
              savedAt: Date.now()
            });

          updatedCount++;
        }
      }

      // Throttle 2s entre requests externos (rate-limit das APIs K-TAG/XADTAG).
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`[${tenantId}] tag ${tag.accessoryId || tag.traqcareId} falhou:`, error.message);
    }
  }

  return updatedCount;
}

// ============================================================
// Multi-tenant: sync de custom claims + admin user provisioning
// ============================================================

/**
 * Sincroniza customClaims do Firebase Auth com o doc do usuário no tenant.
 * Roda em CREATE e UPDATE de /tenants/{tenantId}/users/{uid}.
 *
 * Por que precisa: as Firestore Rules e qualquer middleware server-side
 * usam request.auth.token.tenantId / token.role como atalho barato (sem
 * get() do user doc a cada read). Este trigger mantém o token sincronizado
 * com o estado canônico do banco.
 */
async function syncUserClaims(uid, tenantId, role, status) {
  if (!uid || !tenantId) return;
  try {
    const isApproved = status === 'approved';
    await admin.auth().setCustomUserClaims(uid, {
      tenantId,
      role: role || 'user',
      approved: isApproved,
    });
  } catch (e) {
    console.error('Falha ao setar customClaims', { uid, tenantId, role, error: e.message });
  }
}

exports.onTenantUserCreate = onDocumentCreated(
  'tenants/{tenantId}/users/{uid}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;
    await syncUserClaims(event.params.uid, event.params.tenantId, data.role, data.status);
    await logAudit(event.params.tenantId, 'CREATE', 'User', `Usuário provisionado: ${data.email}`, event.params.uid, data.id || 'SYSTEM');
    return null;
  }
);

exports.onTenantUserUpdate = onDocumentUpdated(
  'tenants/{tenantId}/users/{uid}',
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after) return null;

    const roleChanged = before?.role !== after.role;
    const statusChanged = before?.status !== after.status;
    if (roleChanged || statusChanged) {
      await syncUserClaims(event.params.uid, event.params.tenantId, after.role, after.status);
      await logAudit(
        event.params.tenantId,
        'UPDATE',
        'User',
        `Permissões atualizadas: role=${after.role}, status=${after.status}`,
        event.params.uid,
        after.updatedBy || 'SYSTEM'
      );
    }
    return null;
  }
);

/**
 * Resolve quem é o caller e em que tenant ele está, validando que é admin
 * daquele tenant. Throws HttpsError se não autorizado.
 */
async function requireTenantAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login obrigatório.');
  }
  const callerUid = request.auth.uid;
  const tenantId = request.data?.tenantId || request.auth.token?.tenantId;
  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'tenantId não informado.');
  }
  const callerDocRef = admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(callerUid);
  const snap = await callerDocRef.get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Usuário não pertence a este tenant.');
  }
  const data = snap.data();
  if (!['admin', 'admin_tecnico', 'superadmin'].includes(data.role)) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar esta operação.');
  }
  return { tenantId, callerUid };
}

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%';
  let result = '';
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Admin do tenant cria um novo usuário (Auth + doc) com senha temporária.
 * Retorna { uid, email, password } — frontend exibe e envia ao colaborador.
 */
exports.createTenantUser = onCall(async (request) => {
  const { tenantId } = await requireTenantAdmin(request);

  const { email, name, role, customRoleId, cpf, phone, pixKey, technicianId } = request.data || {};
  if (!email || !name) {
    throw new HttpsError('invalid-argument', 'email e name são obrigatórios.');
  }
  const cleanEmail = String(email).toLowerCase().trim();
  const password = generateRandomPassword();

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password,
      displayName: name,
    });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Já existe uma conta com este e-mail.');
    }
    throw new HttpsError('internal', `Falha ao criar usuário: ${e.message}`);
  }

  const uid = userRecord.uid;
  const userDoc = {
    id: uid,
    email: cleanEmail,
    name, // O frontend criptografa name antes do write em fluxo normal, mas aqui
          // é escrito em texto e o trigger onTenantUserCreate ainda assim funciona
          // pois apenas lê role/status. UI deve criptografar via updateProfile
          // logo após onboarding ou o admin deve editar e re-salvar.
          // TODO: mover criptografia para Cloud Function (admin SDK) — requer
          // chave por tenant em Secret Manager. Fora de escopo Fase 2.
    role: role || 'user',
    status: 'approved',
    tenantId,
    customRoleId: customRoleId || undefined,
    cpf: cpf || undefined,
    phone: phone || undefined,
    pixKey: pixKey || undefined,
    technicianId: technicianId || undefined,
    createdAt: Date.now(),
  };
  Object.keys(userDoc).forEach((k) => userDoc[k] === undefined && delete userDoc[k]);

  await admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(uid).set(userDoc);

  // syncUserClaims roda via trigger, mas chamamos aqui para garantir que o token
  // já esteja válido caso o admin precise impersonate em seguida.
  await syncUserClaims(uid, tenantId, userDoc.role, userDoc.status);

  await logAudit(tenantId, 'CREATE', 'User', `Admin criou usuário ${cleanEmail} (${userDoc.role})`, uid, request.auth.uid);

  return { uid, email: cleanEmail, password };
});

/**
 * Admin do tenant reseta a senha de um usuário do mesmo tenant.
 */
exports.resetTenantUserPassword = onCall(async (request) => {
  const { tenantId } = await requireTenantAdmin(request);
  const { userId } = request.data || {};
  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId é obrigatório.');
  }

  const targetSnap = await admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(userId).get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Usuário não encontrado neste tenant.');
  }

  const password = generateRandomPassword();
  try {
    await admin.auth().updateUser(userId, { password });
  } catch (e) {
    throw new HttpsError('internal', `Falha ao atualizar senha: ${e.message}`);
  }

  await logAudit(tenantId, 'UPDATE', 'User', `Admin resetou senha de ${targetSnap.data().email}`, userId, request.auth.uid);

  return { userId, email: targetSnap.data().email, password };
});

/**
 * Admin do tenant remove um usuário (Auth + doc).
 */
exports.deleteTenantUser = onCall(async (request) => {
  const { tenantId, callerUid } = await requireTenantAdmin(request);
  const { userId } = request.data || {};
  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId é obrigatório.');
  }
  if (userId === callerUid) {
    throw new HttpsError('failed-precondition', 'Você não pode excluir sua própria conta.');
  }
  try {
    await admin.auth().deleteUser(userId);
  } catch (e) {
    // Se o usuário já não existe no Auth, segue para apagar o doc.
    if (e.code !== 'auth/user-not-found') {
      console.warn('deleteUser auth error:', e.message);
    }
  }
  await admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(userId).delete();
  await logAudit(tenantId, 'DELETE', 'User', `Admin removeu usuário ${userId}`, userId, callerUid);
  return { ok: true };
});

exports.sendPushNotification = onCall(
  async (request) => {

    webpush.setVapidDetails(
      "mailto:monitoramento@lockprotecao.com.br",
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login obrigatório.');
    }

    const tenantId = request.data?.tenantId || request.auth.token?.tenantId;
    if (!tenantId) {
      throw new HttpsError('invalid-argument', 'tenantId não informado.');
    }

    const { userId, title, body, url } = request.data;
    if (!userId || !title || !body) {
      throw new HttpsError("invalid-argument", "Missing userId, title or body");
    }

    try {
      // Filtra por tenantId para evitar push de um tenant para outro.
      const subscriptionsSnapshot = await admin.firestore()
        .collection('push_subscriptions')
        .where('userId', '==', userId)
        .where('tenantId', '==', tenantId)
        .get();

      if (subscriptionsSnapshot.empty) {
        return { success: false, message: 'User has no push subscriptions' };
      }

      const notifications = [];
      const payload = JSON.stringify({
        title,
        body,
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
