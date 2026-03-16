
import { Vehicle, LocationHistory } from '../../../types';

export const calculateFleetStats = (vehicles: Vehicle[], fleetLocations: LocationHistory[]) => {
    const linked = vehicles.filter(v => v.tagId).length;
    const online = fleetLocations.length;
    const offline = linked - online;
    return { linked, online, offline };
};
