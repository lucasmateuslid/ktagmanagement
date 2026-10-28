
import React from 'react';
import { Vehicle, Tag, VehicleCategory, Client } from '../../../types';
import { VehicleRow } from './VehicleRow';
import { Car, Search } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '../../../components/ui';

interface VehicleTableProps {
  vehicles: Vehicle[];
  searching?: boolean;
  tags: Tag[];
  categories: VehicleCategory[];
  clients: Client[];
  isReadOnly: boolean;
  /** true quando há busca/filtro ativo (muda a mensagem do estado vazio). */
  filtered?: boolean;
  onCreate?: () => void;
  /** Rodapé dentro do card (paginação). */
  footer?: React.ReactNode;
  selectedVehicles: Set<string>;
  toggleSelect: (id: string) => void;
  onEdit: (v: Vehicle) => void;
  onDelete: (id: string) => void;
}

export const VehicleTable: React.FC<VehicleTableProps> = ({ 
  vehicles, searching = false, tags, categories, clients, isReadOnly, filtered = false, onCreate, footer, selectedVehicles, toggleSelect, onEdit, onDelete
}) => {
  const desktopColumns = isReadOnly
    ? 'md:grid-cols-[minmax(11rem,1.2fr)_minmax(14rem,2fr)_minmax(12rem,1.3fr)_minmax(12rem,1fr)]'
    : 'md:grid-cols-[minmax(12rem,1.3fr)_minmax(15rem,2fr)_minmax(12rem,1.3fr)_minmax(10rem,1fr)_7rem]';

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
         {/* CABEÇALHO TABELA - VISÍVEL APENAS EM DESKTOP */}
        <div className={`hidden md:grid ${desktopColumns} gap-4 px-6 py-3.5 border-b border-line bg-surface-2 text-label-xs font-black uppercase tracking-widest text-fg-2`}>
          <div>Placa & Status</div>
          <div>Veículo</div>
          <div>{isReadOnly ? 'Dispositivo' : 'Cliente'}</div>
          {!isReadOnly && <div>Responsável & Data</div>}
          <div className="text-right">Ações</div>
         </div>
         <div className="divide-y divide-line">
            {vehicles.length === 0 ? (
               searching ? (
                 <div className="space-y-3 p-5" aria-busy>
                   {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={56} className="w-full" />)}
                 </div>
               ) : filtered ? (
                 <EmptyState icon={<Search size={22} aria-hidden />} title="Nenhum veículo localizado" description="Ajuste a busca ou os filtros para ver outros resultados." />
               ) : (
                 <EmptyState
                   icon={<Car size={22} aria-hidden />}
                   title="Nenhum veículo cadastrado"
                   description="Cadastre o primeiro veículo da frota para acompanhá-lo no mapa."
                   action={onCreate && !isReadOnly ? <Button type="button" onClick={onCreate}>Novo veículo</Button> : undefined}
                 />
               )
            ) : (
              vehicles.map(v => (
                <VehicleRow 
                    key={v.id} 
                    vehicle={v} 
                    tags={tags} 
                    categories={categories} 
                    clients={clients} 
                    isReadOnly={isReadOnly}
                    isSelected={selectedVehicles.has(v.id)}
                    toggleSelect={toggleSelect}
                    onEdit={onEdit} 
                    onDelete={onDelete} 
                />
              ))
            )}
         </div>
         {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
    </div>
  );
};
