
import { useState, useMemo } from 'react';
import { Schedule, Technician, User } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

export const useScheduleFilters = (
  schedules: Schedule[],
  technicians: Technician[],
  user: User | null,
  viewDate: Date
) => {
  const { isAdmin } = useAuth();
  const isPrivileged = isAdmin || user?.role === 'moderator' || user?.role === 'admin_tecnico';

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
  const [filterShift, setFilterShift] = useState('Todos Turnos');
  const [filterActiveRequester, setFilterActiveRequester] = useState(false);
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  
  // Date Filter (Overrides month view)
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const filteredList = useMemo(() => {
    let filtered = schedules;

    // Helper for date range
    const hasDateFilter = filterStartDate || filterEndDate;
    const checkDateRange = (targetStr: string) => {
        if (filterStartDate && filterEndDate) {
            return targetStr >= filterStartDate && targetStr <= filterEndDate;
        } else if (filterStartDate) {
            return targetStr >= filterStartDate;
        } else if (filterEndDate) {
            return targetStr <= filterEndDate;
        }
        return true;
    };

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
                filtered = filtered.filter(s => ['Solicitada', 'Em análise', 'Em orçamento', 'Autorizada'].includes(s.status));
                if (hasDateFilter) {
                    filtered = filtered.filter(s => s.preferredDate && checkDateRange(s.preferredDate));
                }
            } else if (adminTab === 'agendados') {
                filtered = filtered.filter(s => ['Confirmada', 'Reagendada', 'Técnico no local', 'Cliente no local', 'Aguardando Vínculo'].includes(s.status));
                
                // DATE FILTER LOGIC
                if (hasDateFilter) {
                    filtered = filtered.filter(s => {
                        const tgt = s.confirmedDate || s.preferredDate || '';
                        return tgt && checkDateRange(tgt);
                    });
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
                if (hasDateFilter) {
                    filtered = filtered.filter(s => {
                        const target = s.confirmedDate || new Date(s.createdAt).toISOString().split('T')[0];
                        return target && checkDateRange(target);
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
            if (filterShift !== 'Todos Turnos') {
                filtered = filtered.filter(s => {
                    const timeToCheck = s.confirmedTime || s.preferredTime;
                    if (!timeToCheck) return false;
                    const hours = parseInt(timeToCheck.split(':')[0], 10);
                    if (filterShift === 'Manhã') return hours >= 0 && hours < 12;
                    if (filterShift === 'Tarde') return hours >= 12 && hours < 18;
                    if (filterShift === 'Noite') return hours >= 18;
                    return true;
                });
            }
            if (filterActiveRequester) {
                filtered = filtered.filter(s => s.clientStatus?.toUpperCase() === 'ATIVO');
            }
            if (filterOnlyMine && user) {
                filtered = filtered.filter(s => s.requesterId === user.id || s.history.some(h => h.actionBy === user.name));
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
  }, [schedules, searchTerm, statusFilter, adminTab, isPrivileged, filterTech, filterService, filterStatusDropdown, filterDevice, filterShift, filterActiveRequester, filterOnlyMine, filterStartDate, filterEndDate, technicians, showMyRequests, viewDate, user]);

  return {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    adminTab, setAdminTab,
    showMyRequests, setShowMyRequests,
    filterTech, setFilterTech,
    filterService, setFilterService,
    filterStatusDropdown, setFilterStatusDropdown,
    filterDevice, setFilterDevice,
    filterShift, setFilterShift,
    filterActiveRequester, setFilterActiveRequester,
    filterOnlyMine, setFilterOnlyMine,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    filteredList,
    isPrivileged
  };
};
