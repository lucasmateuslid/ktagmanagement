
import { useState, useMemo } from 'react';
import { Schedule, Technician, User } from '../../../types';

export const useScheduleFilters = (
  schedules: Schedule[],
  technicians: Technician[],
  user: User | null,
  viewDate: Date
) => {
  const isPrivileged = user?.role === 'admin' || user?.role === 'moderator';

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // User logic
  const [adminTab, setAdminTab] = useState<'pendentes' | 'agendados' | 'historico'>('pendentes'); // Admin logic
  const [showMyRequests, setShowMyRequests] = useState(false);
  
  // Dropdowns (Admin)
  const [filterTech, setFilterTech] = useState('Todos Técnicos');
  const [filterService, setFilterService] = useState('Todos Serviços');
  const [filterStatusDropdown, setFilterStatusDropdown] = useState('Todos Status');

  const filteredList = useMemo(() => {
    let filtered = schedules;

    // 1. Search Text
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(s => 
            s.vehiclePlate.toLowerCase().includes(lower) || 
            s.vehicleModel.toLowerCase().includes(lower) ||
            s.requesterName.toLowerCase().includes(lower) ||
            s.clientName?.toLowerCase().includes(lower) ||
            s.locationAddress.toLowerCase().includes(lower)
        );
    }

    if (isPrivileged) {
        // 2. Admin Logic
        if (showMyRequests) {
            filtered = filtered.filter(s => s.requesterId === user?.id || s.history.some(h => h.actionBy === user?.name));
        } else {
            if (adminTab === 'pendentes') {
                filtered = filtered.filter(s => ['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada'].includes(s.status));
            } else if (adminTab === 'agendados') {
                filtered = filtered.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local'].includes(s.status));
                // Month filter
                filtered = filtered.filter(s => {
                    const d = new Date(s.confirmedDate || s.preferredDate + 'T12:00:00');
                    return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                });
            } else if (adminTab === 'historico') {
                filtered = filtered.filter(s => ['Concluída', 'Cancelada'].includes(s.status));
                // Month filter
                filtered = filtered.filter(s => {
                    const d = s.createdAt ? new Date(s.createdAt) : new Date();
                    return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                });
            }
        }

        // 3. Dropdown Filters
        if (filterService !== 'Todos Serviços') {
            filtered = filtered.filter(s => s.serviceType === filterService);
        }
        if (filterStatusDropdown !== 'Todos Status') {
            filtered = filtered.filter(s => s.status === filterStatusDropdown);
        }
        if (filterTech !== 'Todos Técnicos') {
            if (filterTech === 'Sem Técnico') {
                filtered = filtered.filter(s => !s.technicianId);
            } else {
                const techId = technicians.find(t => t.name === filterTech)?.id;
                if (techId) filtered = filtered.filter(s => s.technicianId === techId);
            }
        }

    } else {
        // 4. User Logic
        if (statusFilter === 'active') {
            filtered = filtered.filter(s => !['Concluída', 'Cancelada'].includes(s.status));
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(s => ['Concluída', 'Cancelada'].includes(s.status));
        }
    }

    return filtered;
  }, [schedules, searchTerm, statusFilter, adminTab, isPrivileged, filterTech, filterService, filterStatusDropdown, technicians, showMyRequests, viewDate, user]);

  return {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    adminTab, setAdminTab,
    showMyRequests, setShowMyRequests,
    filterTech, setFilterTech,
    filterService, setFilterService,
    filterStatusDropdown, setFilterStatusDropdown,
    filteredList,
    isPrivileged
  };
};
