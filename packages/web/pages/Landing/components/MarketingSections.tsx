import { ArrowDown, ArrowRight, Building2, CalendarDays, Car, Check, ChevronDown, Database, MapPin, Package, Radio, Satellite, Server, Settings2, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { InventoryPreview, MapPreview, SchedulePreview } from './ProductPreviews';

function SectionHeading({ kicker, title, text, light = false }: { kicker: string; title: string; text?: string; light?: boolean }) {
  return <div className={`marketing-heading ${light ? 'marketing-heading--light' : ''}`}><p className="marketing-kicker">{kicker}</p><h2>{title}</h2>{text && <p>{text}</p>}</div>;
}

export function ProblemSection() {
  const inputs = ['WhatsApp', 'Planilha', 'Rastreador', 'Estoque', 'Técnico', 'Agenda', 'Cliente'];
  return <section id="problema" className="marketing-section marketing-section--light"><div className="marketing-shell"><SectionHeading light kicker="O problema é operacional" title="Sua operação não deveria depender de cinco sistemas diferentes." text="Quando estoque, técnicos, rastreadores, chips, agendamentos e clientes ficam espalhados, o problema deixa de ser rastreamento. O problema passa a ser operação."/><div className="problem-diagram"><div className="problem-diagram__inputs">{inputs.map(item => <span key={item}>{item}</span>)}</div><ArrowDown /><div className="problem-diagram__result"><img src="/brand/logo-mark-dark.svg" alt=""/><strong>MONITORA360</strong><small>Uma visão operacional</small></div></div></div></section>;
}

export function PlatformOverview() {
  return <section id="produto" className="marketing-section"><div className="marketing-shell"><SectionHeading kicker="A plataforma" title="Muito além de mostrar um veículo no mapa." text="O Monitora360 conecta rastreamento, atendimento e operação de campo em uma única estrutura."/><div className="platform-composition"><article className="module-card module-card--wide"><span>01 / Rastreamento</span><MapPin/><h3>Veículos, posição e histórico.</h3><p>Acompanhe equipamentos vinculados e consulte a movimentação dentro da mesma operação.</p></article><article className="module-card"><span>02 / Operação</span><CalendarDays/><h3>Técnicos e agendamentos.</h3><p>Organize instalações, manutenções, retiradas e vistorias.</p></article><article className="module-card"><span>03 / Equipamentos</span><Satellite/><h3>IMEI, chips e estoque.</h3><p>Conecte o equipamento ao serviço e ao veículo.</p></article><article className="module-card module-card--wide module-card--accent"><span>04 / Empresas</span><Building2/><h3>Clientes e operações independentes.</h3><p>Estrutura multiempresa com usuários, módulos e identidade por operação.</p></article></div></div></section>;
}

export function TrackingSection() {
  return <section id="operacao" className="marketing-section feature-section"><div className="marketing-shell"><div className="feature-copy"><SectionHeading kicker="Rastreamento" title="Veja o que está acontecendo com sua operação em tempo real." text="Posição, status de comunicação, equipamento vinculado e histórico de localização em uma visão preparada para o trabalho diário."/><div className="feature-points"><span><Radio/> Atualização em tempo real</span><span><MapPin/> Posição e endereço</span><span><Database/> Histórico por veículo</span></div></div><div className="feature-product"><MapPreview/></div><p className="integration-note"><i/> Integração preparada para operações baseadas em Traccar e K-TAG.</p></div></section>;
}

export function InventorySection() {
  return <section className="marketing-section marketing-section--soft feature-section"><div className="marketing-shell"><div className="feature-copy"><SectionHeading light kicker="Equipamentos" title="Saiba exatamente onde está cada equipamento." text="Da entrada no estoque até a instalação no veículo. Organize IMEI, chip, lote, status e vínculo sem reconstruir o histórico em planilhas."/><div className="inventory-flow"><span>Estoque central</span><i/><span>Serviço reservado</span><i/><span>Veículo</span></div></div><div className="feature-product"><InventoryPreview/></div></div></section>;
}

export function TechnicianSection() {
  return <section className="marketing-section technician-section"><div className="marketing-shell marketing-split"><div><SectionHeading kicker="Equipe externa" title="Pare de procurar técnico no WhatsApp." text="Organize agenda, disponibilidade, serviços, valores e atendimentos dos técnicos em uma visão operacional única."/><a className="marketing-text-link" href="#fluxo">Ver gestão de operações <ArrowRight/></a></div><div className="technician-board"><header><span>Equipe técnica</span><small>Disponibilidade operacional</small></header>{[['Carlos A.', 'Instalação', 'Disponível'], ['Marina S.', 'Manutenção', 'Em atendimento'], ['Rafael P.', 'Retirada', 'Agenda livre']].map((row, i) => <article key={row[0]}><div className={`tech-avatar tone-${i}`}>{row[0][0]}</div><p><strong>{row[0]}</strong><small>{row[1]}</small></p><span><i/>{row[2]}</span></article>)}</div></div></section>;
}

export function SchedulingSection() {
  return <section className="marketing-section feature-section"><div className="marketing-shell"><div className="feature-copy"><SectionHeading kicker="Agendamentos" title="Venda o serviço. O sistema ajuda a organizar a execução." text="Horários, técnicos, deslocamento, status e histórico do atendimento permanecem conectados à mesma ordem de serviço."/><ul className="marketing-checks"><li><Check/> Instalação, manutenção, retirada e vistoria</li><li><Check/> Atribuição de técnico e acompanhamento de status</li><li><Check/> Checklist, assinatura e vínculo do equipamento</li></ul></div><div className="feature-product"><SchedulePreview/></div></div></section>;
}

export function MultiCompanySection() {
  return <section className="marketing-section marketing-section--light"><div className="marketing-shell marketing-split"><SectionHeading light kicker="Multiempresa + white-label" title="Uma estrutura. Várias operações." text="Gerencie diferentes empresas mantendo dados, usuários e módulos organizados de forma independente. Personalize nome, logos e cores para cada operação."/><div className="tenant-diagram"><div><img src="/brand/logo-mark-dark.svg" alt=""/><strong>MONITORA360</strong></div><i/><ul><li><Building2/> Empresa A <span>Operação independente</span></li><li><Building2/> Empresa B <span>Marca personalizada</span></li><li><Building2/> Empresa C <span>Usuários e módulos</span></li></ul></div></div></section>;
}

export function IntegrationsSection() {
  const integrations = [{ name: 'Traccar', icon: Satellite, text: 'Rastreamento e telemetria' }, { name: 'K-TAG', icon: Radio, text: 'Localização de equipamentos' }, { name: 'Hinova', icon: Server, text: 'Consulta da base operacional' }, { name: 'WhatsApp', icon: Smartphone, text: 'Comunicação de agendamentos' }, { name: 'Melhor Envio', icon: Package, text: 'Remessas e etiquetas' }];
  return <section id="integracoes" className="marketing-section"><div className="marketing-shell"><SectionHeading kicker="Integrações reais" title="Conecte o Monitora360 ao que já faz parte da sua operação." text="A plataforma reúne integrações presentes no fluxo de rastreamento, atendimento e logística."/><div className="integrations-list">{integrations.map(({ name, icon: Icon, text }) => <article key={name}><Icon/><div><strong>{name}</strong><span>{text}</span></div><ArrowRight/></article>)}</div></div></section>;
}

export function ComparisonSection() {
  const rows = [['Planilha', 'Estoque centralizado'], ['WhatsApp', 'Operação organizada'], ['Vários sistemas', 'Uma visão operacional'], ['Busca manual de técnico', 'Gestão de técnicos'], ['Equipamentos espalhados', 'Histórico por equipamento'], ['Informação descentralizada', 'Dados conectados']];
  return <section className="marketing-section comparison-section"><div className="marketing-shell"><SectionHeading kicker="Menos improviso" title="Mais controle."/><div className="comparison-table"><header><span>Sem Monitora360</span><span>Com Monitora360</span></header>{rows.map(row => <div key={row[0]}><span>{row[0]}</span><ArrowRight/><strong><Check/>{row[1]}</strong></div>)}</div></div></section>;
}

export function AudienceSection() {
  return <section id="para-quem" className="marketing-section marketing-section--light"><div className="marketing-shell"><SectionHeading light kicker="Para quem é" title="Construído para quem opera rastreamento de verdade."/><div className="audience-grid"><article><span>01</span><Car/><h3>Empresas de rastreamento</h3><p>Organize dispositivos, clientes, técnicos, serviços e operação em uma única plataforma.</p></article><article><span>02</span><ShieldCheck/><h3>Associações de proteção veicular</h3><p>Acompanhe rastreamento e operação dos associados sem depender de processos espalhados.</p></article></div></div></section>;
}

export function WorkflowSection() {
  const steps = ['Equipamento entra no estoque', 'Equipamento é reservado para o serviço', 'Serviço é agendado', 'Técnico realiza a instalação', 'Equipamento é vinculado ao veículo', 'Veículo entra em monitoramento'];
  return <section id="fluxo" className="marketing-section"><div className="marketing-shell"><SectionHeading kicker="Fluxo operacional" title="Do equipamento ao veículo. Tudo conectado."/><ol className="workflow-list">{steps.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, '0')}</span><strong>{step}</strong>{i < steps.length - 1 && <ArrowDown/>}</li>)}</ol></div></section>;
}

