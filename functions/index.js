
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");
const dns = require("node:dns").promises;
const net = require("node:net");
const asaas = require("./asaas");

// ---------- SSRF GUARD (mirror do server.ts) ----------
const PROXY_ALLOWED_HOSTS = new Set(
  (process.env.PROXY_ALLOWED_HOSTS || '')
    .split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
);
function _isPrivateIPv4(ip) {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}
function _isPrivateIPv6(ip) {
  const low = String(ip).toLowerCase();
  if (low === '::1' || low === '::') return true;
  if (low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd')) return true;
  if (low.startsWith('::ffff:')) {
    const v4 = low.slice('::ffff:'.length);
    if (net.isIPv4(v4)) return _isPrivateIPv4(v4);
  }
  return false;
}
async function assertProxyTargetAllowed(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('URL inválida.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`Protocolo não permitido: ${u.protocol}`);
  if (u.username || u.password) throw new Error('URL com credenciais embutidas não é permitida.');
  const host = u.hostname.toLowerCase();
  if (PROXY_ALLOWED_HOSTS.size > 0) {
    const ok = [...PROXY_ALLOWED_HOSTS].some(h => host === h || host.endsWith('.' + h));
    if (!ok) throw new Error(`Host não permitido: ${host}`);
  }
  if (['metadata.google.internal', 'metadata', 'instance-data', 'metadata.goog'].includes(host)) {
    throw new Error('Host de metadados bloqueado.');
  }
  if (net.isIP(host)) {
    if (net.isIPv4(host) ? _isPrivateIPv4(host) : _isPrivateIPv6(host)) {
      throw new Error(`IP privado/reservado bloqueado: ${host}`);
    }
    return u;
  }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error(`Falha ao resolver host: ${host}`); }
  for (const a of (Array.isArray(addrs) ? addrs : [addrs])) {
    const bad = a.family === 6 ? _isPrivateIPv6(a.address) : _isPrivateIPv4(a.address);
    if (bad) throw new Error(`Host resolve para IP privado/reservado (${a.address}).`);
  }
  return u;
}

// Secrets — set with: firebase functions:secrets:set <NAME>
const ASAAS_API_KEY = defineSecret("ASAAS_API_KEY");
const ASAAS_WEBHOOK_TOKEN = defineSecret("ASAAS_WEBHOOK_TOKEN");
// VAPID keys também via Secret Manager. Configurar com:
//   firebase functions:secrets:set VAPID_PUBLIC_KEY
//   firebase functions:secrets:set VAPID_PRIVATE_KEY
const VAPID_PUBLIC_KEY = defineSecret("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
// CORS: em produção, só aceita ktagfinder.app e seus subdomínios.
// Localhost continua liberado para dev. server-to-server (sem origin) também.
// Override via ALLOWED_ORIGIN_OVERRIDE=true mantém compat com integrações
// pontuais (ex.: testes manuais) — usar com cuidado.
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)?ktagfinder\.app$/;
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (process.env.ALLOWED_ORIGIN_OVERRIDE === 'true') return cb(null, true);
    if (ALLOWED_ORIGIN_PATTERN.test(origin)) return cb(null, true);
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return cb(null, true);
    }
    return cb(new Error(`Origin não permitida: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'api_token', 'timestamp', 'Authorization', 'x-goog-api-key', 'x-goog-api-client', 'x-goog-user-project']
};
const cors = require("cors")(corsOptions);
const webpush = require("web-push");

// Inicializa o Admin SDK se ainda não estiver inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}
// Aceitar `undefined` em writes do Firestore como "campo ausente" em vez de erro.
admin.firestore().settings({ ignoreUndefinedProperties: true });

// --- CONFIGURAÇÃO VAPID (PUSH NOTIFICATIONS) ---
// Chaves VAPID vêm do Secret Manager. Funções que enviam push devem declarar
// { secrets: VAPID_SECRETS } e chamar configureWebPush() antes de usar webpush.
// Why: a chave PRIVADA NUNCA pode ficar no source — quem tem a privada pode
// enviar push como se fosse a aplicação, fazendo phishing direto no usuário.
const VAPID_SECRETS = [VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY];
let _vapidConfigured = false;
function configureWebPush() {
  if (_vapidConfigured) return;
  const pub = VAPID_PUBLIC_KEY.value();
  const priv = VAPID_PRIVATE_KEY.value();
  if (!pub || !priv) {
    console.warn("VAPID secrets ausentes — push notifications desabilitadas.");
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || "mailto:admin@ktag.com.br",
    pub,
    priv,
  );
  _vapidConfigured = true;
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
    configureWebPush();
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
    configureWebPush();
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

/**
 * Constrói o payload de push para eventos de billing.
 * Retorna null para eventos que não merecem notificação.
 */
function buildBillingPushPayload(event, payment) {
  const raw = Number(payment.value || 0);
  const value = raw > 0
    ? `R$ ${raw.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';
  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
      return {
        title: 'Pagamento confirmado',
        body: value ? `Recebemos o pagamento de ${value}.` : 'Seu pagamento foi confirmado.',
        url: '/#/billing',
      };
    case 'PAYMENT_OVERDUE':
      return {
        title: 'Fatura em atraso',
        body: value
          ? `Há uma fatura de ${value} em aberto. Regularize para evitar suspensão.`
          : 'Você tem uma fatura em atraso.',
        url: '/#/billing',
      };
    case 'PAYMENT_CREATED':
      return {
        title: 'Nova fatura disponível',
        body: value ? `Uma nova fatura de ${value} foi gerada.` : 'Uma nova fatura está disponível.',
        url: '/#/billing',
      };
    default:
      return null;
  }
}

/**
 * Envia push apenas para usuários admin/admin_tecnico do tenant que não
 * desativaram a preferência 'billingUpdates'.
 *
 * Não lança exceção — falha silenciosa para não bloquear o webhook.
 */
async function sendBillingPushToAdmins(tenantId, payload) {
  if (!tenantId || !payload) return;
  try {
    configureWebPush();
    const usersSnap = await admin.firestore()
      .collection('tenants').doc(tenantId)
      .collection('users')
      .where('role', 'in', ['admin', 'admin_tecnico'])
      .get();

    const targetIds = [];
    usersSnap.forEach(doc => {
      const user = doc.data();
      const prefs = user.notificationPreferences || {};
      if (prefs.billingUpdates !== false) targetIds.push(user.id);
    });

    if (targetIds.length === 0) return;

    const subsSnap = await admin.firestore()
      .collection('push_subscriptions')
      .where('tenantId', '==', tenantId)
      .get();

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/#/billing',
      icon: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
    });

    const sends = [];
    subsSnap.forEach(doc => {
      if (!targetIds.includes(doc.data().userId)) return;
      const sub = doc.data().subscription;
      sends.push(
        webpush.sendNotification(sub, pushPayload).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) return doc.ref.delete();
        })
      );
    });

    await Promise.all(sends);
  } catch (e) {
    console.error(`sendBillingPushToAdmins(${tenantId}):`, e);
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
    const { url, method, headers, body } = req.body || {};

    if (!url || typeof url !== 'string') {
      res.status(400).send({ error: "Missing 'url' in request body" });
      return;
    }
    if (url.length > 2048) {
      res.status(400).send({ error: "URL muito longa." });
      return;
    }

    // SSRF guard: bloqueia metadata, loopback, RFC1918, link-local, ULA + DNS rebinding.
    let target;
    try { target = await assertProxyTargetAllowed(url); }
    catch (e) {
      console.warn('[Proxy] target rejected:', e.message, 'url=', url);
      res.status(403).send({ error: `Proxy bloqueado: ${e.message}` });
      return;
    }

    const ALLOWED = new Set([
      'authorization', 'content-type', 'accept', 'apikey', 'api_token',
      'timestamp', 'user-agent', 'x-api-key',
    ]);
    const safeHeaders = {};
    if (headers && typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers)) {
        if (ALLOWED.has(k.toLowerCase()) && typeof v === 'string') safeHeaders[k] = v;
      }
    }
    if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
      safeHeaders['User-Agent'] = process.env.PROXY_USER_AGENT || 'KTagManagerPro-Proxy/1.0';
    }
    const safeMethod = (typeof method === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD)$/i.test(method))
      ? method.toUpperCase() : 'GET';

    try {
      const response = await axios({
        url: target.toString(),
        method: safeMethod,
        headers: safeHeaders,
        data: (safeMethod === 'GET' || safeMethod === 'HEAD') ? undefined : (body || undefined),
        validateStatus: () => true,
        timeout: 15000,
        maxRedirects: 0,                  // não seguir redirects (mitiga SSRF via Location)
        maxContentLength: 5 * 1024 * 1024, // 5MB
        maxBodyLength: 1 * 1024 * 1024,    // 1MB
      });
      res.status(response.status).send(response.data);
    } catch (error) {
      console.error("[Proxy Error]", error.message);
      const status = error.response ? error.response.status : 502;
      const message = error.response ? error.response.data : error.message;
      let errorMsg = message;
      if (typeof message === 'object') {
        try { errorMsg = JSON.stringify(message); } catch (e) { errorMsg = String(message); }
      }
      res.status(status).json({ error: errorMsg, proxyError: true });
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
  { document: 'tenants/{tenantId}/schedules/{scheduleId}', secrets: VAPID_SECRETS },
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
  { document: 'tenants/{tenantId}/schedules/{scheduleId}', secrets: VAPID_SECRETS },
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
  { document: 'tenants/{tenantId}/vehicles/{vehicleId}', secrets: VAPID_SECRETS },
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
  { document: 'tenants/{tenantId}/feedbacks/{feedbackId}', secrets: VAPID_SECRETS },
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
  // CSPRNG via Node crypto. Math.random() é previsível e NÃO deve ser usado
  // para gerar senhas/tokens — qualquer dump de timing aproximado revela a sementinha.
  const { randomInt } = require('node:crypto');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#$%';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(randomInt(0, chars.length));
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

// ============================================================
// SUPER ADMIN (Fase 4)
// ============================================================

async function requireSuperAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login obrigatório.');
  }
  const uid = request.auth.uid;
  const snap = await admin.firestore().collection('system_admins').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'Acesso restrito a super administradores.');
  }
  return { uid };
}

