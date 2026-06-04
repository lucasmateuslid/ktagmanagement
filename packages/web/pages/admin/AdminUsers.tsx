import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import {
  Loader2, Users as UsersIcon, Search, Building2, MoreVertical, KeyRound, Copy, X, Shield, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Select } from '../../components/ui/select';
import { DropdownMenu, type DropdownItem } from '../../components/ui/dropdown-menu';
import { ConfirmStrongModal } from '../../components/ui/confirm-strong-modal';
import { SkeletonRows } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { adminApi } from '../../services/adminApi';
import { AnimatePresence, motion } from 'framer-motion';

interface UserRow {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  status: string;
  createdAt: number;
}

interface ResetResult {
  email: string;
  password: string;
  tenantId: string;
}

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);

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

  const buildActions = (u: UserRow): DropdownItem[] => [
    {
      key: 'reset',
      label: 'Resetar senha',
      icon: <KeyRound size={14} />,
      onSelect: () => setResetting(u),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Usuários</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Visão cross-tenant — {users.length} {users.length === 1 ? 'usuário' : 'usuários'} em {tenants.length} {tenants.length === 1 ? 'empresa' : 'empresas'}.
          </p>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por email ou uid…"
            className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/40 focus:bg-white/[0.05] rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder:text-zinc-600 outline-none transition-colors"
          />
        </div>
        <div className="sm:w-60">
          <Select<string>
            value={tenantFilter}
            onChange={setTenantFilter}
            placeholder="Todas as empresas"
            leftIcon={<Building2 size={14} />}
            options={[
              { value: '', label: 'Todas as empresas', description: `${users.length} usuários no total` },
              ...tenants.map(t => ({ value: t, label: t, description: `${users.filter(u => u.tenantId === t).length} usuários` })),
            ]}
          />
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-5"><SkeletonRows rows={6} cols={5} /></div>
        ) : error ? (
          <div className="p-6 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <UsersIcon className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum usuário no filtro atual</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Empresa</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Criado</th>
                    <th className="text-right px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {filtered.map(u => (
                      <motion.tr
                        key={`${u.tenantId}-${u.id}`}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3 truncate max-w-[260px]" title={u.email}>{u.email}</td>
                        <td className="px-5 py-3"><code className="text-amber-500 text-xs">{u.tenantId}</code></td>
                        <td className="px-5 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={u.status === 'approved' ? 'emerald' : 'amber'}>{u.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-zinc-500 text-xs">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <DropdownMenu
                            items={buildActions(u)}
                            trigger={
                              <button
                                type="button"
                                className="text-zinc-500 hover:text-amber-400 hover:bg-white/5 p-2 rounded-lg transition-colors"
                                aria-label="Ações"
                              >
                                <MoreVertical size={15} />
                              </button>
                            }
                          />
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {filtered.map(u => (
                <div key={`${u.tenantId}-${u.id}`} className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 text-xs shrink-0">
                    {u.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{u.email}</div>
                    <code className="text-amber-500 text-[11px]">{u.tenantId}</code>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <RoleBadge role={u.role} />
                      <Badge tone={u.status === 'approved' ? 'emerald' : 'amber'}>{u.status}</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResetting(u)}
                    className="text-zinc-500 hover:text-amber-400 p-2 rounded-lg hover:bg-white/5"
                    aria-label="Resetar senha"
                  >
                    <KeyRound size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirmação forte: exige digitar o email do usuário */}
      <ConfirmStrongModal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title="Resetar senha do usuário"
        warningHighlight={resetting ? `${resetting.email} · ${resetting.tenantId}` : undefined}
        description={resetting && (
          <>
            Uma nova senha aleatória será gerada e o login atual do usuário será invalidado imediatamente.
            Você verá a nova senha em texto plano <strong className="text-white">apenas uma vez</strong> e
            precisa enviá-la ao usuário por canal seguro.
          </>
        )}
        confirmText={resetting?.email || ''}
        confirmLabel="Gerar nova senha"
        onConfirm={async () => {
          if (!resetting) return;
          const r = await adminApi.superAdminResetUserPassword(resetting.tenantId, resetting.id);
          setResetResult({ email: r.email, password: r.password, tenantId: resetting.tenantId });
        }}
      />

      {/* Resultado: senha em texto plano (one-shot) */}
      {resetResult && (
        <PasswordResultModal
          result={resetResult}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
};

const RoleBadge = ({ role }: { role: string }) => {
  const tone =
    role === 'admin' || role === 'superadmin' ? 'purple' :
      role === 'admin_tecnico' ? 'blue' :
        role === 'manager' ? 'amber' :
          role === 'tech' ? 'emerald' :
            'neutral';
  return <Badge tone={tone as any}>{role}</Badge>;
};

const PasswordResultModal = ({ result, onClose }: { result: ResetResult; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(result.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-zinc-950 border border-amber-500/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl shadow-amber-500/10 overflow-hidden"
      >
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full bg-amber-500/15 blur-[100px]" />
        <header className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-400" size={20} />
            </div>
            <div>
              <h3 className="font-display font-black text-lg uppercase tracking-widest">Senha gerada</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-bold">Esta senha não será mostrada novamente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </header>

        <div className="relative space-y-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Usuário</div>
            <div className="font-mono text-sm truncate">{result.email}</div>
            <code className="text-[10px] text-amber-500/80">{result.tenantId}</code>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1.5">Nova senha</div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base text-white tracking-wide break-all flex-1">{result.password}</div>
              <button
                onClick={copy}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
                  copied
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                }`}
              >
                {copied ? <><CheckCircle2 size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            Envie esta senha ao colaborador por canal seguro (WhatsApp/email pessoal) e oriente a trocar no primeiro login.
          </p>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl transition-colors"
        >
          Fechar
        </button>
      </motion.div>
    </div>
  );
};
