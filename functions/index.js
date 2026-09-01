
/**
 * Backend Functions - Firebase
 * Inclui Proxy API, Rate Limiting e Triggers de Notificação Push
 */

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const axios = require("axios");
const dns = require("node:dns").promises;
const net = require("node:net");
const crypto = require("node:crypto");
const asaas = require("./asaas");
// K-TAG (api.gps308.com): helpers puros (bateria/lote) + cripto server-side
// (espelho de packages/web/services/encryption.ts) para ler/gravar as chaves das
// tags no MESMO formato cifrado que a UI usa.
const { mapKtagBatchResults } = require("./ktagLocation");
const ktagCrypto = require("./ktagCrypto");
// User-Agent usado nas chamadas ao feibao / keysByLogin.
const KTAG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
// K-TAG: credenciais da conta ÚNICA da plataforma (todos os tenants compartilham).
// Injetadas server-side no relay/scheduler — o cliente nunca recebe usuário/senha.
//   firebase functions:secrets:set KTAG_API_USER
//   firebase functions:secrets:set KTAG_API_PASS
// A URL (não-secreta) vai por env: KTAG_API_URL
const KTAG_API_USER = defineSecret("KTAG_API_USER");
const KTAG_API_PASS = defineSecret("KTAG_API_PASS");
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

