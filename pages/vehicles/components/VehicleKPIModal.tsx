
import React, { useMemo } from 'react';
import { X, Activity, Car, CreditCard, Tag as TagIcon, ShieldCheck, Building2, Download, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vehicle, Company, Tag, VehicleCategory, Client } from '../../../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { mapVehiclesToExportData } from '../utils/vehicleExportUtils';

interface VehicleKPIModalProps {
  onClose: () => void;
  vehicles: Vehicle[];
  companies: Company[];
  tags: Tag[];
  categories: VehicleCategory[];
  clients: Client[];
}

export const VehicleKPIModal: React.FC<VehicleKPIModalProps> = ({ 
  onClose, vehicles, companies, tags, categories, clients 
}) => {
  const stats = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'active').length;
    const leased = vehicles.filter(v => v.ownershipStatus === 'leased').length;
    const purchased = vehicles.filter(v => v.ownershipStatus === 'purchased').length;
    const tagOnly = vehicles.filter(v => v.installationType === 'tag_only').length;
    const tagTracker = vehicles.filter(v => v.installationType === 'tag_tracker').length;

    const byCompany = companies.map(company => {
      const companyVehicles = vehicles.filter(v => v.companyId === company.id);
      return {
        name: company.name,
        total: companyVehicles.length,
        active: companyVehicles.filter(v => v.status === 'active').length,
        leased: companyVehicles.filter(v => v.ownershipStatus === 'leased').length,
        purchased: companyVehicles.filter(v => v.ownershipStatus === 'purchased').length,
        tagOnly: companyVehicles.filter(v => v.installationType === 'tag_only').length,
        tagTracker: companyVehicles.filter(v => v.installationType === 'tag_tracker').length,
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

    const byResponsible = Array.from(new Set(vehicles.map(v => v.updatedBy || 'SISTEMA'))).map(name => {
      const respVehicles = vehicles.filter(v => (v.updatedBy || 'SISTEMA') === name);
      return {
        name,
        total: respVehicles.length,
        active: respVehicles.filter(v => v.status === 'active').length,
        tagOnly: respVehicles.filter(v => v.installationType === 'tag_only').length,
        tagTracker: respVehicles.filter(v => v.installationType === 'tag_tracker').length,
      };
    }).sort((a, b) => b.total - a.total);

    return { total, active, leased, purchased, tagOnly, tagTracker, byCompany, byResponsible };
  }, [vehicles, companies]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();

    doc.setFontSize(20);
    doc.text('Relatório de KPIs da Frota', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${now}`, 14, 30);

    // Resumo Geral
    autoTable(doc, {
      startY: 40,
      head: [['Indicador', 'Quantidade']],
      body: [
        ['Total de Veículos', stats.total],
        ['Placas Ativas', stats.active],
        ['Em Comodato', stats.leased],
        ['Adquiridos', stats.purchased],
        ['Apenas Tag', stats.tagOnly],
        ['Tag + Rastreador', stats.tagTracker],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 110, 130] }
    });

    // Por Responsável
    doc.setFontSize(14);
    doc.text('Distribuição por Responsável (Regional)', 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Regional', 'Total', 'Ativos', 'Comodato', 'Adquirido', 'Tag', 'Tag+Rast']],
      body: stats.byCompany.map(c => [
        c.name, c.total, c.active, c.leased, c.purchased, c.tagOnly, c.tagTracker
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 110, 130] }
    });

    // Por Responsável (Cadastro)
    doc.setFontSize(14);
    doc.text('Distribuição por Responsável (Cadastro)', 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Responsável', 'Total', 'Ativos', 'Tag', 'Tag+Rast']],
      body: stats.byResponsible.map(r => [
        r.name, r.total, r.active, r.tagOnly, r.tagTracker
      ]),
      theme: 'grid',
      headStyles: { fillColor: [0, 110, 130] }
    });

    doc.save(`KPI_Frota_${new Date().getTime()}.pdf`);
  };

  const handleExportExcel = async () => {
    const { default: XLSX } = await import('xlsx');
    
    // 1. Resumo Geral
    const summaryData = [
      ['RELATÓRIO DE KPI - FROTA KTAG'],
      ['Gerado em:', new Date().toLocaleString()],
      [],
      ['RESUMO GERAL'],
      ['Indicador', 'Quantidade'],
      ['Total de Veículos', stats.total],
      ['Placas Ativas', stats.active],
      ['Em Comodato', stats.leased],
      ['Adquiridos', stats.purchased],
      ['Apenas Tag', stats.tagOnly],
      ['Tag + Rastreador', stats.tagTracker],
      [],
      ['DISTRIBUIÇÃO POR RESPONSÁVEL (REGIONAL)'],
      ['Regional', 'Total', 'Ativos', 'Comodato', 'Adquirido', 'Apenas Tag', 'Tag + Rastreador'],
      ...stats.byCompany.map(c => [
        c.name, c.total, c.active, c.leased, c.purchased, c.tagOnly, c.tagTracker
      ]),
      [],
      ['DISTRIBUIÇÃO POR RESPONSÁVEL (CADASTRO)'],
      ['Responsável', 'Total', 'Ativos', 'Apenas Tag', 'Tag + Rastreador'],
      ...stats.byResponsible.map(r => [
        r.name, r.total, r.active, r.tagOnly, r.tagTracker
      ])
    ];

    // 2. Lista Detalhada de Veículos (para filtros avançados no Excel)
    const detailedData = mapVehiclesToExportData(vehicles, tags, companies, categories, clients);

    const wb = XLSX.utils.book_new();
    
    // Aba de Resumo
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo KPI");
    
    // Aba de Detalhes
    const wsDetails = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, wsDetails, "Lista de Veículos");

    XLSX.writeFile(wb, `Relatorio_KPI_Detalhado_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl bg-white dark:bg-zinc-900 rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
              <Activity size={20} className="text-black" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight truncate">Relatório de KPIs</h2>
              <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest truncate">Indicadores de desempenho da frota</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button 
              onClick={handleExportExcel}
              title="Exportar Excel"
              className="p-2.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-2 font-black text-[9px] uppercase tracking-widest"
            >
              <FileSpreadsheet size={16} /> <span className="hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={handleExportPDF}
              title="Exportar PDF"
              className="p-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl hover:scale-105 transition-all flex items-center gap-2 font-black text-[9px] uppercase tracking-widest"
            >
              <Download size={16} /> <span className="hidden sm:inline">PDF</span>
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={<Car size={16}/>} label="Total" value={stats.total} color="zinc" />
            <KPICard icon={<ShieldCheck size={16}/>} label="Ativos" value={stats.active} color="emerald" />
            <KPICard icon={<CreditCard size={16}/>} label="Comodato" value={stats.leased} color="blue" />
            <KPICard icon={<Building2 size={16}/>} label="Adquiridos" value={stats.purchased} color="purple" />
            <KPICard icon={<TagIcon size={16}/>} label="Apenas Tag" value={stats.tagOnly} color="amber" />
            <KPICard icon={<Activity size={16}/>} label="Tag+Rast" value={stats.tagTracker} color="primary" />
          </div>

          {/* Detailed Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Building2 size={16} />
              <h3 className="text-[10px] font-black uppercase tracking-widest">Distribuição por Responsável (Regional)</h3>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-[24px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800/50">
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Regional</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Total</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Ativos</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Comodato</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Adquirido</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Tag</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Tag+Rast</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {stats.byCompany.map((c, i) => (
                      <tr key={i} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-xs text-zinc-900 dark:text-white">{c.name}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs">{c.total}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-emerald-500">{c.active}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-blue-500">{c.leased}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-purple-500">{c.purchased}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-amber-500">{c.tagOnly}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-primary-500">{c.tagTracker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Responsible Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <Activity size={16} />
              <h3 className="text-[10px] font-black uppercase tracking-widest">Distribuição por Responsável (Cadastro)</h3>
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-[24px] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800/50">
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Responsável</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Total</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Ativos</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Tag</th>
                      <th className="px-5 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500 text-center">Tag+Rast</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {stats.byResponsible.map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-xs text-zinc-900 dark:text-white">{r.name}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs">{r.total}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-emerald-500">{r.active}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-amber-500">{r.tagOnly}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-xs text-primary-500">{r.tagTracker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'zinc' | 'emerald' | 'blue' | 'purple' | 'amber' | 'primary';
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    primary: 'bg-primary-500/10 text-primary-600 dark:text-primary-400',
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center text-center gap-1.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="space-y-0.5">
        <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">{label}</p>
        <p className="text-lg font-display font-black text-zinc-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  );
};
