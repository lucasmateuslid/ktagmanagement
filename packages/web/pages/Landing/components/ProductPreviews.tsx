import { CalendarDays, Car, MapPin, Package, Radio, Satellite, Search, Users } from 'lucide-react';

function Frame({ title, section, children, hero = false }: { title: string; section: string; children: React.ReactNode; hero?: boolean }) {
  return (
    <div className={`product-frame ${hero ? 'product-frame--hero' : ''}`} aria-label={`Demonstração da interface: ${title}`}>
      <div className="product-frame__top"><div className="product-frame__brand"><span>M</span> MONITORA<b>360</b></div><div className="product-frame__search"><Search /> Buscar na operação</div><div className="product-frame__avatar">OP</div></div>
      <div className="product-frame__body"><aside><div className="is-active"><Radio /> Visão geral</div><div><MapPin /> Mapa</div><div><Car /> Veículos</div><div><Satellite /> Equipamentos</div><div><CalendarDays /> Agenda</div><div><Users /> Técnicos</div></aside><div className="product-frame__content"><p>{section}</p><h3>{title}</h3>{children}</div></div>
    </div>
  );
}

export function DashboardPreview({ hero = false }: { hero?: boolean }) {
  return (
    <Frame title="Controle operacional" section="Visão geral / Hoje" hero={hero}>
      <div className="preview-kpis"><div className="preview-kpi preview-kpi--dark"><small>Frota monitorada</small><strong>Operação ativa</strong><span><i /> comunicação em tempo real</span></div><div className="preview-kpi"><small>Equipamentos</small><strong>Estoque organizado</strong><span>Disponível · reservado · instalado</span></div><div className="preview-kpi"><small>Serviços</small><strong>Agenda operacional</strong><span>Instalações, manutenções e retiradas</span></div></div>
      <div className="preview-dashboard-row"><div className="preview-chart"><div className="preview-chart__head"><span>Fluxo de serviços</span><small>Últimos dias</small></div><div className="preview-bars">{[44, 68, 53, 82, 61, 91, 74, 86].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div><div className="preview-activity"><span>Atividade recente</span>{['Equipamento vinculado ao veículo', 'Serviço atribuído ao técnico', 'Posição recebida no mapa'].map((item, i) => <div key={item}><i className={`tone-${i}`} /><p>{item}<small>Registro operacional</small></p></div>)}</div></div>
    </Frame>
  );
}

export function MapPreview() {
  return <Frame title="Mapa ao vivo" section="Rastreamento / Operação"><div className="preview-map"><div className="preview-map__roads" /><div className="preview-map__pin pin-a"><Car /></div><div className="preview-map__pin pin-b"><Car /></div><div className="preview-map__pin pin-c"><Car /></div><div className="preview-map__panel"><span><i /> Veículo online</span><strong>Veículo 024</strong><small>Posição atualizada · equipamento vinculado</small><dl><div><dt>Status</dt><dd>Em movimento</dd></div><div><dt>Origem</dt><dd>Traccar</dd></div></dl></div></div></Frame>;
}

export function InventoryPreview() {
  const rows = [['860•••••••••104', 'ST-901', 'Estoque central', 'Disponível'], ['860•••••••••287', 'ST-901', 'Serviço reservado', 'Reservado'], ['860•••••••••412', 'Chip vinculado', 'Veículo 018', 'Em uso']];
  return <Frame title="Equipamentos e estoque" section="Ativos / Inventário"><div className="preview-toolbar"><div><Package /><span>Controle por IMEI, lote e status</span></div><button>Adicionar equipamento</button></div><div className="preview-table"><div className="preview-table__row preview-table__head"><span>IMEI</span><span>Modelo / chip</span><span>Local ou vínculo</span><span>Status</span></div>{rows.map(row => <div className="preview-table__row" key={row[0]}>{row.map((cell, i) => <span key={cell} className={i === 3 ? `status-${i}` : ''}>{cell}</span>)}</div>)}</div></Frame>;
}

export function SchedulePreview() {
  return <Frame title="Agenda da equipe" section="Operação / Calendário"><div className="preview-calendar"><div className="preview-calendar__hours">{['08:00', '10:00', '12:00', '14:00', '16:00'].map(t => <span key={t}>{t}</span>)}</div><div className="preview-calendar__days">{['SEG 24', 'TER 25', 'QUA 26', 'QUI 27'].map((day, i) => <div key={day}><strong>{day}</strong>{i !== 2 && <article className={`event-${i}`}><small>{i === 0 ? 'Instalação' : i === 1 ? 'Manutenção' : 'Retirada'}</small><b>Serviço #{104 + i}</b><span>Técnico atribuído</span></article>}</div>)}</div></div></Frame>;
}
