import React from 'react';
import { CheckSquare, Download, FileCode, FileSpreadsheet, FileText, Filter, Square } from 'lucide-react';
import { Company } from '../../../types';
import { Button, DropdownMenu, Field, SearchBar, Select } from '../../../components/ui';

interface VehicleFiltersBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  companyFilter: string;
  setCompanyFilter: (companyId: string) => void;
  ownershipFilter: string;
  setOwnershipFilter: (ownership: string) => void;
  installationFilter: string;
  setInstallationFilter: (installation: string) => void;
  tagFilter: string;
  setTagFilter: (tagFilter: string) => void;
  companies: Company[];
  isClientView: boolean;
  selectedCount: number;
  totalCount: number;
  handleSelectAll: () => void;
  handleExportPDF: () => void;
  handleExportExcel: () => void;
  handleExportCSV: () => void;
  searchPlaceholder: string;
}

export const VehicleFiltersBar: React.FC<VehicleFiltersBarProps> = ({
  searchTerm, setSearchTerm,
  statusFilter, setStatusFilter,
  companyFilter, setCompanyFilter,
  ownershipFilter, setOwnershipFilter,
  installationFilter, setInstallationFilter,
  tagFilter, setTagFilter,
  companies,
  isClientView, selectedCount, totalCount,
  handleSelectAll, handleExportPDF, handleExportExcel, handleExportCSV, searchPlaceholder,
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const activeFilters = [statusFilter, companyFilter, ownershipFilter, installationFilter, tagFilter].filter(value => value !== 'all').length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-3">
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={searchPlaceholder}
        label="Buscar veículos"
        actions={
          <>
            {!isClientView && selectedCount > 0 && (
              <DropdownMenu
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <Download size={14} aria-hidden /> Exportar ({selectedCount})
                  </Button>
                }
                items={[
                  { key: 'pdf', label: 'PDF', icon: <FileText size={14} />, onSelect: handleExportPDF },
                  { key: 'xlsx', label: 'Excel', icon: <FileSpreadsheet size={14} />, onSelect: handleExportExcel },
                  { key: 'csv', label: 'CSV', icon: <FileCode size={14} />, onSelect: handleExportCSV },
                ]}
              />
            )}
            <Button
              type="button"
              variant={showFilters || activeFilters > 0 ? 'secondary' : 'outline'}
              size="sm"
              aria-expanded={showFilters}
              onClick={() => setShowFilters(open => !open)}
            >
              <Filter size={14} aria-hidden /> Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </Button>
            {!isClientView && (
              <Button type="button" variant="outline" size="sm" aria-pressed={allSelected} onClick={handleSelectAll}>
                {allSelected ? <CheckSquare size={14} aria-hidden /> : <Square size={14} aria-hidden />}
                {allSelected ? 'Desmarcar' : 'Todos'}
              </Button>
            )}
          </>
        }
      />

      {showFilters && (
        <div className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos os status' },
                { value: 'active', label: 'Ativo' },
                { value: 'stolen', label: 'Roubo/Furto' },
                { value: 'maintenance', label: 'Manutenção' },
              ]}
            />
          </Field>
          {!isClientView && (
            <Field label="Responsável (regional)">
              <Select
                value={companyFilter}
                onChange={setCompanyFilter}
                options={[{ value: 'all', label: 'Todas as regionais' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
              />
            </Field>
          )}
          <Field label="Modalidade">
            <Select
              value={ownershipFilter}
              onChange={setOwnershipFilter}
              options={[
                { value: 'all', label: 'Todas as modalidades' },
                { value: 'leased', label: 'Comodato' },
                { value: 'purchased', label: 'Adquirido' },
              ]}
            />
          </Field>
          <Field label="Tipo de instalação">
            <Select
              value={installationFilter}
              onChange={setInstallationFilter}
              options={[
                { value: 'all', label: 'Todos os tipos' },
                { value: 'tag_only', label: 'Apenas tag' },
                { value: 'tracker_only', label: 'Apenas rastreador' },
                { value: 'tag_tracker', label: 'Tag + rastreador' },
              ]}
            />
          </Field>
          <Field label="Status da tag">
            <Select
              value={tagFilter}
              onChange={setTagFilter}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'c_tag', label: 'Com tag' },
                { value: 's_tag', label: 'Sem tag' },
              ]}
            />
          </Field>
          {activeFilters > 0 && (
            <div className="flex items-end sm:col-span-2 lg:col-span-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all'); setCompanyFilter('all'); setOwnershipFilter('all');
                  setInstallationFilter('all'); setTagFilter('all');
                }}
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
