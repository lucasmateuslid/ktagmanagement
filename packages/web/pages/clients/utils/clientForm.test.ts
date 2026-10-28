import { describe, expect, it } from 'vitest';
import { Client } from '../../../types';
import { isCorrupted, validateClientForm } from './clientForm';

const existing: Client[] = [
  { id: 'c1', name: 'Ana Lima', cpf: '52998224725', phone: '', createdAt: 1 },
];

describe('validateClientForm', () => {
  it('exige nome e CPF', () => {
    const errors = validateClientForm({}, existing);
    expect(errors.name).toBeDefined();
    expect(errors.cpf).toBeDefined();
  });

  it('aceita cliente válido', () => {
    expect(validateClientForm({ name: 'Bruno', cpf: '11144477735', phone: '84999990000', email: 'b@x.com' }, existing)).toEqual({});
  });

  it('rejeita CPF com dígitos repetidos e CPF incompleto', () => {
    expect(validateClientForm({ name: 'A', cpf: '11111111111' }, existing).cpf).toMatch(/iguais/);
    expect(validateClientForm({ name: 'A', cpf: '123' }, existing).cpf).toMatch(/11 dígitos/);
  });

  it('bloqueia CPF duplicado mas permite o mesmo cliente', () => {
    expect(validateClientForm({ id: 'c2', name: 'A', cpf: '52998224725' }, existing).cpf).toMatch(/Já existe/);
    expect(validateClientForm({ id: 'c1', name: 'Ana', cpf: '52998224725' }, existing).cpf).toBeUndefined();
  });

  it('valida telefone e e-mail quando preenchidos', () => {
    const errors = validateClientForm({ name: 'A', cpf: '11144477735', phone: '123', email: 'x' }, existing);
    expect(errors.phone).toBeDefined();
    expect(errors.email).toBeDefined();
  });
});

describe('isCorrupted', () => {
  it('detecta strings cifradas e ignora nomes normais', () => {
    expect(isCorrupted('QWxhZGRpbjpvcGVuIHNlc2FtZVRoaXNJc0Jhc2U2NA==')).toBe(true);
    expect(isCorrupted('Ana Lima')).toBe(false);
  });
});
