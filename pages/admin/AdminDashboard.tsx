import * as React from 'react';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { systemCollection } from '../../lib/firestore';
import { Building2, CheckCircle2, XCircle, Shield } from 'lucide-react';

interface Counts {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  superAdmins: number;
}

export const AdminDashboard = () => {
  const [counts, setCounts] = useState<Counts>({
    totalTenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    superAdmins: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const [tenantsSnap, adminsSnap] = await Promise.all([
          getDocs(collection(db, 'tenants')),
          getDocs(systemCollection('system_admins')),
        ]);
        let active = 0;
        let inactive = 0;
        tenantsSnap.forEach(d => {
          if (d.data().active === false) inactive++;
          else active++;
        });
        setCounts({
          totalTenants: tenantsSnap.size,
          activeTenants: active,
          inactiveTenants: inactive,
          superAdmins: adminsSnap.size,
        });
      } catch (e) {
        console.error('Dashboard load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Visão geral da plataforma</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Empresas" value={counts.totalTenants} icon={Building2} color="text-amber-500" loading={loading} />
        <StatCard label="Ativas" value={counts.activeTenants} icon={CheckCircle2} color="text-emerald-500" loading={loading} />
        <StatCard label="Inativas" value={counts.inactiveTenants} icon={XCircle} color="text-red-500" loading={loading} />
        <StatCard label="Super Admins" value={counts.superAdmins} icon={Shield} color="text-blue-500" loading={loading} />
      </div>

      <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6">
        <h2 className="font-display text-sm font-black uppercase tracking-widest text-zinc-400 mb-3">Próximas ações</h2>
        <ul className="text-sm text-zinc-300 space-y-2">
          <li>• Vá em <code className="text-amber-500">Empresas</code> para criar/desativar tenants</li>
          <li>• Em <code className="text-amber-500">Auditoria</code>, monitore eventos críticos da plataforma</li>
          <li>• <code className="text-amber-500">Super Admins</code> permite delegar acesso a outros usuários</li>
        </ul>
      </section>
    </div>
  );
};

const StatCard = ({
  label, value, icon: Icon, color, loading,
}: { label: string; value: number; icon: any; color: string; loading: boolean }) => (
  <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      <Icon className={color} size={18} />
    </div>
    <div className="font-display text-3xl font-black">
      {loading ? <span className="text-zinc-700">···</span> : value}
    </div>
  </div>
);
