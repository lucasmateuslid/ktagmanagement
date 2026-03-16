
import { useState } from 'react';
import { Vehicle, Tag, Company, VehicleCategory, Client } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { mapVehiclesToExportData } from '../utils/vehicleExportUtils';

interface UseVehicleExportProps {
  vehicles: Vehicle[];
  filteredVehicles: Vehicle[];
  selectedVehicles: Set<string>;
  tags: Tag[];
  companies: Company[];
  categories: VehicleCategory[];
  clients: Client[];
  clearSelection: () => void;
}

export const useVehicleExport = ({
  vehicles, filteredVehicles, selectedVehicles, tags, companies, categories, clients, clearSelection
}: UseVehicleExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotification();

  const getExportData = () => {
    const sourceList = selectedVehicles.size > 0 
        ? vehicles.filter(v => selectedVehicles.has(v.id))
        : filteredVehicles;
    
    return mapVehiclesToExportData(sourceList, tags, companies, categories, clients);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('l', 'mm', 'a4');
      const data = getExportData();
      
      doc.setFontSize(20);
      doc.setTextColor(24, 24, 27);
      doc.text("RELATÓRIO GERAL DE VEÍCULOS", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(113, 113, 122);
      doc.text(`Total de Veículos: ${data.length} | Gerado em: ${new Date().toLocaleString()}`, 14, 28);

      autoTable(doc, {
        startY: 35,
        head: [['Placa', 'Status', 'Modelo', 'Categoria', 'Cliente', 'Equipamento', 'Propriedade', 'Cadastro']],
        body: data.map(v => [
          v.Placa, v.Status, v.Modelo, v.Categoria, v.Cliente, v.Equipamento, v['Propriedade'], v['Data Cadastro']
        ]),
        theme: 'striped',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255] },
        styles: { fontSize: 8 }
      });

      doc.save(`veiculos_ktag_${Date.now()}.pdf`);
      addNotification('success', 'Exportação PDF', 'O relatório foi gerado com sucesso.');
      clearSelection();
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    const { default: XLSX } = await import('xlsx');
    const data = getExportData();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Veículos");
    XLSX.writeFile(wb, `veiculos_ktag_${Date.now()}.xlsx`);
    addNotification('success', 'Exportação Excel', 'Planilha gerada com sucesso.');
    clearSelection();
  };

  const handleExportCSV = () => {
    const data = getExportData();
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `veiculos_ktag_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('success', 'Exportação CSV', 'Arquivo CSV gerado com sucesso.');
    clearSelection();
  };

  return { isExporting, handleExportPDF, handleExportExcel, handleExportCSV };
};