const RESERVED_TENANT_SLUGS = ['admin', 'api', 'www', 'mail', 'ftp', 'static', 'cdn', 'auth', 'app', 'system', 'root', 'localhost'];
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return 'Slug obrigatório.';
  if (!SLUG_REGEX.test(slug)) return 'Slug deve ter 3-32 caracteres: letras minúsculas, números e hífens.';
  if (RESERVED_TENANT_SLUGS.includes(slug)) return `Slug "${slug}" é reservado.`;
  return null;
}

/**
 * Cria um novo tenant + opcional admin inicial (Auth user + doc).
 * Retorna { slug, ownerEmail?, ownerPassword? } se ownerEmail foi passado.
 */
exports.createTenant = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug, name, plan = 'basic', active = true, ownerEmail, ownerName } = request.data || {};

  const slugError = validateSlug(slug);
  if (slugError) throw new HttpsError('invalid-argument', slugError);
  if (!name) throw new HttpsError('invalid-argument', 'name é obrigatório.');

  const tenantRef = admin.firestore().collection('tenants').doc(slug);

  try {
    const existing = await tenantRef.get();
    if (existing.exists) {
      throw new HttpsError('already-exists', `Tenant "${slug}" já existe.`);
    }

    await tenantRef.set({
      id: slug,
      name,
      slug,
      plan,
      active,
      createdAt: Date.now(),
      settings: { maxUsers: 10, features: [], integrations: {} },
    });

    await tenantRef.collection('settings').doc('config').set(
      { language: 'pt', customAppName: name },
      { merge: true }
    );

    let ownerPassword = null;
    let ownerUid = null;
    if (ownerEmail) {
      const cleanEmail = String(ownerEmail).toLowerCase().trim();
      ownerPassword = generateRandomPassword();
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(cleanEmail);
        try {
          await admin.auth().updateUser(userRecord.uid, { password: ownerPassword });
        } catch (e) {
          console.error('[createTenant] updateUser falhou', { uid: userRecord.uid, code: e.code, message: e.message });
          throw new HttpsError('internal', `Falha ao atualizar senha do admin existente: ${e.message}`);
        }
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        if (e.code !== 'auth/user-not-found') {
          console.error('[createTenant] getUserByEmail falhou', { email: cleanEmail, code: e.code, message: e.message });
          throw new HttpsError('internal', `Falha ao buscar email no Auth: ${e.message}`);
        }
        try {
          userRecord = await admin.auth().createUser({
            email: cleanEmail,
            password: ownerPassword,
            displayName: ownerName || cleanEmail,
          });
        } catch (ce) {
          console.error('[createTenant] createUser falhou', { email: cleanEmail, code: ce.code, message: ce.message });
          if (ce.code === 'auth/invalid-email') {
            throw new HttpsError('invalid-argument', 'Email do admin inválido.');
          }
          if (ce.code === 'auth/weak-password') {
            throw new HttpsError('invalid-argument', 'Senha gerada não atende aos requisitos do Firebase.');
          }
          throw new HttpsError('internal', `Falha ao criar admin no Auth: ${ce.message}`);
        }
      }
      ownerUid = userRecord.uid;
      try {
        await admin.auth().setCustomUserClaims(ownerUid, { tenantId: slug, role: 'admin', approved: true });
      } catch (e) {
        console.error('[createTenant] setCustomUserClaims falhou', { uid: ownerUid, code: e.code, message: e.message });
        throw new HttpsError('internal', `Falha ao setar claims do admin: ${e.message}`);
      }
      await tenantRef.collection('users').doc(ownerUid).set({
        id: ownerUid,
        name: ownerName || cleanEmail,
        email: cleanEmail,
        role: 'admin',
        status: 'approved',
        tenantId: slug,
        createdAt: Date.now(),
      });
      await tenantRef.update({ ownerUserId: ownerUid });
    }

    await logAudit(null, 'CREATE', 'Tenant', `Super admin criou tenant ${slug} (${plan})`, slug, callerUid);

    return { slug, ownerEmail: ownerEmail || null, ownerPassword, ownerUid };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[createTenant] erro não-tratado', { slug, code: e?.code, message: e?.message, stack: e?.stack });
    throw new HttpsError('internal', `Falha ao criar tenant: ${e?.message || 'erro desconhecido'}`);
  }
});

/**
 * Ativa/desativa um tenant. Não apaga dados.
 */
exports.setTenantActive = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug, active } = request.data || {};
  if (!slug || typeof active !== 'boolean') {
    throw new HttpsError('invalid-argument', 'slug e active são obrigatórios.');
  }
  try {
    const ref = admin.firestore().collection('tenants').doc(slug);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);

    await ref.update({ active });
    await logAudit(null, 'UPDATE', 'Tenant', `Super admin ${active ? 'ativou' : 'desativou'} tenant ${slug}`, slug, callerUid);
    return { slug, active };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error('[setTenantActive] erro não-tratado', { slug, active, code: e?.code, message: e?.message, stack: e?.stack });
    throw new HttpsError('internal', `Falha ao alterar status do tenant: ${e?.message || 'erro desconhecido'}`);
  }
});

/**
 * Atualiza metadata do tenant (nome, plano).
 */
exports.updateTenant = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug, name, plan, settings } = request.data || {};
  if (!slug) throw new HttpsError('invalid-argument', 'slug é obrigatório.');

  const ref = admin.firestore().collection('tenants').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (plan !== undefined) patch.plan = plan;
  if (settings !== undefined) patch.settings = settings;
  if (Object.keys(patch).length === 0) {
    return { slug, changed: false };
  }
  await ref.update(patch);
  await logAudit(null, 'UPDATE', 'Tenant', `Super admin atualizou tenant ${slug}: ${Object.keys(patch).join(', ')}`, slug, callerUid);
  return { slug, changed: true };
});

/**
 * Adiciona um usuário ao system_admins. Caller precisa ser superadmin.
 * O target user precisa já existir em Firebase Auth (passar uid OU email).
 */
exports.addSystemAdmin = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { uid, email } = request.data || {};
  if (!uid && !email) {
    throw new HttpsError('invalid-argument', 'uid OU email é obrigatório.');
  }
  let targetUid = uid;
  if (!targetUid && email) {
    try {
      const rec = await admin.auth().getUserByEmail(email.toLowerCase().trim());
      targetUid = rec.uid;
    } catch (e) {
      throw new HttpsError('not-found', 'Usuário não encontrado no Firebase Auth.');
    }
  }
  await admin.firestore().collection('system_admins').doc(targetUid).set({
    uid: targetUid,
    addedBy: callerUid,
    addedAt: Date.now(),
  });
  // Custom claim para fast-path em rules.
  const existing = (await admin.auth().getUser(targetUid)).customClaims || {};
  await admin.auth().setCustomUserClaims(targetUid, { ...existing, superadmin: true });

  await logAudit(null, 'CREATE', 'SystemAdmin', `Super admin promoveu ${targetUid} a system admin`, targetUid, callerUid);
  return { uid: targetUid };
});

