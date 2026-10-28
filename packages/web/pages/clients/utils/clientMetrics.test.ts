import { describe, expect, it } from 'vitest';
import { Client, Vehicle } from '../../../types';
import { filterClients, getClientMetrics } from './clientMetrics';

const clients: Client[] = [
  { id: 'client-1', name: 'Ana Lima', cpf: '11122233344', phone: '84999990000', createdAt: 1, hasAccess: true },
  { id: 'client-2', name: 'Bruno Silva', cpf: '55566677788', phone: '84988880000', createdAt: 2, hasAccess: false },
  { id: 'client-3', name: 'Carla Souza', cpf: '99988877766', phone: '', createdAt: 3 },
];

const vehicles: Vehicle[] = [
  { id: 'vehicle-1', type: 'car', plate: 'ABC1234', model: 'Hatch', clientId: 'client-1', createdAt: 1 },
  { id: 'vehicle-2', type: 'car', plate: 'DEF5678', model: 'Sedan', clientId: 'client-1', createdAt: 2 },
];

describe('client metrics', () => {
  it('counts clients by vehicle link and portal access', () => {
    expect(getClientMetrics(clients, vehicles)).toEqual({
      total: 3,
      withVehicles: 1,
      withoutVehicles: 2,
      activeAccess: 1,
      pendingAccess: 2,
    });
  });

  it('searches names, CPF and phone while sorting by name', () => {
    expect(filterClients(clients, 'ana').map(client => client.id)).toEqual(['client-1']);
    expect(filterClients(clients, '555.666.777-88').map(client => client.id)).toEqual(['client-2']);
    expect(filterClients(clients, '(84) 99999-0000').map(client => client.id)).toEqual(['client-1']);
    expect(filterClients(clients, '').map(client => client.id)).toEqual(['client-1', 'client-2', 'client-3']);
  });
});

describe('filterClients — e-mail e placa', () => {
  it('encontra pelo e-mail e pela placa vinculada', () => {
    const withEmail: Client[] = [{ ...clients[0], email: 'ana@lima.com' }, clients[1]];
    expect(filterClients(withEmail, 'ana@').map(c => c.id)).toEqual(['client-1']);
    const plates = new Map([['client-2', ['QGM9G85']]]);
    expect(filterClients(clients, 'qgm9', plates).map(c => c.id)).toEqual(['client-2']);
  });
});
