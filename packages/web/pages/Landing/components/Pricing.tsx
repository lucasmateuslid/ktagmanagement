import { ArrowUpRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  BillingPeriod,
  CommercialQuote,
  formatCount,
  formatMoney,
  OperationMode,
  PLANS,
  INCLUDED_VEHICLES,
  EXCESS_TIERS,
  tierLabel,
} from "../pricing";

export function PeriodSelector({
  period,
  onChange,
  label,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  label: string;
}) {
  return (
    <div className="period-selector" role="group" aria-label={label}>
      <button
        type="button"
        aria-pressed={period === "monthly"}
        onClick={() => onChange("monthly")}
      >
        Mensal
      </button>
      <button
        type="button"
        aria-pressed={period === "annual"}
        onClick={() => onChange("annual")}
      >
        Anual <span>Economize</span>
      </button>
    </div>
  );
}
export default function Pricing({
  period,
  onPeriodChange,
  mode,
  onSelect,
}: {
  period: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
  mode: OperationMode;
  onSelect: (quote: CommercialQuote) => void;
}) {
  return (
    <section id="planos" className="sales-section pricing-section">
      <div className="sales-shell">
        <div className="pricing-heading">
          <div className="section-heading">
            <span className="sales-kicker">04 / SEU PRÓXIMO NÍVEL</span>
            <h2>
              Um plano para cada
              <br />
              <span>momento da sua empresa.</span>
            </h2>
            <p>Comece com controle. Cresça com estrutura.</p>
          </div>
          <PeriodSelector
            period={period}
            onChange={onPeriodChange}
            label="Ciclo de cobrança dos planos"
          />
        </div>
        <div className="plans-grid">
          {PLANS.map((plan) => {
            const monthly =
              period === "annual" ? plan.annualMonthlyCents : plan.monthlyCents;
            return (
              <article
                key={plan.id}
                className={`plan-card ${plan.id === "pro" ? "plan-card--featured" : ""}`}
              >
                {plan.id === "pro" && (
                  <div className="plan-ribbon">
                    <Sparkles size={13} /> PARA EXPANDIR SUA OPERAÇÃO
                  </div>
                )}
                <span className="plan-label">{plan.label}</span>
                <h3>{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
                <span className="plan-base-label">
                  {monthly !== null
                    ? "MENSALIDADE BASE"
                    : "PROPOSTA PERSONALIZADA"}
                </span>
                <div className="plan-price">
                  {monthly === null ? (
                    <strong className="plan-price--custom">Sob consulta</strong>
                  ) : (
                    <>
                      <strong>{formatMoney(monthly)}</strong>
                      <span>/mês</span>
                    </>
                  )}
                </div>
                <p className="plan-billing">
                  {monthly === null
                    ? "Condições para o seu cenário."
                    : period === "annual"
                      ? `${formatMoney(monthly * 12)} cobrados por ano.`
                      : "Cobrança mensal."}
                </p>
                <div className="plan-capacity">
                  <ShieldCheck size={17} />
                  {plan.id === "enterprise"
                    ? "Capacidade sob medida"
                    : `${formatCount(INCLUDED_VEHICLES)} veículos incluídos`}
                </div>
                <Button
                  asChild
                  className={`sales-button ${plan.id === "pro" ? "" : "sales-button--outline"}`}
                >
                  <a
                    href="#demonstracao"
                    onClick={() =>
                      onSelect({
                        planId: plan.id,
                        period,
                        vehicles: null,
                        mode,
                      })
                    }
                  >
                    {plan.id === "enterprise"
                      ? "Montar minha proposta"
                      : `Quero o ${plan.name}`}
                    <ArrowUpRight size={16} />
                  </a>
                </Button>
                <p className="plan-overage">
                  {plan.id === "enterprise"
                    ? "Volume e tarifas definidos na proposta."
                    : "Acima de 1.500: adicionais progressivos de R$ 3,00 a R$ 1,20 por veículo/mês."}
                </p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {period === "annual" &&
                  monthly !== null &&
                  plan.monthlyCents !== null && (
                    <p className="plan-saving">
                      Economize{" "}
                      {formatMoney((plan.monthlyCents - monthly) * 12)} por ano.
                    </p>
                  )}
              </article>
            );
          })}
        </div>
        <div className="pricing-tiers">
          <h3>Sua frota cresce. O adicional por veículo diminui.</h3>
          <p>
            Apenas os veículos acima de 1.500 geram adicionais, calculados por
            faixa.
          </p>
          <div>
            {EXCESS_TIERS.map((tier) => (
              <article key={tier.from}>
                <span>{tierLabel(tier)} veículo</span>
                <strong>
                  {formatMoney(tier.rateCents)}
                  <small>/veículo por mês</small>
                </strong>
              </article>
            ))}
          </div>
        </div>
        <p className="pricing-note">
          Mensalidades base para até 1.500 veículos. Excedentes cobrados por
          faixas progressivas. O desconto anual se aplica à mensalidade base; as
          tarifas dos excedentes são as mesmas. Implantação, integrações e
          serviços de terceiros são alinhados na proposta. A contratação é
          confirmada com nossa equipe.
        </p>
      </div>
    </section>
  );
}
