import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Cpu } from 'lucide-react';
import { isTraccarTagModel } from '@ktag/shared';
import { storage } from '../../services/storage';
import { trackingApi } from '../../services/trackingApi';
import { authenticatedFetch, readApiResponse } from '../../services/authenticatedFetch';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import type { Tag, TagType } from '../../types';
import {
  Button,
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
  type SegmentedOption,
  type SelectOption,
} from '../../components/ui';
import { displayTagSerial, tagEditData, tagTypeLabel, traccarIdentifier, validateTagForm, type TagFormErrors } from './utils/tagForm';

const TAG_TYPE_OPTIONS: SegmentedOption<TagType>[] = [
  { value: 'K_TAG', label: 'K-Tag' },
  { value: 'XADTAG', label: 'XADTAG', activeClassName: 'bg-cyan-500 text-white shadow-sm' },
  { value: 'H_TAG', label: 'H-TAG', activeClassName: 'bg-info text-white shadow-sm' },
];

const POWER_TYPE_OPTIONS: SelectOption<'battery' | '12v'>[] = [
  { value: 'battery', label: 'Com bateria' },
  { value: '12v', label: 'Alimentado 12V' },
];

const NEW_TAG: Partial<Tag> = { batteryWarrantyYears: 1, type: 'K_TAG' };

