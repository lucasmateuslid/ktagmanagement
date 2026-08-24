
import { LocationHistory, Vehicle, Tag } from '../../../types';
import { geocodingService } from '../../../services/geocoding';
import { exportRowsToXlsx } from '../../../utils/excel';

// Helper para resolver endereços em lote para exportação
export const processExportData = async (
    historyItems: LocationHistory[],
    resolvedAddresses: Record<string, string>,
    onProgress: (progress: number) => void
) => {
    const total = historyItems.length;
    const exportData = [];
    const currentAddresses = { ...resolvedAddresses };

    for (let i = 0; i < total; i++) {
        const item = historyItems[i];
        const key = `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`;
        let address = item.address || currentAddresses[key];

        if (!address) {
            try {
                await new Promise(r => setTimeout(r, 100)); 
                address = await geocodingService.reverseGeocode(item.lat, item.lon);
                currentAddresses[key] = address;
            } catch (e) {
                address = "Endereço indisponível";
            }
        }

        exportData.push({
            data: new Date(item.timestamp).toLocaleString(),
            lat: item.lat,
            lon: item.lon,
            endereco: address
        });
        onProgress(Math.round(((i + 1) / total) * 100));
    }

    return exportData;
};

export const generatePDF = async (label: string, data: any[]) => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`RELATÓRIO DE TRAJETO (24H)`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Alvo: ${label}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Data/Hora', 'Coordenadas', 'Endereço Local']],
      body: data.map(item => [
        item.data,
        `${item.lat.toFixed(5)}, ${item.lon.toFixed(5)}`,
        item.endereco
      ]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 8 }
    });
    doc.save(`Trajeto_${label}.pdf`);
};

export const generateExcel = async (label: string, data: any[]) => {
    await exportRowsToXlsx(data, 'Trajeto', `Trajeto_${label}.xlsx`);
};
