import React from 'react';
import { Car, Edit2, MapPinned, StickyNote, User } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCPF, formatPhone } from '@ktag/shared';
import { storage } from '../services/storage';
import { Tag, VehicleCategory } from '../types';
import {
  Badge, Button, Detail, DetailGrid, EmptyState, InfoCard, NotFoundState, PageContainer, RecordHeader, Skeleton,
} from '../components/ui';
import { useClients } from './clients/hooks/useClients';
import { LinkedVehicleCard } from './clients/components/LinkedVehicleCard';

export const ClientDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, vehicles, loading } = useClients();
  const [tags, setTags] = React.useState<Tag[]>([]);
  const [categories, setCategories] = React.useState<VehicleCategory[]>([]);
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    let active = true;
    Promise.all([storage.getTags(), storage.getCategories()])
      .then(([t, c]) => { if (active) { setTags(t); setCategories(c); } })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const client = React.useMemo(() => clients.find(item => item.id === id) || null, [clients, id]);
  const linked = React.useMemo(() => vehicles.filter(vehicle => vehicle.clientId === id), [vehicles, id]);

  if (loading) {
    return (
      <PageContainer size="full" className="space-y-6">
        <Skeleton h={96} className="w-80" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
          <Skeleton h={180} rounded="3xl" /><Skeleton h={180} rounded="3xl" />
        </div>
      </PageContainer>
    );
  }
  if (!client) return <NotFoundState what="Cliente" onBack={() => navigate('/clients')} />;

  const editPath = `/clients/${encodeURIComponent(client.id)}/edit`;
  const notInformed = 'Não informado';
  const cityState = [client.city, client.state].filter(Boolean).join(' / ');

  return (
    <PageContainer size="full" className="space-y-6">
      <RecordHeader
        backLabel="Voltar aos clientes"
        onBack={() => navigate('/clients')}
        eyebrow="Ficha do cliente"
        title={client.name}
        badges={
          <>
            <Badge tone={client.hasAccess ? 'emerald' : 'neutral'}>{client.hasAccess ? 'Portal ativo' : 'Sem acesso ao portal'}</Badge>
            <Badge tone="neutral">{linked.length} {linked.length === 1 ? 'veículo' : 'veículos'}</Badge>
          </>
        }
        actions={
          <Button type="button" onClick={() => navigate(editPath)}>
            <Edit2 size={14} aria-hidden /> Editar cliente
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]">
        <InfoCard title="Dados e contato" icon={<User size={16} />}>
          <DetailGrid>
            <Detail label="Documento" value={<span className="font-mono">{formatCPF(client.cpf)}</span>} />
            <Detail label="Telefone" value={client.phone ? formatPhone(client.phone) : notInformed} />
            <Detail label="E-mail" value={<span className="normal-case">{client.email || notInformed}</span>} />
            <Detail label="Contato preferido" value={client.preferredContact || notInformed} />
          </DetailGrid>
        </InfoCard>
        <InfoCard title="Endereço e cadastro" icon={<MapPinned size={16} />}>
          <DetailGrid cols={1}>
            <Detail label="Endereço" value={client.address || notInformed} />
            <Detail label="Cidade / UF" value={cityState || notInformed} />
            <Detail label="Cadastrado em" value={new Date(client.createdAt).toLocaleDateString('pt-BR')} />
          </DetailGrid>
        </InfoCard>
      </div>

      {client.notes && (
        <InfoCard title="Observações" icon={<StickyNote size={16} />}>
          <p className="whitespace-pre-line text-sm text-fg-1">{client.notes}</p>
        </InfoCard>
      )}

      <section aria-labelledby="linked-vehicles" className="space-y-4">
        <div>
          <h2 id="linked-vehicles" className="font-display text-xl font-black tracking-tight text-fg-1">Veículos vinculados</h2>
          <p className="text-caption text-fg-2">Placa → equipamento → comunicação</p>
        </div>
        {linked.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              icon={<Car size={22} aria-hidden />}
              title="Nenhum veículo vinculado"
              description="Vincule placas ao cliente na tela de edição."
              action={<Button variant="outline" onClick={() => navigate(editPath)}>Vincular veículos</Button>}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {linked.map(vehicle => (
              <LinkedVehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                tag={tags.find(t => t.id === vehicle.tagId)}
                category={categories.find(c => c.id === vehicle.type)}
                now={now}
              />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
};