// Inicializa o Admin SDK modular. O adaptador local preserva as chamadas
// admin.firestore()/admin.auth() enquanto o restante das Functions é migrado.
if (getApps().length === 0) initializeApp();
const firestore = () => getFirestore();
firestore.FieldValue = FieldValue;
firestore.Timestamp = Timestamp;
const admin = { firestore, auth: getAuth };
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
exports.proxyApi = onRequest({ secrets: [KTAG_API_USER, KTAG_API_PASS] }, (req, res) => {
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
    let { url, method, headers, body } = req.body || {};
    const injectAuth = (req.body || {}).injectAuth;

    // K-TAG: credenciais centralizadas — o cliente envia apenas injectAuth:'ktag'
    // (sem url nem Authorization). O servidor resolve a URL e injeta o Basic Auth.
    if (injectAuth === 'ktag') {
      url = process.env.KTAG_API_URL || '';
      if (!url) {
        res.status(500).send({ error: 'K-TAG não configurada no servidor (KTAG_API_URL ausente).' });
        return;
      }
    }

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
    // K-TAG: injeta Basic Auth a partir dos secrets (cliente nunca vê as credenciais).
    if (injectAuth === 'ktag') {
      const u = KTAG_API_USER.value() || '';
      const p = KTAG_API_PASS.value() || '';
      safeHeaders['Authorization'] = 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
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

// ktagBatteryStatus agora vem de ./ktagLocation.js (telemetria observada:
// 0=alta … 3=muito baixa).

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

/**
 * Busca posições em LOTE no feibao (doc 3.3). Recebe tags com as chaves JÁ
 * decifradas ({ id, accessoryId, hashedAdvKey, privateKey }). Envia
 * hashed_keys[]/priv_keys[] paralelos e mapeia os resultados de volta pela `key`
 * (== hashedAdvKey), como exige a doc. Retorna [{ tag, location }] só das
 * posições válidas. NUNCA loga corpo/chaves — apenas status/mensagem no erro.
 */
async function fetchKtagLocationsBatch(tagsWithKeys) {
  const url = process.env.KTAG_API_URL;
  if (!url || tagsWithKeys.length === 0) return [];

  const payload = {
    hashed_keys: tagsWithKeys.map(t => t.hashedAdvKey),
    priv_keys: tagsWithKeys.map(t => t.privateKey)
  };
  const authHeader = `Basic ${Buffer.from(`${KTAG_API_USER.value()}:${KTAG_API_PASS.value()}`).toString('base64')}`;

  try {
    const response = await axios({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'User-Agent': KTAG_UA
      },
      data: payload,
      timeout: 30000
    });
    const results = Array.isArray(response.data && response.data.results) ? response.data.results : [];
    return mapKtagBatchResults(results, tagsWithKeys);
  } catch (e) {
    console.error(`[K-Tag] lote (${tagsWithKeys.length} tags) falhou:`, (e.response && e.response.status) || e.message);
    return [];
  }
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
 * SYNC DE CHAVES (doc 3.1 keysByLogin). Um admin do tenant dispara; o servidor
 * consulta a plataforma do fornecedor com as credenciais ÚNICAS da plataforma
 * (KTAG_API_USER/PASS) e atualiza as chaves (privateKey/hashedAdvKey) das tags
 * cujo `accessoryId == sn`, quando mudaram. Útil quando o fornecedor rotaciona
 * as chaves — causa comum de "parou de conectar".
 *
 * SEGURANÇA: as chaves NUNCA voltam ao cliente (só um resumo com contagens) e são
 * regravadas CIFRADAS (mesmo formato da UI). Dispositivos de outros tenants na
 * lista da plataforma são descartados — casamos só por SN das tags DESTE tenant.
 */
exports.syncKtagKeys = onCall({ secrets: [KTAG_API_USER, KTAG_API_PASS] }, async (request) => {
  const { tenantId } = await requireTenantAdmin(request);

  const url = process.env.KTAG_KEYS_API_URL || 'https://api.gps308.com/tag/system/tag/device/keysByLogin';
  const username = KTAG_API_USER.value();
  const password = KTAG_API_PASS.value();
  if (!username || !password) {
    throw new HttpsError('failed-precondition', 'Credenciais K-TAG não configuradas no servidor.');
  }

  let list;
  try {
    const response = await axios({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': KTAG_UA },
      data: { username, password },
      timeout: 20000,
      validateStatus: () => true
    });
    // Doc: code 200 = sucesso; 500 = usuário/senha errados. Não repassa detalhes.
    if (response.status !== 200 || !response.data || response.data.code !== 200) {
      const code = (response.data && response.data.code) || response.status;
      throw new HttpsError('internal', `keysByLogin falhou (code ${code}).`);
    }
    list = (response.data.data && response.data.data.list) || [];
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('internal', `Falha ao consultar keysByLogin: ${e.message}`);
  }

  const bySn = new Map();
  for (const d of list) {
    if (d && d.sn) bySn.set(String(d.sn), d);
  }

  const db = admin.firestore();
  const tagsSnap = await db.collection('tenants').doc(tenantId).collection('tags').get();

  let atualizadas = 0;
  let inalteradas = 0;
  const snsNaoEncontrados = [];
  let batch = db.batch();
  let pending = 0;

  for (const doc of tagsSnap.docs) {
    const tag = doc.data();
    if (!tag.accessoryId) continue;
    const remote = bySn.get(String(tag.accessoryId));
    if (!remote) { snsNaoEncontrados.push(tag.accessoryId); continue; }

    const curHashed = await ktagCrypto.decrypt(tenantId, tag.hashedAdvKey);
    const curPriv = await ktagCrypto.decrypt(tenantId, tag.privateKey);
    if (curHashed === remote.hashedAdvKey && curPriv === remote.privateKey) {
      inalteradas++;
      continue;
    }

    batch.update(doc.ref, {
      hashedAdvKey: await ktagCrypto.encrypt(tenantId, remote.hashedAdvKey),
      privateKey: await ktagCrypto.encrypt(tenantId, remote.privateKey)
    });
    atualizadas++;
    pending++;
    if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
  }
  if (pending > 0) await batch.commit();

  await logAudit(tenantId, 'UPDATE', 'Tag', `Sync de chaves K-TAG: ${atualizadas} atualizadas, ${inalteradas} inalteradas`, null, request.auth.uid);

  return {
    total: tagsSnap.size,
    atualizadas,
    inalteradas,
    naoEncontradas: snsNaoEncontrados.length,
    snsNaoEncontrados: snsNaoEncontrados.slice(0, 50) // limita o payload de volta
  };
});

// ============================================================
// Multi-tenant: sync de custom claims + admin user provisioning
// ============================================================

// ------------------------------------------------------------------
// UNIFIED IDENTITY MODEL
// ------------------------------------------------------------------
// Um mesmo e-mail (= um único Firebase UID no projeto) pode ser membro de
// vários tenants E/OU super admin da plataforma. As fontes da verdade são:
//
//   /tenants/{tid}/users/{uid}            → registro operacional por-tenant
//                                           (escrito pelo app/admin; criptografa name/cpf)
//   /system_admins/{uid}                  → flag de super admin global
//
// Derivados, mantidos SOMENTE por estas funções (Admin SDK; rules = read-only):
//
//   /identities/{uid}                     → { uid, email, isGlobalAdmin, disabled, updatedAt }
//   /identities/{uid}/memberships/{tid}   → { uid, tenantId, role, status, customRoleId?, email }
//
// Custom claims (= "JWT payload") — REPLACE em cada rebuild, fonte única:
//   { superadmin?: true, tn?: { [tid]: role }, tnBig?: true }
//   `tn` só inclui memberships APROVADOS. `superadmin` é poder de PAINEL —
//   as rules NÃO o usam para liberar dados operacionais de tenant (isolamento).
//   Limite de claims do Firebase ≈ 1000 bytes: se `tn` estourar, omitimos e
//   marcamos tnBig=true; as rules então caem no fallback por doc de membership.

const MAX_CLAIM_BYTES = 900; // margem sob o teto de 1000 bytes do Firebase.

function identityDocRef(uid) {
  return admin.firestore().collection('identities').doc(uid);
}
function membershipColRef(uid) {
  return identityDocRef(uid).collection('memberships');
}

async function isGlobalAdminUid(uid) {
  const snap = await admin.firestore().collection('system_admins').doc(uid).get();
  return snap.exists;
}

/**
 * Espelha o registro de tenant para a camada de identidade. Não toca claims —
 * o caller deve chamar rebuildIdentityAndClaims(uid) em seguida.
 */
async function upsertMembership(uid, tenantId, data) {
  if (!uid || !tenantId) return;
  const email = (data.email || '').toLowerCase();
  await identityDocRef(uid).set({
    uid,
    email,
    updatedAt: Date.now(),
  }, { merge: true });
  await membershipColRef(uid).doc(tenantId).set({
    uid,
    tenantId,
    role: data.role || 'user',
    status: data.status || 'pending',
    customRoleId: data.customRoleId || null,
    clientId: data.role === 'client' ? (data.clientId || null) : null,
    email,
    updatedAt: Date.now(),
  }, { merge: true });
}

async function removeMembership(uid, tenantId) {
  if (!uid || !tenantId) return;
  await membershipColRef(uid).doc(tenantId).delete().catch(() => {});
}

/**
 * Recomputa /identities/{uid}.isGlobalAdmin + custom claims a partir de TODAS
 * as memberships + system_admins. Fonte única que faz setCustomUserClaims
 * (REPLACE), então limpa claims legadas {tenantId, role, approved} no processo.
 */
async function rebuildIdentityAndClaims(uid) {
  if (!uid) return;
  try {
    const [membersSnap, isGlobal] = await Promise.all([
      membershipColRef(uid).get(),
      isGlobalAdminUid(uid),
    ]);

    const tn = {};
    membersSnap.forEach((d) => {
      const m = d.data();
      if (m.status === 'approved') tn[d.id] = m.role || 'user';
    });

    const claims = {};
    if (isGlobal) claims.superadmin = true;
    // Mede o tamanho só com `tn` para decidir fallback.
    const withTn = { ...claims, tn };
    if (Buffer.byteLength(JSON.stringify(withTn), 'utf8') <= MAX_CLAIM_BYTES) {
      if (Object.keys(tn).length > 0) claims.tn = tn;
    } else {
      claims.tnBig = true; // rules caem no fallback por doc de membership.
    }

    await admin.auth().setCustomUserClaims(uid, claims);
    await identityDocRef(uid).set({
      uid,
      isGlobalAdmin: !!isGlobal,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.error('rebuildIdentityAndClaims falhou', { uid, error: e.message });
  }
}

exports.onTenantUserCreate = onDocumentCreated(
  'tenants/{tenantId}/users/{uid}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;
    const { uid, tenantId } = event.params;
    await upsertMembership(uid, tenantId, data);
    await rebuildIdentityAndClaims(uid);
    await logAudit(tenantId, 'CREATE', 'User', `Usuário provisionado: ${data.email}`, uid, data.id || 'SYSTEM');
    return null;
  }
);

exports.onTenantUserUpdate = onDocumentUpdated(
  'tenants/{tenantId}/users/{uid}',
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after) return null;
    const { uid, tenantId } = event.params;

    const roleChanged = before?.role !== after.role;
    const statusChanged = before?.status !== after.status;
    const customRoleChanged = before?.customRoleId !== after.customRoleId;
    if (roleChanged || statusChanged || customRoleChanged) {
      await upsertMembership(uid, tenantId, after);
      await rebuildIdentityAndClaims(uid);
      await logAudit(
        tenantId,
        'UPDATE',
        'User',
        `Permissões atualizadas: role=${after.role}, status=${after.status}`,
        uid,
        after.updatedBy || 'SYSTEM'
      );
    }
    return null;
  }
);

exports.onTenantUserDelete = onDocumentDeleted(
  'tenants/{tenantId}/users/{uid}',
  async (event) => {
    const { uid, tenantId } = event.params;
    await removeMembership(uid, tenantId);
    await rebuildIdentityAndClaims(uid);
    await logAudit(tenantId, 'DELETE', 'User', `Membership removida do tenant`, uid, 'SYSTEM');
    return null;
  }
);

/**
 * Backfill idempotente: reconstrói /identities + memberships + claims a partir
 * dos docs existentes em /tenants/*\/users/* e /system_admins/*. Seguro rodar
 * várias vezes. Apenas super admin.
 */
exports.migrateIdentities = onCall(async (request) => {
  await requireSuperAdmin(request);
  const db = admin.firestore();
  const tenantsSnap = await db.collection('tenants').get();

  const touched = new Set();
  let memberships = 0;
  for (const t of tenantsSnap.docs) {
    const usersSnap = await t.ref.collection('users').get();
    for (const u of usersSnap.docs) {
      const data = u.data();
      await upsertMembership(u.id, t.id, data);
      touched.add(u.id);
      memberships++;
    }
  }

  // system_admins → identidade pode existir sem nenhuma membership de tenant.
  const adminsSnap = await db.collection('system_admins').get();
  adminsSnap.forEach((d) => touched.add(d.id));

  for (const uid of touched) {
    await rebuildIdentityAndClaims(uid);
  }

  return { identities: touched.size, memberships, tenants: tenantsSnap.size };
});

// ------------------------------------------------------------------
// SUPER ADMIN — gestão de ACESSOS (memberships cross-tenant)
// ------------------------------------------------------------------
// Permite ao super admin conceder/revogar acesso de qualquer e-mail a qualquer
// tenant e consultar os vínculos de um e-mail. Escrever /tenants/{tid}/users/{uid}
// dispara os triggers que mantêm /identities + claims em sincronia.

// Papéis concedíveis no escopo de um tenant. 'superadmin' NÃO entra aqui — é
// gerido por addSystemAdmin/removeSystemAdmin (poder de painel, separado).
const GRANTABLE_TENANT_ROLES = new Set([
  'admin', 'admin_tecnico', 'moderator', 'user', 'technician', 'client',
]);

/** Consulta vínculos (memberships) + flag de super admin de um e-mail. */
exports.superAdminLookupIdentity = onCall(async (request) => {
  await requireSuperAdmin(request);
  const email = String(request.data?.email || '').toLowerCase().trim();
  if (!email) throw new HttpsError('invalid-argument', 'email é obrigatório.');

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') return { found: false, email };
    throw new HttpsError('internal', `Falha ao buscar e-mail: ${e.message}`);
  }
  const uid = userRecord.uid;
  const [membersSnap, isGlobal] = await Promise.all([
    membershipColRef(uid).get(),
    isGlobalAdminUid(uid),
  ]);
  const memberships = membersSnap.docs.map((d) => {
    const m = d.data();
    return { tenantId: d.id, role: m.role || 'user', status: m.status || 'pending' };
  });
  return {
    found: true,
    uid,
    email: userRecord.email || email,
    disabled: !!userRecord.disabled,
    isGlobalAdmin: isGlobal,
    memberships,
  };
});

/**
 * Concede (ou atualiza o papel de) acesso de um e-mail a um tenant.
 * Cria a conta no Firebase Auth se ainda não existir (retorna senha temporária).
 */
exports.superAdminGrantMembership = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const email = String(request.data?.email || '').toLowerCase().trim();
  const tenantId = String(request.data?.tenantId || '').toLowerCase().trim();
  const role = String(request.data?.role || 'user');
  const name = request.data?.name ? String(request.data.name) : '';

  if (!email || !tenantId) throw new HttpsError('invalid-argument', 'email e tenantId são obrigatórios.');
  if (!GRANTABLE_TENANT_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', `Papel inválido: ${role}.`);
  }
  const tenantSnap = await admin.firestore().collection('tenants').doc(tenantId).get();
  if (!tenantSnap.exists) throw new HttpsError('not-found', `Tenant ${tenantId} não encontrado.`);

  // Resolve/cria a conta no Auth.
  let userRecord;
  let created = false;
  let tempPassword = null;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', `Falha ao buscar e-mail: ${e.message}`);
    }
    tempPassword = generateRandomPassword();
    try {
      userRecord = await admin.auth().createUser({ email, password: tempPassword, displayName: name || email });
      created = true;
    } catch (ce) {
      if (ce.code === 'auth/invalid-email') throw new HttpsError('invalid-argument', 'E-mail inválido.');
      throw new HttpsError('internal', `Falha ao criar usuário: ${ce.message}`);
    }
  }
  const uid = userRecord.uid;

  const ref = admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(uid);
  const existing = await ref.get();
  const userDoc = {
    id: uid,
    email,
    name: name || email, // plaintext OK: encryption.decrypt devolve o original p/ não-ciphertext.
    role,
    status: 'approved',
    tenantId,
    updatedBy: callerUid,
  };
  if (!existing.exists) userDoc.createdAt = Date.now();
  await ref.set(userDoc, { merge: true });

  // Síncrono p/ claims já válidas no retorno (o trigger também roda, idempotente).
  await upsertMembership(uid, tenantId, userDoc);
  await rebuildIdentityAndClaims(uid);

  await logAudit(tenantId, existing.exists ? 'UPDATE' : 'CREATE', 'User',
    `Super admin ${existing.exists ? 'alterou papel de' : 'concedeu acesso a'} ${email} (${role})`, uid, callerUid);

  return { uid, email, tenantId, role, created, tempPassword };
});

