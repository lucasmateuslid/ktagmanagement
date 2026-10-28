import * as React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CheckSquare, Download, Edit2, FileSpreadsheet, FileText, Filter, Plus, Search, Square, Trash2, UserPlus } from 'lucide-react';
import { formatCPF, formatPhone } from '@ktag/shared';
import { storage } from '../services/storage';
import { authenticatedFetch } from '../services/authenticatedFetch';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { exportRowsToXlsx } from '../utils/excel';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  EmptyState,
  Field,
  ModuleHeader,
  PageContainer,
  Pagination,
  SearchBar,
  Select,
  Skeleton,
} from '../components/ui';
import { Client } from '../types';
import { useClients } from './clients/hooks/useClients';
import { isCorrupted } from './clients/utils/clientForm';
import { filterClients, getClientMetrics } from './clients/utils/clientMetrics';

// Zinc-900 do DS: cabeçalho das tabelas exportadas em PDF.
const PDF_HEADER_COLOR: [number, number, number] = [24, 24, 27];
const PAGE_SIZE = 25;
const ROW_GRID = 'md:grid-cols-[2rem_minmax(12rem,1.5fr)_minmax(12rem,1.4fr)_minmax(8rem,0.9fr)_minmax(7rem,0.8fr)_9.5rem]';

type AccessFilter = 'all' | 'active' | 'none';
type LinkFilter = 'all' | 'with' | 'without';
type SortOrder = 'name-asc' | 'name-desc' | 'recent';

