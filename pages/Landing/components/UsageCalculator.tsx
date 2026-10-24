import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Info,
  Layers,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  BillingPeriod,
  CommercialQuote,
  estimateUsage,
  EXCESS_TIERS,
  INCLUDED_VEHICLES,
  MAX_SIMULATED_VEHICLES,
  tierLabel,
  formatCount,
  formatMoney,
  modeLabel,
  OperationMode,
} from "../pricing";
import { PeriodSelector } from "./Pricing";
export default function UsageCalculator({
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
  const [quantity, setQuantity] = useState("1000");
  const [advanced, setAdvanced] = useState(false);
  const [multiCompany, setMultiCompany] = useState(false);
  const vehicles = Number(quantity);
  const estimate = estimateUsage(vehicles, period, advanced, multiCompany);
  const adjust = (delta: number) =>
    setQuantity(
      String(
        Math.max(
          1,
          Math.min(
            MAX_SIMULATED_VEHICLES,
            (Number.isFinite(vehicles) ? vehicles : 0) + delta,
          ),
        ),
      ),
    );
  const valid = estimate !== null && vehicles <= MAX_SIMULATED_VEHICLES;
  return (
    <section id="simulador" className="sales-section calculator-section">
      <div className="sales-shell">
        <div className="section-heading">
          <span className="sales-kicker">
            03 / CRESCIMENTO QUE CABE NA CONTA
          </span>
          <h2>
            Sua base. Seu plano.
            <br />
            <span>Seu próximo passo.</span>
          </h2>
          <p>
            Descubra a capacidade ideal e o investimento em software por veículo
            da sua operação.
          </p>
        </div>
        <div className="calculator-grid">
          <div className="calculator-controls">
            <div className="calculator-label">
              <label htmlFor="vehicle-quantity">
                Quantos veículos você gerencia?
              </label>
              <span>01</span>
            </div>
            <p className="field-hint" id="quantity-help">
              A mensalidade inclui até 1.500 veículos. Chips e rastreadores
              vinculados não são contados novamente.
            </p>
            <div className="quantity-input">
              <button
                type="button"
                aria-label="Diminuir 100 veículos"
                onClick={() => adjust(-100)}
                disabled={vehicles <= 1}
              >
                <Minus size={18} />
              </button>
              <Input
                id="vehicle-quantity"
                type="number"
                min="1"
                max={MAX_SIMULATED_VEHICLES}
                step="1"
                inputMode="numeric"
                value={quantity}
                aria-describedby="quantity-help quantity-error"
                aria-invalid={!valid}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <span>veículos</span>
              <button
                type="button"
                aria-label="Adicionar 100 veículos"
                onClick={() => adjust(100)}
                disabled={vehicles >= MAX_SIMULATED_VEHICLES}
              >
                <Plus size={18} />
              </button>
            </div>
            <input
              aria-label="Quantidade de veículos no simulador"
              type="range"
              min="1"
              max="10000"
              step="1"
              value={Math.min(10000, Math.max(1, vehicles || 1))}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <div className="range-labels">
              <span>1 veículo</span>
              <span>5.000</span>
              <span>10.000+</span>
            </div>
            <p
              id="quantity-error"
              className="quantity-error"
              role={valid ? undefined : "alert"}
            >
              {!valid
                ? "Informe uma quantidade inteira entre 1 e 1.000.000."
                : "\u00a0"}
            </p>
            <details className="tier-guide">
              <summary>Como funciona o adicional por veículo?</summary>
              <p>
                Até 1.500 veículos estão incluídos. Apenas o excedente é
                cobrado, faixa a faixa:
              </p>
              <ul>
                {EXCESS_TIERS.map((tier) => (
                  <li key={tier.from}>
                    <span>{tierLabel(tier)} veículo</span>
                    <strong>{formatMoney(tier.rateCents)}/mês</strong>
                  </li>
                ))}
              </ul>
              <small>
                A tarifa de cada faixa vale só para os veículos dentro dela.
              </small>
            </details>
            <div className="calculator-label">
              <span>O que sua operação precisa?</span>
              <span>02</span>
            </div>
            <label className="calculator-option" htmlFor="advanced-features">
              <input
                id="advanced-features"
                type="checkbox"
                checked={advanced}
                onChange={(event) => setAdvanced(event.target.checked)}
              />
              <span>
                Gestão avançada e integrações
                <small>
                  Estoque, chips, ocorrências e sistemas conectados.
                </small>
              </span>
              <Layers size={18} />
            </label>
            <label className="calculator-option" htmlFor="multiple-companies">
              <input
                id="multiple-companies"
                type="checkbox"
                checked={multiCompany}
                onChange={(event) => setMultiCompany(event.target.checked)}
              />
              <span>
                Gerenciar múltiplas empresas
                <small>Uma estrutura preparada para várias operações.</small>
              </span>
            </label>
            <div className="calculator-cycle">
              <span>Ciclo de cobrança</span>
              <PeriodSelector
                period={period}
                onChange={onPeriodChange}
                label="Ciclo de cobrança da simulação"
              />
            </div>
            <p className="calculator-mode">
              <Check size={14} />
              {modeLabel(mode)} <a href="#como-funciona">Alterar</a>
            </p>
          </div>
          <div
            className="calculator-result"
            aria-live="polite"
            aria-atomic="true"
          >
            {valid && estimate ? (
              <>
                <span className="result-kicker">
                  <Sparkles size={16} /> SEU PLANO RECOMENDADO
                </span>
                <div className="result-title">
                  <h3>{estimate.plan.name}</h3>
                  <span>
                    {estimate.plan.id === "enterprise"
                      ? "SOB MEDIDA"
                      : `BASE: ${formatCount(INCLUDED_VEHICLES)} VEÍCULOS`}
                  </span>
                </div>
                <p>{estimate.plan.description}</p>
                <div className="result-price">
                  {estimate.monthlyCents === null ? (
                    <strong>Vamos conversar.</strong>
                  ) : (
                    <>
                      <strong>{formatMoney(estimate.monthlyCents)}</strong>
                      <span>
                        /mês{period === "annual" ? " equivalente" : ""}
                      </span>
                    </>
                  )}
                </div>
                <p className="result-billing">
                  {estimate.monthlyCents === null
                    ? "Uma proposta dimensionada para sua base."
                    : period === "annual"
                      ? `${formatMoney(estimate.annualTotalCents!)} por ano, mantendo esta frota.`
                      : "Mensalidade base + excedentes por faixa."}
                </p>
                <div className="result-details">
                  {estimate.baseCents !== null && (
                    <div>
                      <span>Base · até 1.500 veículos</span>
                      <strong>{formatMoney(estimate.baseCents)}</strong>
                    </div>
                  )}
                  {estimate.excessCents !== null && (
                    <div>
                      <span>
                        Adicional · {formatCount(estimate.excessVehicles)}{" "}
                        excedentes
                      </span>
                      <strong>{formatMoney(estimate.excessCents)}</strong>
                    </div>
                  )}
                  <div>
                    <span>Sua base</span>
                    <strong>{formatCount(vehicles)} veículos</strong>
                  </div>
                  <div>
                    <span>Custo médio por veículo / mês</span>
                    <strong>
                      {estimate.perVehicleCents === null
                        ? "Sob consulta"
                        : formatMoney(estimate.perVehicleCents)}
                    </strong>
                  </div>
                  {estimate.monthlyCents !== null &&
                    vehicles <= INCLUDED_VEHICLES && (
                      <>
                        <div>
                          <span>Disponíveis na mensalidade base</span>
                          <strong>
                            +{formatCount(estimate.includedRemaining)} veículos
                          </strong>
                        </div>
                        <div
                          className="capacity-bar"
                          role="meter"
                          aria-label="Franquia de veículos utilizada"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(estimate.includedPercent!)}
                        >
                          <span
                            style={{ width: `${estimate.includedPercent}%` }}
                          />
                        </div>
                      </>
                    )}
                </div>
                {estimate.tiers.length > 0 && (
                  <details className="result-tiers" open>
                    <summary>Composição do adicional mensal</summary>
                    {estimate.tiers.map((tier) => (
                      <div key={tier.from}>
                        <span>
                          {formatCount(tier.quantity)} ×{" "}
                          {formatMoney(tier.rateCents)}
                          <small>{tierLabel(tier)} veículo</small>
                        </span>
                        <strong>{formatMoney(tier.totalCents)}</strong>
                      </div>
                    ))}
                  </details>
                )}
                {period === "annual" && estimate.savingsCents !== null && (
                  <p className="result-saving">
                    <Check size={14} />
                    {formatMoney(estimate.savingsCents)} a menos por ano na
                    mensalidade base.
                  </p>
                )}
                <Button asChild className="sales-button">
                  <a
                    href="#demonstracao"
                    onClick={() =>
                      onSelect({
                        planId: estimate.plan.id,
                        period,
                        vehicles,
                        mode,
                      })
                    }
                  >
                    Receber proposta deste plano <ArrowUpRight size={17} />
                  </a>
                </Button>
                <small>
                  <Info size={13} /> Estimativa para a frota informada. O
                  desconto anual vale para a base. Chips, equipamentos e
                  serviços adicionais são cotados separadamente.
                </small>
              </>
            ) : (
              <div className="calculator-empty">
                <Info size={30} />
                <h3>Vamos dimensionar sua operação.</h3>
                <p>
                  Informe uma quantidade válida para visualizar a recomendação e
                  o investimento.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
