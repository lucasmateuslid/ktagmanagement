import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Layers,
  MapPin,
  Package,
  Plug,
  Radar,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { OperationMode } from "../pricing";

export function OperationModes({
  mode,
  onModeChange,
}: {
  mode: OperationMode;
  onModeChange: (mode: OperationMode) => void;
}) {
  return (
    <section id="como-funciona" className="sales-section modes-section">
      <div className="sales-shell">
        <div className="section-heading">
          <span className="sales-kicker">02 / FLEXÍVEL COMO SUA OPERAÇÃO</span>
          <h2>
            O sistema que se adapta
            <br />
            <span>ao seu próximo passo.</span>
          </h2>
          <p>
            Já tem uma plataforma? Conecte. Precisa de uma central de
            rastreamento? Comece com o Monitora 360.
          </p>
        </div>
        <div className="mode-grid">
          <button
            type="button"
            className={`mode-card ${mode === "integrated" ? "is-selected" : ""}`}
            aria-pressed={mode === "integrated"}
            onClick={() => onModeChange("integrated")}
          >
            <div className="mode-card__top">
              <Plug size={25} />
              <span>
                {mode === "integrated" ? (
                  <>
                    <Check size={13} /> SELECIONADO
                  </>
                ) : (
                  "MODO 01"
                )}
              </span>
            </div>
            <h3>
              Some inteligência
              <br />
              ao que você já usa.
            </h3>
            <p>
              Integre sua plataforma de rastreamento ao Monitora 360 para
              conectar chips, rastreadores, estoque e ocorrências de roubo.
            </p>
            <div className="mode-flow">
              <span>Seu sistema</span>
              <ArrowRight size={16} />
              <strong>Monitora 360</strong>
            </div>
            <span className="mode-card__footer">
              Quero integrar minha operação <ArrowUpRight size={18} />
            </span>
          </button>
          <button
            type="button"
            className={`mode-card ${mode === "standalone" ? "is-selected" : ""}`}
            aria-pressed={mode === "standalone"}
            onClick={() => onModeChange("standalone")}
          >
            <div className="mode-card__top">
              <Radar size={25} />
              <span>
                {mode === "standalone" ? (
                  <>
                    <Check size={13} /> SELECIONADO
                  </>
                ) : (
                  "MODO 02"
                )}
              </span>
            </div>
            <h3>
              Sua central de rastreamento.
              <br />
              Sua operação completa.
            </h3>
            <p>
              Use o Monitora 360 como seu sistema de rastreamento, com
              localização, histórico e gestão dos ativos no mesmo ambiente.
            </p>
            <div className="mode-flow">
              <span>Seus rastreadores</span>
              <ArrowRight size={16} />
              <strong>Monitora 360</strong>
            </div>
            <span className="mode-card__footer">
              Quero minha central completa <ArrowUpRight size={18} />
            </span>
          </button>
        </div>
        <div className="integration-strip">
          <span>CONEXÕES PARA SUA OPERAÇÃO</span>
          <strong>Traccar</strong>
          <strong>K-TAG</strong>
          <strong>SGA Hinova</strong>
          <strong>Ileva</strong>
          <strong>Siprov</strong>
          <small>Compatibilidade e escopo validados na implantação.</small>
        </div>
      </div>
    </section>
  );
}