/** Lista de clientes. Cadastro e edição vivem em páginas dedicadas (ClientFormPage). */
export const Clients = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const { user: currentUser } = useAuth();
  const { clients, vehicles, loading, error, reload } = useClients();

  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all');
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('name-asc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const platesByClient = useMemo(() => {
    const map = new Map<string, string[]>();
    vehicles.forEach(v => {
      if (!v.clientId) return;
      const list = map.get(v.clientId) || [];
      list.push(v.plate);
      map.set(v.clientId, list);
    });
    return map;
  }, [vehicles]);
  const metrics = useMemo(() => getClientMetrics(clients, vehicles), [clients, vehicles]);

  const filtered = useMemo(() => {
    const list = filterClients(clients, searchTerm, platesByClient).filter(client => {
      const plates = platesByClient.get(client.id)?.length || 0;
      return (accessFilter === 'all' || (accessFilter === 'active' ? client.hasAccess === true : client.hasAccess !== true))
        && (linkFilter === 'all' || (linkFilter === 'with' ? plates > 0 : plates === 0));
    });
    if (sortOrder === 'name-desc') return [...list].reverse();
    if (sortOrder === 'recent') return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [clients, searchTerm, platesByClient, accessFilter, linkFilter, sortOrder]);

  // Qualquer mudança de busca/filtro volta para a primeira página.
  const filterKey = `${searchTerm}|${accessFilter}|${linkFilter}|${sortOrder}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggle = (id: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map(c => c.id)));

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    if (selected.size === 0) return;
    const rows = clients.filter(c => selected.has(c.id)).map(c => ({
      Nome: c.name,
      CPF: formatCPF(c.cpf),
      Telefone: formatPhone(c.phone),
      Email: c.email || '-',
      Veiculos: platesByClient.get(c.id)?.join(', ') || 'Nenhum',
      'Acesso Portal': c.hasAccess ? 'Sim' : 'Não',
      Cadastro: new Date(c.createdAt).toLocaleDateString('pt-BR'),
    }));

    if (format === 'xlsx') {
      await exportRowsToXlsx(rows, 'Clientes Selecionados', `clientes_export_${Date.now()}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text('Relatório de Clientes', 14, 20);
      autoTable(doc, {
        startY: 30,
        head: [['Nome', 'CPF', 'Telefone', 'Veículos', 'Acesso']],
        body: rows.map(r => [r.Nome, r.CPF, r.Telefone, r.Veiculos, r['Acesso Portal']]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: PDF_HEADER_COLOR },
      });
      doc.save(`clientes_export_${Date.now()}.pdf`);
    }
    addNotification('success', 'Exportação concluída', `${rows.length} clientes exportados.`);
    setSelected(new Set());
  };

  const handleDelete = async (client: Client) => {
    try {
      const linked = vehicles.filter(v => v.clientId === client.id);
      await Promise.all(linked.map(async vehicle => {
        const response = await authenticatedFetch(`/api/vehicles/${encodeURIComponent(vehicle.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: '' }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Falha ao desvincular veículo.');
      }));
      await storage.deleteClient(client.id);
      if (currentUser) storage.logAction(currentUser, 'DELETE', 'Client', `Removeu cliente: ${client.name}`, client.id);
      addNotification('info', 'Cliente removido', 'Cadastro excluído e veículos desvinculados.');
      setSelected(current => { const next = new Set(current); next.delete(client.id); return next; });
      await reload();
    } catch (err: any) {
      addNotification('error', 'Erro', err?.message || 'Não foi possível excluir o cliente.');
    }
  };

  const activeFilters = [accessFilter !== 'all', linkFilter !== 'all', sortOrder !== 'name-asc'].filter(Boolean).length;
  const hasFilters = Boolean(searchTerm.trim()) || accessFilter !== 'all' || linkFilter !== 'all';
  const clearFilters = () => { setSearchTerm(''); setAccessFilter('all'); setLinkFilter('all'); };

  return (
    <PageContainer size="full" className="space-y-5">
      <ModuleHeader
        eyebrow="Módulo de clientes"
        title="Gestão de clientes"
        subtitle="Controle de associados e permissões de acesso ao portal."
        actions={
          <Button type="button" size="pill" onClick={() => navigate('/clients/new')}>
            <Plus size={16} strokeWidth={3} aria-hidden /> Adicionar cliente
          </Button>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Buscar nome, CPF, telefone, e-mail ou placa…"
        label="Buscar clientes"
        actions={
          <>
            {selected.size > 0 && (
              <DropdownMenu
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    <Download size={14} aria-hidden /> Exportar ({selected.size})
                  </Button>
                }
                items={[
                  { key: 'pdf', label: 'PDF', icon: <FileText size={14} />, onSelect: () => handleExport('pdf') },
                  { key: 'xlsx', label: 'Excel', icon: <FileSpreadsheet size={14} />, onSelect: () => handleExport('xlsx') },
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
            <Button type="button" variant="outline" size="sm" aria-pressed={allSelected} onClick={toggleAll}>
              {allSelected ? <CheckSquare size={14} aria-hidden /> : <Square size={14} aria-hidden />}
              {allSelected ? 'Desmarcar' : 'Todos'}
            </Button>
          </>
        }
      />

      {showFilters && (
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:grid-cols-3">
        <Field label="Acesso ao portal">
        <Select<AccessFilter>
          value={accessFilter}
          onChange={setAccessFilter}
          options={[
            { value: 'all', label: `Todos os acessos (${metrics.total})` },
            { value: 'active', label: `Portal ativo (${metrics.activeAccess})` },
            { value: 'none', label: `Sem acesso (${metrics.pendingAccess})` },
          ]}
        />
        </Field>
        <Field label="Vínculo">
        <Select<LinkFilter>
          value={linkFilter}
          onChange={setLinkFilter}
          options={[
            { value: 'all', label: 'Todos os vínculos' },
            { value: 'with', label: `Com veículo (${metrics.withVehicles})` },
            { value: 'without', label: `Sem veículo (${metrics.withoutVehicles})` },
          ]}
        />
        </Field>
        <Field label="Ordenação">
        <Select<SortOrder>
          value={sortOrder}
          onChange={setSortOrder}
          options={[
            { value: 'name-asc', label: 'Nome A–Z' },
            { value: 'name-desc', label: 'Nome Z–A' },
            { value: 'recent', label: 'Cadastro mais recente' },
          ]}
        />
        </Field>
      </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>Tentar novamente</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className={`hidden items-center gap-4 border-b border-line bg-surface-2 px-6 py-3.5 text-label-xs font-black uppercase tracking-widest text-fg-2 md:grid ${ROW_GRID}`}>
          <span aria-hidden />
          <span>Cliente</span>
          <span>Contato</span>
          <span>Veículos</span>
          <span>Portal</span>
          <span className="text-right">Ações</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5" aria-busy>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={52} className="w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              icon={<UserPlus size={22} aria-hidden />}
              title="Nenhum cliente cadastrado"
              description="Cadastre o primeiro cliente para vincular veículos e liberar o acesso ao portal."
              action={<Button type="button" onClick={() => navigate('/clients/new')}>Adicionar cliente</Button>}
            />
          ) : (
            <EmptyState
              icon={<Search size={22} aria-hidden />}
              title="Nenhum resultado"
              description="Nenhum cliente corresponde à busca e aos filtros atuais."
              action={hasFilters ? <Button type="button" variant="outline" onClick={clearFilters}>Limpar filtros</Button> : undefined}
            />
          )
        ) : (
          <ul>
            {pageItems.map(client => {
              const protectedRecord = isCorrupted(client.name);
              const plates = platesByClient.get(client.id) || [];
              const detailsPath = `/clients/${encodeURIComponent(client.id)}`;
              return (
                <li
                  key={client.id}
                  className={`grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 border-b border-line px-4 py-4 transition-colors last:border-b-0 hover:bg-primary-500/5 md:items-center md:gap-4 md:px-6 ${ROW_GRID}`}
                >
                  <Checkbox checked={selected.has(client.id)} onChange={() => toggle(client.id)}>
                    <span className="sr-only">Selecionar {client.name}</span>
                  </Checkbox>
                  <button
                    type="button"
                    disabled={protectedRecord}
                    onClick={() => navigate(detailsPath)}
                    className="min-w-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span className="block truncate text-sm font-black uppercase text-fg-1">{client.name}</span>
                    <span className="mt-0.5 block truncate font-mono text-caption text-fg-2">
                      {protectedRecord ? 'Registro protegido' : client.cpf ? formatCPF(client.cpf) : 'CPF não informado'}
                    </span>
                  </button>
                  <div className="col-start-2 min-w-0 md:col-start-auto">
                    <p className={`truncate text-sm font-semibold ${client.phone ? 'text-fg-1' : 'text-fg-3'}`}>{client.phone ? formatPhone(client.phone) : 'Não informado'}</p>
                    <p className={`truncate text-caption ${client.email ? 'text-fg-2' : 'text-fg-3'}`}>{client.email || 'Sem e-mail'}</p>
                  </div>
                  <div className="col-start-2 md:col-start-auto">
                    <p className="text-sm font-black text-fg-1">{plates.length} {plates.length === 1 ? 'veículo' : 'veículos'}</p>
                    <p className="truncate font-mono text-caption text-fg-2">
                      {plates.length === 0 ? 'Sem veículo' : plates.length === 1 ? plates[0] : `${plates[0]} +${plates.length - 1}`}
                    </p>
                  </div>
                  <div className="col-start-2 md:col-start-auto">
                    <Badge size="xs" tone={client.hasAccess ? 'emerald' : 'neutral'}>
                      {client.hasAccess ? 'Ativo' : 'Sem acesso'}
                    </Badge>
                  </div>
                  <div className="col-start-2 flex items-center gap-1 md:col-start-auto md:justify-end">
                    <Button type="button" variant="link" className="h-10 px-2 text-xs" disabled={protectedRecord} onClick={() => navigate(detailsPath)}>
                      Ficha
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      aria-label={`Editar ${client.name}`} title="Editar cliente"
                      disabled={protectedRecord}
                      onClick={() => navigate(`${detailsPath}/edit`)}
                    >
                      <Edit2 size={15} aria-hidden />
                    </Button>
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="text-danger hover:bg-red-500/10"
                      aria-label={`Excluir ${client.name}`} title="Excluir cliente"
                      onClick={() => setClientToDelete(client)}
                    >
                      <Trash2 size={15} aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <Pagination
          summary={`${(currentPage - 1) * PAGE_SIZE + 1}–${(currentPage - 1) * PAGE_SIZE + pageItems.length} de ${filtered.length}`}
          page={currentPage}
          pageCount={pageCount}
          onPrevious={() => setPage(currentPage - 1)}
          onNext={() => setPage(currentPage + 1)}
        />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={clientToDelete !== null}
        onClose={() => setClientToDelete(null)}
        onConfirm={() => clientToDelete && handleDelete(clientToDelete)}
        title="Excluir cliente"
        message={`Excluir ${clientToDelete?.name ?? 'este cliente'}? Os veículos vinculados continuam no sistema, mas ficam sem cliente.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </PageContainer>
  );
};
