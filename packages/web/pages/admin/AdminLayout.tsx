import * as React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import {
  LayoutDashboard, Building2, Users, Shield, LogOut, FileText, CreditCard, Receipt,
  Search, ChevronRight, Settings2, Menu, X, PanelLeftClose, PanelLeftOpen, MoreHorizontal, UserCog, Layers, Cloud,
  Sun, Moon, KeyRound,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav, type BottomNavItem } from '../../components/ui/bottom-nav';
import { cn } from '../../lib/utils';
import { useAdminTheme, type AdminTheme } from '../../hooks/useAdminTheme';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  group: 'main' | 'billing' | 'system';
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'main' },
  { to: '/admin/tenants', label: 'Empresas', icon: Building2, group: 'main' },
  { to: '/admin/users', label: 'Usuários', icon: Users, group: 'main' },
  { to: '/admin/billing', label: 'Mensalidades', icon: CreditCard, group: 'billing' },
  { to: '/admin/plans', label: 'Planos', icon: Layers, group: 'billing' },
  { to: '/admin/invoices', label: 'Faturas', icon: Receipt, group: 'billing' },
  { to: '/admin/access', label: 'Acessos', icon: KeyRound, group: 'system' },
  { to: '/admin/system-admins', label: 'Super Admins', icon: Shield, group: 'system' },
  { to: '/admin/audit', label: 'Auditoria', icon: FileText, group: 'system' },
  { to: '/admin/asaas-config', label: 'Config. Asaas', icon: Settings2, group: 'system' },
  { to: '/admin/platform-integrations', label: 'Integrações', icon: Cloud, group: 'system' },
  { to: '/admin/account', label: 'Minha conta', icon: UserCog, group: 'system' },
];

const GROUPS = [
  { key: 'main', label: 'Plataforma' },
  { key: 'billing', label: 'Financeiro' },
  { key: 'system', label: 'Sistema' },
] as const;

const BOTTOM_NAV_PRIMARY: BottomNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
  { to: '/admin/tenants', label: 'Empresas', icon: <Building2 size={18} /> },
  { to: '/admin/billing', label: 'Mensalid.', icon: <CreditCard size={18} /> },
  { to: '/admin/invoices', label: 'Faturas', icon: <Receipt size={18} /> },
];

