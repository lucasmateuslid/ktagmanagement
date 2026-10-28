import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Book, Building2, CarFront, Loader2, Search, Unlink, User } from 'lucide-react';
import type { ManagedTracker } from '@ktag/shared';
import { storage } from '../../services/storage';
import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import { Client, Company, Tag, Vehicle, VehicleCategory } from '../../types';
import {
  Badge,
  Button,
  Combobox,
  Detail,
  Field,
  FormPage,
  FormSection,
  Input,
  NotFoundState,
  PageContainer,
  SegmentedControl,
  Select,
  Skeleton,
  StickyFormFooter,
  Textarea,
  inputClassName,
} from '../../components/ui';
import { BrazilianDocumentInput } from '../../components/ui/brazilian-document-input';
import { BrazilianPhoneInput } from '../../components/ui/brazilian-phone-input';
import { useVehicleForm } from './hooks/useVehicleForm';
import { useHinovaLookup } from './hooks/useHinovaLookup';
import { useFipeSearch } from './hooks/useFipeSearch';
import { FipePanel } from './components/FipePanel';
import { VehicleFormErrors } from './utils/vehicleForm';

interface FormData {
  vehicles: Vehicle[];
  tags: Tag[];
  companies: Company[];
  categories: VehicleCategory[];
  clients: Client[];
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo', activeClassName: 'bg-success text-white shadow-sm' },
  { value: 'maintenance', label: 'Manutenção', activeClassName: 'bg-zinc-600 text-white shadow-sm' },
  { value: 'stolen', label: 'Roubado', activeClassName: 'bg-danger text-white shadow-sm' },
];
const INSTALLATION_LOCATIONS = [
  'Atrás do painel', 'Sob o volante', 'Porta-luvas', 'Sob o banco do motorista', 'Sob o banco do passageiro',
  'Porta-malas', 'Coluna lateral', 'Teto / forro', 'Banco (moto)', 'Carenagem (moto)',
];
const PORTAL_OPTIONS = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não', activeClassName: 'bg-fg-1 text-surface shadow-sm' },
];
const OWNERSHIP_OPTIONS = [
  { value: 'leased', label: 'Comodato' },
  { value: 'purchased', label: 'Adquirido' },
];

const NO_VEHICLES: Vehicle[] = [];
const NO_CLIENTS: Client[] = [];
const NO_TAGS: Tag[] = [];
const NO_CATEGORIES: VehicleCategory[] = [];
const NO_COMPANIES: Company[] = [];