/**
 * Remove um system admin. Bloqueia self-remove se for o último.
 */
exports.removeSystemAdmin = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid é obrigatório.');

  if (uid === callerUid) {
    const allAdmins = await admin.firestore().collection('system_admins').get();
    if (allAdmins.size <= 1) {
      throw new HttpsError('failed-precondition', 'Você é o último super admin — não é possível remover.');
    }
  }

  await admin.firestore().collection('system_admins').doc(uid).delete();
  const existing = (await admin.auth().getUser(uid)).customClaims || {};
  delete existing.superadmin;
  await admin.auth().setCustomUserClaims(uid, existing);

  await logAudit(null, 'DELETE', 'SystemAdmin', `Super admin removeu ${uid} dos system admins`, uid, callerUid);
  return { uid };
});

/**
 * Lista todos os tenants (com totais agregados). Apenas super admin.
 */
exports.listAllTenants = onCall(async (request) => {
  await requireSuperAdmin(request);
  const snap = await admin.firestore().collection('tenants').get();
  return {
    tenants: snap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
});

/**
 * Lista usuários cross-tenant. Apenas super admin.
 * Implementação simples: itera tenants e concatena users. Para escalas grandes,
 * substituir por collectionGroup + index composto.
 */
exports.listAllUsers = onCall(async (request) => {
  await requireSuperAdmin(request);
  const tenantsSnap = await admin.firestore().collection('tenants').get();
  const users = [];
  for (const t of tenantsSnap.docs) {
    const usSnap = await t.ref.collection('users').get();
    usSnap.forEach(u => {
      const data = u.data();
      users.push({
        id: u.id,
        tenantId: t.id,
        email: data.email,
        role: data.role,
        status: data.status,
        createdAt: data.createdAt,
      });
    });
  }
  return { users };
});

exports.sendPushNotification = onCall(
  { secrets: VAPID_SECRETS },
  async (request) => {
    configureWebPush();

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

// =====================================================================
// BILLING / ASAAS
// =====================================================================
//
// Convenção: externalReference = tenantSlug (em customer e subscription).
// Isso evita um índice reverso no Firestore: o webhook resolve o tenant
// direto do payload.

const ASAAS_SECRETS = [ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN];
const ASAAS_OPTS = { secrets: ASAAS_SECRETS };
// Webhook + job diário enviam push; combinam secrets Asaas com VAPID.
const ASAAS_WEBHOOK_SECRETS = [...ASAAS_SECRETS, ...VAPID_SECRETS];

// Conjunto de eventos suportados. Eventos fora desta lista são logados mas
// ignorados, evitando 5xx desnecessário que dispara retry do Asaas.
const KNOWN_WEBHOOK_EVENTS = new Set([
  'PAYMENT_CREATED', 'PAYMENT_UPDATED', 'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED',
  'PAYMENT_REFUNDED', 'PAYMENT_RESTORED', 'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
]);

function ensureBillingPayload(data) {
  const slug = String(data.slug || '').toLowerCase().trim();
  if (!slug) throw new HttpsError('invalid-argument', 'slug é obrigatório.');
  return slug;
}

async function getTenantOrThrow(slug) {
  const ref = admin.firestore().collection('tenants').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);
  return { ref, data: snap.data() };
}

function buildNextDueDate(dueDay) {
  const d = new Date();
  const day = Math.min(28, Math.max(1, Number(dueDay) || 10));
  d.setUTCDate(day);
  d.setUTCHours(12, 0, 0, 0);
  if (d.getTime() < Date.now() + 24 * 3600_000) {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.getTime();
}

/**
 * Cria (ou recria) a assinatura do tenant no Asaas.
 * Body: { slug, priceCents, cycle?, billingType?, dueDay?, payer: { name, email, cpfCnpj, phone? } }
 */
exports.createTenantSubscription = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const priceCents = Number(data.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 100) {
    throw new HttpsError('invalid-argument', 'priceCents deve ser >= 100 (R$ 1,00).');
  }
  const payer = data.payer || {};
  if (!payer.name || !payer.email || !payer.cpfCnpj) {
    throw new HttpsError('invalid-argument', 'payer.name, payer.email e payer.cpfCnpj são obrigatórios.');
  }

  const cycle = data.cycle || 'MONTHLY';
  const billingType = data.billingType || 'UNDEFINED';
  const dueDay = data.dueDay || 10;
  const trialDays = Math.max(0, Math.floor(Number(data.trialDays) || 0));

  // Com trial: primeira cobrança ocorre em trialDays dias (Asaas gera automaticamente).
  // Sem trial: próxima cobrança calculada pela data de vencimento (dueDay).
  const nextDueDateMs = trialDays > 0
    ? Date.now() + trialDays * 86400000
    : buildNextDueDate(dueDay);

  const apiKey = ASAAS_API_KEY.value();

  const customer = await asaas.findOrCreateCustomer(apiKey, {
    name: payer.name,
    email: payer.email,
    cpfCnpj: String(payer.cpfCnpj).replace(/\D/g, ''),
    phone: payer.phone,
    externalReference: slug,
  });

  // Se já existe subscription para esse tenant, cancela antes de recriar.
  const existing = tenant.billing?.asaasSubscriptionId;
  if (existing) {
    try { await asaas.cancelSubscription(apiKey, existing); }
    catch (e) { console.warn('cancelSubscription falhou (ok se já cancelada):', e?.response?.data || e.message); }
  }

  const sub = await asaas.createSubscription(apiKey, {
    customerId: customer.id,
    valueCents: priceCents,
    cycle,
    billingType,
    nextDueDateMs,
    description: `Plataforma K-Tag — ${tenant.name} (${tenant.plan || 'basic'})`,
    externalReference: slug,
  });

  const billing = {
    status: trialDays > 0 ? 'trialing' : 'active',
    priceCents,
    cycle,
    method: billingType,
    dueDay,
    nextDueDate: nextDueDateMs,
    asaasCustomerId: customer.id,
    asaasSubscriptionId: sub.id,
    payerCpfCnpj: payer.cpfCnpj,
    payerName: payer.name,
    payerEmail: payer.email,
    lastSyncedAt: Date.now(),
    ...(trialDays > 0 && { trialEndsAt: nextDueDateMs, trialDays }),
  };

  // -------- ADESÃO (setup fee) opcional --------
  // Aceita {valueCents, status: 'paid'|'pending'|'waived', description?}
  // - 'paid': só registra no Firestore (sem cobrança Asaas)
  // - 'pending': cria payment one-time no Asaas e registra paymentId
  // - 'waived' / omitido: ignorado
  const setupFeeInput = data.setupFee;
  if (setupFeeInput && setupFeeInput.status && setupFeeInput.status !== 'waived') {
    const setupValue = Number(setupFeeInput.valueCents);
    if (!Number.isFinite(setupValue) || setupValue < 100) {
      throw new HttpsError('invalid-argument', 'setupFee.valueCents deve ser >= 100 (R$ 1,00).');
    }
    const setupDescription = String(setupFeeInput.description || `Taxa de adesão — ${tenant.name}`).trim();

    const fee = {
      valueCents: setupValue,
      status: setupFeeInput.status, // 'paid' ou 'pending'
      description: setupDescription,
      registeredAt: Date.now(),
      registeredBy: callerUid,
    };

    if (setupFeeInput.status === 'paid') {
      fee.paidAt = Date.now();
    } else if (setupFeeInput.status === 'pending') {
      // Cria cobrança avulsa no Asaas (vencimento padrão: 7 dias).
      try {
        const setupPayment = await asaas.createPayment(apiKey, {
          customerId: customer.id,
          valueCents: setupValue,
          description: setupDescription,
          billingType: setupFeeInput.billingType || 'UNDEFINED',
          dueDateMs: Date.now() + 7 * 86400000,
          externalReference: `${slug}__setup`,
        });
        const setupInvoice = asaas.paymentToInvoice(setupPayment, slug);
        setupInvoice.createdAt = Date.now();
        await ref.collection('invoices').doc(setupPayment.id).set(setupInvoice);
        fee.asaasPaymentId = setupPayment.id;
      } catch (e) {
        console.error(`[createTenantSubscription] Falha ao gerar setupFee Asaas (${slug}):`, e?.response?.data || e.message);
        throw new HttpsError('internal', `Assinatura criada, mas a adesão Asaas falhou: ${e.message}. Crie manualmente via "Nova cobrança avulsa".`);
      }
    }
    billing.setupFee = fee;
  }

  await ref.update({ billing });

  const setupFeeNote = billing.setupFee
    ? ` + adesão R$${(billing.setupFee.valueCents / 100).toFixed(2)} (${billing.setupFee.status})`
    : '';
  await logAudit(null, 'CREATE', 'TenantSubscription',
    `Assinatura criada para ${slug} — R$${(priceCents/100).toFixed(2)}/${cycle}${trialDays > 0 ? ` (trial ${trialDays}d)` : ''}${setupFeeNote}`,
    slug, callerUid);

  return { ok: true, billing, asaasSubscription: sub };
});

/**
 * Marca a adesão (setupFee) de um tenant como paga. Útil quando o admin recebeu
 * o pagamento por fora (em dinheiro/transferência) e quer atualizar o status.
 */
exports.markSetupFeePaid = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug } = request.data || {};
  if (!slug) throw new HttpsError('invalid-argument', 'slug obrigatório.');

  const ref = admin.firestore().collection('tenants').doc(slug);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);
  const billing = snap.data().billing || {};
  if (!billing.setupFee) throw new HttpsError('failed-precondition', 'Este tenant não tem adesão registrada.');
  if (billing.setupFee.status === 'paid') return { ok: true, alreadyPaid: true };

  await ref.update({
    'billing.setupFee.status': 'paid',
    'billing.setupFee.paidAt': Date.now(),
  });
  await logAudit(null, 'UPDATE', 'TenantSubscription',
    `Adesão marcada como paga (R$${(billing.setupFee.valueCents / 100).toFixed(2)})`,
    slug, callerUid);
  return { ok: true, alreadyPaid: false };
});