/** Revoga o acesso de um e-mail a um tenant. NÃO apaga a conta global. */
exports.superAdminRevokeMembership = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const tenantId = String(request.data?.tenantId || '').toLowerCase().trim();
  let uid = request.data?.uid ? String(request.data.uid) : '';
  const email = String(request.data?.email || '').toLowerCase().trim();
  if (!tenantId || (!uid && !email)) {
    throw new HttpsError('invalid-argument', 'tenantId e (uid ou email) são obrigatórios.');
  }
  if (!uid && email) {
    try { uid = (await admin.auth().getUserByEmail(email)).uid; }
    catch (e) { throw new HttpsError('not-found', 'Usuário não encontrado.'); }
  }
  // Apaga só o doc do tenant — onTenantUserDelete limpa a membership + claims.
  // A conta Auth é preservada (pode ter outros vínculos / ser super admin).
  await admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(uid).delete();
  await removeMembership(uid, tenantId);
  await rebuildIdentityAndClaims(uid);
  await logAudit(tenantId, 'DELETE', 'User', `Super admin revogou acesso de ${email || uid}`, uid, callerUid);
  return { ok: true, uid, tenantId };
});

/**
 * Resolve o tenantId-alvo de uma request, na ordem:
 *   1. request.data.tenantId (explícito — sempre vence).
 *   2. claim novo `tn` ({ [tid]: role }) SE houver exatamente uma membership.
 *      Com múltiplas memberships é ambíguo, então exigimos tenantId explícito.
 *   3. claim legado `tenantId` (modelo antigo, removido pelo rebuild de claims;
 *      mantido só por compat com tokens ainda não renovados).
 * Retorna '' se não for possível resolver com segurança.
 */
