
import { Vehicle, Tag, Client, LocationHistory, User } from '../../../types';

type FleetFilter = 'all' | 'online' | 'offline';

export const filterFleetList = (
    searchTerm: string,
    filter: FleetFilter,
    vehicles: Vehicle[],
    tags: Tag[],
    clients: Client[],
    fleetLocations: LocationHistory[],
    user: User | null
) => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
        // Se não tem busca, retorna apenas veículos (comportamento padrão)
        // Aplicando filtros de online/offline apenas em veículos
        let base = vehicles.filter(v => v.tagId);
        if (filter === 'online') base = base.filter(v => fleetLocations.some(l => l.tagId === v.tagId));
        if (filter === 'offline') base = base.filter(v => !fleetLocations.some(l => l.tagId === v.tagId));
        return base;
    }

    // Se tem busca, procura em Veículos e em Tags Soltas
    
    // 1. Veículos
    let matchingVehicles = vehicles.filter(v => {
        if (!v.tagId) return false;
        
        if (user?.role === 'client') {
            return v.plate.toLowerCase().includes(term);
        }

        const tag = tags.find(t => t.id === v.tagId);
        const client = clients.find(c => c.id === v.clientId);
        
        return (
            v.plate.toLowerCase().includes(term) ||
            v.model.toLowerCase().includes(term) ||
            (tag && (tag.name.toLowerCase().includes(term) || tag.accessoryId.toLowerCase().includes(term))) ||
            (client && client.name.toLowerCase().includes(term))
        );
    });

    // 2. Tags Soltas (Apenas para não-clientes)
    let matchingTags: any[] = [];
    if (user?.role !== 'client') {
        const unlinkedTags = tags.filter(t => !vehicles.some(v => v.tagId === t.id));
        matchingTags = unlinkedTags.filter(t => 
            t.name.toLowerCase().includes(term) || 
            t.accessoryId.toLowerCase().includes(term) ||
            (t.imei && t.imei.includes(term))
        ).map(t => ({
            id: 'TAG-' + t.id, // ID virtual para lista
            tagId: t.id,
            isTag: true, // Flag para renderizar diferente
            name: t.name,
            serial: t.accessoryId
        }));
    }

    return [...matchingVehicles, ...matchingTags];
};

export const filterLocationsToRender = (
    fleetLocations: LocationHistory[],
    selectedTagId: string,
    filter: FleetFilter,
    limit50: boolean,
    vehicles: Vehicle[]
) => {
    if (selectedTagId) {
        return fleetLocations.filter(l => l.tagId === selectedTagId);
    }
    
    // Se não tem nada selecionado, mostra frota
    // Filtra para remover tags soltas que não estão selecionadas
    const activeVehicleTagIds = new Set(vehicles.map(v => v.tagId));
    
    let base = fleetLocations.filter(l => activeVehicleTagIds.has(l.tagId));

    // Se filter === 'online', já está implícito pois fleetLocations são os onlines
    
    if (limit50 && base.length > 50) {
        return base.slice(0, 50);
    }
    return base;
};
