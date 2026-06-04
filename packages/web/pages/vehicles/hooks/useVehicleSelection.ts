
import { useState } from 'react';
import { Vehicle } from '../../../types';

export const useVehicleSelection = (filteredVehicles: Vehicle[]) => {
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedVehicles);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedVehicles(newSet);
  };

  const handleSelectAll = () => {
      if (selectedVehicles.size === filteredVehicles.length && filteredVehicles.length > 0) {
          setSelectedVehicles(new Set());
      } else {
          setSelectedVehicles(new Set(filteredVehicles.map(v => v.id)));
      }
  };

  const clearSelection = () => setSelectedVehicles(new Set());

  return { selectedVehicles, toggleSelect, handleSelectAll, clearSelection, setSelectedVehicles };
};
