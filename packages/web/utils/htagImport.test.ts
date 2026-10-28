import { describe, expect, it } from 'vitest';
import { HTAG_IMPORT_TEMPLATE, parseHtagImportRows, validateHtagImei } from './htagImport';

describe('importação H-TAG', () => {
  it('segue o modelo nome | imei', () => {
    expect(Object.keys(HTAG_IMPORT_TEMPLATE[0])).toEqual(['nome', 'imei']);
  });

  it('aceita IMEI válido e lê colunas sem diferenciar maiúsculas', () => {
    expect(parseHtagImportRows([{ ' Nome ': 'H-TAG 01', IMEI: ' 490154203237518 ' }])).toEqual([
      { name: 'H-TAG 01', imei: '490154203237518', valid: true },
    ]);
  });

  it('rejeita IMEI curto, com letras, Luhn inválido e notação científica', () => {
    expect(validateHtagImei('')).toMatch(/não informado/);
    expect(validateHtagImei('49015420323751')).toMatch(/15 dígitos/);
    expect(validateHtagImei('49015420323751A')).toMatch(/somente dígitos/);
    expect(validateHtagImei('490154203237519')).toMatch(/verificador/);
    expect(validateHtagImei('4.90154E+14')).toMatch(/científica/);
  });

  it('marca IMEI repetido na planilha', () => {
    const rows = parseHtagImportRows([
      { nome: 'A', imei: '490154203237518' },
      { nome: 'B', imei: '490154203237518' },
    ]);
    expect(rows.map(row => row.valid)).toEqual([true, false]);
    expect(rows[1].error).toMatch(/duplicado/);
  });
});
