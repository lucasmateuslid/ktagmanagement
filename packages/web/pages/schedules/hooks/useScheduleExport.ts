
import { useState } from 'react';
import { useNotification } from '../../../contexts/NotificationContext';
import { Schedule, Technician, User, Company } from '../../../types';
import { calculateServiceValue, calculateScheduleTotal } from '../utils/scheduleFinancialUtils';
import { exportRowsToXlsx } from '../../../utils/excel';

export const useScheduleExport = (
  filteredList: Schedule[],
  technicians: Technician[],
  companies: Company[],
  user: User | null,
  viewDate: Date,
  dashboardData: any
) => {
  const [isExporting, setIsExporting] = useState(false);
  const { addNotification } = useNotification();
  const isPrivileged = user?.role === 'admin' || user?.role === 'moderator';

  const getCompanyName = (companyId?: string) => {
      return companies.find(c => c.id === companyId)?.name || 'N/A';
  };

  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-');
          return `${day}/${month}/${year}`;
      }
      return new Date(dateStr).toLocaleDateString();
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.jsPDF || (jsPDFModule as any).default;
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default || (autoTableModule as any);

        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(24, 24, 27);
        doc.text("RELATÓRIO DE SERVIÇOS", 14, 22);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(113, 113, 122);
        doc.text(`Competência: ${viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}`, 14, 30);
        doc.text(`Gerado por: ${user?.name} em ${new Date().toLocaleString()}`, 14, 36);

        if (dashboardData && isPrivileged) {
            const startY = 45;
            
            // KPI Boxes
            doc.setFillColor(24, 24, 27); // Dark
            doc.roundedRect(14, startY, 45, 25, 3, 3, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8); doc.text("TOTAL MÊS", 19, startY + 8);
            doc.setFontSize(14); doc.text(dashboardData.total.toString(), 19, startY + 20);

            doc.setFillColor(16, 185, 129); // Emerald
            doc.roundedRect(64, startY, 45, 25, 3, 3, "F");
            doc.setFontSize(8); doc.text("CONCLUÍDAS", 69, startY + 8);
            doc.setFontSize(14); doc.text(dashboardData.completed.toString(), 69, startY + 20);

            doc.setFillColor(239, 68, 68); // Red
            doc.roundedRect(114, startY, 45, 25, 3, 3, "F");
            doc.setFontSize(8); doc.text("CANCELADAS", 119, startY + 8);
            doc.setFontSize(14); doc.text(dashboardData.canceled.toString(), 119, startY + 20);

            doc.setFillColor(59, 130, 246); // Blue
            doc.roundedRect(164, startY, 45, 25, 3, 3, "F");
            doc.setFontSize(8); doc.text("TICKET MÉDIO", 169, startY + 8);
            doc.setFontSize(14); doc.text(`R$ ${dashboardData.avgTicket.toFixed(0)}`, 169, startY + 20);

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Detalhamento Operacional", 14, startY + 40);

            autoTable(doc, {
                startY: startY + 45,
                head: [['Tipo de Serviço', 'Quantidade', 'Representatividade']],
                body: [
                    ['Instalação', dashboardData.installation, `${((dashboardData.installation/dashboardData.total)*100 || 0).toFixed(1)}%`],
                    ['Manutenção', dashboardData.maintenance, `${((dashboardData.maintenance/dashboardData.total)*100 || 0).toFixed(1)}%`],
                    ['Retirada', dashboardData.removal, `${((dashboardData.removal/dashboardData.total)*100 || 0).toFixed(1)}%`],
                    ['Vistoria', dashboardData.inspection, `${((dashboardData.inspection/dashboardData.total)*100 || 0).toFixed(1)}%`],
                ],
                theme: 'striped',
                headStyles: { fillColor: [63, 63, 70] },
                styles: { fontSize: 9 }
            });

            const currentY = (doc as any).lastAutoTable.finalY + 15;
            doc.text("Análise Financeira e Produtividade", 14, currentY);

            const techData = dashboardData.byTech.map(([name, value]: [string, number]) => [
                name,
                `R$ ${value.toFixed(2)}`
            ]);

            techData.push(['TOTAL GERAL', `R$ ${dashboardData.totalRevenue.toFixed(2)}`]);
            techData.push(['(Gasto com Deslocamento)', `(R$ ${dashboardData.totalDisplacement.toFixed(2)})`]);

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Técnico Responsável', 'Valor Produzido']],
                body: techData,
                theme: 'grid',
                headStyles: { fillColor: [245, 158, 11], textColor: [0,0,0] }, 
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                styles: { fontSize: 9 }
            });
        }

        doc.addPage();
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Relatório Detalhado de Serviços", 14, 20);

        // Use filteredList or monthly data
        const sourceData = (isPrivileged && dashboardData) ? dashboardData.monthSchedules : filteredList;
        
        const detailedRows = sourceData.map((s: Schedule) => {
            const tech = technicians.find(t => t.id === s.technicianId);
            const techName = tech?.name || '-';
            const companyName = getCompanyName(s.companyId);
            const date = s.confirmedDate ? formatDate(s.confirmedDate) : (s.preferredDate ? formatDate(s.preferredDate) : '-');
            
            let val = 0;
            if (['Confirmada', 'Reagendada', 'Concluída', 'Técnico no local', 'Cliente no local'].includes(s.status)) {
                 val = calculateServiceValue(s, tech);
            }
            const disp = s.displacementValue || 0;

            return [
                date,
                s.vehiclePlate,
                companyName,
                s.serviceType,
                s.status,
                techName,
                disp > 0 ? `R$ ${disp.toFixed(2)}` : '-',
                `R$ ${(val + disp).toFixed(2)}`,
                s.technicianPaid ? `R$ ${(s.technicianPaymentAmount || 0).toFixed(2)}` : '-',
                s.technicianPaymentDate && s.technicianPaid ? formatDate(s.technicianPaymentDate) : '-'
            ];
        });

        autoTable(doc, {
            startY: 25,
            head: [['Data', 'Placa', 'Empresa', 'Serviço', 'Status', 'Técnico', 'Desloc.', 'Valor Total', 'Pago Tec.', 'Data Pag.']],
            body: detailedRows,
            theme: 'striped',
            headStyles: { fillColor: [24, 24, 27] },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                5: { halign: 'right' },
                6: { halign: 'right', fontStyle: 'bold' },
                7: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
            }
        });

        doc.save(`relatorio_servicos_${viewDate.getMonth()+1}_${viewDate.getFullYear()}.pdf`);
        addNotification('success', 'PDF Gerado', 'Relatório operacional exportado.');

    } catch (e) {
        console.error(e);
        addNotification('error', 'Erro', 'Falha ao gerar PDF.');
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
      try {
          const sourceData = (isPrivileged && dashboardData) ? dashboardData.monthSchedules : filteredList;

          const data = sourceData.map((s: Schedule) => {
              const tech = technicians.find(t => t.id === s.technicianId);
              
              let val = 0;
              if (['Confirmada', 'Reagendada', 'Concluída', 'Técnico no local', 'Cliente no local'].includes(s.status)) {
                   val = calculateServiceValue(s, tech);
              }

              return {
                  "ID": s.id.substring(0, 8),
                  "Data": s.confirmedDate ? formatDate(s.confirmedDate) : (s.preferredDate ? formatDate(s.preferredDate) : '-'),
                  "Hora": s.confirmedTime || s.preferredTime || '-',
                  "Placa": s.vehiclePlate,
                  "Modelo": s.vehicleModel,
                  "Cliente": s.clientName || '-',
                  "Serviço": s.serviceType,
                  "Status": s.status,
                  "Técnico": tech?.name || '-',
                  "Técnico Pago?": s.technicianPaid ? 'SIM' : 'NÃO',
                  "Valor Pago Técnico": s.technicianPaymentAmount || 0,
                  "Data Pag. Técnico": s.technicianPaymentDate ? formatDate(s.technicianPaymentDate) : '-',
                  "Endereço": s.locationAddress,
                  "Distante?": s.isRemoteLocation ? 'SIM' : 'NÃO',
                  "KM Desloc.": s.displacementKm || 0,
                  "Valor Desloc.": s.displacementValue || 0,
                  "Valor Serviço": val,
                  "Valor Total": val + (s.displacementValue || 0),
                  "Solicitante": s.requesterName,
                  "IMEI Rastreador": s.installedImei || '-',
                  "IMEI/ID Tag": s.installedTagImei || '-'
              };
          });

          await exportRowsToXlsx(data, 'Agendamentos', `agendamentos_${Date.now()}.xlsx`);
          addNotification('success', 'Excel Gerado', 'Planilha exportada com sucesso.');
      } catch (e) {
          addNotification('error', 'Erro', 'Falha ao exportar Excel.');
      }
  };

  return { handleExportPDF, handleExportExcel, isExporting };
};
