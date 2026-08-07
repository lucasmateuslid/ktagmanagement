import * as React from 'react';
import { useEffect, useState } from 'react';
import { Activity, ExternalLink, Loader2, Radio, RefreshCw, Server } from 'lucide-react';
import { trackingApi } from '../../services/trackingApi';

export const AdminTraccarIntegration = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setStatus(await trackingApi.adminStatus()); } catch (e: any) { setError(e.message); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    trackingApi.adminStatus()
      .then(value => { if (active) setStatus(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const testRealtime = async () => { setLoading(true); try { await trackingApi.adminTestWebSocket(); await load(); } catch (e: any) { setError(e.message); setLoading(false); } };
  const indicator = (value: boolean) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${value ? 'bg-emerald-400' : 'bg-red-400'}`} />;
  return (
    <div className="space-y-4 max-w-4xl">
      {error && <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</div>}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><h2 className="font-black uppercase tracking-widest">Integração Traccar</h2><p className="text-xs text-zinc-500 mt-1">Infraestrutura global de rastreamento XADTAG</p></div><button onClick={load} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold flex gap-2 items-center">{loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Atualizar</button></div>
        {status && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card icon={<Server size={15}/>} label="API REST" value={status.rest?.connected ? 'Conectada' : 'Indisponível'} marker={indicator(status.rest?.connected)} />
          <Card icon={<Activity size={15}/>} label="Autenticação" value={status.authenticated ? 'Válida' : 'Inválida'} marker={indicator(status.authenticated)} />
          <Card icon={<Radio size={15}/>} label="Realtime" value={status.realtime?.status || 'disconnected'} marker={indicator(status.realtime?.connected)} />
          <Card icon={<Activity size={15}/>} label="Latência" value={`${status.rest?.latencyMs ?? 0} ms`} />
        </div>}
        {status && <div className="mt-5 grid md:grid-cols-3 gap-3 text-xs text-zinc-500"><span>Última mensagem: {status.realtime?.lastMessageAt || '—'}</span><span>Último snapshot: {status.realtime?.lastSnapshotAt || '—'}</span><span>Reconexões: {status.realtime?.reconnects ?? 0}</span></div>}
        <div className="mt-6 flex flex-wrap gap-2"><button onClick={testRealtime} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black">Testar WebSocket</button>{status?.webUrl && <a href={status.webUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold flex items-center gap-2">Abrir Traccar <ExternalLink size={13}/></a>}</div>
      </div>
    </div>
  );
};
const Card = ({ icon, label, value, marker }: { icon: React.ReactNode; label: string; value: string; marker?: React.ReactNode }) => <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4"><div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest">{icon}{label}</div><div className="mt-3 flex items-center gap-2 text-sm font-bold">{marker}{value}</div></div>;
