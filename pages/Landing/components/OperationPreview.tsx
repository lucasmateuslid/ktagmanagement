import { useState } from "react";
import {
  ArrowUpRight,
  Car,
  Check,
  Crosshair,
  LayoutDashboard,
  MapPin,
  Package,
  Radio,
  ShieldCheck,
  Signal,
  WalletCards,
} from "lucide-react";
const VIEWS = [
  {
    id: "tracking",
    label: "Localização",
    icon: MapPin,
    title: "Sua base. No seu campo de visão.",
    text: "Consulte a posição, o status e o histórico dos veículos em um só lugar.",
  },
  {
    id: "inventory",
    label: "Estoque",
    icon: Package,
    title: "Cada rastreador no lugar certo.",
    text: "Acompanhe IMEI, disponibilidade e vínculo. Aproveite o que já está no estoque antes de comprar mais.",
  },
  {
    id: "chips",
    label: "Chips",
    icon: WalletCards,
    title: "Menos linhas esquecidas. Mais controle.",
    text: "Cruze chips, operadoras e equipamentos para identificar linhas ociosas que merecem revisão.",
  },
  {
    id: "security",
    label: "Ocorrências",
    icon: ShieldCheck,
    title: "Contexto para agir na hora certa.",
    text: "Centralize registros de roubo, veículo envolvido e acompanhamento da recuperação.",
  },
] as const;
type View = (typeof VIEWS)[number]["id"];
function MapIllustration({ security = false }: { security?: boolean }) {
  return (
    <div className="operation-map">
      <svg
        viewBox="0 0 650 310"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect width="650" height="310" className="map-base" />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} transform={`translate(${i * 92 - 30} -20) rotate(-20)`}>
            {Array.from({ length: 7 }, (_, j) => (
              <rect
                key={j}
                x="5"
                y={j * 70}
                width="76"
                height="56"
                rx="5"
                fill="currentColor"
                fillOpacity=".035"
                stroke="currentColor"
                strokeOpacity=".07"
              />
            ))}
          </g>
        ))}
        <path
          d="M475 -30C415 40 550 100 470 155S420 275 540 345"
          stroke="#60a5fa"
          strokeOpacity=".09"
          strokeWidth="48"
        />
        <path
          d="M-30 240 240 140 400 140 590 65 690 65M130 -20 250 315M-30 85 200 85 390 315"
          stroke="currentColor"
          strokeOpacity=".12"
          strokeWidth="10"
        />
        <path
          d="M130 221 242 178 310 178 345 136 412 136 455 119"
          stroke="var(--accent)"
          strokeOpacity=".16"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M130 221 242 178 310 178 345 136 412 136 455 119"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeDasharray={security ? "6 5" : undefined}
          strokeLinecap="round"
        />
        <circle cx="130" cy="221" r="6" fill="var(--accent)" />
        <circle
          cx="455"
          cy="119"
          r="25"
          fill="var(--accent)"
          fillOpacity=".12"
        />
        <circle cx="455" cy="119" r="14" fill="var(--accent)" />
        <path d="m450 123 5-10 5 10-5-3-5 3Z" fill="#18181b" />
        <circle cx="214" cy="64" r="7" fill="#34d399" />
        <circle cx="364" cy="256" r="7" fill="#34d399" />
        <text
          x="38"
          y="50"
          fill="currentColor"
          opacity=".4"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          letterSpacing="2"
        >
          CENTRO
        </text>
        <text
          x="480"
          y="261"
          fill="currentColor"
          opacity=".4"
          fontSize="10"
          fontFamily="Inter, sans-serif"
          letterSpacing="2"
        >
          ZONA SUL
        </text>
      </svg>
      <span className="map-status">
        <span />
        {security ? "Ocorrência em acompanhamento" : "Posições da operação"}
      </span>
      <div className="map-vehicle">
        <span className="map-vehicle__icon">
          {security ? <ShieldCheck size={18} /> : <Car size={18} />}
        </span>
        <div>
          <strong>{security ? "Ocorrência #024" : "Veículo #024"}</strong>
          <span>
            {security
              ? "Registro e histórico reunidos"
              : "Em movimento · 42 km/h"}
          </span>
        </div>
        <Signal size={16} />
      </div>
      <span className="map-crosshair" aria-hidden="true">
        <Crosshair size={17} />
      </span>
    </div>
  );
}
function InventoryIllustration({ chips }: { chips: boolean }) {
  const rows = chips
    ? [
        ["•••• 1048", "Vivo", "Veículo #024", "Vinculado"],
        ["•••• 2081", "Claro", "Sem equipamento", "Ocioso"],
        ["•••• 3502", "TIM", "Veículo #018", "Vinculado"],
        ["•••• 4710", "Vivo", "Estoque central", "Disponível"],
      ]
    : [
        ["•••• 8104", "GT06", "Veículo #024", "Instalado"],
        ["•••• 8287", "ST-901", "Estoque central", "Disponível"],
        ["•••• 8412", "GT06", "Serviço #108", "Reservado"],
        ["•••• 8509", "ST-901", "Estoque central", "Disponível"],
      ];
  return (
    <div className="operation-inventory">
      <div className="inventory-heading">
        <span>{chips ? "Linhas e chips" : "Rastreadores e estoque"}</span>
        <span>Por vínculo e status</span>
      </div>
      <table>
        <caption className="sr-only">
          Exemplo ilustrativo de {chips ? "chips" : "estoque"}
        </caption>
        <thead>
          <tr>
            {[
              chips ? "ICCID" : "IMEI",
              chips ? "Operadora" : "Modelo",
              "Vínculo",
              "Status",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={i}>
                  {i === 3 ? (
                    <span
                      className={`inventory-state ${cell === "Ocioso" || cell === "Reservado" ? "inventory-state--review" : ""}`}
                    >
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Check size={14} />
        {chips
          ? "Identifique linhas sem vínculo para revisar seus custos."
          : "Consulte a disponibilidade antes da próxima compra."}
      </p>
    </div>
  );
}
export function OperationWindow({ view = "tracking" }: { view?: View }) {
  const metrics =
    view === "inventory"
      ? [
          ["Rastreadores", "1.250"],
          ["Disponíveis", "186"],
          ["Reservados", "24"],
        ]
      : view === "chips"
        ? [
            ["Chips cadastrados", "1.250"],
            ["Vinculados", "1.208"],
            ["Para revisar", "42"],
          ]
        : view === "security"
          ? [
              ["Em acompanhamento", "03"],
              ["Recuperados", "12"],
              ["Registros", "15"],
            ]
          : [
              ["Veículos na base", "1.250"],
              ["Comunicando", "1.208"],
              ["Em atenção", "42"],
            ];
  return (
    <div className="operation-window">
      <div className="operation-topbar">
        <div>
          <img src="/brand/logo-mark.svg" alt="" width="22" height="22" />
          <strong>
            monitora<span>360</span>
          </strong>
        </div>
        <span>
          <i /> CENTRAL DE OPERAÇÕES
        </span>
        <span className="operation-avatar">OP</span>
      </div>
      <div className="operation-body">
        <aside aria-hidden="true">
          <LayoutDashboard />
          <MapPin className={view === "tracking" ? "active" : ""} />
          <Package className={view === "inventory" ? "active" : ""} />
          <WalletCards className={view === "chips" ? "active" : ""} />
          <ShieldCheck className={view === "security" ? "active" : ""} />
        </aside>
        <div className="operation-main">
          <div className="operation-title">
            <div>
              <span>VISÃO GERAL</span>
              <h3>
                {view === "tracking"
                  ? "Tudo no seu radar."
                  : VIEWS.find((item) => item.id === view)?.label}
              </h3>
            </div>
            <span className="operation-period">
              Hoje <Radio size={12} />
            </span>
          </div>
          <div className="operation-metrics">
            {metrics.map(([label, value], i) => (
              <div key={label} className={i === 0 ? "primary" : ""}>
                <span>{label}</span>
                <strong>
                  {value}
                  <ArrowUpRight size={15} />
                </strong>
              </div>
            ))}
          </div>
          {view === "tracking" || view === "security" ? (
            <MapIllustration security={view === "security"} />
          ) : (
            <InventoryIllustration chips={view === "chips"} />
          )}
          <div className="operation-caption">
            <span>
              <i /> Visão simplificada do produto
            </span>
            <span>Dados ilustrativos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function OperationPreview() {
  const [view, setView] = useState<View>("tracking");
  const selected = VIEWS.find((item) => item.id === view)!;
  return (
    <section id="produto" className="sales-section product-section">
      <div className="sales-shell">
        <div className="section-heading">
          <span className="sales-kicker">01 / VISIBILIDADE PARA PROTEGER</span>
          <h2>
            Enxergue mais.
            <br />
            <span>Cuide melhor de cada ativo.</span>
          </h2>
          <p>
            Do ponto no mapa ao chip dentro do rastreador. Entenda o que está
            ativo, o que está parado e o que precisa da sua atenção.
          </p>
        </div>
        <div className="product-explorer">
          <div className="product-explorer__copy">
            <div
              className="product-options"
              aria-label="Escolha uma visualização"
            >
              {VIEWS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  aria-controls="operation-preview-panel"
                  onClick={() => setView(id)}
                >
                  <Icon size={18} />
                  {label}
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <div className="product-explorer__description" aria-live="polite">
              <h3>{selected.title}</h3>
              <p>{selected.text}</p>
            </div>
          </div>
          <div id="operation-preview-panel">
            <OperationWindow view={view} />
          </div>
        </div>
      </div>
    </section>
  );
}
