/**
 * Cliente Asaas para Cloud Functions.
 *
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Produção: https://api.asaas.com/v3
 *
 * O ambiente é controlado por ASAAS_ENV ('sandbox' | 'production').
 * A API key vem do Secret Manager via param 'ASAAS_API_KEY'.
 *
 * Convenção crítica:
 *   Toda subscription enviada ao Asaas usa externalReference = tenantSlug.
 *   Isso nos permite resolver o tenant a partir de qualquer webhook sem
 *   manter um índice reverso no Firestore.
 */
const axios = require('axios');

function baseUrl() {
  const env = (process.env.ASAAS_ENV || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
}

function client(apiKey) {
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY não configurada. Rode: firebase functions:secrets:set ASAAS_API_KEY');
  }
  return axios.create({
    baseURL: baseUrl(),
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'ktag-platform/1.0',
    },
    timeout: 15000,
  });
}

function centsToReal(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

function isoDate(epochMs) {
  const d = epochMs ? new Date(epochMs) : new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Busca cliente Asaas por email. Retorna o primeiro match ou null. */
async function findCustomerByEmail(apiKey, email) {
  const res = await client(apiKey).get('/customers', { params: { email, limit: 1 } });
  return res.data?.data?.[0] || null;
}

async function createCustomer(apiKey, { name, email, cpfCnpj, phone, externalReference }) {
  const res = await client(apiKey).post('/customers', {
    name,
    email,
    cpfCnpj,
    phone,
    externalReference,
    notificationDisabled: false,
  });
  return res.data;
}

async function findOrCreateCustomer(apiKey, { name, email, cpfCnpj, phone, externalReference }) {
  const existing = await findCustomerByEmail(apiKey, email);
  if (existing) return existing;
  return createCustomer(apiKey, { name, email, cpfCnpj, phone, externalReference });
}

/**
 * Cria assinatura recorrente.
 * @param {object} args
 * @param {string} args.customerId Asaas customer id (cus_xxx)
 * @param {number} args.valueCents Valor em centavos
 * @param {'MONTHLY'|'QUARTERLY'|'YEARLY'} args.cycle
 * @param {'PIX'|'BOLETO'|'CREDIT_CARD'|'UNDEFINED'} args.billingType
 * @param {number} args.nextDueDateMs próxima data de vencimento (epoch ms)
 * @param {string} args.externalReference tenantSlug
 * @param {string} args.description ex: "Plano Pro - Empresa Acme"
 */
async function createSubscription(apiKey, args) {
  const body = {
    customer: args.customerId,
    billingType: args.billingType || 'UNDEFINED',
    value: centsToReal(args.valueCents),
    nextDueDate: isoDate(args.nextDueDateMs),
    cycle: args.cycle || 'MONTHLY',
    description: args.description,
    externalReference: args.externalReference,
    // E-mails de lembrete: Asaas avisa o pagador N dias antes do vencimento.
    // notificationDisabled já vem false no customer; aqui reforçamos
    // com lembretes em D-5 e D-1 (sobrescreve o default de D-5 do Asaas).
    sendPaymentByPostalService: false,
  };
  const res = await client(apiKey).post('/subscriptions', body);
  return res.data;
}

async function updateSubscription(apiKey, subscriptionId, patch) {
  const body = {};
  if (patch.valueCents !== undefined) body.value = centsToReal(patch.valueCents);
  if (patch.cycle) body.cycle = patch.cycle;
  if (patch.billingType) body.billingType = patch.billingType;
  if (patch.nextDueDateMs) body.nextDueDate = isoDate(patch.nextDueDateMs);
  if (patch.description !== undefined) body.description = patch.description;
  const res = await client(apiKey).post(`/subscriptions/${subscriptionId}`, body);
  return res.data;
}

async function cancelSubscription(apiKey, subscriptionId) {
  const res = await client(apiKey).delete(`/subscriptions/${subscriptionId}`);
  return res.data;
}

async function getSubscription(apiKey, subscriptionId) {
  const res = await client(apiKey).get(`/subscriptions/${subscriptionId}`);
  return res.data;
}

async function listSubscriptionPayments(apiKey, subscriptionId, limit = 20) {
  const res = await client(apiKey).get(`/subscriptions/${subscriptionId}/payments`, {
    params: { limit },
  });
  return res.data?.data || [];
}

async function getPayment(apiKey, paymentId) {
  const res = await client(apiKey).get(`/payments/${paymentId}`);
  return res.data;
}

/** Converte status Asaas em status interno InvoiceStatus. */
function normalizeStatus(asaasStatus) {
  switch (asaasStatus) {
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'RECEIVED';
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'OVERDUE':
      return 'OVERDUE';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
      return 'REFUNDED';
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      return 'PENDING';
    case 'DELETED':
    case 'CANCELED':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return 'CANCELED';
    default:
      return 'PENDING';
  }
}

/** Mapeia payload de payment Asaas pra documento Invoice nosso. */
function paymentToInvoice(payment, tenantSlug) {
  return {
    id: payment.id,
    tenantId: tenantSlug,
    status: normalizeStatus(payment.status),
    valueCents: Math.round(Number(payment.value || 0) * 100),
    dueDate: payment.dueDate ? new Date(payment.dueDate).getTime() : Date.now(),
    paidAt: payment.paymentDate ? new Date(payment.paymentDate).getTime() : undefined,
    billingType: payment.billingType || 'UNDEFINED',
    invoiceUrl: payment.invoiceUrl || undefined,
    bankSlipUrl: payment.bankSlipUrl || undefined,
    boletoBarcode: payment.identificationField || undefined, // linha digitável
    pixQrCode: payment.encodedImage || undefined,            // base64 PNG
    pixPayload: payment.payload || undefined,                // copia-e-cola PIX
    description: payment.description || undefined,
    asaasSubscriptionId: payment.subscription || undefined,
    asaasCustomerId: payment.customer || undefined,
    // ISO string "YYYY-MM-DD HH:MM:SS" — usado para idempotência no webhook.
    asaasDateUpdated: payment.dateUpdated || null,
    updatedAt: Date.now(),
  };
}

/** Cria cobrança avulsa (sem assinatura). */
async function createPayment(apiKey, { customerId, valueCents, description, billingType, dueDateMs, externalReference }) {
  const body = {
    customer: customerId,
    billingType: billingType || 'UNDEFINED',
    value: centsToReal(valueCents),
    dueDate: isoDate(dueDateMs || Date.now()),
    description,
    externalReference,
    sendPaymentByPostalService: false,
  };
  const res = await client(apiKey).post('/payments', body);
  return res.data;
}

/** Reenvia o e-mail / notificação de um pagamento para o cliente. */
async function sendPaymentNotification(apiKey, paymentId) {
  const res = await client(apiKey).post(`/payments/${paymentId}/sendNotification`);
  return res.data;
}

/** Retorna dados da conta Asaas (usado para testar a conexão). */
async function getAccount(apiKey) {
  const res = await client(apiKey).get('/myAccount');
  return res.data;
}

/** Retorna saldo disponível da conta Asaas em reais. */
async function getBalance(apiKey) {
  const res = await client(apiKey).get('/finance/balance');
  return res.data; // { balance: number, transfersBalance: number }
}

/**
 * Lista TODOS os pagamentos de um cliente (paginado, todos os status).
 * Preferir sobre listSubscriptionPayments para sync completo — captura
 * cobranças avulsas além das geradas pela assinatura.
 * @param {string} customerId ID do cliente Asaas (cus_xxx)
 * @param {{ maxPages?: number }} opts maxPages * 100 = limite de faturas (default 1000)
 */
async function listPaymentsByCustomer(apiKey, customerId, { maxPages = 10 } = {}) {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < maxPages; page++) {
    const res = await client(apiKey).get('/payments', {
      params: { customer: customerId, limit, offset },
    });
    const data = res.data?.data || [];
    all.push(...data);
    if (!res.data?.hasMore || data.length < limit) break;
    offset += limit;
  }
  return all;
}

module.exports = {
  baseUrl,
  findCustomerByEmail,
  createCustomer,
  findOrCreateCustomer,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscription,
  listSubscriptionPayments,
  listPaymentsByCustomer,
  getPayment,
  createPayment,
  sendPaymentNotification,
  getAccount,
  getBalance,
  normalizeStatus,
  paymentToInvoice,
};
