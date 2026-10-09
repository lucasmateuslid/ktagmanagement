import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/authenticatedFetch';

type Status = { online: boolean; lastCommand?: { action?: string; status?: string; requestedAt?: number } | null };

export function VehicleBlockingControls({ vehicleId }: { vehicleId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => {
    const response = await authenticatedFetch(`/api/blocking/vehicles/${encodeURIComponent(vehicleId)}`);
    if (!response.ok) { setStatus(null); return; }
    setStatus((await response.json()).data);
  };
  useEffect(() => { setStatus(null); setMessage(''); void refresh().catch(() => setStatus(null)); }, [vehicleId]);
  const send = async (action: 'block' | 'unblock') => {
    if (!window.confirm(action === 'block' ? 'Confirmar bloqueio remoto deste veículo parado?' : 'Confirmar desbloqueio remoto deste veículo?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`/api/blocking/vehicles/${encodeURIComponent(vehicleId)}/commands`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, confirmed: true }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Comando não enviado.');
      setMessage('Comando enviado. O estado físico depende da confirmação do equipamento.');
      await refresh();
    } catch (error: any) { setMessage(error.message || 'Falha no comando.'); }
    finally { setBusy(false); }
  };
  if (!status) return null;
  return <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
    <div className="mb-2 font-black uppercase">Bloqueio remoto · {status.online ? 'Online' : 'Offline'}</div>
    <p className="mb-3 text-zinc-500">{status.lastCommand?.action ? `Último comando: ${status.lastCommand.action === 'block' ? 'bloquear' : 'desbloquear'} · ${status.lastCommand.status || 'desconhecido'}` : 'Nenhum comando registrado.'}</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !status.online} onClick={() => void send('block')} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-40">Bloquear</button><button type="button" disabled={busy || !status.online} onClick={() => void send('unblock')} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-40">Desbloquear</button></div>
    {message && <p role="status" className="mt-3">{message}</p>}
  </section>;
}
