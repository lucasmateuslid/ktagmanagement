import { isValidPhone, normalizeCPF, validateCPF } from '@ktag/shared';
import { Client } from '../../../types';

export interface ClientFormErrors {
  name?: string;
  cpf?: string;
  phone?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Heurística: nome que parece cifrado com chave antiga (base64 longo, sem espaços). */
export function isCorrupted(value?: string): boolean {
  if (!value) return false;
  return value.length > 20 && !value.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(value);
}

/** Valida o formulário de cliente; devolve um mapa campo → mensagem (vazio = válido). */
export function validateClientForm(client: Partial<Client>, allClients: Client[]): ClientFormErrors {
  const errors: ClientFormErrors = {};

  if (!client.name?.trim()) errors.name = 'Informe o nome completo.';

  if (!client.cpf) {
    errors.cpf = 'Informe o CPF.';
  } else {
    const validation = validateCPF(client.cpf);
    if (!validation.valid) {
      errors.cpf = !validation.complete
        ? 'CPF deve conter exatamente 11 dígitos.'
        : validation.reason === 'repeated'
          ? 'CPF não pode ter todos os dígitos iguais.'
          : 'CPF inválido. Verifique os dígitos informados.';
    } else {
      const cpf = normalizeCPF(client.cpf);
      const duplicate = allClients.find(item => item.id !== client.id && normalizeCPF(item.cpf || '') === cpf);
      if (duplicate) errors.cpf = 'Já existe um cliente cadastrado com este CPF.';
    }
  }

  if (client.phone && !isValidPhone(client.phone)) {
    errors.phone = 'Informe o DDD e um telefone com 10 ou 11 dígitos.';
  }

  if (client.email && !EMAIL_PATTERN.test(client.email.trim())) {
    errors.email = 'E-mail inválido.';
  }

  return errors;
}