/**
 * Atualiza preço/ciclo/método. Body: { slug, priceCents?, cycle?, billingType?, dueDay? }
 */
exports.updateTenantSubscription = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const subId = tenant.billing?.asaasSubscriptionId;
  if (!subId) throw new HttpsError('failed-precondition', `Tenant ${slug} não tem assinatura ativa.`);

  const apiKey = ASAAS_API_KEY.value();
  const patch = {};
  if (data.priceCents !== undefined) patch.valueCents = Number(data.priceCents);
  if (data.cycle) patch.cycle = data.cycle;
  if (data.billingType) patch.billingType = data.billingType;
  if (data.dueDay) patch.nextDueDateMs = buildNextDueDate(data.dueDay);

  const sub = await asaas.updateSubscription(apiKey, subId, patch);

  const update = { 'billing.lastSyncedAt': Date.now() };
  if (data.priceCents !== undefined) update['billing.priceCents'] = Number(data.priceCents);
  if (data.cycle) update['billing.cycle'] = data.cycle;
  if (data.billingType) update['billing.method'] = data.billingType;
  if (data.dueDay) {
    update['billing.dueDay'] = data.dueDay;
    update['billing.nextDueDate'] = patch.nextDueDateMs;
  }
  await ref.update(update);

  await logAudit(null, 'UPDATE', 'TenantSubscription',
    `Super admin alterou assinatura ${subId}: ${Object.keys(patch).join(', ')}`,
    slug, callerUid);

  return { ok: true, asaasSubscription: sub };
});

exports.cancelTenantSubscription = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const subId = tenant.billing?.asaasSubscriptionId;
  if (!subId) throw new HttpsError('failed-precondition', `Tenant ${slug} não tem assinatura ativa.`);

  await asaas.cancelSubscription(ASAAS_API_KEY.value(), subId);

  await ref.update({
    'billing.status': 'canceled',
    'billing.asaasSubscriptionId': null,
    'billing.lastSyncedAt': Date.now(),
  });

  await logAudit(null, 'DELETE', 'TenantSubscription',
    `Super admin cancelou assinatura Asaas ${subId} de ${slug}`,
    slug, callerUid);

  return { ok: true };
});

/**
 * Faz pull do Asaas e atualiza invoices + status do tenant.
 */
exports.syncTenantBilling = onCall(ASAAS_OPTS, async (request) => {
  await requireSuperAdmin(request);
  const slug = ensureBillingPayload(request.data || {});
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const subId = tenant.billing?.asaasSubscriptionId;
  if (!subId) {
    return { ok: false, reason: 'sem assinatura' };
  }

  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  let sub, payments;
  try {
    [sub, payments] = await Promise.all([
      asaas.getSubscription(apiKey, subId).catch(() => null),
      asaas.listSubscriptionPayments(apiKey, subId, 50),
    ]);
  } catch (e) {
    const msg = e?.response?.data?.errors?.[0]?.description || e?.message || 'Erro Asaas';
    throw new HttpsError('internal', `Falha ao consultar Asaas: ${msg}`);
  }

  // Atualiza invoices
  const batch = admin.firestore().batch();
  for (const p of payments) {
    const inv = asaas.paymentToInvoice(p, slug);
    inv.createdAt = inv.createdAt || Date.now();
    const invRef = ref.collection('invoices').doc(p.id);
    batch.set(invRef, inv, { merge: true });
  }
  await batch.commit();

  // Calcula status agregado: overdue se alguma fatura OVERDUE, senão active/canceled
  const hasOverdue = payments.some(p => asaas.normalizeStatus(p.status) === 'OVERDUE');
  const statusFromSub = sub?.status === 'INACTIVE' ? 'canceled' : (hasOverdue ? 'overdue' : 'active');

  await ref.update({
    'billing.status': statusFromSub,
    'billing.lastSyncedAt': Date.now(),
  });

  return { ok: true, invoicesCount: payments.length, status: statusFromSub };
});

/**
 * Lista invoices de um tenant. Apenas super admin (UI super-admin).
 */
