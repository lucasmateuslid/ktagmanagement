import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { Loader2, Users as UsersIcon, Search } from 'lucide-react';

interface UserRow {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  status: string;
  createdAt: number;
}

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('');

  useEffect(() => {
    if (!functions) return;
    (async () => {
      try {
        const fn = httpsCallable<{}, { users: UserRow[] }>(functions, 'listAllUsers');
        const res = await fn({});
        setUsers(res.data.users);
      } catch (e: any) {
        setError(e?.message || 'Falha ao carregar usuários.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tenants = useMemo(() => Array.from(new Set(users.map(u => u.tenantId))).sort(), [users]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => {
      if (tenantFilter && u.tenantId !== tenantFilter) return false;
      if (!term) return true;
      return u.email.toLowerCase().includes(term) || u.id.includes(term);
    });
  }, [users, search, tenantFilter]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Usuários</h1>
        <p className="text-zinc-500 text-sm mt-1">Visão cross-tenant — uma linha por usuário em cada tenant.</p>
      </header>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email ou uid…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <select
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm"
        >
          <option value="">Todas as empresas</option>
          {tenants.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-red-400 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <UsersIcon className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum usuário</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Empresa</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Criado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={`${u.tenantId}-${u.id}`} className="border-t border-zinc-800/60 hover:bg-zinc-900/30">
                  <td className="px-5 py-3 truncate max-w-[260px]" title={u.email}>{u.email}</td>
                  <td className="px-5 py-3"><code className="text-amber-500 text-xs">{u.tenantId}</code></td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{u.role}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${u.status === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>{u.status}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
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
