import { isTraccarTagModel } from '@ktag/shared';
import type { Tag, TagType } from '../../../types';
import { validateHtagImei } from '../../../utils/htagImport';

export type TagFormErrors = Partial<Record<'name' | 'accessoryId' | 'identifierOriginal', string>>;

export const tagTypeLabel = (type?: TagType) => type === 'H_TAG' ? 'H-TAG' : type === 'K_TAG' ? 'K-TAG' : type;

/** SN exibido/persistido localmente; remove padding apenas de registros legados. */
export const displayTagSerial = (tag: Partial<Tag>): string => {
  if (tag.type === 'H_TAG') return tag.identifierOriginal || tag.imei || tag.accessoryId || '';
  if (tag.type !== 'XADTAG') return tag.accessoryId || tag.imei || '';
  if (tag.identifierOriginal) return tag.identifierOriginal;
  const legacy = tag.accessoryId || tag.identifierNormalized || tag.traccarUniqueId || '';
  return /^0{5}\d{10}$/.test(legacy) ? legacy.slice(5) : legacy;
};

export const tagEditData = (tag: Tag): Partial<Tag> => isTraccarTagModel(tag.type)
  ? { ...tag, identifierOriginal: displayTagSerial(tag) }
  : tag;

export const canonicalXadTagInput = (input: unknown): string | null => {
  const value = String(input || '');
  if (/^\d{10}$/.test(value)) return value;
  if (/^\d{15}$/.test(value)) return value;
  return null;
};

/** Identificador enviado à integração Traccar (XADTAG/H-TAG); vazio para K-TAG. */
export const traccarIdentifier = (form: Partial<Tag>): string => {
  if (form.type === 'XADTAG') return canonicalXadTagInput(form.identifierOriginal || displayTagSerial(form)) || '';
  if (form.type === 'H_TAG') return String(form.identifierOriginal || '');
  return '';
};

export function validateTagForm(form: Partial<Tag>): TagFormErrors {
  const errors: TagFormErrors = {};
  if (!form.name?.trim()) errors.name = 'Informe a identificação do equipamento.';
  if ((form.type || 'K_TAG') === 'K_TAG' && !form.accessoryId?.trim()) errors.accessoryId = 'Serial Number é obrigatório para K-TAG.';
  if (form.type === 'XADTAG' && !traccarIdentifier(form)) errors.identifierOriginal = 'Informe um serial de 10 dígitos ou um IMEI de 15 dígitos.';
  if (form.type === 'H_TAG') {
    const imeiError = validateHtagImei(traccarIdentifier(form));
    if (imeiError) errors.identifierOriginal = imeiError;
  }
  return errors;
}