function resolveTenantId(request) {
  const explicit = request.data?.tenantId;
  if (explicit) return String(explicit).toLowerCase().trim();
  const token = request.auth?.token || {};
  const tn = token.tn;
  if (tn && typeof tn === 'object') {
    const keys = Object.keys(tn);
    if (keys.length === 1) return keys[0];
  }
  return token.tenantId ? String(token.tenantId).toLowerCase().trim() : '';
}

/**
 * Resolve quem é o caller e em que tenant ele está, validando que é admin
 * daquele tenant. Throws HttpsError se não autorizado.
 */
async function requireTenantAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login obrigatório.');
  }
  const callerUid = request.auth.uid;
  const tenantId = resolveTenantId(request);
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

function isRepeatedDocument(digits) {
  return /^(\d)\1+$/.test(digits);
}
function isValidCpf(value) {
  const cpf = String(value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || isRepeatedDocument(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(cpf[size])) return false;
  }
  return true;
}
function isValidCnpj(value) {
  const cnpj = String(value || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || isRepeatedDocument(cnpj)) return false;
  const calc = (length) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const remainder = weights.reduce((sum, weight, i) => sum + Number(cnpj[i]) * weight, 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}
function isValidCpfCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 11 ? isValidCpf(digits) : digits.length === 14 ? isValidCnpj(digits) : false;
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
  if (cpf && !isValidCpf(cpf)) {
    throw new HttpsError('invalid-argument', 'CPF inválido.');
  }
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

  // O trigger onTenantUserCreate também faz isso, mas chamamos síncrono aqui
  // para garantir identidade + claims válidos no retorno (admin pode agir já).
  await upsertMembership(uid, tenantId, userDoc);
  await rebuildIdentityAndClaims(uid);

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
 * Provisiona o acesso ao portal para um cliente identificado por CPF.
 *
 * O fluxo legado criava apenas /tenants/{tid}/users/client_{cpf} e gravava a
 * senha no Firestore. Isso nunca criava uma conta no Firebase Auth. Esta
 * callable cria (ou reaproveita) a conta global, grava o usuário sob o UID real
 * e migra o documento legado de forma idempotente.
 */
exports.provisionClientAccess = onCall(async (request) => {
  const { tenantId, callerUid } = await requireTenantAdmin(request);
  const cpf = String(request.data?.cpf || '').replace(/\D/g, '');
  const name = String(request.data?.name || '').trim();
  const clientId = String(request.data?.clientId || '').trim();
  const resetInitialPassword = request.data?.resetInitialPassword === true;

  if (!isValidCpf(cpf)) {
    throw new HttpsError('invalid-argument', 'CPF inválido.');
  }
  if (!name) throw new HttpsError('invalid-argument', 'name é obrigatório.');

  const email = `${cpf}@client.ktag`;
  const initialPassword = cpf.slice(0, 6);
  let userRecord;
  let created = false;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', `Falha ao consultar conta do cliente: ${e.message}`);
    }
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: initialPassword,
        displayName: name,
      });
      created = true;
    } catch (ce) {
      throw new HttpsError('internal', `Falha ao criar conta do cliente: ${ce.message}`);
    }
  }

  const uid = userRecord.uid;
  // Ao habilitar um cadastro que já possui uma conta Auth legada, a senha
  // antiga não é conhecida pelo administrador. Reaplica a senha inicial
  // combinada para que o primeiro acesso não dependa de reset manual.
  const effectiveInitialPassword = created || resetInitialPassword ? initialPassword : null;
  if (resetInitialPassword && !created) {
    try {
      await admin.auth().updateUser(uid, { password: initialPassword, disabled: false, displayName: name });
    } catch (e) {
      throw new HttpsError('internal', `Falha ao preparar senha inicial: ${e.message}`);
    }
  }
  const users = admin.firestore().collection('tenants').doc(tenantId).collection('users');
  const legacyRef = users.doc(`client_${cpf}`);
  const targetRef = users.doc(uid);
  const [legacySnap, targetSnap] = await Promise.all([legacyRef.get(), targetRef.get()]);
  const legacyData = legacySnap.exists ? legacySnap.data() : {};
  const targetData = targetSnap.exists ? targetSnap.data() : {};
  const userDoc = {
    ...legacyData,
    ...targetData,
    id: uid,
    email,
    name: targetData.name || legacyData.name || name,
    cpf: targetData.cpf || legacyData.cpf || cpf,
    role: 'client',
    status: 'approved',
    tenantId,
    clientId: clientId || targetData.clientId || legacyData.clientId || null,
    createdAt: targetData.createdAt || legacyData.createdAt || Date.now(),
    updatedAt: Date.now(),
    // Remove qualquer senha deixada pelo modelo legado. Senhas pertencem
    // exclusivamente ao Firebase Authentication.
    password: admin.firestore.FieldValue.delete(),
  };

  await targetRef.set(userDoc, { merge: true });
  await upsertMembership(uid, tenantId, userDoc);
  await rebuildIdentityAndClaims(uid);
  if (legacySnap.exists && legacyRef.id !== uid) await legacyRef.delete();

  await logAudit(tenantId, created ? 'CREATE' : 'UPDATE', 'Client',
    `Acesso do cliente provisionado: ${email}`, uid, callerUid);
  return { uid, email, created, initialPassword: effectiveInitialPassword };
});

