import React from 'react';
import { CarFront, Clock, Edit2, History, MapPin, Radio, StickyNote, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCPF, formatPhone } from '@ktag/shared';
import { storage } from '../services/storage';
import { Client, Company, Tag, Vehicle, VehicleCategory } from '../types';
import {
  Badge, Button, Detail, DetailGrid, InfoCard, NotFoundState, PageContainer, RecordHeader, Skeleton,
} from '../components/ui';
import {
  OWNERSHIP_LABEL, STALE_POSITION_MS, STATUS_LABEL, STATUS_TONE,
  formatDateTime, installationLabel, timeAgo, trackingIdOf,
} from './vehicles/utils/vehicleLabels';

interface VehicleRecord {
  vehicle: Vehicle | null;
  client: Client | null;
  tag: Tag | null;
  category: VehicleCategory | null;
  company: Company | null;
}

export const VehicleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = React.useState<VehicleRecord | null>(null);
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    let active = true;
    Promise.all([storage.getVehicles(), storage.getClients(), storage.getTags(), storage.getCategories(), storage.getCompanies()])
      .then(([vehicles, clients, tags, categories, companies]) => {
        if (!active) return;
        const vehicle = (vehicles || []).find(item => item.id === id) || null;
        setRecord({
          vehicle,
          client: vehicle ? clients.find(item => item.id === vehicle.clientId) || null : null,
          tag: vehicle ? tags.find(item => item.id === vehicle.tagId) || null : null,
          category: vehicle ? categories.find(item => item.id === vehicle.type) || null : null,
          company: vehicle ? companies.find(item => item.id === vehicle.companyId) || null : null,
        });
      })
      .catch(() => { if (active) setRecord({ vehicle: null, client: null, tag: null, category: null, company: null }); });
    return () => { active = false; };
  }, [id]);

  if (!record) {
    return (
      <PageContainer size="full" className="space-y-6">
        <Skeleton h={96} className="w-80" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
          <Skeleton h={220} rounded="3xl" /><Skeleton h={220} rounded="3xl" />
        </div>
      </PageContainer>
    );
  }
  const { vehicle, client, tag, category, company } = record;
  if (!vehicle) return <NotFoundState what="Veículo" onBack={() => navigate('/vehicles')} />;

  const trackingId = trackingIdOf(vehicle);
  const lastPosition = vehicle.lastPosition?.timestamp;
  const stale = lastPosition ? now - lastPosition > STALE_POSITION_MS : false;
  const hasEquipment = Boolean(vehicle.tagId || vehicle.trackerId);
  const notInformed = 'Não informado';

  return (
    <PageContainer size="full" className="space-y-6">
      <RecordHeader
        backLabel="Voltar aos veículos"
        onBack={() => navigate('/vehicles')}
        eyebrow="Ficha do veículo"
        title={<span className="font-mono">{vehicle.plate}</span>}
        subtitle={vehicle.model}
        badges={
          <>
            {vehicle.status && <Badge tone={STATUS_TONE[vehicle.status]}>{STATUS_LABEL[vehicle.status]}</Badge>}
            <Badge tone={hasEquipment ? 'neutral' : 'red'}>{hasEquipment ? 'Equipamento vinculado' : 'Sem equipamento'}</Badge>
            {stale && <Badge tone="accent">Atualização atrasada</Badge>}
          </>
        }
        actions={
          <Button type="button" onClick={() => navigate(`/vehicles/${encodeURIComponent(vehicle.id)}/edit`)}>
            <Edit2 size={14} aria-hidden /> Editar veículo
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
        <InfoCard title="Dados do veículo" icon={<CarFront size={16} />}>
          <DetailGrid>
            <Detail label="Placa" value={<span className="font-mono">{vehicle.plate}</span>} />
            <Detail label="Modelo" value={vehicle.model} />
            <Detail label="Categoria" value={category?.name || notInformed} />
            <Detail label="Ano" value={vehicle.year || notInformed} />
            <Detail label="Cor" value={vehicle.color || notInformed} />
            <Detail label="Chassi" value={vehicle.chassis ? <span className="font-mono">{vehicle.chassis}</span> : notInformed} />
            <Detail label="Empresa" value={company?.name || notInformed} />
            <Detail
              label="Valor FIPE"
              value={vehicle.fipeValue ? vehicle.fipeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : notInformed}
            />
          </DetailGrid>
        </InfoCard>

        <InfoCard title="Equipamento e cadastro" icon={<Radio size={16} />}>
          <DetailGrid cols={1}>
            <Detail label="Instalação" value={installationLabel(vehicle)} />
            <Detail label="Contrato" value={vehicle.ownershipStatus ? OWNERSHIP_LABEL[vehicle.ownershipStatus] : notInformed} />
            <Detail label="Tag" value={tag ? <span className="font-mono">{tag.accessoryId}</span> : 'Não vinculada'} />
            <Detail label="Local de instalação" value={vehicle.installationLocation || notInformed} />
            {vehicle.trackerId && <Detail label="Rastreador" value={<span className="font-mono">{vehicle.trackerId}</span>} />}
            <Detail label="Cadastrado em" value={new Date(vehicle.createdAt).toLocaleDateString('pt-BR')} />
          </DetailGrid>
        </InfoCard>

        {vehicle.notes && (
          <InfoCard title="Observações" icon={<StickyNote size={16} />} className="lg:col-span-2">
            <p className="whitespace-pre-line text-sm text-fg-1">{vehicle.notes}</p>
          </InfoCard>
        )}

        <InfoCard title="Cliente vinculado" icon={<User size={16} />}>
          {client ? (
            <>
              <DetailGrid>
                <Detail label="Nome" value={client.name} />
                <Detail label="Documento" value={<span className="font-mono">{formatCPF(client.cpf)}</span>} />
                <Detail label="Telefone" value={client.phone ? formatPhone(client.phone) : notInformed} />
                <Detail label="E-mail" value={<span className="normal-case">{client.email || notInformed}</span>} />
              </DetailGrid>
              <Button
                type="button"
                variant="link"
                className="mt-4 h-10 px-0"
                onClick={() => navigate(`/clients/${encodeURIComponent(client.id)}`)}
              >
                Abrir ficha do cliente
              </Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-fg-2">Nenhum cliente vinculado a este veículo.</p>
              <Button type="button" variant="outline" onClick={() => navigate(`/vehicles/${encodeURIComponent(vehicle.id)}/edit`)}>
                Vincular cliente
              </Button>
            </div>
          )}
        </InfoCard>

        <InfoCard title="Comunicação" icon={<Clock size={16} />}>
          <p className="text-sm font-semibold text-fg-1">
            Última posição: <span className="font-mono">{formatDateTime(lastPosition)}</span>
            {lastPosition && <span className="ml-1 text-fg-2">({timeAgo(lastPosition, now)})</span>}
          </p>
          {trackingId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/map?tagId=${encodeURIComponent(trackingId)}`)}>
                <MapPin size={14} aria-hidden /> Abrir no mapa
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(`/map?tagId=${encodeURIComponent(trackingId)}&history=1`)}>
                <History size={14} aria-hidden /> Histórico
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-caption text-fg-2">Vincule uma tag ou rastreador para acompanhar no mapa.</p>
          )}
        </InfoCard>
      </div>
    </PageContainer>
  );
};
