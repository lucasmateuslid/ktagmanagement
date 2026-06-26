import * as React from 'react';
import { Building2, ShieldCheck, ArrowRight, Clock } from 'lucide-react';
import type { TenantMembership } from '../services/identity';
import { buildTenantHref } from '../utils/tenant';

interface TenantSwitcherProps {
  memberships: TenantMembership[];
  pending?: TenantMembership[];
  isGlobalAdmin?: boolean;
  /** Tenant atual (para destacar / desabilitar a própria entrada). */
  currentTenantId?: string;
  title?: string;
  subtitle?: string;
}

const roleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'admin_tecnico': return 'Admin Técnico';
    case 'moderator': return 'Moderador';
    case 'technician': return 'Técnico';
    case 'client': return 'Cliente';
    default: return role || 'Usuário';
  }
};

/**
 * Seletor de empresa para identidade unificada. Lista os tenants em que o
 * usuário tem membership APROVADA + (se super admin) o painel da plataforma.
 * Cada item navega para o subdomínio correspondente. Como a sessão do Firebase
 * é por origem, o destino pode pedir novo login (mesmas credenciais). Não há
 * sessão global de PERMISSÕES — cada ambiente resolve o papel do usuário pelo
 * seu próprio vínculo.
 */
export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({
  memberships,
  pending = [],
  isGlobalAdmin = false,
  currentTenantId,
  title = 'Escolha a empresa',
  subtitle = 'Sua conta tem acesso aos ambientes abaixo.',
}) => {
  const hasAny = memberships.length > 0 || isGlobalAdmin;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-black uppercase tracking-widest text-white">{title}</h1>
        <p className="text-zinc-400 text-sm mt-1">{subtitle}</p>
      </div>

      {!hasAny && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center">
          <p className="text-zinc-300 text-sm font-medium">
            Sua conta não está vinculada a nenhuma empresa.
          </p>
          <p className="text-zinc-500 text-xs mt-2">
            Contate o administrador da empresa para liberar seu acesso.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {isGlobalAdmin && (
          <a
            href={buildTenantHref('admin')}
            className="group flex items-center gap-3 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-3.5 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40">
              <ShieldCheck className="text-amber-400" size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-black uppercase tracking-widest text-amber-300">Painel da plataforma</span>
              <span className="block text-[11px] text-amber-500/70 font-bold uppercase tracking-widest">Super admin</span>
            </span>
            <ArrowRight className="text-amber-400/60 group-hover:translate-x-0.5 transition-transform" size={16} />
          </a>
        )}

        {memberships.map((m) => {
          const isCurrent = m.tenantId === currentTenantId;
          return (
            <a
              key={m.tenantId}
              href={isCurrent ? undefined : buildTenantHref(m.tenantId)}
              aria-disabled={isCurrent}
              className={[
                'group flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-colors',
                isCurrent
                  ? 'bg-zinc-800/40 border-zinc-700 cursor-default'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800',
              ].join(' ')}
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700">
                <Building2 className="text-zinc-300" size={20} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-white truncate">{m.tenantId}</span>
                <span className="block text-[11px] text-zinc-500 font-bold uppercase tracking-widest">{roleLabel(m.role)}</span>
              </span>
              {isCurrent ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Atual</span>
              ) : (
                <ArrowRight className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" size={16} />
              )}
            </a>
          );
        })}

        {pending.map((m) => (
          <div
            key={`pending-${m.tenantId}`}
            className="flex items-center gap-3 rounded-xl px-4 py-3.5 border border-zinc-800/60 bg-zinc-900/20 opacity-70"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
              <Clock className="text-zinc-500" size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-zinc-400 truncate">{m.tenantId}</span>
              <span className="block text-[11px] text-zinc-600 font-bold uppercase tracking-widest">Aguardando aprovação</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
