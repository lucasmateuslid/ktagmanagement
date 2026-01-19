
import { storage } from './storage';
import { Tag, KTagLocationResult } from '../types';

const BASE_URL = 'https://tags.traqcare.com/api';

const getHeaders = async () => {
    const settings = await storage.getSettings();
    return {
        'Content-Type': 'application/json',
        'api_token': settings.traqcareToken,
        'timestamp': Math.floor(Date.now() / 1000).toString()
    };
};

export const xadtagService = {
    /**
     * Ativação obrigatória do dispositivo
     */
    activate: async (tag: Tag): Promise<boolean> => {
        const settings = await storage.getSettings();
        if (!tag.traqcareId) return false;

        try {
            const response = await fetch(settings.customProxyUrl || `${BASE_URL}/tag`, {
                method: 'PATCH',
                headers: await getHeaders(),
                body: JSON.stringify({ tagId: tag.traqcareId })
            });

            if (!response.ok) return false;
            return true;
        } catch (e) {
            console.error("XADTAG Activation Error:", e);
            return false;
        }
    },

    /**
     * Consulta de localização atual
     */
    fetchLocation: async (tag: Tag): Promise<KTagLocationResult[]> => {
        const settings = await storage.getSettings();
        if (!tag.traqcareId) return [];

        try {
            const url = new URL(`${BASE_URL}/tag`);
            url.searchParams.append('tagId', tag.traqcareId);

            const response = await fetch(settings.customProxyUrl || url.toString(), {
                method: 'GET',
                headers: await getHeaders()
            });

            if (!response.ok) return [];

            const data = await response.json();
            
            // Adapter: Traqcare (lng) -> K-Tag UI (lon)
            // Fix: Removed 'key' property as it is not part of KTagLocationResult
            return [{
                lat: data.lat,
                lon: data.lng, // Mapeamento correto
                conf: data.battery * 10, // Mock de precisão baseado em bateria se necessário
                status: data.isActived ? 1 : 0,
                timestamp: data.timestamp * 1000,
                isodatetime: new Date(data.timestamp * 1000).toISOString()
            }];
        } catch (e) {
            console.error("XADTAG Fetch Error:", e);
            return [];
        }
    },

    /**
     * Histórico de trajeto
     */
    fetchHistory: async (tag: Tag, startTime: number, endTime: number): Promise<KTagLocationResult[]> => {
        const settings = await storage.getSettings();
        if (!tag.traqcareId) return [];

        try {
            const url = new URL(`${BASE_URL}/tag/history`);
            url.searchParams.append('tagId', tag.traqcareId);
            url.searchParams.append('startTime', Math.floor(startTime / 1000).toString());
            url.searchParams.append('endTime', Math.floor(endTime / 1000).toString());

            const response = await fetch(settings.customProxyUrl || url.toString(), {
                method: 'GET',
                headers: await getHeaders()
            });

            if (!response.ok) return [];

            const points: any[] = await response.json();
            // Fix: Removed 'key' property as it is not part of KTagLocationResult
            return points.map(p => ({
                lat: p.lat,
                lon: p.lng,
                conf: 100,
                status: 1,
                timestamp: p.timestamp * 1000,
                isodatetime: new Date(p.timestamp * 1000).toISOString()
            }));
        } catch (e) {
            console.error("XADTAG History Error:", e);
            return [];
        }
    }
};
