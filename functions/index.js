const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });
const webpush = require("web-push");
const crypto = require("crypto"); // Nativo do Node.js

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- SECRETS VAULT (BACKEND ONLY) ---
// Em produção, use: functions.config().ktag.jwt_secret
const SECRETS = {
  JWT: "ktag-pro-super-secret-key-2025-v3-BACKEND-ONLY",
  SALT: "KTAG_SECURE_SALT_V3_2025_BACKEND_ONLY",
  INDEX_SALT: "KTAG_BLIND_INDEX_KEY_X9_BACKEND_ONLY"
};

// --- HELPER FUNCTIONS ---
function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const signature = crypto.createHmac('sha256', SECRETS.JWT)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SECRETS.SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- SECURE AUTH FUNCTIONS ---

/**
 * Login Seguro: Recebe senha em texto plano (via HTTPS), 
 * hasheia no servidor e verifica no banco. Retorna JWT assinado pelo servidor.
 */
exports.authLogin = functions.https.onCall(async (data, context) => {
  const { identifier, password } = data;
  
  // 1. Busca usuário (Admin SDK ignora regras de segurança do Firestore)
  const usersRef = admin.firestore().collection('ktag_users_db');
  const snapshot = await usersRef.where('email', '==', identifier.toLowerCase().trim()).get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError('not-found', 'Credenciais inválidas.');
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  // 2. Verifica Senha (Hash no servidor)
  // Nota: Aqui usamos Node crypto para hash, replicando a lógica antiga ou migrando para bcrypt (recomendado futuramente)
  const inputHash = crypto.createHash('sha256').update(password + SECRETS.SALT).digest('hex');
  
  if (inputHash !== userData.password) {
    // Fallback para migração se necessário
    if (userData.password !== password) {
       throw new functions.https.HttpsError('unauthenticated', 'Credenciais inválidas.');
    }
    // Se a senha estava em texto plano, atualize para hash agora
    await userDoc.ref.update({ password: inputHash });
  }

  if (userData.status !== 'approved' && userData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Conta pendente de aprovação.');
  }

  // 3. Gera JWT Assinado pelo Servidor
  const now = Math.floor(Date.now() / 1000);
  const token = signJWT({
    sub: userDoc.id,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    status: userData.status,
    companySlug: userData.companySlug,
    avatarInitial: userData.avatarInitial,
    iat: now,
    exp: now + (12 * 60 * 60) // 12h
  });

  // Retorna APENAS o token e dados públicos do usuário. Segredos ficam aqui.
  return {
    token,
    user: {
      id: userDoc.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      avatarInitial: userData.avatarInitial
    }
  };
});

/**
 * Registro Seguro: Cria usuário já com senha hashada no servidor.
 */
exports.authRegister = functions.https.onCall(async (data, context) => {
  const { name, email, password, ip } = data;
  
  const hash = crypto.createHash('sha256').update(password + SECRETS.SALT).digest('hex');
  const userId = crypto.randomUUID();
  
  const newUser = {
    id: userId,
    name,
    email: email.toLowerCase().trim(),
    password: hash,
    role: 'user',
    status: 'pending',
    ip: ip || 'unknown',
    createdAt: Date.now()
  };

  await admin.firestore().collection('ktag_users_db').doc(userId).set(newUser);
  return { success: true };
});

// --- EXISTING PROXY ---
// Mantenha o proxy existente, mas adicione segurança se possível
exports.proxyApi = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // ... (Manter código de proxy existente para compatibilidade)
    // Recomendação: Validar se o request tem um Authorization header com nosso JWT
    
    const { url, method, headers, body } = req.body;
    try {
        const response = await axios({
            url, method: method || 'GET', headers, data: body
        });
        res.status(response.status).send(response.data);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
  });
});

// --- PUSH NOTIFICATIONS ---
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
    // ... (Manter código de push existente)
    return { success: true };
});