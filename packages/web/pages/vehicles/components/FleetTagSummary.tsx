import React from 'react';
import { AlertTriangle, CarFront, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../../../components/ui';
import { Vehicle } from '../../../types';
import { VehicleSummary } from '../hooks/useVehicleSummary';

/** Card "hero" escuro (forçado mesmo no tema claro): veículos com tag × sem tag (revisão). */
export function FleetTagSummary({ summary, untagged }: { summary: VehicleSummary | null; untagged: Vehicle[] }) {
  const navigate = useNavigate();
  return (
    <section
      aria-label="Resumo de tags da frota"
      className="m-card--hero-dark relative grid gap-8 overflow-hidden rounded-card-lg border p-6 sm:p-8 lg:grid-cols-2"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />

      <div className="relative">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white">
          <CheckCircle2 size={16} aria-hidden className="text-accent" /> Veículos com tag
        </h2>
        <p className="mt-1 text-caption text-zinc-400">Quantidade de veículos que possuem tag devidamente vinculada.</p>
        {summary ? (
          <p className="mt-5 font-mono text-4xl font-black tracking-tight text-white">{summary.withTag}</p>
        ) : (
          <Skeleton h={40} className="mt-5 w-24 !bg-white/10" />
        )}
      </div>

      <div className="relative min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-red-400">
          <AlertTriangle size={16} aria-hidden /> Veículos sem tag (revisão)
        </h2>
        <p className="mt-1 text-caption text-zinc-400">Veículos cadastrados que ainda não possuem tag vinculada.</p>
        {summary ? (
          <p className="mt-5 font-mono text-4xl font-black tracking-tight text-red-400">{summary.withoutTag}</p>
        ) : (
          <Skeleton h={40} className="mt-5 w-16 !bg-white/10" />
        )}
        {untagged.length > 0 && (
          <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
            {untagged.map(vehicle => (
              <li key={vehicle.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/vehicles/${encodeURIComponent(vehicle.id)}/edit`)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-left transition-colors hover:border-red-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <CarFront size={14} aria-hidden className="shrink-0 text-zinc-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-sm font-black text-white">{vehicle.plate}</span>
                    <span className="block truncate text-2xs font-bold uppercase tracking-widest text-zinc-500">{vehicle.model}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-2xs font-black uppercase tracking-widest text-zinc-500">Cadastrado em</span>
                    <span className="block font-mono text-caption font-bold text-zinc-300">{new Date(vehicle.createdAt).toLocaleDateString('pt-BR')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
