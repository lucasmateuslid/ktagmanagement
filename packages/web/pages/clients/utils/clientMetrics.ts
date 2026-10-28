import { Client, Vehicle } from '../../../types';
import { normalizeDigits, normalizePhone } from '@ktag/shared';

export interface ClientMetrics {
  total: number;
  withVehicles: number;
  withoutVehicles: number;
  activeAccess: number;
  pendingAccess: number;
}

export function filterClients(
  clients: Client[],
  searchTerm: string,
  /** Placas por cliente, para buscar também pela placa. */
  platesByClient?: Map<string, string[]>,
): Client[] {
  const textTerm = searchTerm.toLowerCase().trim();
  // CPF/telefone só quando o termo é numérico — senão "QGM9" casaria qualquer CPF com 9.
  const digitTerm = /[a-z]/i.test(searchTerm) ? '' : normalizeDigits(searchTerm);
  const plateTerm = searchTerm.toUpperCase().replace(/[^A-Z0-9]/g, '');

  return clients
    .filter(client => {
      if (!textTerm) return true;
      const name = client.name?.toLowerCase() || '';
      const email = client.email?.toLowerCase() || '';
      const cpf = client.cpf || '';
      const phone = client.phone || '';
      const plates = platesByClient?.get(client.id) || [];
      return name.includes(textTerm)
        || email.includes(textTerm)
        || (digitTerm.length > 0 && normalizeDigits(cpf).includes(digitTerm))
        || (digitTerm.length > 0 && normalizePhone(phone).includes(normalizePhone(searchTerm)))
        || (plateTerm.length >= 3 && plates.some(plate => plate.toUpperCase().includes(plateTerm)));
    })
    .sort((first, second) => (first.name || '').localeCompare(second.name || ''));
}

export function getClientMetrics(clients: Client[], vehicles: Vehicle[]): ClientMetrics {
  const linkedClientIds = new Set(
    vehicles
      .map(vehicle => vehicle.clientId)
      .filter((clientId): clientId is string => Boolean(clientId)),
  );

  const activeAccess = clients.filter(client => client.hasAccess === true).length;

  return {
    total: clients.length,
    withVehicles: clients.filter(client => linkedClientIds.has(client.id)).length,
    withoutVehicles: clients.filter(client => !linkedClientIds.has(client.id)).length,
    activeAccess,
    pendingAccess: clients.length - activeAccess,
  };
}