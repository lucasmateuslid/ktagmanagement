import React from 'react';
import { CarFront, ChevronRight, Clock, History, MapPin, Tag as TagIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, IconTile } from '../../../components/ui';
import { Tag, Vehicle, VehicleCategory } from '../../../types';
import {
  OWNERSHIP_LABEL, STALE_POSITION_MS, STATUS_LABEL, STATUS_TONE,
  formatDateTime, installationLabel, timeAgo, trackingIdOf,
} from '../../vehicles/utils/vehicleLabels';

interface LinkedVehicleCardProps {
  vehicle: Vehicle;
  tag?: Tag;
  category?: VehicleCategory;
  /** Instante de referência para "atrasada" / "há N min". */
  now: number;
}

/** Card de veículo na ficha do cliente: placa → equipamento → comunicação → ações. */
export function LinkedVehicleCard({ vehicle, tag, category, now }: LinkedVehicleCardProps) {
  const navigate = useNavigate();
  const trackingId = trackingIdOf(vehicle);
  const lastPosition = vehicle.lastPosition?.timestamp;
  const stale = lastPosition ? now - lastPosition > STALE_POSITION_MS : false;

  return (
    <article className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-sm transition-colors hover:border-primary-500/40">
      <div className="flex items-start gap-3">
        <IconTile icon={<CarFront size={18} aria-hidden />} variant="accent" className="!p-2.5" />
        <div className="min-w-0">
          <h3 className="font-mono text-lg font-black uppercase leading-tight text-fg-1">{vehicle.plate}</h3>
          <p className="truncate text-caption uppercase text-fg-2">{vehicle.model}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {vehicle.status && <Badge size="xs" tone={STATUS_TONE[vehicle.status]}>{STATUS_LABEL[vehicle.status]}</Badge>}
        {stale && <Badge size="xs" tone="accent">Atualização atrasada</Badge>}
        {!trackingId && <Badge size="xs" tone="red">Sem equipamento</Badge>}
      </div>

      <div className="mt-4 space-y-2 border-t border-line pt-4 text-caption text-fg-2">
        <p className="flex items-center gap-2">
          <TagIcon size={13} aria-hidden className="shrink-0 text-fg-3" />
          <span className="truncate font-mono">{tag ? `${tag.type === 'H_TAG' ? 'H-TAG' : tag.type === 'XADTAG' ? 'XADTAG' : 'K-TAG'} · ${tag.identifierOriginal || tag.accessoryId}` : vehicle.trackerId ? `Rastreador · ${vehicle.trackerId}` : 'Sem equipamento'}</span>
        </p>
        <p className="flex items-center gap-2">
          <Clock size={13} aria-hidden className="shrink-0 text-fg-3" />
          <span>Última comunicação: <span className="font-mono">{formatDateTime(lastPosition)}</span>{lastPosition && ` (${timeAgo(lastPosition, now)})`}</span>
        </p>
      </div>

      <details className="group mt-3 rounded-lg bg-surface-2">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-caption font-bold text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
          <ChevronRight size={14} aria-hidden className="transition-transform group-open:rotate-90" /> Mais detalhes
        </summary>
        <dl className="grid grid-cols-2 gap-3 px-3 pb-3 text-caption">
          <div><dt className="text-label-xs uppercase text-fg-3">Categoria</dt><dd className="mt-1 font-bold text-fg-1">{category?.name || '—'}</dd></div>
          <div><dt className="text-label-xs uppercase text-fg-3">Ano</dt><dd className="mt-1 font-bold text-fg-1">{vehicle.year || '—'}</dd></div>
          <div><dt className="text-label-xs uppercase text-fg-3">Instalação</dt><dd className="mt-1 font-bold text-fg-1">{installationLabel(vehicle)}</dd></div>
          <div><dt className="text-label-xs uppercase text-fg-3">Contrato</dt><dd className="mt-1 font-bold text-fg-1">{vehicle.ownershipStatus ? OWNERSHIP_LABEL[vehicle.ownershipStatus] : '—'}</dd></div>
        </dl>
      </details>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" className="px-2" onClick={() => navigate(`/vehicles/${encodeURIComponent(vehicle.id)}`)}>
          Ver ficha
        </Button>
        <Button
          type="button" variant="secondary" className="px-2" disabled={!trackingId}
          onClick={() => navigate(`/map?tagId=${encodeURIComponent(trackingId)}`)}
        >
          <MapPin size={14} aria-hidden /> Mapa
        </Button>
        <Button
          type="button" className="px-2" disabled={!trackingId}
          onClick={() => navigate(`/map?tagId=${encodeURIComponent(trackingId)}&history=1`)}
        >
          <History size={14} aria-hidden /> Histórico
        </Button>
      </div>
    </article>
  );
}
