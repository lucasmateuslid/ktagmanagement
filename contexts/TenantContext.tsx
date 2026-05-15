import * as React from 'react';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getDoc } from 'firebase/firestore';
import type { Tenant } from '../types';
import { db } from '../services/firebase';
import { activeTenant } from '../services/activeTenant';
import { encryption } from '../services/encryption';
import { tenantRootDoc } from '../lib/firestore';
import { getTenantFromHostname, isReservedSlug } from '../utils/tenant';

interface TenantContextValue {
  tenantId: string;
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  isAdminPanel: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const ADMIN_TENANT_SLUG = 'admin';

export const TenantProvider = ({ children }: { children?: ReactNode }) => {
  const [tenantId] = useState<string>(() => getTenantFromHostname());
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminPanel = tenantId === ADMIN_TENANT_SLUG;

  useEffect(() => {
    const boot = async () => {
      try {
        // Slugs reservados não podem existir como tenant real. admin é tratado
        // à parte (futuro painel super admin); demais reservados resultam em 404.
        if (isReservedSlug(tenantId) && !isAdminPanel) {
          setError(`Subdomínio reservado: "${tenantId}"`);
          setLoading(false);
          return;
        }

        // Inicializa o singleton ANTES de qualquer outra leitura — qualquer
        // chamada a storage.* depende disso.
        activeTenant.set(tenantId, null);

        // Inicializa a criptografia derivada do tenantId. Sem isso, leituras de
        // campos sensíveis (User.name, Vehicle.plate, etc.) ficariam pendurando.
        await encryption.initialize(tenantId);

        if (!db) {
          // Modo offline / falha de boot Firebase. Deixa carregar com tenant nulo
          // para que a app consiga ao menos exibir tela de erro decente.
          setLoading(false);
          return;
        }

        // Painel admin não tem documento em /tenants — é resolvido por outro guard.
        if (isAdminPanel) {
          setLoading(false);
          return;
        }

        const snap = await getDoc(tenantRootDoc(tenantId));
        if (!snap.exists()) {
          setError(`Empresa "${tenantId}" não encontrada.`);
          setLoading(false);
          return;
        }

        const data = { ...snap.data(), id: snap.id } as Tenant;
        if (data.active === false) {
          setError(`Empresa "${data.name || tenantId}" está inativa.`);
          setLoading(false);
          return;
        }

        activeTenant.set(tenantId, data);
        setTenant(data);
      } catch (e: any) {
        console.error('TenantProvider boot error:', e);
        setError(`Falha ao carregar empresa: ${e?.message || 'erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [tenantId, isAdminPanel]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <h2 className="font-display font-black text-white uppercase tracking-[0.3em] text-[10px]">
            Carregando empresa
          </h2>
        </div>
      </div>
    );
  }

  if (error) {
    return <TenantNotFound message={error} tenantId={tenantId} />;
  }

  return (
    <TenantContext.Provider value={{ tenantId, tenant, loading, error, isAdminPanel }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
};

const TenantNotFound = ({ message, tenantId }: { message: string; tenantId: string }) => (
  <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white p-6">
    <div className="max-w-md text-center space-y-6">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-950/40 border border-red-900/60">
        <span className="text-4xl">🚫</span>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-black uppercase tracking-widest">
          Empresa indisponível
        </h1>
        <p className="text-zinc-400 text-sm">{message}</p>
        <p className="text-zinc-600 text-xs">
          Subdomínio acessado: <code className="text-amber-500">{tenantId}</code>
        </p>
      </div>
      <p className="text-zinc-500 text-xs">
        Se você acredita que isto é um erro, contate o administrador da plataforma.
      </p>
    </div>
  </div>
);
