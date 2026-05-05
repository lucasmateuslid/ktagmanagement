
import { useState, useMemo } from 'react';
import { Schedule, Technician, User } from '../../../types';

export const useScheduleFilters = (
  schedules: Schedule[],
  technicians: Technician[],
  user: User | null,
  viewDate: Date
) => {
  const isPrivileged = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'admin_tecnico';

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // User logic
  const [adminTab, setAdminTab] = useState<'pendentes' | 'agendados' | 'historico'>('pendentes'); // Admin logic
  const [showMyRequests, setShowMyRequests] = useState(false);
  
  // Dropdowns (Admin)
  const [filterTech, setFilterTech] = useState('Todos Técnicos');
  const [filterService, setFilterService] = useState('Todos Serviços');
  const [filterStatusDropdown, setFilterStatusDropdown] = useState('Todos Status');
  const [filterDevice, setFilterDevice] = useState('Todos Dispositivos');
  
  // Date Filter (Overrides month view)
  const [filterDate, setFilterDate] = useState('');

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
            s.locationAddress.toLowerCase().includes(lower) ||
            s.osNumber?.toLowerCase().includes(lower) ||
            s.installedImei?.toLowerCase().includes(lower) ||
            s.installedTagImei?.toLowerCase().includes(lower)
        );
    }

    if (isPrivileged) {
        // 2. Admin Logic
        if (showMyRequests) {
            // Filtra por ID do usuário ou histórico de ação
            filtered = filtered.filter(s => s.requesterId === user?.id || s.history.some(h => h.actionBy === user?.name));
            
            // APLICA LÓGICA DE USUÁRIO (Abas: Em Andamento vs Histórico)
            if (statusFilter === 'active') {
                filtered = filtered.filter(s => !['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
            } else if (statusFilter === 'completed') {
                filtered = filtered.filter(s => ['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
            }
        } else {
            if (adminTab === 'pendentes') {
                filtered = filtered.filter(s => ['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada', 'Aguardando Vínculo'].includes(s.status));
                // Para pendentes, filtro de data é opcional (geralmente vê tudo), mas se tiver data, filtra pela preferred
                if (filterDate) {
                    filtered = filtered.filter(s => s.preferredDate === filterDate);
                }
            } else if (adminTab === 'agendados') {
                filtered = filtered.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local', 'Cliente no local'].includes(s.status));
                
                // DATE FILTER LOGIC
                if (filterDate) {
                    // Filtra pela data exata
                    filtered = filtered.filter(s => (s.confirmedDate || s.preferredDate) === filterDate);
                } else {
                    // Fallback para Filtro de Mês (viewDate)
                    filtered = filtered.filter(s => {
                        const d = new Date((s.confirmedDate || s.preferredDate) + 'T12:00:00');
                        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                    });
                }

            } else if (adminTab === 'historico') {
                filtered = filtered.filter(s => ['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
                
                // DATE FILTER LOGIC
                if (filterDate) {
                    filtered = filtered.filter(s => {
                        // Tenta usar confirmedDate, se não existir (canceladas antes de agendar), usa createdAt
                        const target = s.confirmedDate || new Date(s.createdAt).toISOString().split('T')[0];
                        return target === filterDate;
                    });
                } else {
                    // Month filter
                    filtered = filtered.filter(s => {
                        const d = s.createdAt ? new Date(s.createdAt) : new Date();
                        return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
                    });
                }
            }
        }

        // 3. Dropdown Filters (Apenas se não estiver vendo Minhas Solicitações)
        if (!showMyRequests) {
            if (filterService !== 'Todos Serviços') {
                filtered = filtered.filter(s => s.serviceType === filterService);
            }
            if (filterStatusDropdown !== 'Todos Status') {
                filtered = filtered.filter(s => s.status === filterStatusDropdown);
            }
            if (filterDevice !== 'Todos Dispositivos') {
                filtered = filtered.filter(s => s.deviceType === filterDevice);
            }
            if (filterTech !== 'Todos Técnicos') {
                if (filterTech === 'Sem Técnico') {
                    filtered = filtered.filter(s => !s.technicianId);
                } else {
                    const techId = technicians.find(t => t.name === filterTech)?.id;
                    if (techId) filtered = filtered.filter(s => s.technicianId === techId);
                }
            }
        }

    } else if (user?.role === 'technician') {
        // 4. Technician Logic
        const techId = technicians.find(t => t.email?.toLowerCase() === user?.email.toLowerCase())?.id || user?.id;
        filtered = filtered.filter(s => s.technicianId === techId);
        
        if (statusFilter === 'active') {
            filtered = filtered.filter(s => !['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(s => ['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
        }
    } else {
        // 5. User Logic
        if (statusFilter === 'active') {
            filtered = filtered.filter(s => !['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(s => ['Concluída', 'Cancelada', 'Frustrada'].includes(s.status));
        }
    }

    return filtered;
  }, [schedules, searchTerm, statusFilter, adminTab, isPrivileged, filterTech, filterService, filterStatusDropdown, filterDevice, filterDate, technicians, showMyRequests, viewDate, user]);

  return {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    adminTab, setAdminTab,
    showMyRequests, setShowMyRequests,
    filterTech, setFilterTech,
    filterService, setFilterService,
    filterStatusDropdown, setFilterStatusDropdown,
    filterDevice, setFilterDevice,
    filterDate, setFilterDate,
    filteredList,
    isPrivileged
  };
};
