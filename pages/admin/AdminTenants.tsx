import * as React from 'react';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import type { Tenant } from '../../types';
import { Building2, Plus, Power, ExternalLink, Loader2, Copy } from 'lucide-react';

export const AdminTenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ slug: string; ownerEmail: string | null; ownerPassword: string | null } | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'tenants'), (snap) => {
      const list: Tenant[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTenants(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleActive = async (slug: string, active: boolean) => {
    if (!functions) return;
    if (!confirm(`${active ? 'Ativar' : 'Desativar'} tenant "${slug}"?`)) return;
    try {
      const fn = httpsCallable(functions, 'setTenantActive');
      await fn({ slug, active });
    } catch (e: any) {
      alert(`Falha: ${e?.message || e}`);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest">Empresas</h1>
          <p className="text-zinc-500 text-sm mt-1">Gestão de tenants da plataforma</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs px-4 py-2.5 rounded-xl"
        >
          <Plus size={14} /> Nova empresa
        </button>
      </header>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            <Building2 className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-bold uppercase tracking-widest">Nenhum tenant cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Slug</th>
                <th className="text-left px-5 py-3">Plano</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/30">
                  <td className="px-5 py-3.5 font-bold">{t.name}</td>
                  <td className="px-5 py-3.5">
                    <code className="text-amber-500 text-xs">{t.slug}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    <PlanBadge plan={t.plan} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge active={t.active !== false} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleActive(t.slug, !t.active)}
                        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-amber-500 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
                        title={t.active !== false ? 'Desativar' : 'Ativar'}
                      >
                        <Power size={14} />
                      </button>
                      <a
                        href={openTenantHref(t.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-amber-500 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
                        title="Abrir tenant em nova aba"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CreateTenantModal
          onClose={() => setShowForm(false)}
          onCreated={(info) => {
            setShowForm(false);
            setCreatedInfo(info);
          }}
        />
      )}

      {createdInfo && (
        <CredentialsModal info={createdInfo} onClose={() => setCreatedInfo(null)} />
      )}
    </div>
  );
};

function openTenantHref(slug: string): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return `${window.location.protocol}//${host}:${window.location.port}/?tenant=${encodeURIComponent(slug)}`;
  }
  // Em prod: assume hostname atual é admin.dominio.com — troca por slug.dominio.com.
  const parts = host.split('.');
  if (parts.length >= 3) {
    parts[0] = slug;
    return `${window.location.protocol}//${parts.join('.')}`;
  }
  return '#';
}

const PlanBadge = ({ plan }: { plan?: string }) => {
  const color = plan === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    : plan === 'pro' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : 'bg-zinc-700/40 text-zinc-300 border-zinc-700';
  return <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${color}`}>{plan || 'basic'}</span>;
};

const StatusBadge = ({ active }: { active: boolean }) => (
  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
    active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
  }`}>
    {active ? 'Ativo' : 'Inativo'}
  </span>
);

const CreateTenantModal = ({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (info: { slug: string; ownerEmail: string | null; ownerPassword: string | null }) => void;
}) => {
  const [form, setForm] = useState({
    slug: '',
    name: '',
    plan: 'basic' as 'basic' | 'pro' | 'enterprise',
    ownerEmail: '',
    ownerName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!functions) return;
    setError('');
    setSubmitting(true);
    try {
      const fn = httpsCallable<any, { slug: string; ownerEmail: string | null; ownerPassword: string | null }>(functions, 'createTenant');
      const res = await fn({
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        plan: form.plan,
        active: true,
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
      });
      onCreated(res.data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao criar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-display font-black text-lg uppercase tracking-widest">Nova empresa</h3>
        {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">{error}</div>}
        <FieldInput label="Slug (subdomínio)" value={form.slug} onChange={(v: string) => setForm({ ...form, slug: v })} required placeholder="empresa-acme" />
        <FieldInput label="Nome" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} required placeholder="Empresa Acme" />
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">Plano</label>
          <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm">
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div className="border-t border-zinc-800 pt-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Admin inicial (opcional)</p>
          <FieldInput label="Email do admin" value={form.ownerEmail} onChange={(v: string) => setForm({ ...form, ownerEmail: v })} type="email" placeholder="admin@empresa.com" />
          <FieldInput label="Nome do admin" value={form.ownerName} onChange={(v: string) => setForm({ ...form, ownerName: v })} placeholder="João da Silva" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-900">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">
            {submitting ? <Loader2 className="inline animate-spin" size={14} /> : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
};

const FieldInput = ({ label, value, onChange, type = 'text', required, placeholder }: any) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm placeholder:text-zinc-600"
    />
  </div>
);

const CredentialsModal = ({ info, onClose }: any) => (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4">
      <h3 className="font-display font-black text-lg uppercase tracking-widest">Tenant criado</h3>
      <p className="text-sm text-zinc-400">Slug: <code className="text-amber-500">{info.slug}</code></p>
      {info.ownerEmail && info.ownerPassword && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Credenciais iniciais do admin</p>
          <CredentialRow label="Email" value={info.ownerEmail} />
          <CredentialRow label="Senha" value={info.ownerPassword} />
          <p className="text-[10px] text-zinc-400">Envie ao admin e oriente a trocar a senha no primeiro login. Esta senha não será exibida novamente.</p>
        </div>
      )}
      <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase tracking-widest text-xs py-2.5 rounded-xl">
        Fechar
      </button>
    </div>
  </div>
);

const CredentialRow = ({ label, value }: { label: string; value: string }) => {
  const copy = () => { navigator.clipboard?.writeText(value); };
  return (
    <div className="flex items-center justify-between gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
        <div className="font-mono text-sm text-white">{value}</div>
      </div>
      <button onClick={copy} className="text-zinc-500 hover:text-amber-500 p-1.5">
        <Copy size={14} />
      </button>
    </div>
  );
};
