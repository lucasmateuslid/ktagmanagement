
import { useState, useMemo } from 'react';
import { Vehicle, Client } from '../../../types';

export const useVehicleFilters = (vehicles: Vehicle[], clients: Client[]) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return vehicles;

    return vehicles.filter(v => {
      const client = clients.find(c => c.id === v.clientId);
      return (
        v.plate.toLowerCase().includes(term) || 
        v.model.toLowerCase().includes(term) || 
        client?.name.toLowerCase().includes(term)
      );
    });
  }, [vehicles, clients, searchTerm]);

  return { searchTerm, setSearchTerm, filteredVehicles };
};