export const AdminLayout = () => {
  const { admin, logout } = useSystemAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle: toggleTheme } = useAdminTheme();

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  const bottomNavItems: BottomNavItem[] = [
    ...BOTTOM_NAV_PRIMARY,
    { label: 'Mais', icon: <MoreHorizontal size={18} />, onClick: () => setMobileOpen(true), active: mobileOpen },
  ];

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Ambient orbs — sutis em ambos os temas (overrides convertem em light) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-amber-400/5 blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[440px] h-[440px] rounded-full bg-orange-500/5 blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <DesktopSidebar
          adminEmail={admin?.email || undefined}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {/* Header desktop */}
          <header className="hidden md:flex sticky top-0 z-20 backdrop-blur-xl bg-zinc-950/50 border-b border-white/5 px-4 lg:px-8 py-3.5 items-center gap-4">
            <div className="flex-1 max-w-xl">
              <label className="relative flex items-center">
                <Search size={14} className="absolute left-3.5 text-zinc-600" />
                <input
                  type="search"
                  placeholder="Buscar empresa, fatura, usuário…"
                  className="w-full bg-white/[0.03] border border-white/5 hover:border-white/10 focus:border-amber-500/30 focus:bg-white/[0.05] rounded-xl pl-10 pr-16 py-2 text-sm placeholder:text-zinc-600 outline-none transition-colors"
                />
                <span className="absolute right-3 text-[9px] font-mono text-zinc-600 border border-white/10 rounded-md px-1.5 py-0.5 bg-white/[0.02] hidden lg:block">⌘K</span>
              </label>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Ambiente {import.meta.env.MODE === 'production' ? 'PROD' : 'DEV'}
            </div>
          </header>

          {/* Header mobile */}
          <header className="md:hidden sticky top-0 z-20 backdrop-blur-xl bg-zinc-950/80 border-b border-white/5 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-zinc-300 hover:text-amber-400 p-1.5 -ml-1 rounded-lg hover:bg-white/5"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-500/80">K-TAG Platform</div>
              <div className="font-display font-black text-sm truncate">{currentPageTitle(location.pathname)}</div>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} compact />
            <button
              onClick={() => setSearchOpen(v => !v)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                searchOpen ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-300 hover:text-amber-400 hover:bg-white/5',
              )}
              aria-label="Buscar"
            >
              <Search size={18} />
            </button>
          </header>

          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="md:hidden sticky top-[57px] z-10 overflow-hidden bg-zinc-950/95 backdrop-blur-xl border-b border-white/5"
              >
                <div className="p-3">
                  <input
                    autoFocus
                    type="search"
                    placeholder="Buscar empresa, fatura, usuário…"
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-amber-500/40 rounded-xl px-3 py-2.5 text-sm placeholder:text-zinc-500 outline-none"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 xl:px-10 py-5 md:py-7 pb-24 md:pb-7 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav items={bottomNavItems} />

      <AnimatePresence>
        {mobileOpen && (
          <MobileDrawer
            adminEmail={admin?.email || undefined}
            onClose={() => setMobileOpen(false)}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================
// THEME TOGGLE
// ============================================================

const ThemeToggle = ({
  theme, onToggle, compact,
}: { theme: AdminTheme; onToggle: () => void; compact?: boolean }) => (
  <button
    onClick={onToggle}
    aria-label={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
    title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
    className={cn(
      'shrink-0 inline-flex items-center justify-center rounded-lg transition-colors border',
      'text-zinc-400 hover:text-amber-400 bg-white/[0.02] hover:bg-white/[0.05]',
      'border-white/5 hover:border-white/10',
      compact ? 'w-9 h-9' : 'h-9 px-2.5',
    )}
  >
    {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
    {!compact && (
      <span className="ml-2 text-[10px] font-black uppercase tracking-widest">
        {theme === 'light' ? 'Dark' : 'Light'}
      </span>
    )}
  </button>
);

// ============================================================
// DESKTOP SIDEBAR
// ============================================================

/* Sidebar admin — largura fixa em w-64 (sem collapse). A altura
 * usa h-screen sticky, mantendo a barra estável em qualquer
 * resolução desktop. Mobile abre via drawer separado. */
const DesktopSidebar = ({
  adminEmail, onLogout, theme, onToggleTheme,
}: {
  adminEmail?: string;
  onLogout: () => void;
  theme: AdminTheme;
  onToggleTheme: () => void;
}) => (
  <aside className="hidden md:flex shrink-0 w-64 sticky top-0 h-screen border-r border-white/5 bg-zinc-950/60 backdrop-blur-xl flex-col">
    <div className="pt-6 pb-5 px-5 flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
        <span className="font-display font-black text-zinc-950 text-sm">K</span>
        <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-amber-500/90 text-[9px] font-black uppercase tracking-[0.18em]">K-TAG Platform</div>
        <div className="font-display font-black text-base leading-tight">Super Admin</div>
      </div>
    </div>

    <nav className="flex-1 px-2.5 pb-4 space-y-5 overflow-y-auto">
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
                    cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent text-amber-400 border border-amber-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                        : 'text-zinc-500 hover:text-white hover:bg-white/[0.03] border border-transparent',
                    )
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

    <div className="pb-5 pt-4 px-3 border-t border-white/5 space-y-2">
      <NavLink
        to="/admin/account"
        className={({ isActive }) => cn(
          'group flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors',
          isActive
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-white/[0.02] border-white/5 hover:border-amber-500/20 hover:bg-amber-500/[0.04]',
        )}
        title="Minha conta"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-zinc-950 font-black text-xs shrink-0">
          {(adminEmail || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-amber-400 truncate transition-colors">
            {adminEmail?.split('@')[0] || 'admin'}
          </div>
          <div className="text-[9px] text-zinc-600 truncate">{adminEmail}</div>
        </div>
        <UserCog size={12} className="text-zinc-600 group-hover:text-amber-400 shrink-0 transition-colors" />
      </NavLink>
      <div className="flex gap-1.5">
        <button
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
          title={theme === 'light' ? 'Tema escuro' : 'Tema claro'}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors text-zinc-500 hover:text-amber-400 hover:bg-white/[0.04] border border-transparent hover:border-white/10"
        >
          {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
        <button
          onClick={onLogout}
          aria-label="Sair"
          title="Sair"
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors text-zinc-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20"
        >
          <LogOut size={12} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  </aside>
);

// ============================================================
// MOBILE DRAWER
// ============================================================

const MobileDrawer = ({
  onClose, adminEmail, onLogout, theme, onToggleTheme,
}: { onClose: () => void; adminEmail?: string; onLogout: () => void; theme: AdminTheme; onToggleTheme: () => void }) => (
  <motion.div
    className="md:hidden fixed inset-0 z-[80] flex"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.16 }}
  >
    <motion.div
      className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    />
    <motion.aside
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="relative w-72 max-w-[85vw] h-full bg-zinc-950 border-r border-white/5 flex flex-col shadow-2xl shadow-black/60"
    >
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <span className="font-display font-black text-zinc-950 text-sm">K</span>
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-amber-500/90 text-[9px] font-black uppercase tracking-[0.18em]">K-TAG Platform</div>
          <div className="font-display font-black text-base leading-tight">Super Admin</div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
        {GROUPS.map(g => {
          const items = NAV.filter(n => n.group === g.key);
          return (
            <div key={g.key}>
              <div className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">{g.label}</div>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors',
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent',
                      )
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-6 pt-4 border-t border-white/5 space-y-2">
        <NavLink
          to="/admin/account"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors',
            isActive
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-white/[0.02] border-white/5 hover:bg-amber-500/[0.04] hover:border-amber-500/20',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-zinc-950 font-black text-xs shrink-0">
            {(adminEmail || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 truncate">
              {adminEmail?.split('@')[0] || 'admin'}
            </div>
            <div className="text-[9px] text-zinc-600 truncate">{adminEmail}</div>
          </div>
          <UserCog size={13} className="text-zinc-500 shrink-0" />
        </NavLink>

        <button
          onClick={onToggleTheme}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-white/[0.04] hover:text-amber-400 border border-white/5 hover:border-amber-500/20 transition-colors"
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-red-500/10 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-colors"
        >
          <LogOut size={13} />
          <span>Sair</span>
        </button>
      </div>
    </motion.aside>
  </motion.div>
);

function currentPageTitle(pathname: string): string {
  const found = NAV.find(n => n.end ? pathname === n.to : pathname.startsWith(n.to));
  return found?.label || 'Admin';
}
