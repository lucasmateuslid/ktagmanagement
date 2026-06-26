import * as React from 'react';
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import {
  Settings2, Zap, Globe, Copy, Check, Loader2, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';

interface AsaasConfig {
  env: 'sandbox' | 'production';
  webhookUrl: string;
  apiBaseUrl: string;
}

interface ConnectionResult {
  ok: boolean;
  env: string;
  account?: { name: string; email: string; cpfCnpj: string };
  error?: string;
}

export const AdminAsaasConfig = () => {
  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadConfig = async () => {
    if (!functions || loading) return;
    setLoading(true); setError('');
    try {
      const fn = httpsCallable<any, AsaasConfig>(functions, 'getAsaasConfig');
      const res = await fn({});
      setConfig(res.data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar configuração.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadConfig(); }, []);

  const testConnection = async () => {
    if (!functions || testing) return;
    setTesting(true); setConnection(null);
    try {
      const fn = httpsCallable<any, ConnectionResult>(functions, 'testAsaasConnection');
      const res = await fn({});
      setConnection(res.data);
    } catch (e: any) {
      setConnection({ ok: false, env: config?.env || 'sandbox', error: e?.message || 'Falha.' });
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = async () => {
    if (!config?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(config.webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  const isSandbox = config?.env !== 'production';

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Configurações Asaas</h1>
        <p className="text-zinc-500 text-sm mt-1">Ambiente, webhook e diagnóstico de conexão</p>
      </header>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Ambiente */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-amber-500" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ambiente</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </div>
        ) : config ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                isSandbox
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSandbox ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {isSandbox ? 'Sandbox' : 'Produção'}
              </span>
              <span className="text-xs text-zinc-500">{config.apiBaseUrl}</span>
            </div>
            {isSandbox && (
              <p className="text-[11px] text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                Modo sandbox: cobranças não são reais. Para produção, defina <code className="text-amber-400">ASAAS_ENV=production</code> nas variáveis de ambiente do Cloud Run.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Webhook URL */}
      {config && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Settings2 size={16} className="text-amber-500" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">URL do Webhook</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Cadastre esta URL no painel Asaas em <strong className="text-zinc-300">Integrações → Webhooks</strong>.
            Eventos: PAYMENT_CREATED, PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_UPDATED.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-mono break-all">
              {config.webhookUrl}
            </code>
            <button
              onClick={copyWebhook}
              className="shrink-0 p-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
              title="Copiar URL"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            O token de autenticação do webhook é o secret <code>ASAAS_WEBHOOK_TOKEN</code>. Configure-o em{' '}
            <code>firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN</code>.
          </p>
        </div>
      )}

      {/* Testar conexão */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-amber-500" />
            <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Diagnóstico de conexão</h2>
          </div>
          <button
            onClick={testConnection}
            disabled={testing}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            {testing ? <Loader2 className="animate-spin" size={13} /> : <Zap size={13} />}
            Testar agora
          </button>
        </div>

        {connection && (
          <div className={`rounded-2xl border p-4 ${
            connection.ok
              ? 'bg-emerald-950/30 border-emerald-900/50'
              : 'bg-red-950/30 border-red-900/50'
          }`}>
            {connection.ok ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest">
                  <CheckCircle2 size={14} /> Conexão OK
                </div>
                <div className="text-xs text-zinc-400 space-y-1">
                  <div><span className="text-zinc-500">Conta:</span> {connection.account?.name}</div>
                  <div><span className="text-zinc-500">Email:</span> {connection.account?.email}</div>
                  <div><span className="text-zinc-500">CPF/CNPJ:</span> {connection.account?.cpfCnpj}</div>
                  <div><span className="text-zinc-500">Ambiente:</span> {connection.env}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-widest">
                  <XCircle size={14} /> Falha na conexão
                </div>
                <p className="text-xs text-red-300/70">{connection.error}</p>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Verifique se o secret <code>ASAAS_API_KEY</code> está configurado e se o ambiente ({connection.env}) está correto.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instruções de setup */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-3">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Setup inicial (uma vez)</h2>
        <pre className="text-[11px] text-zinc-400 font-mono bg-zinc-900 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">{`# 1. API Key (pegar em Asaas → Integrações → API)
firebase functions:secrets:set ASAAS_API_KEY

# 2. Token do webhook (gerar aleatório)
openssl rand -hex 32 | firebase functions:secrets:set ASAAS_WEBHOOK_TOKEN --data-file=-

# 3. Ambiente
#   Painel Cloud Run → Variáveis de ambiente → ASAAS_ENV=sandbox (ou production)

# 4. Cadastrar webhook no Asaas com a URL acima e o token do passo 2`}
        </pre>
      </div>
    </div>
  );
};
