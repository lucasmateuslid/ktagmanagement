import * as React from 'react';
import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { Cloud, Banknote, MessageCircle, Webhook, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Tabs } from '../../components/ui/tabs';
import { AdminPlatformIntegrations } from './AdminPlatformIntegrations';
import { AdminAsaasConfig } from './AdminAsaasConfig';

type TabKey = 'apis' | 'financeiras' | 'chatbot' | 'webhooks';

export const AdminIntegrations = () => {
  const [tab, setTab] = useState<TabKey>('apis');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Integrações</h1>
        <p className="text-zinc-500 text-sm mt-1">APIs, pagamentos, chatbot e webhooks da plataforma</p>
      </header>

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'apis', label: 'APIs', icon: <Cloud size={15} />, content: <AdminPlatformIntegrations /> },
          { key: 'financeiras', label: 'Integrações financeiras', icon: <Banknote size={15} />, content: <AdminAsaasConfig /> },
          { key: 'chatbot', label: 'Chatbot', icon: <MessageCircle size={15} />, content: <ChatbotPlaceholder /> },
          { key: 'webhooks', label: 'Webhooks', icon: <Webhook size={15} />, content: <WebhooksPanel /> },
        ]}
      />
    </div>
  );
};

const ChatbotPlaceholder = () => (
  <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center text-zinc-500 max-w-2xl">
    <MessageCircle className="mx-auto mb-3 opacity-40" size={28} />
    <p className="text-sm font-bold uppercase tracking-widest">Em breve</p>
    <p className="text-xs text-zinc-600 mt-2">
      Integrações de chatbot (WhatsApp, etc.) serão configuradas aqui em uma atualização futura.
    </p>
  </div>
);

const WebhooksPanel = () => {
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!functions) { setLoading(false); return; }
    const fn = httpsCallable<any, { webhookUrl: string }>(functions, 'getAsaasConfig');
    fn({}).then(res => setWebhookUrl(res.data.webhookUrl)).catch((e: any) => {
      setError(e?.message || 'Falha ao carregar webhook.');
    }).finally(() => setLoading(false));
  }, []);

  const copy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Webhook size={16} className="text-amber-500" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Webhook Asaas (pagamentos)</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </div>
        ) : webhookUrl ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-mono break-all">
              {webhookUrl}
            </code>
            <button
              onClick={copy}
              className="shrink-0 p-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
              title="Copiar URL"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        ) : null}
        <p className="text-[11px] text-zinc-600">
          Configuração completa (chave de API, ambiente, diagnóstico) está na aba "Integrações financeiras".
        </p>
      </div>
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 text-xs text-zinc-500">
        Outros webhooks (não-Asaas) aparecerão aqui em atualizações futuras.
      </div>
    </div>
  );
};