export function GrowthSection() {
  const items = [
    {
      icon: WalletCards,
      title: "Revise o custo dos chips.",
      text: "Identifique linhas ociosas e vínculos ausentes para decidir onde reduzir gastos recorrentes.",
    },
    {
      icon: Package,
      title: "Faça seu estoque render.",
      text: "Encontre equipamentos disponíveis e acompanhe seu destino antes de investir em novas compras.",
    },
    {
      icon: ShieldCheck,
      title: "Proteja com mais contexto.",
      text: "Reúna localização, registros de roubo e recuperação para apoiar o trabalho da sua equipe.",
    },
    {
      icon: TrendingUp,
      title: "Abra espaço para crescer.",
      text: "Centralize rotinas e reduza retrabalho para atender uma base maior com uma operação organizada.",
    },
  ];
  return (
    <section className="sales-section growth-section">
      <div className="sales-shell growth-layout">
        <div>
          <span className="sales-kicker">EFICIÊNCIA QUE ABRE CAMINHOS</span>
          <h2>
            Menos desperdício.
            <br />
            Mais fôlego
            <br />
            <span>para expandir.</span>
          </h2>
          <p>Proteger mais começa com usar melhor o que sua empresa já tem.</p>
          <Button asChild className="sales-button">
            <a href="#simulador">
              Encontrar meu plano <ArrowUpRight size={16} />
            </a>
          </Button>
        </div>
        <div className="growth-items">
          {items.map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <span className="growth-index">0{i + 1}</span>
              <Icon size={23} />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  [
    "Preciso abandonar meu sistema de rastreamento?",
    "Não. O Monitora 360 pode funcionar como uma camada de gestão integrada à sua plataforma atual. Você passa a organizar equipamentos, chips, estoque e ocorrências no mesmo fluxo. Conte com integrações com SGA Hinova, Ileva e Siprov. A compatibilidade e o escopo de cada conexão são avaliados com nossa equipe.",
  ],
  [
    "Também posso usar o Monitora 360 para rastrear?",
    "Sim. Você pode usá-lo como sua central de rastreamento, com mapa, localização e histórico, além da gestão operacional. A conexão depende dos modelos, protocolos e serviços compatíveis com seus equipamentos.",
  ],
  [
    "Como o sistema ajuda a reduzir custos?",
    "Ele dá visibilidade sobre chips sem vínculo, equipamentos disponíveis e processos dispersos. Assim, sua equipe consegue revisar linhas ociosas, aproveitar o estoque e reduzir retrabalho. A economia efetiva depende das decisões e do cenário da sua operação.",
  ],
  [
    "O que entra no cálculo do plano?",
    "A simulação considera a quantidade de veículos da sua base, o ciclo de cobrança e a necessidade de recursos avançados ou múltiplas empresas. A base inclui 1.500 veículos. Acima disso, somamos os excedentes de cada faixa: R$ 3,00 do 1.501º ao 3.000º; R$ 2,40 do 3.001º ao 5.000º; R$ 1,80 do 5.001º ao 10.000º; e R$ 1,20 a partir do 10.001º. A tarifa menor não é aplicada retroativamente. O custo médio por veículo divide o total pela frota informada.",
  ],
  [
    "Os planos incluem chips, equipamentos e conectividade?",
    "Os valores apresentados são uma referência para o software. Equipamentos, planos de dados, serviços de terceiros, eventuais custos de implantação e integrações específicas são definidos separadamente na proposta comercial.",
  ],
  [
    "Como funciona a gestão de roubos e recuperações?",
    "Você organiza as ocorrências, os veículos envolvidos, o histórico e o status de recuperação. A plataforma apoia o acompanhamento da equipe; a execução do atendimento e das ações de recuperação continua sob responsabilidade da operação.",
  ],
  [
    "Como começo a usar?",
    "Simule sua base e converse com um especialista. Juntos, alinhamos o plano, validamos integrações e equipamentos e planejamos a implantação. A seleção de um plano nesta página abre uma solicitação comercial, sem cobrança automática.",
  ],
];
export function SalesFAQ() {
  return (
    <section id="faq" className="sales-section faq-section">
      <div className="sales-shell faq-layout">
        <div className="section-heading">
          <span className="sales-kicker">SEM COMPLICAÇÃO</span>
          <h2>
            Vamos esclarecer
            <br />
            <span>o próximo passo.</span>
          </h2>
          <a className="sales-text-link" href="#demonstracao">
            Fale com nossa equipe <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="sales-faq-list">
          {FAQS.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ImplementationSteps() {
  return (
    <section className="implementation-section">
      <div className="sales-shell">
        <span className="sales-kicker">DA CONVERSA À OPERAÇÃO</span>
        <div className="implementation-steps">
          {[
            {
              icon: Layers,
              title: "Entendemos sua base",
              text: "Ativos, sistemas e objetivos.",
            },
            {
              icon: Plug,
              title: "Conectamos sua operação",
              text: "Configuração e integrações validadas.",
            },
            {
              icon: MapPin,
              title: "Você ganha visibilidade",
              text: "Equipe e processos no mesmo fluxo.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <Icon size={21} />
              <h3>{title}</h3>
              <p>{text}</p>
              {i < 2 && <ArrowDown className="step-arrow" size={18} />}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReferenceCompanies() {
  const companies = [
    { initials: "M", name: "Mercosul", category: "Proteção Veicular" },
    { initials: "L", name: "Lock", category: "Proteção Veicular" },
    { initials: "A", name: "Alô", category: "Rastreamento" },
    { initials: "P", name: "Previna", category: "Associação de Benefícios" },
    { initials: "I", name: "Inovar", category: "Associação de Benefícios" },
  ];
  return (
    <section className="references-section" aria-labelledby="references-title">
      <div className="sales-shell">
        <h2 id="references-title">EMPRESAS DE REFERÊNCIA</h2>
        <div className="reference-companies">
          {companies.map((company) => (
            <div key={company.name} className="reference-company">
              <span aria-hidden="true">{company.initials}</span>
              <div>
                <strong>{company.name}</strong>
                <small>{company.category}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
