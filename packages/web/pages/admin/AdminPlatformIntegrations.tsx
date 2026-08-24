import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Save, Loader2, CheckCircle2, AlertTriangle, Cloud, Info, KeyRound, Terminal,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface PlatformIntegrations {
  proxyUrl?: string;
  updatedAt?: number;
}

const DOC_REF = (db: any) => doc(db, 'ktag_settings_v3', 'platform_integrations');

export const AdminPlatformIntegrations = () => {
  const [config, setConfig] = useState<PlatformIntegrations>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!db) { setError('Firestore indisponível.'); setLoading(false); return; }
      try {
        const snap = await getDoc(DOC_REF(db));
        if (alive && snap.exists()) setConfig(snap.data() as PlatformIntegrations);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Falha ao carregar.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSave = async () => {
    if (!db) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const payload = {
        proxyUrl: (config.proxyUrl || '').trim() || null,
        updatedAt: Date.now(),
      };
      await setDoc(DOC_REF(db), payload, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Integrações da Plataforma</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Configura o proxy/relay compartilhado e a conta única da API K-TAG (centralizada
          aqui). O token Traqcare/XADTAG permanece sob cada empresa.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-amber-300/80 bg-amber-500/[0.05] border border-amber-500/15 rounded-2xl px-4 py-3">
        <Info size={14} className="shrink-0 mt-0.5 text-amber-400" />
        <p className="leading-relaxed">
          O valor configurado aqui sobrescreve o que cada empresa tiver salvo. As empresas verão este campo como
          <strong className="text-amber-300"> somente leitura</strong> na tela de Sistema &amp; APIs.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando configuração…
        </div>
      ) : (
        <>
          {/* PROXY */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Cloud size={16} className="text-amber-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Proxy & Relay (CORS bypass)</h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              URL da Cloud Function que faz o roteamento entre as empresas e as APIs externas
              (K-TAG, XADTAG). Sem isso o navegador bloqueia as requisições por CORS.
            </p>
            <input
              type="text"
              value={config.proxyUrl || ''}
              onChange={e => setConfig({ ...config, proxyUrl: e.target.value })}
              placeholder="https://us-central1-projeto.cloudfunctions.net/proxy"
              className="w-full bg-zinc-900/60 border border-white/10 focus:border-amber-500/30 rounded-xl px-4 py-2.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors"
            />
          </div>

          {/* CREDENCIAIS K-TAG (conta única da plataforma) */}
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <KeyRound size={16} className="text-amber-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Credenciais K-TAG (conta da plataforma)</h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              As credenciais da API K-TAG são compartilhadas por todas as empresas e ficam como
              <strong className="text-zinc-300"> segredos do servidor</strong> — o relay injeta o
              Basic Auth a cada chamada e o navegador <strong className="text-zinc-300">nunca</strong> recebe
              usuário/senha. Configure-as via Secret Manager das Cloud Functions:
            </p>
            <div className="rounded-2xl bg-zinc-950/60 border border-white/5 p-4 space-y-2 font-mono text-[11px] text-zinc-300 overflow-x-auto">
              <div className="flex items-center gap-2 text-zinc-500"><Terminal size={12} /> terminal</div>
              <div>firebase functions:secrets:set <span className="text-amber-400">KTAG_API_USER</span></div>
              <div>firebase functions:secrets:set <span className="text-amber-400">KTAG_API_PASS</span></div>
              <div className="text-zinc-500"># URL (não-secreta) via variável de ambiente:</div>
              <div><span className="text-amber-400">KTAG_API_URL</span>=https://api.ktag.example.com</div>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-zinc-500 leading-relaxed">
              <Info size={13} className="shrink-0 mt-0.5 text-zinc-600" />
              <p>
                Após definir os segredos, faça o redeploy das funções (<span className="font-mono text-zinc-400">proxyApi</span> e
                <span className="font-mono text-zinc-400"> scheduledTagUpdate</span>). Em desenvolvimento, defina
                <span className="font-mono text-zinc-400"> KTAG_API_URL/USER/PASS</span> no ambiente do server.ts.
              </p>
            </div>
          </div>

          {/* Metadata + ação */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[10px] text-zinc-600 font-mono">
              {config.updatedAt
                ? `Última atualização: ${new Date(config.updatedAt).toLocaleString('pt-BR')}`
                : 'Nunca configurado.'}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-5 py-2.5 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saving ? 'Salvando...' : saved ? 'Salvo' : 'Salvar Integrações'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