/** Revoga somente o acesso deste cliente a este tenant, sem apagar a conta global. */
exports.revokeClientAccess = onCall(async (request) => {
  const { tenantId, callerUid } = await requireTenantAdmin(request);
  const cpf = String(request.data?.cpf || '').replace(/\D/g, '');
  if (!isValidCpf(cpf)) throw new HttpsError('invalid-argument', 'CPF inválido.');
  const email = `${cpf}@client.ktag`;
  let userRecord;
  try { userRecord = await admin.auth().getUserByEmail(email); }
  catch (e) {
    if (e.code === 'auth/user-not-found') return { ok: true, revoked: false };
    throw new HttpsError('internal', `Falha ao consultar conta do cliente: ${e.message}`);
  }
  const memberRef = admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(userRecord.uid);
  const member = await memberRef.get();
  if (member.exists && member.data()?.role !== 'client') throw new HttpsError('permission-denied', 'A conta não é um cliente deste tenant.');
  await memberRef.delete();
  await removeMembership(userRecord.uid, tenantId);
  await rebuildIdentityAndClaims(userRecord.uid);
  await logAudit(tenantId, 'DELETE', 'Client', `Acesso do cliente revogado: ${email}`, userRecord.uid, callerUid);
  return { ok: true, revoked: member.exists };
});

/** Redefine no Firebase Auth a senha de um cliente pertencente ao tenant. */
exports.resetClientPassword = onCall(async (request) => {
  const { tenantId, callerUid } = await requireTenantAdmin(request);
  const cpf = String(request.data?.cpf || '').replace(/\D/g, '');
  const mode = request.data?.mode === 'default' ? 'default' : 'cpf';
  if (!isValidCpf(cpf)) {
    throw new HttpsError('invalid-argument', 'CPF inválido.');
  }

  const email = `${cpf}@client.ktag`;
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'Cliente ainda não possui conta de acesso.');
    }
    throw new HttpsError('internal', `Falha ao consultar conta do cliente: ${e.message}`);
  }

  const memberSnap = await admin.firestore().collection('tenants').doc(tenantId)
    .collection('users').doc(userRecord.uid).get();
  if (!memberSnap.exists || memberSnap.data()?.role !== 'client') {
    throw new HttpsError('permission-denied', 'Cliente não pertence a este tenant.');
  }

  const password = mode === 'default' ? '123456' : cpf.slice(0, 6);
  await admin.auth().updateUser(userRecord.uid, { password });
  await logAudit(tenantId, 'UPDATE', 'Client', `Senha do cliente redefinida: ${email}`,
    userRecord.uid, callerUid);
  return { uid: userRecord.uid, email, password };
});

/**
 * Admin do tenant remove um usuário DESTE tenant.
 *
 * Identidade unificada: o mesmo e-mail pode pertencer a outros tenants e/ou ser
 * super admin. Por isso só apagamos a conta do Firebase Auth se esta for a
 * ÚLTIMA membership E o usuário não for super admin. Caso contrário, apenas
 * removemos a membership deste tenant (o doc delete dispara onTenantUserDelete,
 * que limpa /identities/{uid}/memberships/{tid} + recomputa claims).
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

  // Remove a membership deste tenant primeiro (dispara o trigger de cleanup).
  await admin.firestore().collection('tenants').doc(tenantId).collection('users').doc(userId).delete();

  // Decide se a conta Auth pode ser apagada: só se não restar NENHUM vínculo.
  const [otherMemberships, isGlobal] = await Promise.all([
    membershipColRef(userId).get(),
    isGlobalAdminUid(userId),
  ]);
  const remaining = otherMemberships.docs.filter((d) => d.id !== tenantId);

  if (remaining.length === 0 && !isGlobal) {
    try {
      await admin.auth().deleteUser(userId);
      await identityDocRef(userId).delete().catch(() => {});
    } catch (e) {
      if (e.code !== 'auth/user-not-found') console.warn('deleteUser auth error:', e.message);
    }
    await logAudit(tenantId, 'DELETE', 'User', `Admin removeu usuário ${userId} (conta global excluída)`, userId, callerUid);
  } else {
    await logAudit(tenantId, 'DELETE', 'User', `Admin removeu usuário ${userId} deste tenant (conta mantida — outros vínculos)`, userId, callerUid);
  }
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

const RESERVED_TENANT_SLUGS = ['admin', 'api', 'api-vps', 'www', 'mail', 'ftp', 'static', 'cdn', 'auth', 'app', 'system', 'root', 'localhost', 'lock'];
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return 'Slug obrigatório.';
  if (!SLUG_REGEX.test(slug)) return 'Slug deve ter 3-32 caracteres: letras minúsculas, números e hífens.';
  if (RESERVED_TENANT_SLUGS.includes(slug)) return `Slug "${slug}" é reservado.`;
  return null;
}

/**
 * Espelho público do tenant em /tenants/{slug}/public_settings/meta.
 * Mantido aqui pelo backend porque a regra do Firestore protege o root doc
 * (billing.asaas* não pode vazar pré-login). Este espelho só carrega name/
 * active/plan e é lido pelo TenantContext do SPA antes do login.
 *
 * Chame após qualquer mudança em name/active/plan no root doc.
 */
async function writeTenantPublicMeta(slug, fields) {
  const ref = admin.firestore()
    .collection('tenants').doc(slug)
    .collection('public_settings').doc('meta');
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.active !== undefined) patch.active = fields.active !== false;
  if (fields.plan !== undefined) patch.plan = fields.plan || 'basic';
  if (Object.keys(patch).length === 0) return;
  await ref.set(patch, { merge: true });
}

/**
 * Cria um novo tenant + opcional admin inicial (Auth user + doc).
 * Retorna { slug, ownerEmail?, ownerPassword? } se ownerEmail foi passado.
 */
