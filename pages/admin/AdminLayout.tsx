import * as React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSystemAdmin } from '../../contexts/SystemAdminContext';
import { LayoutDashboard, Building2, Users, Shield, LogOut, FileText } from 'lucide-react';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/tenants', label: 'Empresas', icon: Building2 },
  { to: '/admin/users', label: 'Usuários', icon: Users },
  { to: '/admin/system-admins', label: 'Super Admins', icon: Shield },
  { to: '/admin/audit', label: 'Auditoria', icon: FileText },
];

export const AdminLayout = () => {
  const { admin, logout } = useSystemAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      <aside className="w-64 shrink-0 border-r border-zinc-900 flex flex-col">
        <div className="px-6 py-6 border-b border-zinc-900">
          <div className="text-amber-500 text-[10px] font-black uppercase tracking-widest">K-TAG Platform</div>
          <div className="font-display font-black text-lg leading-tight mt-1">Super Admin</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border border-transparent'
                }`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-zinc-900 space-y-2">
          <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest truncate">
            {admin?.email}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-red-400"
          >
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
