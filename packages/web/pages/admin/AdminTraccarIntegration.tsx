import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
  Activity, Bot, CheckCircle2, Cloud, CreditCard, ExternalLink, Loader2,
  Radio, RefreshCw, Server, Settings2, XCircle,
} from 'lucide-react';
import { trackingApi } from '../../services/trackingApi';
import { db, functions } from '../../services/firebase';
import { AiConfigModule } from '../../components/settings/AiConfigModule';
import { authenticatedFetch } from '../../services/authenticatedFetch';

type State = 'online' | 'warning' | 'offline' | 'loading';
interface TraccarStatus {
  configured: boolean; authenticated: boolean;
  rest?: { connected?: boolean; latencyMs?: number };
  realtime?: { status?: string; connected?: boolean; lastMessageAt?: string };
  webUrl?: string | null;
}
interface AsaasConfig { env: 'sandbox' | 'production'; apiBaseUrl: string; webhookUrl: string }
interface AsaasConnection { ok: boolean; env: string; error?: string }

const tone: Record<State, string> = {
  online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  offline: 'text-red-400 bg-red-500/10 border-red-500/20',
  loading: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

function StatusBadge({ state, children }: { state: State; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${tone[state]}`}>
    {state === 'loading' ? <Loader2 size={11} className="animate-spin" /> : state === 'online' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
    {children}
  </span>;
}

function IntegrationCard({ icon, title, description, state, status, details, action }: {
  icon: React.ReactNode; title: string; description: string; state: State; status: string;
  details: Array<[string, React.ReactNode]>; action?: React.ReactNode;
}) {
  return <section className="rounded-3xl border border-white/5 bg-white/[0.025] p-5 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-zinc-900 p-3 text-amber-500">{icon}</div><div><h2 className="font-display font-black uppercase tracking-wider">{title}</h2><p className="text-xs text-zinc-500 mt-0.5">{description}</p></div></div>
      <StatusBadge state={state}>{status}</StatusBadge>
    </div>
    <div className="grid grid-cols-2 gap-2">{details.map(([label, value]) => <div key={label} className="rounded-xl bg-zinc-950/50 p-3"><div className="text-[9px] uppercase tracking-widest text-zinc-600">{label}</div><div className="mt-1 truncate text-xs font-bold text-zinc-300">{value}</div></div>)}</div>
    {action && <div className="flex gap-2 border-t border-white/5 pt-4">{action}</div>}
  </section>;
}

export const AdminTraccarIntegration = () => {
  const [loading, setLoading] = useState(true);
  const [traccar, setTraccar] = useState<TraccarStatus | null>(null);
  const [asaas, setAsaas] = useState<{ config?: AsaasConfig; connection?: AsaasConnection }>({});
  const [ktag, setKtag] = useState<{ proxy: boolean }>({ proxy: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Array<{ modelId: string; approved: boolean; block: { type: string }; unblock: { type: string } }>>([]);
  const [profileForm, setProfileForm] = useState({ modelId: '', blockType: 'engineStop', unblockType: 'engineResume', blockAttributes: '{}', unblockAttributes: '{}', approved: false });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErrors([]);
    const [traccarResult, asaasConfigResult, asaasTestResult, platformResult] = await Promise.allSettled([
      trackingApi.adminStatus(),
      functions ? httpsCallable<Record<string, never>, AsaasConfig>(functions, 'getAsaasConfig')({}) : Promise.reject(new Error('Functions indisponível')),
      functions ? httpsCallable<Record<string, never>, AsaasConnection>(functions, 'testAsaasConnection')({}) : Promise.reject(new Error('Functions indisponível')),
      db ? getDoc(doc(db, 'ktag_settings_v3', 'platform_integrations')) : Promise.reject(new Error('Firestore indisponível')),
    ]);
    if (traccarResult.status === 'fulfilled') setTraccar(traccarResult.value as TraccarStatus);
    if (asaasConfigResult.status === 'fulfilled') setAsaas(current => ({ ...current, config: asaasConfigResult.value.data }));
    if (asaasTestResult.status === 'fulfilled') setAsaas(current => ({ ...current, connection: asaasTestResult.value.data }));
    if (platformResult.status === 'fulfilled') setKtag({ proxy: Boolean(platformResult.value.data()?.proxyUrl) });
    const failed = [traccarResult, asaasConfigResult, asaasTestResult, platformResult].filter(result => result.status === 'rejected');
    if (failed.length) setErrors(failed.map(result => result.status === 'rejected' ? result.reason?.message || 'Diagnóstico indisponível' : ''));
    const profilesResponse = await authenticatedFetch('/api/admin/integrations/traccar/blocking-profiles').catch(() => null);
    if (profilesResponse?.ok) setProfiles((await profilesResponse.json()).data || []);
    setLoading(false);
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileError('');
    try {
      const body = { approved: profileForm.approved, block: { type: profileForm.blockType, attributes: JSON.parse(profileForm.blockAttributes) }, unblock: { type: profileForm.unblockType, attributes: JSON.parse(profileForm.unblockAttributes) } };
      const response = await authenticatedFetch(`/api/admin/integrations/traccar/blocking-profiles/${encodeURIComponent(profileForm.modelId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha ao salvar perfil.');
      await load();
    } catch (error: any) { setProfileError(error.message || 'Perfil inválido.'); }
    finally { setProfileSaving(false); }
  };

  // Diagnóstico inicial é uma sincronização deliberada com quatro sistemas externos.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const traccarOnline = Boolean(traccar?.rest?.connected);
  const asaasOnline = Boolean(asaas.connection?.ok);

  return <div className="space-y-6">
    <header className="flex items-start justify-between gap-4 flex-wrap">
      <div><h1 className="font-display text-2xl font-black uppercase tracking-widest">Integrações</h1><p className="text-zinc-500 text-sm mt-1">Saúde dos serviços externos e motores de inteligência da plataforma</p></div>
      <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 flex gap-2 items-center text-xs font-bold hover:bg-white/5 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar diagnósticos</button>
    </header>

    {errors.length > 0 && <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">Alguns diagnósticos não responderam. Os demais serviços continuam independentes.</div>}

    <section className="space-y-3 rounded-3xl border border-white/10 p-5"><h2 className="font-bold">Perfis de bloqueio homologados</h2><p className="text-xs text-zinc-500">Aprovar somente após testar bloquear e desbloquear no equipamento físico instalado. O ID do modelo deve coincidir com o catálogo de rastreadores.</p>
      <div className="grid gap-2 md:grid-cols-3"><input className="rounded-xl bg-zinc-900 p-3 text-sm" placeholder="ID do modelo" value={profileForm.modelId} onChange={e => setProfileForm(v => ({ ...v, modelId: e.target.value }))}/><input className="rounded-xl bg-zinc-900 p-3 text-sm" placeholder="Comando de bloqueio" value={profileForm.blockType} onChange={e => setProfileForm(v => ({ ...v, blockType: e.target.value }))}/><input className="rounded-xl bg-zinc-900 p-3 text-sm" placeholder="Comando de desbloqueio" value={profileForm.unblockType} onChange={e => setProfileForm(v => ({ ...v, unblockType: e.target.value }))}/><input className="rounded-xl bg-zinc-900 p-3 font-mono text-xs" aria-label="Atributos do bloqueio em JSON" value={profileForm.blockAttributes} onChange={e => setProfileForm(v => ({ ...v, blockAttributes: e.target.value }))}/><input className="rounded-xl bg-zinc-900 p-3 font-mono text-xs" aria-label="Atributos do desbloqueio em JSON" value={profileForm.unblockAttributes} onChange={e => setProfileForm(v => ({ ...v, unblockAttributes: e.target.value }))}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={profileForm.approved} onChange={e => setProfileForm(v => ({ ...v, approved: e.target.checked }))}/>Teste físico concluído</label></div>
      {profileError && <p className="text-xs text-red-400">{profileError}</p>}<button type="button" disabled={profileSaving || !profileForm.modelId} onClick={() => void saveProfile()} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black disabled:opacity-40">Salvar perfil</button>
      <div className="flex flex-wrap gap-2">{profiles.map(profile => <button type="button" key={profile.modelId} className="rounded-xl border border-white/10 px-3 py-2 text-left text-xs" onClick={() => setProfileForm({ modelId: profile.modelId, blockType: profile.block.type, unblockType: profile.unblock.type, blockAttributes: JSON.stringify((profile.block as any).attributes || {}), unblockAttributes: JSON.stringify((profile.unblock as any).attributes || {}), approved: profile.approved })}>{profile.modelId} · {profile.approved ? 'homologado' : 'desativado'}</button>)}</div>
    </section>

    <div className="grid gap-4 xl:grid-cols-2">
      <IntegrationCard icon={<Radio size={20} />} title="Traccar / XADTAG" description="REST, GT06 e posições em tempo real" state={loading && !traccar ? 'loading' : traccarOnline ? 'online' : 'offline'} status={loading && !traccar ? 'Verificando' : traccarOnline ? 'Operacional' : 'Indisponível'} details={[["API REST", traccarOnline ? 'Conectada' : 'Desconectada'], ["Autenticação", traccar?.authenticated ? 'Válida' : 'Inválida'], ["Realtime", traccar?.realtime?.status || '—'], ["Latência", `${traccar?.rest?.latencyMs ?? 0} ms`]]} action={traccar?.webUrl ? <a href={traccar.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-zinc-300 hover:text-white">Abrir Traccar <ExternalLink size={13} /></a> : undefined} />

      <IntegrationCard icon={<CreditCard size={20} />} title="Asaas" description="Cobranças, assinaturas e webhook financeiro" state={loading && !asaas.config ? 'loading' : asaasOnline ? 'online' : 'offline'} status={loading && !asaas.config ? 'Verificando' : asaasOnline ? 'Operacional' : 'Atenção'} details={[["Conexão", asaasOnline ? 'Autenticada' : 'Sem resposta'], ["Ambiente", asaas.config?.env || '—'], ["Webhook", asaas.config?.webhookUrl ? 'Configurado' : 'Ausente'], ["API", asaas.config?.apiBaseUrl || '—']]} action={<Link to="/admin/asaas-config" className="inline-flex items-center gap-2 text-xs text-zinc-300 hover:text-white">Configurar Asaas <Settings2 size={13} /></Link>} />

      <IntegrationCard icon={<Server size={20} />} title="K-TAG" description="Relay centralizado e última posição via Functions/Firestore" state={loading ? 'loading' : ktag.proxy ? 'online' : 'warning'} status={loading ? 'Verificando' : ktag.proxy ? 'Configurada' : 'Configuração parcial'} details={[["Relay", ktag.proxy ? 'Configurado' : 'Não configurado'], ["Credenciais", 'Secret do servidor'], ["Posições", 'Última posição'], ["Persistência", 'Firestore']]} action={<Link to="/admin/platform-integrations" className="inline-flex items-center gap-2 text-xs text-zinc-300 hover:text-white">Configurar plataforma <Settings2 size={13} /></Link>} />

      <IntegrationCard icon={<Bot size={20} />} title="NVIDIA AI / NIM" description="Motor OpenAI-compatible para o assistente da plataforma" state="warning" status="Compatível" details={[["Nemotron", 'Ultra / Super'], ["Meta", 'Llama'], ["Z.ai", 'GLM'], ["MiniMax", 'M2 e catálogo NIM']]} />
    </div>

    <section className="rounded-3xl border border-white/5 bg-white/[0.025] p-6 space-y-5">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-purple-500/10 p-3 text-purple-400"><Activity size={20} /></div><div><h2 className="font-display font-black uppercase tracking-wider">Motor de inteligência artificial</h2><p className="text-xs text-zinc-500">Selecione NVIDIA NIM e escolha um modelo do catálogo ou informe outro identificador compatível.</p></div></div>
      <AiConfigModule embedded scope="platform" />
      <div className="flex items-start gap-2 rounded-xl border border-sky-500/10 bg-sky-500/5 p-3 text-[11px] text-sky-200/70"><Cloud size={14} className="mt-0.5 shrink-0" /> NVIDIA NIM usa a API OpenAI-compatible. O modelo pode ser trocado sem alterar o assistente ou suas ferramentas.</div>
    </section>
  </div>;
};