exports.createTenant = onCall({ secrets: [ASAAS_API_KEY] }, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const {
    slug, name, plan = 'basic', active = true, ownerEmail, ownerName,
    billing: billingInput, logoBase64Light, logoBase64Dark,
  } = request.data || {};

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

    const configPatch = { language: 'pt', customAppName: name };
    const MAX_LOGO_BASE64_BYTES = 400 * 1024; // teto defensivo — espelha o limite já aplicado no client
    if (typeof logoBase64Light === 'string' && logoBase64Light.length > 0) {
      if (logoBase64Light.length > MAX_LOGO_BASE64_BYTES) {
        throw new HttpsError('invalid-argument', 'Logo (modo claro) excede o tamanho máximo permitido.');
      }
      configPatch.customLogoBase64Light = logoBase64Light;
    }
    if (typeof logoBase64Dark === 'string' && logoBase64Dark.length > 0) {
      if (logoBase64Dark.length > MAX_LOGO_BASE64_BYTES) {
        throw new HttpsError('invalid-argument', 'Logo (modo escuro) excede o tamanho máximo permitido.');
      }
      configPatch.customLogoBase64Dark = logoBase64Dark;
    }
    await tenantRef.collection('settings').doc('config').set(configPatch, { merge: true });

    // Espelho público — necessário pro SPA carregar o subdomínio sem login.
    await writeTenantPublicMeta(slug, { name, active, plan });

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
      const ownerDoc = {
        id: ownerUid,
        name: ownerName || cleanEmail,
        email: cleanEmail,
        role: 'admin',
        status: 'approved',
        tenantId: slug,
        createdAt: Date.now(),
      };
      await tenantRef.collection('users').doc(ownerUid).set(ownerDoc);
      // Espelha membership + recomputa claims. Se o e-mail já era membro de
      // outros tenants, o rebuild PRESERVA esses acessos (não sobrescreve como
      // o claim singular legado fazia).
      try {
        await upsertMembership(ownerUid, slug, ownerDoc);
        await rebuildIdentityAndClaims(ownerUid);
      } catch (e) {
        console.error('[createTenant] identity/claims falhou', { uid: ownerUid, code: e.code, message: e.message });
        throw new HttpsError('internal', `Falha ao setar identidade/claims do admin: ${e.message}`);
      }
      await tenantRef.update({ ownerUserId: ownerUid });
    }

    await logAudit(null, 'CREATE', 'Tenant', `Super admin criou tenant ${slug} (${plan})`, slug, callerUid);

    // Assinatura opcional — reaproveita a mesma lógica de createTenantSubscription.
    // Falha aqui NÃO desfaz o tenant já criado: o admin pode configurar a cobrança
    // manualmente depois em Financeiro → Assinaturas.
    let billing = null;
    let billingError = null;
    if (billingInput) {
      try {
        const subResult = await createSubscriptionForTenant(slug, { ...billingInput, slug }, callerUid);
        billing = subResult.billing;
      } catch (e) {
        console.error('[createTenant] criação de assinatura falhou', { slug, code: e?.code, message: e?.message });
        billingError = e?.message || 'Falha ao criar assinatura.';
      }
    }

    return { slug, ownerEmail: ownerEmail || null, ownerPassword, ownerUid, billing, billingError };
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
    await writeTenantPublicMeta(slug, { active });
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
  if (patch.name !== undefined || patch.plan !== undefined) {
    await writeTenantPublicMeta(slug, { name: patch.name, plan: patch.plan });
  }
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
  // Recomputa identidade + claims (superadmin + memberships preservadas).
  await rebuildIdentityAndClaims(targetUid);

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
  // Recomputa: remove o claim superadmin mas mantém memberships de tenant.
  await rebuildIdentityAndClaims(uid);

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
 * Backfill one-shot do espelho público (/tenants/{slug}/public_settings/meta).
 * Necessário pra tenants criados antes do espelho existir — sem ele, o SPA
 * retorna "Empresa não encontrada" no boot pré-login.
 *
 * Idempotente: pode ser chamado várias vezes sem efeito colateral.
 */
exports.backfillTenantPublicMeta = onCall(async (request) => {
  await requireSuperAdmin(request);
  const snap = await admin.firestore().collection('tenants').get();
  let written = 0;
  for (const doc of snap.docs) {
    const t = doc.data() || {};
    await writeTenantPublicMeta(doc.id, {
      name: t.name || doc.id,
      active: t.active !== false,
      plan: t.plan || 'basic',
    });
    written++;
  }
  return { written };
});

/**
 * Lista usuários cross-tenant. Apenas super admin.
 * Implementação simples: itera tenants e concatena users. Para escalas grandes,
 * substituir por collectionGroup + index composto.
 */