const toLocalDateTimeInput = (timestamp?: number) => timestamp
  ? new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  : '';

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** Cadastro e edição de equipamento em página dedicada (/tags/new e /tags/:id/edit). */
export const TagFormPage = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const isEditing = Boolean(routeId);
  const navigate = useNavigate();
  const { user, customRoles } = useAuth();
  const { addNotification } = useNotification();
  const canManage = hasPermission(user, customRoles, PERMISSIONS.TAGS_MANAGE);

  const [loaded, setLoaded] = React.useState(!isEditing);
  const [loadError, setLoadError] = React.useState('');
  const [notFound, setNotFound] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Tag>>(NEW_TAG);
  const [errors, setErrors] = React.useState<TagFormErrors>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!routeId) return;
    try {
      const tag = (await storage.getTags()).find(item => item.id === routeId);
      if (tag) setFormData(tagEditData(tag)); else setNotFound(true);
      setLoadError('');
      setLoaded(true);
    } catch (error) {
      setLoadError((error as Error).message || 'Não foi possível carregar o equipamento.');
    }
  }, [routeId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento remoto é o efeito sincronizado
  React.useEffect(() => { void load(); }, [load]);

  const patch = (changes: Partial<Tag>, ...clear: (keyof TagFormErrors)[]) => {
    setFormData(current => ({ ...current, ...changes }));
    if (clear.length) setErrors(current => {
      const next = { ...current };
      clear.forEach(key => delete next[key]);
      return next;
    });
  };

  const changeType = (type: TagType) => {
    setErrors({});
    patch({ type, identifierOriginal: '', traccarUniqueId: undefined, ...(type === 'H_TAG' && !formData.powerType ? { powerType: '12v' as const } : {}) });
  };

  const backToList = () => navigate('/tags');

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const nextErrors = validateTagForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    // id estável: gera uma vez e fixa no estado para que um retry reuse o mesmo doc.
    const tagId = formData.id || crypto.randomUUID();
    const type = formData.type || 'K_TAG';
    setIsSaving(true);
    try {
      if (isTraccarTagModel(type)) {
        const input = {
          model: type, name: formData.name!.trim(), identifierOriginal: traccarIdentifier(formData),
          traqcareId: formData.traqcareId, powerType: formData.powerType,
          batteryWarrantyYears: formData.batteryWarrantyYears, batteryStartedAt: formData.batteryStartedAt,
        };
        if (formData.id) await trackingApi.updateXadTag(formData.id, input);
        else await trackingApi.registerXadTag(input);
      } else {
        const tag: Tag = {
          id: tagId, name: formData.name!.trim(), type, accessoryId: formData.accessoryId || '',
          createdAt: formData.createdAt || Date.now(), hashedAdvKey: formData.hashedAdvKey, privateKey: formData.privateKey,
          imei: formData.imei, macAddress: formData.macAddress, powerType: formData.powerType,
          batteryWarrantyYears: formData.batteryWarrantyYears, batteryStartedAt: formData.batteryStartedAt,
          batteryStartSource: formData.batteryStartSource,
        };
        setFormData(current => ({ ...current, id: tagId }));
        const response = await authenticatedFetch(isEditing ? `/api/tags/${encodeURIComponent(tagId)}` : '/api/tags', {
          method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tag),
        });
        const payload = await readApiResponse(response);
        if (!response.ok) throw new Error(payload.error || 'Falha ao salvar equipamento.');
      }
      addNotification('success', 'Equipamento salvo', `${tagTypeLabel(type)} ${formData.name} salvo com sucesso.`);
      backToList();
    } catch (error) {
      addNotification('error', 'Erro ao salvar', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) return <NotFoundState what="Página" onBack={backToList} />;

  if (loadError) {
    return (
      <PageContainer size="5xl">
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      </PageContainer>
    );
  }

  if (!loaded) {
    return (
      <PageContainer size="5xl">
        <Skeleton h={48} className="mb-6 w-72" />
        <Skeleton h={280} className="w-full" rounded="2xl" />
      </PageContainer>
    );
  }

  if (notFound) return <NotFoundState what="Equipamento" onBack={backToList} />;

  const type = formData.type || 'K_TAG';
  const showBatteryStart = type === 'K_TAG' || formData.powerType === 'battery';

  return (
    <FormPage
      eyebrow="Estoque de equipamentos"
      title={isEditing ? formData.name || 'Editar equipamento' : 'Novo equipamento'}
      subtitle={isEditing ? `${tagTypeLabel(type)} · ${displayTagSerial(formData) || 'sem identificador'}` : 'Modelo, identificação e bateria'}
      icon={<Cpu size={20} aria-hidden />}
      backLabel="Voltar ao estoque"
      onBack={backToList}
      onSubmit={handleSave}
      footer={<StickyFormFooter onCancel={backToList} isSaving={isSaving} submitLabel={isEditing ? 'Salvar alterações' : 'Cadastrar equipamento'} />}
    >
      <FormSection title="Equipamento" description={isEditing ? 'O modelo não pode ser alterado após o cadastro.' : 'Escolha o modelo antes de preencher a identificação.'}>
        <div className="sm:col-span-2">
          {isEditing
            ? <p className="text-sm font-bold text-fg-1">{tagTypeLabel(type)}</p>
            : <SegmentedControl aria-label="Modelo do equipamento" value={type} onChange={changeType} options={TAG_TYPE_OPTIONS} />}
        </div>
        <Field label="Identificação (nome/apelido)" required error={errors.name} className="sm:col-span-2">
          <Input value={formData.name || ''} onChange={e => patch({ name: e.target.value }, 'name')} placeholder="Ex.: Tag 01 - Reserva" />
        </Field>

        {type === 'K_TAG' && (
          <>
            <Field label="Serial Number (SN)" required error={errors.accessoryId}>
              <Input value={formData.accessoryId || ''} onChange={e => patch({ accessoryId: e.target.value }, 'accessoryId')} className="font-mono" placeholder="Ex.: KTAG-12345" />
            </Field>
            <Field label="IMEI GT06 da K-TAG" hint="Opcional. Sem IMEI, a tag continua usando a Feibao.">
              <Input inputMode="numeric" maxLength={15} value={formData.imei || ''} onChange={e => patch({ imei: digits(e.target.value, 15) })} className="font-mono" placeholder="15 dígitos" />
            </Field>
            <Field label="Chave pública (hashed)" hint="Opcional.">
              <Input value={formData.hashedAdvKey || ''} onChange={e => patch({ hashedAdvKey: e.target.value })} className="font-mono" />
            </Field>
            <Field label="Chave privada" hint="Opcional.">
              <Input value={formData.privateKey || ''} onChange={e => patch({ privateKey: e.target.value })} className="font-mono" />
            </Field>
          </>
        )}

        {type === 'XADTAG' && (
          <>
            <Field label="Identificador original" required error={errors.identifierOriginal} hint="Serial de 10 dígitos ou IMEI de 15 dígitos.">
              <Input inputMode="numeric" maxLength={15} value={formData.identifierOriginal || ''} onChange={e => patch({ identifierOriginal: digits(e.target.value, 15), traccarUniqueId: undefined }, 'identifierOriginal')} className="font-mono" placeholder="7260412520" />
            </Field>
            <Field label="ID TraqCare" hint="Deixe em branco para preencher na ativação.">
              <Input value={formData.traqcareId || ''} onChange={e => patch({ traqcareId: e.target.value })} className="font-mono" />
            </Field>
          </>
        )}

        {type === 'H_TAG' && (
          <Field label="IMEI da H-TAG" required error={errors.identifierOriginal} hint="15 dígitos.">
            <Input inputMode="numeric" maxLength={15} value={formData.identifierOriginal || ''} onChange={e => patch({ identifierOriginal: digits(e.target.value, 15), traccarUniqueId: undefined }, 'identifierOriginal')} className="font-mono" placeholder="869731052727815" />
          </Field>
        )}

        {isTraccarTagModel(type) && (
          <Field label="Tipo de alimentação">
            <Select value={formData.powerType || (type === 'H_TAG' ? '12v' : 'battery')} onChange={powerType => patch({ powerType })} options={POWER_TYPE_OPTIONS} />
          </Field>
        )}
      </FormSection>

      <FormSection title="Bateria" description="Garantia e início de contagem da bateria.">
        <Field label="Garantia da bateria (anos)">
          <Input type="number" min={1} max={10} value={formData.batteryWarrantyYears || 1} onChange={e => patch({ batteryWarrantyYears: Number(e.target.value) || 1 })} />
        </Field>
        {showBatteryStart && (
          <Field label="Início manual da bateria" hint="Vazio: inicia na primeira comunicação GPS válida.">
            <Input
              type="datetime-local"
              value={toLocalDateTimeInput(formData.batteryStartedAt)}
              onChange={e => patch({ batteryStartedAt: e.target.value ? new Date(e.target.value).getTime() : undefined, batteryStartSource: e.target.value ? 'manual' : undefined })}
            />
          </Field>
        )}
      </FormSection>
    </FormPage>
  );
};
