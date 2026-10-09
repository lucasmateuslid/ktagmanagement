
import { Vehicle, LocationHistory } from '../../../types';
import { hasRecentVehiclePosition } from './vehicleTracking';

export const calculateFleetStats = (vehicles: Vehicle[], fleetLocations: LocationHistory[]) => {
    const linkedVehicles = vehicles.filter(v => v.tagId || v.trackerId);
    const linked = linkedVehicles.length;
    const online = linkedVehicles.filter(v => hasRecentVehiclePosition(v, fleetLocations)).length;
    const offline = linked - online;
    return { linked, online, offline };
};