exports.listTenantInvoices = onCall(async (request) => {
  await requireSuperAdmin(request);
  const slug = ensureBillingPayload(request.data || {});
  const snap = await admin.firestore()
    .collection('tenants').doc(slug)
    .collection('invoices')
    .orderBy('dueDate', 'desc')
    .limit(60)
    .get();
  return { invoices: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
});

// ---------- ENDPOINTS TENANT-SCOPED (admin do próprio tenant) ----------
//
// Pareados com os super-admin (listTenantInvoices/syncTenantBilling) mas com
// guard requireTenantAdmin — admin de um tenant NUNCA enxerga outro.

/**
 * Retorna o estado de billing + plano do tenant do caller.
 * Útil pra exibir na área /billing do tenant.
 */
exports.getMyTenantBilling = onCall(async (request) => {
  const { tenantId } = await requireTenantAdmin(request);
  const snap = await admin.firestore().collection('tenants').doc(tenantId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Tenant não encontrado.');
  const t = snap.data();
  // Não vazamos asaasCustomerId/SubscriptionId — IDs internos do Asaas só pro
  // super admin. O tenant só precisa do estado funcional.
  const b = t.billing || {};
  return {
    tenant: {
      id: tenantId,
      name: t.name,
      slug: t.slug || tenantId,
      plan: t.plan || 'basic',
      active: t.active !== false,
    },
    billing: {
      status: b.status || 'none',
      priceCents: b.priceCents,
      cycle: b.cycle,
      method: b.method,
      dueDay: b.dueDay,
      nextDueDate: b.nextDueDate,
      lastSyncedAt: b.lastSyncedAt,
      payerName: b.payerName,
      payerEmail: b.payerEmail,
    },
  };
});

/**
 * Lista invoices do PRÓPRIO tenant do caller (admin do tenant).
 * Body opcional: { limit?, status? }
 */
exports.listMyTenantInvoices = onCall(async (request) => {
  const { tenantId } = await requireTenantAdmin(request);
  const data = request.data || {};
  const limit = Math.min(120, Math.max(10, Number(data.limit) || 60));
  const status = data.status && data.status !== 'all' ? String(data.status) : null;

  let q = admin.firestore()
    .collection('tenants').doc(tenantId)
    .collection('invoices')
    .orderBy('dueDate', 'desc');
  if (status) q = q.where('status', '==', status);

  const snap = await q.limit(limit).get();
  return {
    invoices: snap.docs.map(d => {
      const inv = d.data();
      // Removemos campos que o tenant não precisa ver
      delete inv.asaasCustomerId;
      delete inv.asaasSubscriptionId;
      return { id: d.id, ...inv };
    }),
  };
});

/**
 * Permite que o admin do tenant force um sync com Asaas (mesmo callable usado
 * pelo super admin, mas guard menos restritivo). Limita a 1 chamada a cada
 * 60s por tenant para evitar abuse.
 */
const _syncCooldown = new Map();
exports.syncMyTenantBilling = onCall(ASAAS_OPTS, async (request) => {
  const { tenantId } = await requireTenantAdmin(request);
  const last = _syncCooldown.get(tenantId) || 0;
  if (Date.now() - last < 60_000) {
    throw new HttpsError('resource-exhausted', 'Aguarde 1 minuto entre sincronizações.');
  }
  // Cooldown só é registrado após o Asaas responder — falhas não bloqueiam retry.

  const ref = admin.firestore().collection('tenants').doc(tenantId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Tenant não encontrado.');
  const tenant = snap.data();
  const subId = tenant.billing?.asaasSubscriptionId;
  if (!subId) return { ok: false, reason: 'sem assinatura' };

  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  let sub, payments;
  try {
    [sub, payments] = await Promise.all([
      asaas.getSubscription(apiKey, subId).catch(() => null),
      asaas.listSubscriptionPayments(apiKey, subId, 50),
    ]);
  } catch (e) {
    const msg = e?.response?.data?.errors?.[0]?.description || e?.message || 'Erro Asaas';
    throw new HttpsError('internal', `Falha ao consultar Asaas: ${msg}`);
  }

  const batch = admin.firestore().batch();
  for (const p of payments) {
    const inv = asaas.paymentToInvoice(p, tenant.slug || tenantId);
    inv.createdAt = inv.createdAt || Date.now();
    batch.set(ref.collection('invoices').doc(p.id), inv, { merge: true });
  }
  await batch.commit();

  const hasOverdue = payments.some(p => asaas.normalizeStatus(p.status) === 'OVERDUE');
  const statusFromSub = sub?.status === 'INACTIVE' ? 'canceled' : (hasOverdue ? 'overdue' : 'active');
  await ref.update({
    'billing.status': statusFromSub,
    'billing.lastSyncedAt': Date.now(),
  });

  _syncCooldown.set(tenantId, Date.now());
  return { ok: true, invoicesCount: payments.length, status: statusFromSub };
});

/**
 * Lista invoices cross-tenant para o painel global de faturas.
 * Body: { status?, tenantSlug?, fromMs?, toMs?, limit? }
 * Itera /tenants/* e concatena — adequado até ~200 tenants. Acima disso,
 * trocar por collectionGroup('invoices') + índice composto em (status, dueDate).
 */
exports.listInvoicesGlobal = onCall(async (request) => {
  await requireSuperAdmin(request);
  const data = request.data || {};
  const status = data.status && data.status !== 'all' ? String(data.status) : null;
  const tenantSlug = data.tenantSlug ? String(data.tenantSlug) : null;
  const fromMs = Number(data.fromMs) || null;
  const toMs = Number(data.toMs) || null;
  const limit = Math.min(500, Math.max(20, Number(data.limit) || 100));

  const db = admin.firestore();
  const tenantsSnap = tenantSlug
    ? await db.collection('tenants').where('slug', '==', tenantSlug).get()
    : await db.collection('tenants').get();

  const tenantNames = {};
  tenantsSnap.forEach(t => { tenantNames[t.id] = t.data().name || t.id; });

  const all = [];
  for (const t of tenantsSnap.docs) {
    let q = t.ref.collection('invoices').orderBy('dueDate', 'desc');
    if (status) q = q.where('status', '==', status);
    if (fromMs) q = q.where('dueDate', '>=', fromMs);
    if (toMs) q = q.where('dueDate', '<=', toMs);
    const snap = await q.limit(limit).get();
    snap.forEach(d => {
      const inv = d.data();
      all.push({
        id: d.id,
        ...inv,
        tenantId: t.id,
        tenantName: tenantNames[t.id],
      });
    });
  }

  all.sort((a, b) => (b.dueDate || 0) - (a.dueDate || 0));
  return { invoices: all.slice(0, limit), total: all.length };
});

/**
 * Agrega receita realizada (status RECEIVED/CONFIRMED) por mês nos últimos N meses.
 * Body: { months? } — default 12.
 * Retorna pontos no formato { month: 'YYYY-MM', revenueCents, invoicesCount, paidTenants },
 * mais snapshot do MRR atual derivado de tenants.billing.
 */
exports.aggregateMRRHistory = onCall(async (request) => {
  await requireSuperAdmin(request);
  const months = Math.min(24, Math.max(3, Number(request.data?.months) || 12));

  const db = admin.firestore();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1, 0, 0, 0));

  const buckets = {};
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets[key] = { month: key, revenueCents: 0, invoicesCount: 0, tenants: new Set() };
  }

  const tenantsSnap = await db.collection('tenants').get();
  let mrrCents = 0;
  let activeTenants = 0;

  for (const t of tenantsSnap.docs) {
    const tdata = t.data();
    const b = tdata.billing;
    if (b && (b.status === 'active' || b.status === 'overdue') && b.priceCents) {
      let monthly = b.priceCents;
      if (b.cycle === 'YEARLY') monthly = Math.round(b.priceCents / 12);
      else if (b.cycle === 'QUARTERLY') monthly = Math.round(b.priceCents / 3);
      mrrCents += monthly;
      activeTenants++;
    }

    const invSnap = await t.ref.collection('invoices')
      .where('dueDate', '>=', start.getTime())
      .get();
    invSnap.forEach(doc => {
      const inv = doc.data();
      if (inv.status !== 'RECEIVED' && inv.status !== 'CONFIRMED') return;
      const when = inv.paidAt || inv.dueDate;
      if (!when) return;
      const d = new Date(when);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets[key];
      if (!bucket) return;
      bucket.revenueCents += Number(inv.valueCents || 0);
      bucket.invoicesCount += 1;
      bucket.tenants.add(t.id);
    });
  }

  const history = Object.values(buckets).map(b => ({
    month: b.month,
    revenueCents: b.revenueCents,
    invoicesCount: b.invoicesCount,
    paidTenants: b.tenants.size,
  }));

  return {
    history,
    currentMrrCents: mrrCents,
    activeTenants,
  };
});

// ─── Fase 6: Reenvio manual ───────────────────────────────────────────────────
/**
 * Reenvia o e-mail de notificação de uma fatura para o pagador (via Asaas).
 * Body: { slug, paymentId }
 */
exports.remindTenantPayment = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  const paymentId = String(data.paymentId || '').trim();
  if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId obrigatório.');

  const { ref: tenantRef } = await getTenantOrThrow(slug);

  // Garante que a fatura pertence ao tenant antes de reenviar.
  const invSnap = await tenantRef.collection('invoices').doc(paymentId).get();
  if (!invSnap.exists) throw new HttpsError('not-found', 'Fatura não encontrada neste tenant.');

  const apiKey = ASAAS_API_KEY.value();
  await asaas.sendPaymentNotification(apiKey, paymentId);

  await logAudit(null, 'REMIND', 'Invoice',
    `Lembrete reenviado: payment=${paymentId}`, slug, callerUid);

  return { ok: true };
});

// ─── Fase 2: Cobrança avulsa ──────────────────────────────────────────────────
/**
 * Cria uma cobrança avulsa (não-recorrente) para um tenant existente.
 * Body: { slug, valueCents, description, billingType?, dueDateMs? }
 * Requer que o tenant já tenha um asaasCustomerId (criado pela assinatura).
 */
exports.createOneTimeCharge = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const valueCents = Number(data.valueCents);
  if (!Number.isFinite(valueCents) || valueCents < 100) {
    throw new HttpsError('invalid-argument', 'valueCents deve ser >= 100 (R$ 1,00).');
  }
  const description = String(data.description || '').trim();
  if (!description) throw new HttpsError('invalid-argument', 'description obrigatória.');

  const customerId = tenant.billing?.asaasCustomerId;
  if (!customerId) {
    throw new HttpsError('failed-precondition',
      'Tenant sem customer Asaas. Crie uma assinatura primeiro para registrar o pagador.');
  }

  const billingType = data.billingType || 'UNDEFINED';
  const dueDateMs = Number(data.dueDateMs) > Date.now()
    ? Number(data.dueDateMs)
    : Date.now() + 7 * 86400000; // padrão: 7 dias

  const apiKey = ASAAS_API_KEY.value();
  const payment = await asaas.createPayment(apiKey, {
    customerId,
    valueCents,
    description,
    billingType,
    dueDateMs,
    externalReference: slug,
  });

  const invoice = asaas.paymentToInvoice(payment, slug);
  invoice.createdAt = Date.now();
  await ref.collection('invoices').doc(payment.id).set(invoice);

  await logAudit(null, 'CREATE', 'OneTimeCharge',
    `Cobrança avulsa: "${description}" R$${(valueCents / 100).toFixed(2)} para ${slug}`,
    slug, callerUid);

  return { ok: true, invoice };
});

