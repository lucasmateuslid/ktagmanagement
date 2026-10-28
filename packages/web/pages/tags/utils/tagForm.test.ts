import { describe, expect, it } from 'vitest';
import type { Tag } from '../../../types';
import { displayTagSerial, traccarIdentifier, validateTagForm } from './tagForm';

describe('formulário de equipamento', () => {
  it('exige nome e serial da K-TAG', () => {
    expect(validateTagForm({ type: 'K_TAG' })).toEqual({
      name: expect.any(String), accessoryId: expect.any(String),
    });
    expect(validateTagForm({ type: 'K_TAG', name: 'Tag 01', accessoryId: 'SN-1' })).toEqual({});
  });

  it('aceita serial de 10 dígitos ou IMEI na XADTAG', () => {
    expect(validateTagForm({ type: 'XADTAG', name: 'X', identifierOriginal: '7260412520' })).toEqual({});
    expect(validateTagForm({ type: 'XADTAG', name: 'X', identifierOriginal: '123' }).identifierOriginal).toMatch(/10 dígitos/);
  });

  it('exige IMEI válido na H-TAG', () => {
    expect(validateTagForm({ type: 'H_TAG', name: 'H', identifierOriginal: '490154203237518' })).toEqual({});
    expect(validateTagForm({ type: 'H_TAG', name: 'H', identifierOriginal: '7260412520' }).identifierOriginal).toMatch(/15 dígitos/);
    expect(validateTagForm({ type: 'H_TAG', name: 'H', identifierOriginal: '490154203237519' }).identifierOriginal).toMatch(/verificador/);
  });

  it('remove padding legado só na XADTAG', () => {
    expect(displayTagSerial({ type: 'XADTAG', accessoryId: '000007260412520' } as Tag)).toBe('7260412520');
    expect(displayTagSerial({ type: 'H_TAG', identifierOriginal: '490154203237518' } as Tag)).toBe('490154203237518');
    expect(traccarIdentifier({ type: 'K_TAG', accessoryId: 'SN' })).toBe('');
  });
});
