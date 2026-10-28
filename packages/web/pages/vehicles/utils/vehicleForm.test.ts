import { describe, expect, it } from 'vitest';
import { validateVehicleForm } from './vehicleForm';

const validClient = { name: 'Ana', cpf: '52998224725', phone: '84999990000' };

describe('validateVehicleForm', () => {
  it('exige placa, modelo e dados do associado', () => {
    const errors = validateVehicleForm({}, {});
    expect(errors.plate).toBeDefined();
    expect(errors.model).toBeDefined();
    expect(errors.clientName).toBeDefined();
    expect(errors.cpf).toBeDefined();
  });

  it('aceita placa antiga e Mercosul', () => {
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol' }, validClient)).toEqual({});
    expect(validateVehicleForm({ plate: 'ABC1D23', model: 'Gol' }, validClient)).toEqual({});
  });

  it('rejeita placa inválida', () => {
    expect(validateVehicleForm({ plate: 'AB12', model: 'Gol' }, validClient).plate).toMatch(/inválido/);
  });

  it('valida ano dentro do intervalo', () => {
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', year: '1800' }, validClient, 2026).year).toBeDefined();
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', year: '2027' }, validClient, 2026).year).toBeUndefined();
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', year: '20' }, validClient, 2026).year).toBeDefined();
  });

  it('rejeita valor FIPE NaN ou negativo', () => {
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', fipeValue: NaN }, validClient).fipeValue).toBeDefined();
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', fipeValue: -1 }, validClient).fipeValue).toBeDefined();
    expect(validateVehicleForm({ plate: 'ABC1234', model: 'Gol', fipeValue: 45000 }, validClient).fipeValue).toBeUndefined();
  });

  it('valida CPF e telefone do associado', () => {
    const errors = validateVehicleForm({ plate: 'ABC1234', model: 'Gol' }, { name: 'A', cpf: '11111111111', phone: '1' });
    expect(errors.cpf).toMatch(/iguais/);
    expect(errors.phone).toBeDefined();
  });
});
