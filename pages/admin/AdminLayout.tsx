import * as React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import {
  LayoutDashboard, Building2, Users, Shield, LogOut, FileText, CreditCard, Receipt, Search, ChevronRight, Settings2,
} from 'lucide-react';

const NAV: { to: string; label: string; icon: any; end?: boolean; group: 'main' | 'billing' | 'system' }[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'main' },
  { to: '/admin/tenants', label: 'Empresas', icon: Building2, group: 'main' },
  { to: '/admin/users', label: 'Usuários', icon: Users, group: 'main' },
  { to: '/admin/billing', label: 'Mensalidades', icon: CreditCard, group: 'billing' },
  { to: '/admin/invoices', label: 'Faturas', icon: Receipt, group: 'billing' },
  { to: '/admin/system-admins', label: 'Super Admins', icon: Shield, group: 'system' },
  { to: '/admin/audit', label: 'Auditoria', icon: FileText, group: 'system' },
  { to: '/admin/asaas-config', label: 'Config. Asaas', icon: Settings2, group: 'system' },
];

const GROUPS = [
  { key: 'main', label: 'Plataforma' },
  { key: 'billing', label: 'Financeiro' },
  { key: 'system', label: 'Sistema' },
] as const;

export const AdminLayout = () => {
  const { admin, logout } = useSystemAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Ambient orbs — substituem o fundo chapado por uma profundidade sutil */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-amber-400/5 blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[440px] h-[440px] rounded-full bg-orange-500/5 blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-white/5 bg-zinc-950/60 backdrop-blur-xl flex flex-col">
          <div className="px-5 pt-6 pb-5">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="font-display font-black text-zinc-950 text-sm">K</span>
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
              </div>
              <div>
                <div className="text-amber-500/90 text-[9px] font-black uppercase tracking-[0.18em]">K-TAG Platform</div>
                <div className="font-display font-black text-base leading-tight">Super Admin</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
            {GROUPS.map(g => {
              const items = NAV.filter(n => n.group === g.key);
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <div className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map(({ to, label, icon: Icon, end }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent text-amber-400 border border-amber-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                              : 'text-zinc-500 hover:text-white hover:bg-white/[0.03] border border-transparent'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-amber-400" />
                            )}
                            <Icon size={15} className={isActive ? 'text-amber-400' : 'text-zinc-500 group-hover:text-zinc-300'} />
                            <span className="flex-1">{label}</span>
                            {isActive && <ChevronRight size={12} className="text-amber-400/60" />}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="px-3 pb-5 pt-4 border-t border-white/5 space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-zinc-950 font-black text-xs shrink-0">
                {(admin?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">
                  {admin?.email?.split('@')[0] || 'admin'}
                </div>
                <div className="text-[9px] text-zinc-600 truncate">{admin?.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-colors"
            >
              <LogOut size={12} />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 backdrop-blur-xl bg-zinc-950/50 border-b border-white/5 px-8 py-3.5">
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xl">
                <label className="relative flex items-center">
                  <Search size={14} className="absolute left-3.5 text-zinc-600" />
                  <input
                    type="search"
                    placeholder="Buscar empresa, fatura, usuário…"
                    className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/30 focus:bg-white/[0.05] rounded-xl pl-10 pr-16 py-2 text-sm placeholder:text-zinc-600 outline-none transition-colors"
                  />
                  <span className="absolute right-3 text-[9px] font-mono text-zinc-600 border border-white/10 rounded-md px-1.5 py-0.5 bg-white/[0.02]">⌘K</span>
                </label>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                Ambiente {import.meta.env.MODE === 'production' ? 'PROD' : 'DEV'}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