/** Cadastro e edição de veículo em página dedicada (/vehicles/new e /vehicles/:id/edit). */
export const VehicleFormPage = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const isEditing = Boolean(routeId);
  const navigate = useNavigate();
  const { user: currentUser, customRoles } = useAuth();
  const { enabledModules } = useTenant();
  const canManage = hasPermission(currentUser, customRoles, PERMISSIONS.VEHICLES_MANAGE);
  const canLinkTrackers = enabledModules.includes('trackers') && hasPermission(currentUser, customRoles, PERMISSIONS.ASSETS);

  const [data, setData] = React.useState<FormData | null>(null);
  const [loadError, setLoadError] = React.useState('');
  const [hydrated, setHydrated] = React.useState(false);
  const [trackers, setTrackers] = React.useState<ManagedTracker[]>([]);
  const [trackersLoading, setTrackersLoading] = React.useState(false);
  const [trackersError, setTrackersError] = React.useState('');

  const loadAll = React.useCallback(async () => {
    try {
      const [vehicles, tags, categories, companies, clients] = await Promise.all([
        storage.getVehicles(), storage.getTags(), storage.getCategories(), storage.getCompanies(), storage.getClients(),
      ]);
      setData({ vehicles: vehicles || [], tags, categories, companies, clients });
      setLoadError('');
    } catch (err: any) {
      setLoadError(err?.message || 'Não foi possível carregar os dados do formulário.');
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado
  React.useEffect(() => { void loadAll(); }, [loadAll]);

  const vehicles = data?.vehicles ?? NO_VEHICLES;
  const clients = data?.clients ?? NO_CLIENTS;
  const tags = data?.tags ?? NO_TAGS;
  const categories = data?.categories ?? NO_CATEGORIES;
  const companies = data?.companies ?? NO_COMPANIES;

  const {
    isSaving, errors, setErrors, formData, setFormData, clientData, setClientData,
    handleSave, checkExistingClient, openNew, openEdit,
  } = useVehicleForm(vehicles, clients, currentUser, () => navigate('/vehicles'));

  const { status: hinovaStatus, lookupPlate } = useHinovaLookup(setFormData, setClientData, clients);
  const fipe = useFipeSearch(categories);

  const existing = React.useMemo(() => vehicles.find(item => item.id === routeId), [vehicles, routeId]);

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza rascunho/estado com dados remotos */
  // Hidrata uma única vez quando os dados chegam.
  React.useEffect(() => {
    if (!data || hydrated) return;
    if (isEditing) {
      if (!existing) return;
      openEdit(existing, tags);
    } else {
      openNew();
    }
    setHydrated(true);
  }, [data, hydrated, isEditing, existing, tags, openEdit, openNew]);

  // Rastreadores disponíveis para vínculo.
  React.useEffect(() => {
    if (!canLinkTrackers) return;
    let active = true;
    setTrackersLoading(true);
    setTrackersError('');
    void authenticatedFetch('/api/trackers').then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Falha ao carregar rastreadores.');
      if (active) setTrackers(payload.data || []);
    }).catch((error: Error) => {
      if (active) setTrackersError(error.message || 'Falha ao carregar rastreadores.');
    }).finally(() => { if (active) setTrackersLoading(false); });
    return () => { active = false; };
  }, [canLinkTrackers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const clearError = (...keys: (keyof VehicleFormErrors)[]) => {
    setErrors(current => {
      if (!keys.some(key => current[key])) return current;
      const next = { ...current };
      keys.forEach(key => delete next[key]);
      return next;
    });
  };
  const patchVehicle = (changes: Partial<Vehicle>, ...clear: (keyof VehicleFormErrors)[]) => {
    setFormData(current => ({ ...current, ...changes }));
    clearError(...clear);
  };
  const patchClient = (changes: Partial<Client>, ...clear: (keyof VehicleFormErrors)[]) => {
    setClientData(current => ({ ...current, ...changes }));
    clearError(...clear);
  };

  const tagsInUse = React.useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach(v => { if (v.tagId && v.id !== formData.id) map.set(v.tagId, v); });
    return map;
  }, [vehicles, formData.id]);

  const tagOptions = React.useMemo(() => tags.map(tag => {
    const owner = tagsInUse.get(tag.id);
    return {
      value: tag.id,
      label: `${tag.accessoryId} · ${tag.name}`,
      description: owner ? `Em uso por ${owner.plate}` : 'Livre',
      disabled: Boolean(owner),
    };
  }), [tags, tagsInUse]);

  const selectableTrackers = trackers.filter(
    tracker => !tracker.vehicleId || tracker.vehicleId === formData.id || tracker.id === formData.trackerId,
  );
  const trackerOptions = [
    { value: '', label: 'Sem rastreador' },
    ...(formData.trackerId && !selectableTrackers.some(t => t.id === formData.trackerId)
      ? [{ value: formData.trackerId, label: `Rastreador atual · ${formData.trackerId}` }]
      : []),
    ...selectableTrackers.map(tracker => ({
      value: tracker.id,
      label: `${tracker.manufacturer} ${tracker.modelName} · ${tracker.imei}${tracker.integrationStatus !== 'registered' ? ' · sincronização pendente' : ''}`,
    })),
  ];

  const installationLabel = formData.trackerId
    ? (formData.tagId ? 'Tag e rastreador' : 'Somente rastreador')
    : (formData.tagId ? 'Somente tag' : 'Nenhum equipamento vinculado');

  const linkedExistingClient = Boolean(clientData.id && clients.some(c => c.id === clientData.id));

  if (currentUser?.role === 'client' || !canManage) {
    return <NotFoundState what="Página" onBack={() => navigate('/vehicles')} />;
  }

  if (loadError) {
    return (
      <PageContainer size="5xl">
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()}>Tentar novamente</Button>
        </div>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer size="5xl">
        <Skeleton h={48} className="mb-6 w-72" />
        <Skeleton h={280} className="mb-4 w-full" rounded="2xl" />
        <Skeleton h={320} className="w-full" rounded="2xl" />
      </PageContainer>
    );
  }

  if (isEditing && !existing) return <NotFoundState what="Veículo" onBack={() => navigate('/vehicles')} />;
  if (!hydrated) return null;

  const plate = (formData.plate || '').toUpperCase();

  const backPath = isEditing && existing ? `/vehicles/${encodeURIComponent(existing.id)}` : '/vehicles';

  return (
    <FormPage
      eyebrow="Ficha do veículo"
      title={isEditing ? plate || 'Editar veículo' : 'Novo veículo'}
      subtitle={isEditing ? formData.model || 'Edição de cadastro' : 'Dados do veículo, equipamento e associado'}
      icon={<CarFront size={20} aria-hidden />}
      backLabel={isEditing ? 'Voltar à ficha' : 'Voltar aos veículos'}
      onBack={() => navigate(backPath)}
      onSubmit={handleSave}
      footer={
        <StickyFormFooter
          onCancel={() => navigate(backPath)}
          isSaving={isSaving}
          submitLabel={isEditing ? 'Salvar alterações' : 'Cadastrar veículo'}
        />
      }
    >
      <FormSection title="Veículo e equipamento" description="Selecione a empresa antes de consultar a placa no SGA.">
        <Field label="Categoria">
          <Select
            value={formData.type || ''}
            options={[{ value: '', label: 'Sem categoria' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
            onChange={type => patchVehicle({ type })}
          />
        </Field>
        <Field label="Empresa">
          <Select
            value={formData.companyId || ''}
            leftIcon={<Building2 size={14} aria-hidden />}
            options={[{ value: '', label: 'Sem empresa' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
            onChange={companyId => patchVehicle({ companyId })}
          />
        </Field>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-label-xs uppercase text-fg-2">Status</span>
          <SegmentedControl
            aria-label="Status do veículo"
            value={formData.status}
            options={STATUS_OPTIONS}
            onChange={status => patchVehicle({ status: status as Vehicle['status'] })}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-label-xs uppercase text-fg-2">Modelo de contrato (tag)</span>
          <SegmentedControl
            aria-label="Modelo de contrato"
            value={formData.ownershipStatus}
            options={OWNERSHIP_OPTIONS}
            onChange={ownershipStatus => patchVehicle({ ownershipStatus: ownershipStatus as Vehicle['ownershipStatus'] })}
          />
        </div>

        <Field label="Placa" htmlFor="vehicle-plate" required error={errors.plate} hint="Padrão antigo (AAA0000) ou Mercosul (AAA0A00)." className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              id="vehicle-plate"
              value={formData.plate || ''}
              maxLength={7}
              placeholder="ABC1D23"
              className="font-mono font-black uppercase"
              onChange={e => patchVehicle({ plate: e.target.value.toUpperCase() }, 'plate')}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-11 shrink-0"
              disabled={hinovaStatus === 'loading'}
              onClick={() => lookupPlate(formData.plate || '')}
            >
              {hinovaStatus === 'loading' ? <Loader2 className="animate-spin" size={14} aria-hidden /> : <Search size={14} aria-hidden />}
              SGA
            </Button>
          </div>
        </Field>

        <Field label="Modelo" htmlFor="vehicle-model" required error={errors.model} className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              id="vehicle-model"
              value={formData.model || ''}
              placeholder="Ex.: Fiat Strada Endurance"
              onChange={e => patchVehicle({ model: e.target.value }, 'model')}
            />
            <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={() => void fipe.startSearch(formData.type)}>
              <Book size={14} aria-hidden /> Busca FIPE
            </Button>
          </div>
        </Field>

        {fipe.isOpen && (
          <FipePanel
            onClose={() => fipe.setIsOpen(false)}
            step={fipe.step}
            loading={fipe.loading}
            searchTerm={fipe.searchTerm}
            setSearchTerm={fipe.setSearchTerm}
            currentType={fipe.currentType}
            selectedBrand={fipe.selectedBrand}
            selectedModel={fipe.selectedModel}
            filteredList={fipe.filteredList}
            handleBack={fipe.handleBack}
            handleSelection={item => fipe.handleSelection(item, (model, year, price) => {
              patchVehicle({ model, year, fipeValue: price }, 'model', 'year', 'fipeValue');
            })}
          />
        )}

        <Field label="Ano" error={errors.year}>
          <Input
            inputMode="numeric"
            maxLength={4}
            placeholder="2024"
            value={formData.year || ''}
            onChange={e => patchVehicle({ year: e.target.value.replace(/\D/g, '') }, 'year')}
          />
        </Field>
        <Field label="Valor FIPE (R$)" error={errors.fipeValue}>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={formData.fipeValue ?? ''}
            onChange={e => patchVehicle({ fipeValue: e.target.value === '' ? undefined : parseFloat(e.target.value) }, 'fipeValue')}
          />
        </Field>
        <Field label="Chassi">
          <Input
            value={formData.chassis || ''}
            maxLength={17}
            className="font-mono uppercase"
            onChange={e => patchVehicle({ chassis: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Cor">
          <Input value={formData.color || ''} onChange={e => patchVehicle({ color: e.target.value })} />
        </Field>

        <Field label="Tag vinculada" htmlFor="vehicle-tag" hint="Tags em uso por outro veículo ficam indisponíveis." className={canLinkTrackers ? undefined : 'sm:col-span-2'}>
          <div className="flex gap-2">
            <Combobox
              id="vehicle-tag"
              value={formData.tagId || ''}
              options={tagOptions}
              placeholder="Selecione uma tag…"
              searchPlaceholder="Buscar por nome ou ID…"
              emptyText="Nenhuma tag encontrada"
              onChange={tagId => patchVehicle({ tagId })}
            />
            {formData.tagId && (
              <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Desvincular tag" title="Desvincular tag" onClick={() => patchVehicle({ tagId: undefined })}>
                <Unlink size={16} aria-hidden />
              </Button>
            )}
          </div>
        </Field>

        {canLinkTrackers && (
          <Field
            label="Rastreador vinculado"
            error={trackersError || undefined}
            hint={
              trackersLoading ? 'Carregando rastreadores…'
                : !trackersError && selectableTrackers.length === 0 ? 'Cadastre um rastreador no estoque para vinculá-lo.'
                  : undefined
            }
          >
            <Select
              value={formData.trackerId || ''}
              options={trackerOptions}
              disabled={trackersLoading || Boolean(trackersError)}
              onChange={trackerId => patchVehicle({ trackerId: trackerId || undefined })}
            />
          </Field>
        )}

        <dl className="rounded-xl border border-line bg-surface-2 p-4 sm:col-span-2">
          <Detail label="Instalação do equipamento" value={installationLabel} />
        </dl>
      </FormSection>

      <div className="flex flex-col gap-6">
        <FormSection
          title="Associado"
          description={
            linkedExistingClient
              ? 'Cliente já cadastrado: o veículo será vinculado e os dados dele são preservados.'
              : 'Confira os dados importados antes de salvar. Se o CPF já existir, o cadastro é carregado.'
          }
          aside={linkedExistingClient ? <Badge tone="emerald" className="shrink-0">Cliente existente</Badge> : undefined}
        >
          <Field label="Nome do associado" required error={errors.clientName} className="sm:col-span-2">
            <Input
              leadingIcon={<User size={16} aria-hidden />}
              value={clientData.name || ''}
              placeholder="Nome completo"
              autoComplete="name"
              onChange={e => patchClient({ name: e.target.value }, 'clientName')}
            />
          </Field>
          <Field label="CPF" required error={errors.cpf} className="sm:col-span-2">
            <BrazilianDocumentInput
              kind="cpf"
              value={clientData.cpf || ''}
              placeholder="000.000.000-00"
              className={`${inputClassName} font-mono`}
              onBlur={e => checkExistingClient(e.currentTarget.value)}
              onValueChange={cpf => patchClient({ cpf }, 'cpf')}
            />
          </Field>
          <Field label="Telefone" error={errors.phone}>
            <BrazilianPhoneInput
              value={clientData.phone || ''}
              placeholder="(84) 99999-9999"
              className={inputClassName}
              onValueChange={phone => patchClient({ phone }, 'phone')}
            />
          </Field>
          <Field label="E-mail" error={errors.email}>
            <Input type="email" value={clientData.email || ''} autoComplete="email" placeholder="cliente@provedor.com" onChange={e => patchClient({ email: e.target.value }, 'email')} />
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-label-xs uppercase text-fg-2">Terá acesso ao portal?</span>
            <SegmentedControl
              aria-label="Acesso ao portal"
              value={clientData.hasAccess ? 'yes' : 'no'}
              options={PORTAL_OPTIONS}
              onChange={value => patchClient({ hasAccess: value === 'yes' })}
            />
          </div>
        </FormSection>

        <FormSection title="Instalação e observações" description="Registre onde o equipamento ficou e qualquer detalhe útil para a equipe.">
          <Field label="Local de instalação" hint="Ex.: atrás do painel, porta-malas, sob o banco." className="sm:col-span-2">
            <Input
              list="installation-locations"
              value={formData.installationLocation || ''}
              placeholder="Selecione ou descreva o local"
              onChange={e => patchVehicle({ installationLocation: e.target.value })}
            />
          </Field>
          <datalist id="installation-locations">
            {INSTALLATION_LOCATIONS.map(location => <option key={location} value={location} />)}
          </datalist>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea
              value={formData.notes || ''}
              maxLength={1000}
              placeholder="Informações adicionais sobre o veículo, a instalação ou o atendimento…"
              onChange={e => patchVehicle({ notes: e.target.value })}
            />
          </Field>
        </FormSection>
      </div>
    </FormPage>
  );
};
