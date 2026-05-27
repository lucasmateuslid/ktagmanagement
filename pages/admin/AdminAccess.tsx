import * as React from 'react';
import { useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { adminApi, type IdentityLookup, type GrantMembershipResult } from '../../services/adminApi';
import { useTenants } from '../../hooks/useTenants';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import {
  Loader2, Search, Building2, ShieldCheck, ShieldOff, UserPlus, Trash2,
  KeyRound, Copy, CheckCircle2, X, AlertTriangle, Mail, Plus,
} from 'lucide-react';

// Papéis concedíveis (espelha GRANTABLE_TENANT_ROLES no backend).
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'admin_tecnico', label: 'Admin Técnico' },
  { value: 'moderator', label: 'Moderador' },
  { value: 'user', label: 'Usuário' },
  { value: 'technician', label: 'Técnico' },
  { value: 'client', label: 'Cliente' },
];

const roleTone = (role: string) =>
  role === 'admin' ? 'purple' :
  role === 'admin_tecnico' ? 'blue' :
  role === 'moderator' ? 'amber' :
  role === 'technician' ? 'emerald' : 'neutral';

export const AdminAccess = () => {
  const { tenants } = useTenants();
  const tenantOptions = useMemo(
    () => tenants
      .filter(t => !t.deletedAt)
      .map(t => ({ value: t.slug || t.id, label: t.name || t.slug || t.id, description: t.slug || t.id })),
    [tenants],
  );

  // ---- Busca de identidade ----
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<IdentityLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ---- Conceder acesso ----
  const [grantTenant, setGrantTenant] = useState('');
  const [grantRole, setGrantRole] = useState('user');
  const [granting, setGranting] = useState(false);
  const [credResult, setCredResult] = useState<GrantMembershipResult | null>(null);

  const runLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setLoading(true);
    setError('');
    setLookup(null);
    try {
      const res = await adminApi.lookupIdentity(clean);
      setLookup(res);
    } catch (err: any) {
      setError(err?.message || 'Falha na busca.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (lookup && 'email' in lookup) {
      try { setLookup(await adminApi.lookupIdentity(lookup.email)); } catch { /* noop */ }
    }
  };

  const toggleSuperAdmin = async (makeAdmin: boolean) => {
    if (!functions || !lookup || !lookup.found) return;
    const verb = makeAdmin ? 'promover a SUPER ADMIN' : 'remover dos super admins';
    if (!confirm(`Confirmar ${verb}: ${lookup.email}?`)) return;
    setBusy(true);
    try {
      const fn = httpsCallable(functions, makeAdmin ? 'addSystemAdmin' : 'removeSystemAdmin');
      await fn(makeAdmin ? { email: lookup.email } : { uid: lookup.uid });
      await refresh();
    } catch (err: any) {
      alert(`Falha: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (tenantId: string) => {
    if (!lookup || !lookup.found) return;
    if (!confirm(`Revogar acesso de ${lookup.email} à empresa "${tenantId}"?`)) return;
    setBusy(true);
    try {
      await adminApi.revokeMembership({ tenantId, uid: lookup.uid });
      await refresh();
    } catch (err: any) {
      alert(`Falha: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = (lookup && lookup.found ? lookup.email : email).trim().toLowerCase();
    if (!targetEmail || !grantTenant) {
      setError('Informe um e-mail (busque acima) e selecione a empresa.');
      return;
    }
    setGranting(true);
    setError('');
    try {
      const res = await adminApi.grantMembership({ email: targetEmail, tenantId: grantTenant, role: grantRole });
      if (res.created && res.tempPassword) setCredResult(res);
      setEmail(targetEmail);
      await runLookup();
    } catch (err: any) {
      setError(err?.message || 'Falha ao conceder acesso.');
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Acessos</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Gerencie quais e-mails têm acesso a quais empresas — e quem é super admin da plataforma.
        </p>
      </header>

      {/* Busca */}
      <form onSubmit={runLookup} className="flex flex-col sm:flex-row gap-2 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
        <div className="flex-1 relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mail do usuário"
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/40 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-lg"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
          Buscar
        </button>
      </form>

      {error && (
        <div className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle size={15} /> {error}</div>
      )}

      {/* Resultado da busca */}
      {lookup && !lookup.found && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-sm">
          Nenhuma conta encontrada para <strong className="text-white">{lookup.email}</strong>.
          <p className="text-zinc-500 text-xs mt-1">Você pode conceder acesso abaixo — a conta será criada automaticamente.</p>
        </div>
      )}

      {lookup && lookup.found && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Cabeçalho da identidade */}
          <div className="flex items-center justify-between gap-3 p-5 border-b border-zinc-800/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center font-display font-black text-amber-400 shrink-0">
                {lookup.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{lookup.email}</div>
                <code className="text-[10px] text-zinc-500">{lookup.uid}</code>
              </div>
              {lookup.isGlobalAdmin && <Badge tone="purple">Super admin</Badge>}
              {lookup.disabled && <Badge tone="red">Desativado</Badge>}
            </div>
            <button
              onClick={() => toggleSuperAdmin(!lookup.isGlobalAdmin)}
              disabled={busy}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest disabled:opacity-50 transition-colors ${
                lookup.isGlobalAdmin
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                  : 'bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20'
              }`}
            >
              {lookup.isGlobalAdmin ? <><ShieldOff size={13} /> Remover super admin</> : <><ShieldCheck size={13} /> Tornar super admin</>}
            </button>
          </div>

          {/* Memberships */}
          <div className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Empresas com acesso</p>
            {lookup.memberships.length === 0 ? (
              <p className="text-zinc-500 text-sm">Sem vínculo a nenhuma empresa.</p>
            ) : (
              <div className="space-y-1.5">
                {lookup.memberships.map(m => (
                  <div key={m.tenantId} className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-3 py-2.5">
                    <Building2 size={16} className="text-zinc-400 shrink-0" />
                    <span className="font-bold text-sm flex-1 truncate">{m.tenantId}</span>
                    <Badge tone={roleTone(m.role) as any}>{m.role}</Badge>
                    <Badge tone={m.status === 'approved' ? 'emerald' : 'amber'}>{m.status}</Badge>
                    <button
                      onClick={() => revoke(m.tenantId)}
                      disabled={busy}
                      className="text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg disabled:opacity-50"
                      title="Revogar acesso"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conceder acesso */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-amber-400" />
          <h2 className="font-display font-black uppercase tracking-widest text-sm">Conceder acesso a uma empresa</h2>
        </div>
        <p className="text-zinc-500 text-xs">
          {lookup && lookup.found
            ? <>Concedendo para <strong className="text-white">{lookup.email}</strong>.</>
            : 'Busque um e-mail acima (ou digite um novo — a conta será criada e uma senha temporária será exibida).'}
        </p>
        <form onSubmit={grant} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Select<string>
              value={grantTenant}
              onChange={setGrantTenant}
              placeholder="Selecione a empresa"
              leftIcon={<Building2 size={14} />}
              options={tenantOptions}
            />
          </div>
          <div className="sm:w-52">
            <Select<string>
              value={grantRole}
              onChange={setGrantRole}
              placeholder="Papel"
              leftIcon={<KeyRound size={14} />}
              options={ROLE_OPTIONS}
            />
          </div>
          <button
            type="submit"
            disabled={granting}
            className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-lg"
          >
            {granting ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            Conceder
          </button>
        </form>
      </div>

      {credResult && <CredentialModal result={credResult} onClose={() => setCredResult(null)} />}
    </div>
  );
};

const CredentialModal = ({ result, onClose }: { result: GrantMembershipResult; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(result.tempPassword || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-zinc-950 border border-amber-500/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-400" size={20} />
            </div>
            <div>
              <h3 className="font-display font-black text-lg uppercase tracking-widest">Conta criada</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-bold">Senha mostrada apenas uma vez</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5"><X size={18} /></button>
        </header>
        <div className="space-y-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Usuário</div>
            <div className="font-mono text-sm truncate">{result.email}</div>
            <code className="text-[10px] text-amber-500/80">{result.tenantId} · {result.role}</code>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1.5">Senha temporária</div>
            <div className="flex items-center justify-between gap-2">
              <div className="font-mono text-base text-white tracking-wide break-all flex-1">{result.tempPassword}</div>
              <button
                onClick={copy}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
                  copied ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                }`}
              >
                {copied ? <><CheckCircle2 size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">Envie por canal seguro e oriente a trocar no primeiro login.</p>
        </div>
        <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">Fechar</button>
      </div>
    </div>
  );
};
