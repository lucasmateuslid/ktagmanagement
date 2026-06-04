
import { useState, useMemo } from 'react';
import { Vehicle, Client } from '../../../types';

export const useVehicleFilters = (vehicles: Vehicle[], clients: Client[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('all');
  const [installationFilter, setInstallationFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Search term filter
      const term = searchTerm.toLowerCase().trim();
      const client = clients.find(c => c.id === v.clientId);
      const matchesSearch = !term || (
        v.plate.toLowerCase().includes(term) || 
        v.model.toLowerCase().includes(term) || 
        client?.name.toLowerCase().includes(term)
      );

      // Status filter
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      // Company filter
      const matchesCompany = companyFilter === 'all' || v.companyId === companyFilter;

      // Ownership filter
      const matchesOwnership = ownershipFilter === 'all' || v.ownershipStatus === ownershipFilter;

      // Installation filter
      const matchesInstallation = installationFilter === 'all' || v.installationType === installationFilter;
      
      // Tag filter
      const matchesTag = tagFilter === 'all' || 
                         (tagFilter === 'c_tag' && !!v.tagId) || 
                         (tagFilter === 's_tag' && !v.tagId);

      return matchesSearch && matchesStatus && matchesCompany && matchesOwnership && matchesInstallation && matchesTag;
    });
  }, [vehicles, clients, searchTerm, statusFilter, companyFilter, ownershipFilter, installationFilter, tagFilter]);

  return { 
    searchTerm, setSearchTerm, 
    statusFilter, setStatusFilter,
    companyFilter, setCompanyFilter,
    ownershipFilter, setOwnershipFilter,
    installationFilter, setInstallationFilter,
    tagFilter, setTagFilter,
    filteredVehicles 
  };
};
