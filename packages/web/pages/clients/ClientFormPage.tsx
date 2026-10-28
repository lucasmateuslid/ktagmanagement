import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Car, Check, Fingerprint, KeyRound, RotateCcw, Search, UserPlus, Users } from 'lucide-react';
import { normalizeCPF } from '@ktag/shared';
import { storage } from '../../services/storage';
import { functions } from '../../services/firebase';
import { authenticatedFetch } from '../../services/authenticatedFetch';
import { useNotification } from '../../contexts/NotificationContext';
import { useTenant } from '../../contexts/TenantContext';
import { Client } from '../../types';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FormPage,
  FormSection,
  Input,
  NotFoundState,
  PageContainer,
  Skeleton,
  StickyFormFooter,
  Textarea,
  inputClassName,
} from '../../components/ui';
import { BrazilianDocumentInput } from '../../components/ui/brazilian-document-input';
import { BrazilianPhoneInput } from '../../components/ui/brazilian-phone-input';
import { useClients } from './hooks/useClients';
import { ClientFormErrors, isCorrupted, validateClientForm } from './utils/clientForm';

/** Cadastro e edição de cliente em página dedicada (/clients/new e /clients/:id/edit). */
export const ClientFormPage = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const isEditing = Boolean(routeId);
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const { tenantId } = useTenant();
  const { clients, vehicles, loading, reload } = useClients();

  const [client, setClient] = React.useState<Partial<Client>>({ hasAccess: false });
  const [errors, setErrors] = React.useState<ClientFormErrors>({});
  const [selectedVehicleIds, setSelectedVehicleIds] = React.useState<Set<string>>(new Set());
  const [blockingVehicleIds, setBlockingVehicleIds] = React.useState<Set<string>>(new Set());
  const [vehicleSearch, setVehicleSearch] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const existing = React.useMemo(() => clients.find(item => item.id === routeId), [clients, routeId]);
  const blocked = isEditing && existing ? isCorrupted(existing.name) : false;

  /* eslint-disable react-hooks/set-state-in-effect -- sincroniza rascunho/estado com dados remotos */
  // Hidrata o formulário uma única vez, quando os dados chegam.
  React.useEffect(() => {
    if (loading || hydrated) return;
    if (isEditing) {
      if (!existing) return;
      setClient(existing);
      const linked = vehicles.filter(v => v.clientId === existing.id);
      setSelectedVehicleIds(new Set(linked.map(v => v.id)));
      setBlockingVehicleIds(new Set(linked.filter(v => v.clientBlockingAllowed).map(v => v.id)));
    }
    setHydrated(true);
  }, [loading, hydrated, isEditing, existing, vehicles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const visibleVehicles = React.useMemo(() => {
    const term = vehicleSearch.toLowerCase().trim();
    if (!term) return vehicles.slice(0, 50);
    return vehicles.filter(v => v.plate.toLowerCase().includes(term) || v.model.toLowerCase().includes(term));
  }, [vehicles, vehicleSearch]);

  const patch = (changes: Partial<Client>) => {
    setClient(current => ({ ...current, ...changes }));
    const touched = Object.keys(changes) as (keyof ClientFormErrors)[];
    setErrors(current => {
      if (!touched.some(key => current[key])) return current;
      const next = { ...current };
      touched.forEach(key => delete next[key]);
      return next;
    });
  };

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds(current => {
      const next = new Set(current);
      if (next.has(vehicleId)) next.delete(vehicleId); else next.add(vehicleId);
      return next;
    });
  };

  const toggleBlocking = (vehicleId: string, allowed: boolean) => {
    setBlockingVehicleIds(current => {
      const next = new Set(current);
      if (allowed) next.add(vehicleId); else next.delete(vehicleId);
      return next;
    });
  };

  const handleResetPassword = async (mode: 'default' | 'cpf') => {
    if (!client.cpf || resetting) return;
    setResetting(true);
    try {
      if (!functions) throw new Error('Serviço de autenticação indisponível.');
      const provision = httpsCallable<
        { tenantId: string; cpf: string; name: string; clientId: string },
        { uid: string }
      >(functions, 'provisionClientAccess');
      await provision({ tenantId, cpf: client.cpf, name: client.name || 'Cliente', clientId: client.id || '' });
      const reset = httpsCallable<{ tenantId: string; cpf: string; mode: 'default' | 'cpf' }, { password: string }>(
        functions, 'resetClientPassword',
      );
      const result = await reset({ tenantId, cpf: client.cpf, mode });
      addNotification('success', 'Senha redefinida', `A nova senha é: ${result.data.password}`);
      setResetOpen(false);
    } catch (e: any) {
      addNotification('error', 'Erro', e?.message || 'Não foi possível redefinir a senha no momento.');
    } finally {
      setResetting(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    // Idempotência: impede reentrância (duplo clique / rede lenta).
    if (isSaving) return;

    const validation = validateClientForm(client, clients);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      addNotification('error', 'Revise o formulário', 'Corrija os campos destacados para salvar.');
      return;
    }

    // id estável: gerado uma vez e fixado, para que um retry reutilize o mesmo documento.
    const clientId = client.id || crypto.randomUUID();
    const cleanCpf = normalizeCPF(client.cpf as string);
    const wasAccessEnabled = Boolean(existing?.hasAccess);

    setIsSaving(true);
    try {
      const clientData: Client = {
        ...(client as Client),
        id: clientId,
        name: (client.name as string).trim(),
        cpf: client.cpf as string,
        phone: client.phone || '',
        createdAt: client.createdAt || Date.now(),
      };
      setClient(current => ({ ...current, id: clientId }));

      // storage.saveClient já registra a auditoria (CREATE/UPDATE Client).
      await storage.saveClient(clientData);

      // O indicador de acesso só permanece ativo se o provisionamento concluir.
      if (clientData.hasAccess && !wasAccessEnabled) {
        if (!functions) throw new Error('Serviço de criação de acesso indisponível.');
        const provision = httpsCallable<
          { tenantId: string; cpf: string; name: string; clientId: string; resetInitialPassword?: boolean },
          { uid: string; email: string; created: boolean; initialPassword: string | null }
        >(functions, 'provisionClientAccess');
        try {
          const result = await provision({ tenantId, cpf: cleanCpf, name: clientData.name, clientId, resetInitialPassword: true });
          if (result.data.initialPassword) {
            addNotification('success', 'Acesso criado', `Login: ${result.data.email} — senha inicial: ${result.data.initialPassword}`);
          }
        } catch (error) {
          await storage.saveClient({ ...clientData, hasAccess: false });
          throw error;
        }
      }
      if (!clientData.hasAccess && wasAccessEnabled) {
        if (!functions) throw new Error('Serviço de revogação de acesso indisponível.');
        const revoke = httpsCallable<{ tenantId: string; cpf: string }, { ok: boolean }>(functions, 'revokeClientAccess');
        try {
          await revoke({ tenantId, cpf: cleanCpf });
        } catch (error) {
          await storage.saveClient({ ...clientData, hasAccess: true });
          throw error;
        }
      }

      await Promise.all(vehicles.map(async vehicle => {
        const isSelected = selectedVehicleIds.has(vehicle.id);
        const wasMine = vehicle.clientId === clientId;
        if (isSelected === wasMine) return;
        const response = await authenticatedFetch(`/api/vehicles/${encodeURIComponent(vehicle.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: isSelected ? clientId : '' }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha ao vincular veículo.');
      }));

      for (const vehicle of vehicles.filter(v => selectedVehicleIds.has(v.id))) {
        const allowed = blockingVehicleIds.has(vehicle.id) && clientData.hasAccess === true;
        if (allowed === Boolean(vehicle.clientBlockingAllowed) && vehicle.clientId === clientId) continue;
        const response = await authenticatedFetch(
          `/api/blocking/clients/${encodeURIComponent(clientId)}/vehicles/${encodeURIComponent(vehicle.id)}`,
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed }) },
        );
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha ao salvar autorização de bloqueio.');
      }

      const reindexResponse = await authenticatedFetch(`/api/vehicles/reindex-client/${encodeURIComponent(clientId)}`, { method: 'POST' });
      const reindexPayload = await reindexResponse.json().catch(() => ({}));
      if (!reindexResponse.ok) throw new Error(reindexPayload.error || 'Falha ao atualizar o índice de pesquisa da frota.');

      addNotification('success', 'Cliente salvo', 'Perfil e frota do cliente atualizados.');
      await reload();
      navigate('/clients');
    } catch (err: any) {
      console.error('Falha ao salvar cliente:', err);
      addNotification('error', 'Erro ao salvar', err?.message || 'Não foi possível salvar o cliente. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer size="5xl">
        <Skeleton h={48} className="mb-6 w-72" />
        <Skeleton h={280} className="mb-4 w-full" rounded="2xl" />
        <Skeleton h={320} className="w-full" rounded="2xl" />
      </PageContainer>
    );
  }

  if (isEditing && !existing) return <NotFoundState what="Cliente" onBack={() => navigate('/clients')} />;

  if (blocked) {
    return (
      <NotFoundState
        what="Registro protegido"
        onBack={() => navigate('/clients')}
      />
    );
  }

  const backPath = isEditing && existing ? `/clients/${encodeURIComponent(existing.id)}` : '/clients';

  return (
    <FormPage
      eyebrow="Ficha do cliente"
      title={isEditing ? client.name || 'Editar cliente' : 'Novo cliente'}
      subtitle={isEditing ? 'Edição de cadastro' : 'Cadastro de associado'}
      icon={isEditing ? <Users size={20} aria-hidden /> : <UserPlus size={20} aria-hidden />}
      backLabel={isEditing ? 'Voltar à ficha' : 'Voltar aos clientes'}
      onBack={() => navigate(backPath)}
      onSubmit={handleSave}
      footer={
        <StickyFormFooter
          onCancel={() => navigate(backPath)}
          isSaving={isSaving}
          submitLabel={isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
        />
      }
    >
      <FormSection title="Informações cadastrais" description="Dados do associado e acesso ao portal.">
        <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
          <Input value={client.name || ''} onChange={e => patch({ name: e.target.value })} autoComplete="name" />
        </Field>
        <Field label="CPF" required error={errors.cpf} hint="Somente números; usado como login do portal.">
          <BrazilianDocumentInput
            kind="cpf"
            value={client.cpf || ''}
            onValueChange={cpf => patch({ cpf })}
            placeholder="000.000.000-00"
            className={`${inputClassName} font-mono`}
          />
        </Field>
        <Field label="Telefone" error={errors.phone}>
          <BrazilianPhoneInput
            value={client.phone || ''}
            onValueChange={phone => patch({ phone })}
            placeholder="(00) 00000-0000"
            className={inputClassName}
          />
        </Field>
        <Field label="E-mail" error={errors.email} className="sm:col-span-2">
          <Input type="email" value={client.email || ''} onChange={e => patch({ email: e.target.value })} placeholder="cliente@provedor.com" autoComplete="email" />
        </Field>
        <Field label="Endereço" className="sm:col-span-2">
          <Input value={client.address || ''} onChange={e => patch({ address: e.target.value })} placeholder="Rua, número – bairro" autoComplete="street-address" />
        </Field>
        <Field label="Cidade">
          <Input value={client.city || ''} onChange={e => patch({ city: e.target.value })} autoComplete="address-level2" />
        </Field>
        <Field label="UF">
          <Input
            value={client.state || ''}
            maxLength={2}
            placeholder="RN"
            className="uppercase"
            onChange={e => patch({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}
            autoComplete="address-level1"
          />
        </Field>

        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            value={client.notes || ''}
            maxLength={1000}
            placeholder="Preferências de contato, combinados com o associado, histórico relevante…"
            onChange={e => patch({ notes: e.target.value })}
          />
        </Field>

        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2 p-4 sm:col-span-2">
          <Checkbox checked={Boolean(client.hasAccess)} onChange={hasAccess => patch({ hasAccess })}>
            <span className="font-bold uppercase">Liberar portal do cliente</span>
            <span className="block text-caption text-fg-2">Acesso via CPF e senha inicial gerada no salvamento.</span>
          </Checkbox>

          {isEditing && existing?.hasAccess && (
            !resetOpen ? (
              <div>
                <Button type="button" variant="outline" onClick={() => setResetOpen(true)}>
                  <KeyRound size={14} aria-hidden /> Redefinir senha
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 border-t border-line pt-4">
                <p className="text-sm text-fg-2">A alteração é imediata. O cliente deverá usar a nova credencial no próximo acesso.</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="secondary" disabled={resetting} onClick={() => handleResetPassword('default')}>
                    <RotateCcw size={14} aria-hidden /> Senha padrão (123456)
                  </Button>
                  <Button type="button" disabled={resetting} onClick={() => handleResetPassword('cpf')}>
                    <Fingerprint size={14} aria-hidden /> 6 primeiros do CPF
                  </Button>
                  <Button type="button" variant="ghost" disabled={resetting} onClick={() => setResetOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </FormSection>

      <FormSection
        title="Gestão de acesso (placas)"
        description="Selecione as placas do cliente. O bloqueio remoto só vale com o portal liberado."
        aside={<Badge tone="accent" className="shrink-0">{selectedVehicleIds.size} selecionados</Badge>}
      >
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Input
            leadingIcon={<Search size={16} aria-hidden />}
            aria-label="Buscar placa ou modelo"
            placeholder="Buscar placa para vincular…"
            value={vehicleSearch}
            onChange={e => setVehicleSearch(e.target.value)}
          />

          <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
            {visibleVehicles.length === 0 && (
              <li className="flex flex-col items-center gap-2 py-12 text-fg-3">
                <Car size={28} aria-hidden />
                <span className="text-label-xs uppercase">Nenhum veículo encontrado</span>
              </li>
            )}
            {visibleVehicles.map(vehicle => {
              const selected = selectedVehicleIds.has(vehicle.id);
              const belongsToOther = Boolean(vehicle.clientId && vehicle.clientId !== client.id);
              return (
                <li
                  key={vehicle.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${selected ? 'border-accent bg-accent text-fg-on-accent shadow-sm' : 'border-line bg-surface hover:bg-surface-2'}`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleVehicle(vehicle.id)}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-1"
                  >
                    <span
                      aria-hidden
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-black/10' : 'bg-surface-2 text-fg-3'}`}
                    >
                      <Car size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm font-black uppercase">{vehicle.plate}</span>
                      <span className={`block truncate text-caption uppercase ${selected ? 'opacity-80' : 'text-fg-2'}`}>
                        {vehicle.model}
                        {belongsToOther && !selected && <span className="ml-2 font-bold text-danger">• Outro cliente</span>}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? 'border-current bg-fg-1 text-surface' : 'border-line text-transparent'}`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </button>
                  {selected && (
                    <Checkbox
                      disabled={!client.hasAccess}
                      checked={blockingVehicleIds.has(vehicle.id)}
                      onChange={allowed => toggleBlocking(vehicle.id, allowed)}
                    >
                      <span className="text-caption font-bold text-current">Bloqueio</span>
                    </Checkbox>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </FormSection>
    </FormPage>
  );
};
