import { describe, expect, it } from 'vitest';
import { filterFleetList } from './livemapFilters';

const vehicle = { id: 'vehicle-1', tagId: 'tag-1', clientId: 'client-1', plate: 'ABC1D23', model: 'Modelo' } as any;
const tag = { id: 'tag-1', name: 'Tag 1', accessoryId: 'A1' } as any;
const client = {
  id: 'client-1',
  name: 'Cliente',
  cpf: '529.982.247-25',
  phone: '(84) 99999-9999',
} as any;
const user = { id: 'admin-1', role: 'admin' } as any;

describe('filterFleetList', () => {
  it.each(['52998224725', '529.982.247-25', '84999999999', '(84) 99999-9999'])(
    'localiza cliente por CPF ou telefone com e sem máscara: %s',
    (search) => {
      const result = filterFleetList(search, 'all', [vehicle], [tag], [client], [], user);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(vehicle.id);
    },
  );
});
