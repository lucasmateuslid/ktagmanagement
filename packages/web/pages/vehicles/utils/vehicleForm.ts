import { isValidPhone, validateCPF } from '@ktag/shared';
import { Client, Vehicle } from '../../../types';
import { validateBrazilianPlate } from './plateValidation';

export interface VehicleFormErrors {
  plate?: string;
  model?: string;
  year?: string;
  fipeValue?: string;
  clientName?: string;
  cpf?: string;
  phone?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida os campos do formulário de veículo + cliente. Mapa vazio = válido. */
export function validateVehicleForm(
  vehicle: Partial<Vehicle>,
  client: Partial<Client>,
  currentYear = new Date().getFullYear(),
): VehicleFormErrors {
  const errors: VehicleFormErrors = {};

  const plate = (vehicle.plate || '').toUpperCase();
  if (!plate) errors.plate = 'Informe a placa.';
  else if (!validateBrazilianPlate(plate)) errors.plate = 'Formato inválido (ex.: AAA0000 ou AAA0A00).';

  if (!vehicle.model?.trim()) errors.model = 'Informe o modelo.';

  if (vehicle.year) {
    const year = Number(vehicle.year);
    if (!/^\d{4}$/.test(String(vehicle.year)) || year < 1900 || year > currentYear + 1) {
      errors.year = `Informe um ano entre 1900 e ${currentYear + 1}.`;
    }
  }

  if (vehicle.fipeValue !== undefined && vehicle.fipeValue !== null) {
    if (!Number.isFinite(vehicle.fipeValue) || vehicle.fipeValue < 0) errors.fipeValue = 'Valor FIPE inválido.';
  }

  if (!client.name?.trim()) errors.clientName = 'Informe o nome do associado.';

  if (!client.cpf) {
    errors.cpf = 'Informe o CPF do associado.';
  } else {
    const validation = validateCPF(client.cpf);
    if (!validation.valid) {
      errors.cpf = !validation.complete
        ? 'CPF deve conter exatamente 11 dígitos.'
        : validation.reason === 'repeated'
          ? 'CPF não pode ter todos os dígitos iguais.'
          : 'CPF inválido. Verifique os dígitos informados.';
    }
  }

  if (client.phone && !isValidPhone(client.phone)) errors.phone = 'Informe o DDD e um telefone com 10 ou 11 dígitos.';
  if (client.email && !EMAIL_PATTERN.test(client.email.trim())) errors.email = 'E-mail inválido.';

  return errors;
}