export function EditorialBreak() {
  return <><section className="editorial-break"><div className="marketing-shell"><p>Rastreamento é tecnologia.<br/>Operação também deveria ser.</p></div></section><section className="process-break"><div className="marketing-shell"><p className="marketing-kicker">Processo visível</p><h2>Se sua equipe precisa perguntar no grupo onde está um rastreador, existe um problema de processo.</h2><p>O Monitora360 transforma informações espalhadas em uma operação centralizada.</p></div></section></>;
}

export function BenefitsSection() {
  const items = [['Mais controle', 'Centralize informações que antes estavam espalhadas.'], ['Mais velocidade', 'Encontre equipamentos, veículos e serviços rapidamente.'], ['Menos retrabalho', 'Mantenha histórico e contexto dentro da própria operação.'], ['Mais capacidade de escala', 'Estruture processos antes que o volume aumente.']];
  return <section className="marketing-section"><div className="marketing-shell"><SectionHeading kicker="Impacto operacional" title="Menos ruído entre equipes. Mais contexto para decidir."/><div className="benefits-grid">{items.map((item, i) => <article key={item[0]}><span>{String(i + 1).padStart(2, '0')}</span><h3>{item[0]}</h3><p>{item[1]}</p></article>)}</div></div></section>;
}

const FAQS = [
  ['O Monitora360 substitui meu sistema de rastreamento?', 'O Monitora360 organiza a operação e também oferece recursos de mapa e histórico. A combinação ideal depende da sua estrutura atual e das integrações utilizadas.'],
  ['Posso integrar com minha plataforma atual?', 'O projeto possui integrações com Traccar, K-TAG e Hinova. A compatibilidade e a configuração necessárias são avaliadas durante a demonstração.'],
  ['Funciona para empresas de rastreamento e associações?', 'Sim. A estrutura atende empresas de rastreamento e associações de proteção veicular que precisam coordenar veículos, equipamentos, clientes e serviços.'],
  ['Posso gerenciar mais de uma operação?', 'Sim. A arquitetura é multiempresa e mantém dados, usuários, módulos e identidade visual separados por operação.'],
  ['Consigo controlar equipamentos e chips?', 'Sim. O produto possui cadastro de rastreadores, IMEI, chips/SIM, estoque, status e vínculo com veículos e serviços.'],
  ['Como funciona a implantação?', 'A implantação começa pelo entendimento da operação, configuração do ambiente e validação das integrações necessárias. O cronograma é definido conforme o cenário de cada empresa.'],
];

export function FAQSection() {
  return <section id="faq" className="marketing-section marketing-section--soft"><div className="marketing-shell faq-layout"><SectionHeading light kicker="Perguntas frequentes" title="O que você precisa saber antes da demonstração."/><div className="faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown/></summary><p>{answer}</p></details>)}</div></div></section>;
}