exports.listAllUsers = onCall(async (request) => {
  await requireSuperAdmin(request);
  const { tenantId } = request.data || {};
  const tenantsSnap = tenantId
    ? [await admin.firestore().collection('tenants').doc(tenantId).get()].filter(d => d.exists)
    : (await admin.firestore().collection('tenants').get()).docs;
  const users = [];
  for (const t of tenantsSnap) {
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

/**
 * Lista quem tem acesso a um tenant (memberships via collectionGroup) e marca
 * quais desses uids são superadmins globais (system_admins). Usado na aba
 * "Usuários" do detalhe da empresa, para mostrar superadmins com acesso
 * concedido — complementa listAllUsers (usuários internos do tenant).
 */
exports.listTenantMemberships = onCall(async (request) => {
  await requireSuperAdmin(request);
  const { tenantId } = request.data || {};
  if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId é obrigatório.');

  const [membersSnap, adminsSnap] = await Promise.all([
    admin.firestore().collectionGroup('memberships').where('tenantId', '==', tenantId).get(),
    admin.firestore().collection('system_admins').get(),
  ]);
  const adminUids = new Set(adminsSnap.docs.map(d => d.id));

  const memberships = membersSnap.docs.map(d => {
    const data = d.data();
    return {
      uid: data.uid,
      email: data.email || null,
      role: data.role || 'user',
      status: data.status || 'pending',
      isGlobalAdmin: adminUids.has(data.uid),
    };
  });
  return { memberships };
});

exports.sendPushNotification = onCall(
  { secrets: VAPID_SECRETS },
  async (request) => {
    configureWebPush();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login obrigatório.');
    }

    const tenantId = resolveTenantId(request);
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
 * Lógica de criação de assinatura no Asaas, compartilhada entre o callable
 * `createTenantSubscription` e a criação opcional de billing dentro de
 * `createTenant` (cadastro de empresa já com cobrança configurada).
 * Body: { slug, priceCents, cycle?, billingType?, dueDay?, payer: { name, email, cpfCnpj, phone? } }
 */
async function createSubscriptionForTenant(slug, data, callerUid) {
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const priceCents = Number(data.priceCents);
  if (!Number.isFinite(priceCents) || priceCents < 100) {
    throw new HttpsError('invalid-argument', 'priceCents deve ser >= 100 (R$ 1,00).');
  }
  const payer = data.payer || {};
  if (!payer.name || !payer.email || !payer.cpfCnpj) {
    throw new HttpsError('invalid-argument', 'payer.name, payer.email e payer.cpfCnpj são obrigatórios.');
  }
  if (!isValidCpfCnpj(payer.cpfCnpj)) {
    throw new HttpsError('invalid-argument', 'CPF/CNPJ do pagador inválido.');
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
}

exports.createTenantSubscription = onCall(ASAAS_OPTS, async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const data = request.data || {};
  const slug = ensureBillingPayload(data);
  return createSubscriptionForTenant(slug, data, callerUid);
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
 * Usa listPaymentsByCustomer (paginado) quando disponível para capturar
 * cobranças avulsas além das da assinatura.
 */
exports.syncTenantBilling = onCall(ASAAS_OPTS, async (request) => {
  await requireSuperAdmin(request);
  const slug = ensureBillingPayload(request.data || {});
  const { ref, data: tenant } = await getTenantOrThrow(slug);

  const subId = tenant.billing?.asaasSubscriptionId;
  const custId = tenant.billing?.asaasCustomerId;
  if (!subId && !custId) {
    return { ok: false, reason: 'sem assinatura' };
  }

  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  let sub, payments;
  try {
    [sub, payments] = await Promise.all([
      subId ? asaas.getSubscription(apiKey, subId).catch(() => null) : null,
      custId
        ? asaas.listPaymentsByCustomer(apiKey, custId)
        : asaas.listSubscriptionPayments(apiKey, subId, 100),
    ]);
  } catch (e) {
    const msg = e?.response?.data?.errors?.[0]?.description || e?.message || 'Erro Asaas';
    throw new HttpsError('internal', `Falha ao consultar Asaas: ${msg}`);
  }

  // Atualiza invoices (pagas e não pagas)
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
  const custId = tenant.billing?.asaasCustomerId;
  if (!subId && !custId) return { ok: false, reason: 'sem assinatura' };

  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  let sub, payments;
  try {
    [sub, payments] = await Promise.all([
      subId ? asaas.getSubscription(apiKey, subId).catch(() => null) : null,
      custId
        ? asaas.listPaymentsByCustomer(apiKey, custId)
        : asaas.listSubscriptionPayments(apiKey, subId, 100),
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
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  try {
    await asaas.sendPaymentNotification(apiKey, paymentId);
  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.errors?.[0]?.description || e?.message || 'Erro Asaas';
    console.error('[remindTenantPayment] falha Asaas:', { slug, paymentId, status, msg });
    throw new HttpsError('internal', `Falha ao reenviar lembrete: ${msg}`);
  }

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

/** Retorna o saldo disponível da conta Asaas em centavos. */
exports.getAsaasBalance = onCall(ASAAS_OPTS, async (request) => {
  await requireSuperAdmin(request);
  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');
  try {
    const data = await asaas.getBalance(apiKey);
    return {
      balanceCents: Math.round((data.balance || 0) * 100),
      balanceReal: data.balance || 0,
      env: (process.env.ASAAS_ENV || 'sandbox').toLowerCase(),
    };
  } catch (e) {
    const msg = e?.response?.data?.errors?.[0]?.description || e?.message || 'Erro Asaas';
    throw new HttpsError('internal', `Falha ao buscar saldo: ${msg}`);
  }
});

/**
 * Sincroniza TODOS os tenants com o Asaas de uma vez.
 * Para cada tenant com asaasCustomerId (ou asaasSubscriptionId), busca
 * todos os pagamentos — pagos e não pagos — e atualiza o Firestore.
 * Timeout de 300s para acomodar muitos tenants.
 */
exports.syncAllTenantsBilling = onCall({ ...ASAAS_OPTS, timeoutSeconds: 300 }, async (request) => {
  await requireSuperAdmin(request);
  const apiKey = ASAAS_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'ASAAS_API_KEY não configurada.');

  const db = admin.firestore();
  const tenantsSnap = await db.collection('tenants').get();

  let synced = 0;
  const errors = [];

  for (const t of tenantsSnap.docs) {
    const tenant = t.data();
    const custId = tenant.billing?.asaasCustomerId;
    const subId  = tenant.billing?.asaasSubscriptionId;
    if (!custId && !subId) continue;

    try {
      const payments = custId
        ? await asaas.listPaymentsByCustomer(apiKey, custId)
        : await asaas.listSubscriptionPayments(apiKey, subId, 100);

      const batch = db.batch();
      for (const p of payments) {
        const inv = asaas.paymentToInvoice(p, tenant.slug || t.id);
        inv.createdAt = inv.createdAt || Date.now();
        batch.set(t.ref.collection('invoices').doc(p.id), inv, { merge: true });
      }
      await batch.commit();

      const hasOverdue = payments.some(p => asaas.normalizeStatus(p.status) === 'OVERDUE');
      let statusFromSub = hasOverdue ? 'overdue' : 'active';
      if (subId) {
        const sub = await asaas.getSubscription(apiKey, subId).catch(() => null);
        if (sub?.status === 'INACTIVE') statusFromSub = 'canceled';
      }
      await t.ref.update({ 'billing.status': statusFromSub, 'billing.lastSyncedAt': Date.now() });

      synced++;
    } catch (e) {
      const label = tenant.slug || t.id;
      console.error(`syncAllTenantsBilling: erro em ${label}`, e.message);
      errors.push(`${label}: ${e.message}`);
    }
  }

  return { synced, errors, total: tenantsSnap.size };
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
  const { slug, limiteTags, limiteVeiculos, maxUsers, features } = request.data || {};
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
  // features = override de módulos por empresa (sobrescreve os módulos do plano quando definido).
  // null limpa o override (volta a herdar do plano); array define a lista explícita.
  if (features !== undefined) {
    if (features === null) {
      if (prev.features !== undefined) {
        changes.push('features: override removido (volta a herdar do plano)');
        delete next.features;
      }
    } else if (Array.isArray(features)) {
      const cleaned = features.filter((f) => typeof f === 'string');
      if (JSON.stringify(prev.features || []) !== JSON.stringify(cleaned)) {
        changes.push(`features: [${(prev.features || []).join(', ')}] → [${cleaned.join(', ')}]`);
        next.features = cleaned;
      }
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
    await writeTenantPublicMeta(slug, { active: false });
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

  // 2. Coletar UIDs de usuários do tenant.
  const usersSnap = await tenantRef.collection('users').get();
  const userUids = usersSnap.docs.map(d => d.id);

  // 3. IDENTIDADE UNIFICADA: desativar no Auth SOMENTE contas sem outro vínculo.
  // Uma conta compartilhada (mesmo e-mail em outro tenant, ou super admin) NÃO
  // pode ser desabilitada — isso bloquearia o acesso aos demais ambientes.
  // (As memberships em /identities/{uid}/memberships são limpas pelos triggers
  // onTenantUserDelete disparados no recursiveDelete abaixo.)
  let disabledCount = 0;
  await Promise.all(userUids.map(async (uid) => {
    try {
      const [membersSnap, isGlobal] = await Promise.all([
        membershipColRef(uid).get(),
        isGlobalAdminUid(uid),
      ]);
      const hasOtherTenant = membersSnap.docs.some((d) => d.id !== slug);
      if (hasOtherTenant || isGlobal) return; // mantém a conta — tem outros acessos
      await admin.auth().updateUser(uid, { disabled: true });
      disabledCount++;
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
      details: `HARD delete de "${tenant.name}" (${slug}) — ${userUids.length} usuários (${disabledCount} contas desativadas; demais mantidas por terem outros vínculos), billing=${billing.status || 'none'}.`,
      tenantSlug: slug,
      callerUid,
      timestamp: Date.now(),
    });
  } catch (_) { /* sem coleção é OK */ }

  return { slug, mode, ok: true, usersDisabled: disabledCount, usersTotal: userUids.length };
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

// ============================================================
// CONTAS A PAGAR/RECEBER (despesas manuais por categoria)
// ============================================================

const EXPENSE_CATEGORIES_DOC = ['system_config', 'expense_categories'];

function expenseCategoriesDocRef() {
  return admin.firestore().collection(EXPENSE_CATEGORIES_DOC[0]).doc(EXPENSE_CATEGORIES_DOC[1]);
}

function expensesCollectionRef() {
  return admin.firestore().collection('system_finance').doc('root').collection('expenses');
}

exports.listExpenseCategories = onCall(async (request) => {
  await requireSuperAdmin(request);
  const snap = await expenseCategoriesDocRef().get();
  const categories = snap.exists ? (snap.data().categories || []) : [];
  return { categories };
});

exports.upsertExpenseCategory = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { id, label, color } = request.data || {};
  const cleanLabel = String(label || '').trim();
  if (!cleanLabel) throw new HttpsError('invalid-argument', 'label é obrigatório.');

  const ref = expenseCategoriesDocRef();
  const snap = await ref.get();
  const categories = snap.exists ? (snap.data().categories || []) : [];
  const categoryId = id || `cat_${Date.now().toString(36)}`;
  const idx = categories.findIndex(c => c.id === categoryId);
  const next = { id: categoryId, label: cleanLabel, color: color || undefined };
  if (idx >= 0) categories[idx] = next; else categories.push(next);

  await ref.set({ categories, updatedAt: Date.now() }, { merge: true });
  await logAudit(null, 'UPDATE', 'ExpenseCategory', `Categoria "${cleanLabel}" salva`, null, callerUid);
  return { categories };
});

exports.deleteExpenseCategory = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'id é obrigatório.');

  const ref = expenseCategoriesDocRef();
  const snap = await ref.get();
  const categories = snap.exists ? (snap.data().categories || []) : [];
  const next = categories.filter(c => c.id !== id);

  await ref.set({ categories: next, updatedAt: Date.now() }, { merge: true });
  await logAudit(null, 'DELETE', 'ExpenseCategory', `Categoria ${id} removida`, null, callerUid);
  return { categories: next };
});

exports.listExpenses = onCall(async (request) => {
  await requireSuperAdmin(request);
  const { type, status, categoryId, limit } = request.data || {};

  // Filtra só por `type` no servidor (1 índice composto: type+dueDate). status/categoryId
  // são aplicados no client sobre o resultado já limitado — evita explosão de índices
  // compostos para uma tabela pequena gerenciada manualmente pelo admin.
  let query = expensesCollectionRef().orderBy('dueDate', 'desc');
  if (type === 'payable' || type === 'receivable') query = query.where('type', '==', type);

  const snap = await query.limit(Math.min(500, Number(limit) || 200)).get();
  let expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (status) expenses = expenses.filter(e => e.status === status);
  if (categoryId) expenses = expenses.filter(e => e.categoryId === categoryId);
  return { expenses };
});

exports.createExpense = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { categoryId, description, amountCents, type, dueDate, notes } = request.data || {};

  if (type !== 'payable' && type !== 'receivable') {
    throw new HttpsError('invalid-argument', 'type deve ser "payable" ou "receivable".');
  }
  const cleanAmount = Number(amountCents);
  if (!Number.isFinite(cleanAmount) || cleanAmount < 1) {
    throw new HttpsError('invalid-argument', 'amountCents deve ser >= 1.');
  }
  const cleanDescription = String(description || '').trim();
  if (!cleanDescription) throw new HttpsError('invalid-argument', 'description é obrigatório.');

  const doc = {
    categoryId: categoryId || null,
    description: cleanDescription,
    amountCents: cleanAmount,
    type,
    status: 'pending',
    dueDate: dueDate ? Number(dueDate) : null,
    notes: notes ? String(notes).trim() : null,
    createdAt: Date.now(),
    createdBy: callerUid,
  };
  const ref = await expensesCollectionRef().add(doc);
  await logAudit(null, 'CREATE', 'Expense', `Despesa "${cleanDescription}" criada (${type})`, null, callerUid);
  return { id: ref.id, ...doc };
});

exports.updateExpense = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { id, categoryId, description, amountCents, dueDate, notes, status } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'id é obrigatório.');

  const ref = expensesCollectionRef().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Despesa não encontrada.');

  const patch = {};
  if (categoryId !== undefined) patch.categoryId = categoryId || null;
  if (description !== undefined) patch.description = String(description).trim();
  if (amountCents !== undefined) {
    const v = Number(amountCents);
    if (!Number.isFinite(v) || v < 1) throw new HttpsError('invalid-argument', 'amountCents inválido.');
    patch.amountCents = v;
  }
  if (dueDate !== undefined) patch.dueDate = dueDate ? Number(dueDate) : null;
  if (notes !== undefined) patch.notes = notes ? String(notes).trim() : null;
  if (status !== undefined) {
    if (!['pending', 'paid', 'overdue'].includes(status)) {
      throw new HttpsError('invalid-argument', 'status inválido.');
    }
    patch.status = status;
    if (status === 'paid') patch.paidAt = Date.now();
  }
  if (Object.keys(patch).length === 0) return { id, changed: false };

  await ref.update(patch);
  await logAudit(null, 'UPDATE', 'Expense', `Despesa ${id} atualizada: ${Object.keys(patch).join(', ')}`, null, callerUid);
  return { id, changed: true };
});

exports.deleteExpense = onCall(async (request) => {
  const { uid: callerUid } = await requireSuperAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'id é obrigatório.');

  await expensesCollectionRef().doc(id).delete();
  await logAudit(null, 'DELETE', 'Expense', `Despesa ${id} removida`, null, callerUid);
  return { id, deleted: true };
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
