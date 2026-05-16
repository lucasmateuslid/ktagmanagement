import * as React from 'react';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { systemCollection } from '../../lib/firestore';
import { FileText, Loader2 } from 'lucide-react';

interface LogRow {
  id: string;
  event?: string;
  action?: string;
  entity?: string;
  details?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  entityId?: string;
  timestamp?: number;
}

export const AdminAudit = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(systemCollection('system_audit_logs'), orderBy('timestamp', 'desc'), limit(200));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (e) {
        console.error('Audit load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Auditoria do Sistema</h1>
        <p className="text-zinc-500 text-sm mt-1">Eventos cross-tenant registrados em <code className="text-amber-500">/system_audit_logs</code>.</p>
      </header>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <FileText className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Sem eventos registrados</p>
            <p className="text-xs mt-2">Operações de super admin (criação/desativação de tenants etc.) aparecerão aqui.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">Quando</th>
                <th className="text-left px-5 py-3">Ação</th>
                <th className="text-left px-5 py-3">Entidade</th>
                <th className="text-left px-5 py-3">Detalhes</th>
                <th className="text-left px-5 py-3">Autor</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-zinc-800/60">
                  <td className="px-5 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {l.timestamp ? new Date(l.timestamp).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{l.action || l.event}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-300 text-xs">{l.entity || '—'}</td>
                  <td className="px-5 py-3 text-zinc-300 text-xs max-w-[400px] truncate" title={l.details}>{l.details || '—'}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs truncate max-w-[180px]" title={l.userId}>
                    {l.userName || l.userEmail || l.userId || 'SYSTEM'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