// ─── Fase 8: Config Asaas ─────────────────────────────────────────────────────
/**
 * Retorna configuração atual do Asaas (ambiente, URL do webhook).
 * Não requer ASAAS_API_KEY — só lê variáveis de ambiente.
 */
exports.getAsaasConfig = onCall({ secrets: [ASAAS_WEBHOOK_TOKEN] }, async (request) => {
  await requireSuperAdmin(request);
  const env = (process.env.ASAAS_ENV || 'sandbox').toLowerCase();
  const projectId = admin.app().options.projectId || 'saastagmanager';
  const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/asaasWebhook`;
  return { env, webhookUrl, apiBaseUrl: asaas.baseUrl() };
});

/**
 * Testa a conexão com o Asaas chamando GET /myAccount.
 * Retorna { ok, env, account? } ou { ok: false, error }.
 */
exports.testAsaasConnection = onCall(ASAAS_OPTS, async (request) => {
  await requireSuperAdmin(request);
  const env = (process.env.ASAAS_ENV || 'sandbox').toLowerCase();
  try {
    const apiKey = ASAAS_API_KEY.value();
    const account = await asaas.getAccount(apiKey);
    return {
      ok: true,
      env,
      account: {
        name: account.name || account.commercialName || '—',
        email: account.email || '—',
        cpfCnpj: account.cpfCnpj || '—',
      },
    };
  } catch (e) {
    return { ok: false, env, error: String(e.response?.data?.errors?.[0]?.description || e.message || e) };
  }
});

/**
 * Webhook do Asaas.
 *
 * Cadastrar em https://www.asaas.com/integracoes/webhooks com:
 *  - URL: https://<region>-<project>.cloudfunctions.net/asaasWebhook
 *  - Token de autenticação: igual ao secret ASAAS_WEBHOOK_TOKEN
 *  - Eventos: PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_CONFIRMED,
 *    PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_UPDATED
 *
 * O Asaas envia o token em header 'asaas-access-token'.
 *
 * Política de inativação: tenant fica 'overdue' assim que PAYMENT_OVERDUE chega;
 * a desativação automática (active=false) acontece via job diário.
 */
exports.asaasWebhook = onRequest(
  { secrets: ASAAS_WEBHOOK_SECRETS, cors: false, timeoutSeconds: 30 },
  async (req, res) => {
    const receivedAt = Date.now();
    // Referência ao doc de forensics; preenchida após validação inicial.
    let billingEventRef = null;

    try {
      // ── 1. Método ────────────────────────────────────────────────────────────
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }

      // ── 2. Autenticação do token ─────────────────────────────────────────────
      const expectedToken = ASAAS_WEBHOOK_TOKEN.value();
      const receivedToken = req.headers['asaas-access-token'];
      if (!expectedToken || receivedToken !== expectedToken) {
        console.warn('asaasWebhook: token inválido', { ip: req.ip });
        return res.status(401).send('Unauthorized');
      }

      // ── 3. Validação do payload ──────────────────────────────────────────────
      const body = req.body || {};
      const event = body.event;
      const payment = body.payment;

      if (!event || typeof event !== 'string') {
        return res.status(400).send('payload inválido: event ausente');
      }
      if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
        return res.status(400).send('payload inválido: payment ausente');
      }
      if (!payment.id || typeof payment.id !== 'string') {
        return res.status(400).send('payload inválido: payment.id ausente');
      }

      // Evento desconhecido: retorna 202 para não disparar retry desnecessário.
      if (!KNOWN_WEBHOOK_EVENTS.has(event)) {
        console.info(`asaasWebhook: evento desconhecido "${event}" — ignorado`, { paymentId: payment.id });
        return res.status(202).send('ignored: unknown event type');
      }

      // ── 4. Resolve tenant ────────────────────────────────────────────────────
      // tenantSlug vem do externalReference (definido na criação da subscription).
      const slug = String(payment.externalReference || '').toLowerCase().trim();

      // ── 5. Grava forensics em system_billing_events ──────────────────────────
      // Feito ANTES de qualquer processamento; captura toda entrega, inclusive
      // as que serão ignoradas ou rejeitadas por lógica de negócio.
      billingEventRef = await admin.firestore().collection('system_billing_events').add({
        event,
        paymentId: payment.id,
        tenantSlug: slug || null,
        status: 'processing',
        rawPayment: payment,
        receivedAt,
        ip: req.ip || null,
      });

      if (!slug) {
        console.warn('asaasWebhook: payment sem externalReference', payment.id);
        await billingEventRef.update({ status: 'ignored_no_reference' });
        return res.status(202).send('ignored: no externalReference');
      }

      const tenantRef = admin.firestore().collection('tenants').doc(slug);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) {
        console.warn(`asaasWebhook: tenant "${slug}" não existe`, { paymentId: payment.id });
        await billingEventRef.update({ status: 'ignored_tenant_not_found' });
        return res.status(202).send('ignored: tenant not found');
      }

      // ── 6. Idempotência por dateUpdated ──────────────────────────────────────
      // Se o invoice já existe e o dateUpdated que temos é igual ou mais recente
      // que o do evento entrante, o evento é obsoleto — ignoramos sem reescrever.
      const invoiceRef = tenantRef.collection('invoices').doc(payment.id);
      if (payment.dateUpdated) {
        const existingSnap = await invoiceRef.get();
        if (existingSnap.exists) {
          const storedDateUpdated = existingSnap.data()?.asaasDateUpdated;
          // Comparação de strings ISO "YYYY-MM-DD HH:MM:SS" é lexicograficamente
          // correta para ordem cronológica.
          if (storedDateUpdated && storedDateUpdated >= payment.dateUpdated) {
            console.info('asaasWebhook: evento obsoleto, pulando', {
              paymentId: payment.id, stored: storedDateUpdated, incoming: payment.dateUpdated,
            });
            await billingEventRef.update({ status: 'skipped_stale' });
            return res.status(200).send('ok: stale');
          }
        }
      }

      // ── 7. Persiste invoice ───────────────────────────────────────────────────
      const invoice = asaas.paymentToInvoice(payment, slug);
      // Preserva createdAt original se invoice já existia.
      if (!invoice.createdAt) invoice.createdAt = Date.now();
      await invoiceRef.set(invoice, { merge: true });

      // ── 8. Atualiza status agregado do tenant ─────────────────────────────────
      const tenantUpdate = { 'billing.lastSyncedAt': Date.now() };
      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          tenantUpdate['billing.status'] = 'active';
          break;
        case 'PAYMENT_OVERDUE':
          tenantUpdate['billing.status'] = 'overdue';
          break;
        // PAYMENT_DELETED / PAYMENT_REFUNDED: refletido só na invoice.
      }
      await tenantRef.update(tenantUpdate);

      // ── 9. Push para admins do tenant ─────────────────────────────────────────
      const pushPayload = buildBillingPushPayload(event, payment);
      await sendBillingPushToAdmins(slug, pushPayload);

      // ── 10. Finaliza forensics + audit ────────────────────────────────────────
      await billingEventRef.update({ status: 'processed' });
      await logAudit(null, 'WEBHOOK', 'Asaas',
        `${event} payment=${payment.id} status=${payment.status}`,
        slug, 'ASAAS_WEBHOOK');

      return res.status(200).send('ok');
    } catch (e) {
      console.error('asaasWebhook erro:', e);
      // Atualiza forensics com o erro antes de retornar 500.
      // 5xx faz o Asaas reentregar — correto para erros transitórios de infra.
      if (billingEventRef) {
        await billingEventRef.update({
          status: 'error',
          error: String(e.message || e),
        }).catch(() => {});
      }
      return res.status(500).send('error');
    }
  }
);

/**
 * Job diário: desativa tenants em atraso há mais de 7 dias.
 * (Soft: marca active=false; dados permanecem.)
 */
exports.dailyBillingEnforcement = onSchedule(
  { schedule: 'every day 03:30', timeZone: 'America/Sao_Paulo', secrets: VAPID_SECRETS },
  async () => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const snap = await admin.firestore()
      .collection('tenants')
      .where('billing.status', '==', 'overdue')
      .get();

    let suspended = 0;
    for (const doc of snap.docs) {
      const t = doc.data();
      if (t.active === false) continue;
      // Verifica se a invoice mais antiga em atraso passou do cutoff
      const invs = await doc.ref.collection('invoices')
        .where('status', '==', 'OVERDUE')
        .orderBy('dueDate', 'asc')
        .limit(1)
        .get();
      const oldestOverdue = invs.docs[0]?.data()?.dueDate;
      if (oldestOverdue && oldestOverdue < cutoff) {
        await doc.ref.update({ active: false });
        await logAudit(null, 'SUSPEND', 'Tenant',
          `Suspensão automática por inadimplência > 7d`,
          doc.id, 'BILLING_JOB');
        // Avisa admins do tenant sobre a suspensão.
        await sendBillingPushToAdmins(doc.id, {
          title: 'Empresa suspensa por inadimplência',
          body: 'Seu acesso foi suspenso por fatura em atraso há mais de 7 dias. Regularize para reativar.',
          url: '/#/billing',
        });
        suspended++;
      }
    }
    console.log(`dailyBillingEnforcement: suspended=${suspended}`);
  }
);

// ============================================================
// FASE 2 — TENANT USAGE + LIMITES + EXCLUSÃO + RANKING
// ============================================================

/**
 * Conta entidades de um tenant e atualiza usage.* cacheado no doc.
 * Restrito a super admin. Reusa as subcoleções tenant-aware.
 */
exports.getTenantUsage = onCall(async (request) => {
  await requireSuperAdmin(request);
  const { slug } = request.data || {};
  if (!slug) throw new HttpsError('invalid-argument', 'slug obrigatório.');

  const tenantRef = admin.firestore().collection('tenants').doc(slug);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);

  // Conta cada subcoleção em paralelo via count() aggregation (mais barato).
  const COLS = ['tags', 'vehicles', 'users', 'schedules'];
  const counts = await Promise.all(COLS.map(async (col) => {
    try {
      const agg = await tenantRef.collection(col).count().get();
      return agg.data().count;
    } catch (e) {
      console.warn(`getTenantUsage count(${col}) falhou para ${slug}:`, e.message);
      return 0;
    }
  }));
  const [tagsUtilizadas, veiculosUtilizados, usuariosAtivos, agendamentosAtivos] = counts;

  // Última atividade: olha o doc mais recente entre schedules, vehicles e tags.
  let lastActivityAt = 0;
  for (const col of ['schedules', 'vehicles', 'tags']) {
    try {
      const last = await tenantRef.collection(col).orderBy('createdAt', 'desc').limit(1).get();
      const ts = last.docs[0]?.data()?.createdAt || 0;
      if (ts > lastActivityAt) lastActivityAt = ts;
    } catch (e) { /* coleção pode não ter createdAt indexado */ }
  }

  const usage = {
    tagsUtilizadas,
    veiculosUtilizados,
    usuariosAtivos,
    agendamentosAtivos,
    lastComputedAt: Date.now(),
    lastActivityAt: lastActivityAt || undefined,
  };
  await tenantRef.update({ usage });
  return { slug, usage };
});

/**
 * Atualiza limites do tenant (limiteTags, limiteVeiculos, maxUsers).
 * Restrito a super admin. Audita a mudança.
 */
exports.updateTenantLimits = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug, limiteTags, limiteVeiculos, maxUsers } = request.data || {};
  if (!slug) throw new HttpsError('invalid-argument', 'slug obrigatório.');

  const tenantRef = admin.firestore().collection('tenants').doc(slug);
  const snap = await tenantRef.get();
  if (!snap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);

  const prev = snap.data().settings || {};
  const next = { ...prev };
  const changes = [];
  if (limiteTags !== undefined && Number.isFinite(limiteTags) && limiteTags >= 0) {
    if (prev.limiteTags !== limiteTags) {
      changes.push(`limiteTags: ${prev.limiteTags ?? 'ilimitado'} → ${limiteTags || 'ilimitado'}`);
      next.limiteTags = limiteTags;
    }
  }
  if (limiteVeiculos !== undefined && Number.isFinite(limiteVeiculos) && limiteVeiculos >= 0) {
    if (prev.limiteVeiculos !== limiteVeiculos) {
      changes.push(`limiteVeiculos: ${prev.limiteVeiculos ?? 'ilimitado'} → ${limiteVeiculos || 'ilimitado'}`);
      next.limiteVeiculos = limiteVeiculos;
    }
  }
  if (maxUsers !== undefined && Number.isFinite(maxUsers) && maxUsers >= 0) {
    if (prev.maxUsers !== maxUsers) {
      changes.push(`maxUsers: ${prev.maxUsers ?? 'ilimitado'} → ${maxUsers || 'ilimitado'}`);
      next.maxUsers = maxUsers;
    }
  }
  if (changes.length === 0) return { slug, changed: false };

  await tenantRef.update({ settings: next });
  await logAudit(null, 'UPDATE', 'Tenant', `Super admin alterou limites: ${changes.join('; ')}`, slug, callerUid);
  return { slug, changed: true, changes };
});

/**
 * Exclui um tenant — soft ou hard.
 * soft: marca deletedAt + active=false (reversível).
 * hard: cancela subscription no Asaas, apaga subcoleções recursivamente,
 *       desativa usuários no Firebase Auth, apaga o doc do tenant.
 *
 * confirmName: o caller precisa enviar o name exato do tenant para confirmar.
 */
exports.deleteTenant = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { slug, mode, confirmName } = request.data || {};
  if (!slug) throw new HttpsError('invalid-argument', 'slug obrigatório.');
  if (mode !== 'soft' && mode !== 'hard') {
    throw new HttpsError('invalid-argument', 'mode deve ser "soft" ou "hard".');
  }

  const tenantRef = admin.firestore().collection('tenants').doc(slug);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) throw new HttpsError('not-found', `Tenant ${slug} não encontrado.`);
  const tenant = tenantSnap.data();

  if (!confirmName || confirmName.trim() !== (tenant.name || '').trim()) {
    throw new HttpsError('failed-precondition',
      'Nome de confirmação não corresponde ao tenant. Operação abortada.');
  }

  // ---------- SOFT ----------
  if (mode === 'soft') {
    await tenantRef.update({
      active: false,
      deletedAt: Date.now(),
      deletedBy: callerUid,
      deletionMode: 'soft',
    });
    await logAudit(null, 'DELETE', 'Tenant',
      `Super admin executou SOFT delete de "${tenant.name}" (${slug}). Reversível.`,
      slug, callerUid);
    return { slug, mode, ok: true };
  }

  // ---------- HARD ----------
  // 1. Cancelar subscription Asaas (best-effort).
  const billing = tenant.billing || {};
  if (billing.asaasSubscriptionId) {
    try {
      const apiKey = await ASAAS_API_KEY.value();
      await asaas.cancelSubscription(apiKey, billing.asaasSubscriptionId);
      console.log(`[deleteTenant] Asaas subscription ${billing.asaasSubscriptionId} cancelada.`);
    } catch (e) {
      console.error(`[deleteTenant] Falha ao cancelar Asaas (${slug}):`, e.message);
      // Não bloqueia hard delete — apenas registra.
    }
  }

  // 2. Coletar UIDs de usuários do tenant para desativar no Firebase Auth.
  const usersSnap = await tenantRef.collection('users').get();
  const userUids = usersSnap.docs.map(d => d.id);

  // 3. Desativar usuários no Auth (não delete — permite recriação se houver erro).
  await Promise.all(userUids.map(async (uid) => {
    try {
      await admin.auth().updateUser(uid, { disabled: true });
    } catch (e) {
      console.warn(`[deleteTenant] Auth disable ${uid} falhou:`, e.message);
    }
  }));

  // 4. recursiveDelete cobre todas as subcoleções (tags, vehicles, schedules,
  // shipments, audit_logs, settings, etc) + o próprio doc do tenant.
  await admin.firestore().recursiveDelete(tenantRef);

  // 5. Limpar push_subscriptions deste tenant (coleção flat).
  try {
    const pushSnap = await admin.firestore().collection('push_subscriptions')
      .where('tenantId', '==', slug).get();
    const batch = admin.firestore().batch();
    pushSnap.docs.forEach(d => batch.delete(d.ref));
    if (!pushSnap.empty) await batch.commit();
  } catch (e) {
    console.warn('[deleteTenant] limpeza push_subscriptions falhou:', e.message);
  }

  // 6. Auditoria global. Não vai mais no audit_logs do tenant (não existe mais).
  try {
    await admin.firestore().collection('system_audit_logs').add({
      action: 'DELETE',
      entity: 'Tenant',
      details: `HARD delete de "${tenant.name}" (${slug}) — ${userUids.length} usuários, billing=${billing.status || 'none'}.`,
      tenantSlug: slug,
      callerUid,
      timestamp: Date.now(),
    });
  } catch (_) { /* sem coleção é OK */ }

  return { slug, mode, ok: true, usersDisabled: userUids.length };
});

// ============================================================
// CONFIGURAÇÃO DE PLANOS — /system_config/plans
// ============================================================

const PLANS_CONFIG_DOC = ['system_config', 'plans'];

/** Defaults usados quando o doc /system_config/plans ainda não existe. */
const DEFAULT_PLANS_CONFIG = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceCents: 9900,
    maxUsers: 5,
    defaultLimiteTags: 50,
    defaultSetupFeeCents: 0,
    defaultDueDay: 10,
    features: [],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 29900,
    maxUsers: 25,
    defaultLimiteTags: 250,
    defaultSetupFeeCents: 29900,
    defaultDueDay: 10,
    features: [],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceCents: 99900,
    maxUsers: 0,
    defaultLimiteTags: 0,
    defaultSetupFeeCents: 99900,
    defaultDueDay: 10,
    features: [],
  },
};

function plansDocRef() {
  return admin.firestore().collection(PLANS_CONFIG_DOC[0]).doc(PLANS_CONFIG_DOC[1]);
}

/**
 * Retorna a configuração atual dos planos. Se não existir, devolve os defaults
 * (sem persistir — só persiste no primeiro updatePlansConfig).
 */
exports.getPlansConfig = onCall(async (request) => {
  await requireSuperAdmin(request);
  const snap = await plansDocRef().get();
  if (!snap.exists) {
    return { plans: DEFAULT_PLANS_CONFIG, fromDefaults: true };
  }
  return { plans: snap.data(), fromDefaults: false };
});

/**
 * Atualiza a configuração de planos. Só super admin.
 * Body: { plans: { basic: PlanConfig, pro: PlanConfig, enterprise: PlanConfig } }
 * Valida que cada plano tem priceCents válido. Audita.
 */
exports.updatePlansConfig = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { plans } = request.data || {};
  if (!plans || typeof plans !== 'object') {
    throw new HttpsError('invalid-argument', 'plans é obrigatório.');
  }

  const allowedIds = ['basic', 'pro', 'enterprise'];
  const sanitized = {};
  for (const id of allowedIds) {
    const p = plans[id];
    if (!p) throw new HttpsError('invalid-argument', `plans.${id} é obrigatório.`);
    const priceCents = Number(p.priceCents);
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      throw new HttpsError('invalid-argument', `plans.${id}.priceCents inválido (mín R$ 1,00).`);
    }
    const setupFeeCents = Number(p.defaultSetupFeeCents || 0);
    if (setupFeeCents < 0) {
      throw new HttpsError('invalid-argument', `plans.${id}.defaultSetupFeeCents não pode ser negativo.`);
    }
    const dueDay = Math.min(28, Math.max(1, Number(p.defaultDueDay || 10)));
    sanitized[id] = {
      id,
      name: String(p.name || id).trim(),
      priceCents,
      maxUsers: Math.max(0, Number(p.maxUsers || 0)),
      defaultLimiteTags: Math.max(0, Number(p.defaultLimiteTags || 0)),
      defaultSetupFeeCents: setupFeeCents,
      defaultDueDay: dueDay,
      features: Array.isArray(p.features) ? p.features.map(String) : [],
    };
  }

  const payload = {
    ...sanitized,
    updatedAt: Date.now(),
    updatedBy: callerUid,
  };
  await plansDocRef().set(payload, { merge: false });

  await logAudit(null, 'UPDATE', 'PlansConfig',
    `Super admin atualizou planos: ` +
    `basic=R$${(sanitized.basic.priceCents / 100).toFixed(2)}, ` +
    `pro=R$${(sanitized.pro.priceCents / 100).toFixed(2)}, ` +
    `enterprise=R$${(sanitized.enterprise.priceCents / 100).toFixed(2)}`,
    null, callerUid);

  return { ok: true, plans: payload };
});

/**
 * Super admin reseta a senha de qualquer usuário em qualquer tenant.
 * Gera senha aleatória e devolve em texto plano (mostrada uma única vez).
 * Difere de `resetTenantUserPassword` porque NÃO exige role admin no tenant —
 * o gate é via `requireSuperAdmin` (mais privilegiado).
 */
exports.superAdminResetUserPassword = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { tenantId, userId } = request.data || {};
  if (!tenantId || !userId) {
    throw new HttpsError('invalid-argument', 'tenantId e userId são obrigatórios.');
  }

  const targetRef = admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(userId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', `Usuário ${userId} não encontrado em ${tenantId}.`);
  }

  const targetEmail = targetSnap.data().email || '';
  const password = generateRandomPassword();
  try {
    await admin.auth().updateUser(userId, { password });
  } catch (e) {
    throw new HttpsError('internal', `Falha ao atualizar senha no Firebase Auth: ${e.message}`);
  }

  // Audita no tenant (para o dono ver) E no log global de super admin.
  await logAudit(tenantId, 'UPDATE', 'User',
    `Super admin (${callerUid}) resetou senha de ${targetEmail}`,
    userId, callerUid);
  try {
    await admin.firestore().collection('system_audit_logs').add({
      action: 'PASSWORD_RESET',
      entity: 'User',
      details: `Super admin resetou senha de ${targetEmail} em ${tenantId}.`,
      tenantSlug: tenantId,
      targetUid: userId,
      callerUid,
      timestamp: Date.now(),
    });
  } catch (_) { /* coleção opcional */ }

  return { userId, email: targetEmail, password };
});

/**
 * Estatísticas agregadas cross-tenant para o painel de Empresas:
 * - ranking por uso de tags
 * - ranking por veículos
 * - tenants inadimplentes
 * - novos tenants por mês (12m)
 *
 * Lê o cache `usage.*` dos tenants — chame `getTenantUsage` periodicamente
 * (ou no carregamento da tela) para manter atualizado.
 */
exports.aggregateTenantsStats = onCall(async (request) => {
  await requireSuperAdmin(request);

  const snap = await admin.firestore().collection('tenants').get();
  const tenants = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const ranked = (key) => tenants
    .filter(t => !t.deletedAt && (t.usage?.[key] || 0) > 0)
    .sort((a, b) => (b.usage[key] || 0) - (a.usage[key] || 0))
    .slice(0, 10)
    .map(t => ({
      slug: t.slug,
      name: t.name,
      plan: t.plan,
      value: t.usage[key] || 0,
      limit: key === 'tagsUtilizadas' ? t.settings?.limiteTags : (key === 'veiculosUtilizados' ? t.settings?.limiteVeiculos : undefined),
    }));

  // Inadimplentes: status overdue ou trial expirado sem assinatura ativa.
  const overdue = tenants
    .filter(t => !t.deletedAt && t.billing?.status === 'overdue')
    .map(t => ({
      slug: t.slug,
      name: t.name,
      plan: t.plan,
      priceCents: t.billing?.priceCents || 0,
      nextDueDate: t.billing?.nextDueDate,
    }));

  // Mais ativos: ordena por usage.lastActivityAt desc.
  const mostActive = tenants
    .filter(t => !t.deletedAt && t.usage?.lastActivityAt)
    .sort((a, b) => (b.usage.lastActivityAt || 0) - (a.usage.lastActivityAt || 0))
    .slice(0, 10)
    .map(t => ({
      slug: t.slug,
      name: t.name,
      plan: t.plan,
      lastActivityAt: t.usage.lastActivityAt,
    }));

  // Crescimento por mês: bucket dos últimos 12 meses por createdAt.
  const now = new Date();
  const buckets = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[k] = 0;
  }
  for (const t of tenants) {
    if (!t.createdAt) continue;
    const d = new Date(t.createdAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (k in buckets) buckets[k]++;
  }
  const growth = Object.entries(buckets).map(([month, count]) => ({ month, count }));

  return {
    topByTags: ranked('tagsUtilizadas'),
    topByVehicles: ranked('veiculosUtilizados'),
    mostActive,
    overdue,
    growth,
    totals: {
      tenants: tenants.length,
      active: tenants.filter(t => t.active !== false && !t.deletedAt).length,
      deleted: tenants.filter(t => t.deletedAt).length,
    },
  };
});
