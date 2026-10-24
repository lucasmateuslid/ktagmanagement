import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";
import { formatPhone, isValidPhone, normalizePhone } from "@ktag/shared";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { WHATSAPP_URL } from "../brand";
import {
  CommercialQuote,
  calculatePlanCost,
  INCLUDED_VEHICLES,
  OperationMode,
  formatCount,
  formatMoney,
  modeLabel,
  PLANS,
} from "../pricing";
type Lead = {
  name: string;
  company: string;
  phone: string;
  email: string;
  vehicles?: string;
};
const initialLead: Lead = { name: "", company: "", phone: "", email: "" };
export function buildWhatsAppLeadUrl(
  lead: Lead,
  quote?: CommercialQuote | null,
  mode?: OperationMode,
) {
  const plan = quote ? PLANS.find((item) => item.id === quote.planId) : null;
  const estimate =
    quote && plan
      ? calculatePlanCost(
          plan.id,
          quote.vehicles ?? INCLUDED_VEHICLES,
          quote.period,
        )
      : null;
  const cents = estimate?.monthlyCents ?? null;
  const message = [
    "Olá! Quero conhecer o Monitora360.",
    "",
    `Nome: ${lead.name.trim()}`,
    `Empresa: ${lead.company.trim()}`,
    `WhatsApp: ${formatPhone(lead.phone)}`,
    `E-mail corporativo: ${lead.email.trim()}`,
    ...(lead.vehicles
      ? [`Quantidade aproximada de veículos: ${lead.vehicles}`]
      : []),
    ...(quote && plan
      ? [
          "",
          `Plano de interesse: ${plan.name}`,
          `Ciclo: ${quote.period === "annual" ? "Anual" : "Mensal"}`,
          `Modo de uso: ${modeLabel(quote.mode)}`,
          ...(quote.vehicles === null
            ? []
            : [`Veículos: ${formatCount(quote.vehicles)}`]),
          ...(estimate && estimate.baseCents !== null
            ? [
                `Mensalidade base (até 1.500 veículos): ${formatMoney(estimate.baseCents)}`,
                ...estimate.tiers.map(
                  (tier) =>
                    `Excedentes: ${formatCount(tier.quantity)} veículos × ${formatMoney(tier.rateCents)} = ${formatMoney(tier.totalCents)}/mês`,
                ),
              ]
            : []),
          `Referência do software: ${cents === null ? "Sob consulta" : `${formatMoney(cents)}/mês${quote.period === "annual" ? ` equivalente; projeção anual de ${formatMoney(cents * 12)} para a mesma frota` : ""}`}`,
        ]
      : mode
        ? [`Modo de uso: ${modeLabel(mode)}`]
        : []),
  ].join("\n");
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}
export default function LeadForm({
  quote,
  mode = "integrated",
}: {
  quote?: CommercialQuote | null;
  mode?: OperationMode;
}) {
  const [lead, setLead] = useState(initialLead);
  const [error, setError] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  useEffect(() => {
    setContactUrl("");
  }, [quote, mode]);
  const update = (field: keyof Lead, value: string) => {
    setLead((current) => ({ ...current, [field]: value }));
    setContactUrl("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !lead.name.trim() ||
      !lead.company.trim() ||
      !isValidPhone(normalizePhone(lead.phone)) ||
      !/^\S+@\S+\.\S+$/.test(lead.email.trim())
    ) {
      setError(
        "Revise os campos. Informe nome, empresa, WhatsApp com DDD e e-mail válido.",
      );
      return;
    }
    setError("");
    const url = buildWhatsAppLeadUrl(
      { ...lead, phone: normalizePhone(lead.phone) },
      quote,
      mode,
    );
    setContactUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const plan = quote ? PLANS.find((item) => item.id === quote.planId) : null;
  return (
    <section id="demonstracao" className="sales-section contact-section">
      <div className="sales-shell contact-grid">
        <div>
          <span className="sales-kicker">PROTEJA MAIS. VÁ MAIS LONGE.</span>
          <h2>
            Seu próximo
            <br />
            capítulo começa
            <br />
            <span>com mais controle.</span>
          </h2>
          <p>
            Conte com o Monitora 360 para organizar sua operação, reduzir
            desperdícios e preparar sua empresa para proteger muito mais.
          </p>
          <div className="contact-benefits">
            <span>
              <Check size={16} /> Demonstração orientada à sua operação
            </span>
            <span>
              <Check size={16} /> Avaliação dos sistemas que você já usa
            </span>
            <span>
              <Check size={16} /> Proposta dimensionada para sua base
            </span>
          </div>
          <a
            className="contact-whatsapp"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={23} />
            <span>
              Prefere uma conversa direta?
              <strong>
                Fale com a equipe pelo WhatsApp <ArrowUpRight size={14} />
              </strong>
            </span>
          </a>
        </div>
        <form className="sales-lead-form" onSubmit={submit}>
          <span className="sales-kicker">VAMOS CONHECER SUA OPERAÇÃO</span>
          <h3>Converse com um especialista.</h3>
          {quote && plan && (
            <div className="lead-selection" role="status">
              <span>SEU INTERESSE</span>
              <strong>
                {plan.name} · {quote.period === "annual" ? "Anual" : "Mensal"}
                {quote.vehicles !== null &&
                  ` · ${formatCount(quote.vehicles)} veículos`}
              </strong>
              <small>{modeLabel(quote.mode)}</small>
            </div>
          )}
          {!quote && (
            <p className="lead-mode">
              {modeLabel(mode)} <a href="#como-funciona">Alterar</a>
            </p>
          )}
          <div className="lead-fields">
            <label htmlFor="lead-name">
              Seu nome
              <Input
                id="lead-name"
                name="name"
                autoComplete="name"
                placeholder="Como podemos chamar você?"
                required
                maxLength={100}
                value={lead.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label htmlFor="lead-company">
              Empresa
              <Input
                id="lead-company"
                name="company"
                autoComplete="organization"
                placeholder="Nome da sua empresa ou associação"
                required
                maxLength={150}
                value={lead.company}
                onChange={(event) => update("company", event.target.value)}
              />
            </label>
            <label htmlFor="lead-phone">
              WhatsApp
              <Input
                id="lead-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                required
                maxLength={20}
                aria-describedby={error ? "lead-error" : undefined}
                value={formatPhone(lead.phone)}
                onChange={(event) => update("phone", event.target.value)}
              />
            </label>
            <label htmlFor="lead-email">
              E-mail corporativo
              <Input
                id="lead-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@empresa.com.br"
                required
                maxLength={180}
                value={lead.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p id="lead-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button className="sales-button" type="submit">
            Quero proteger mais <ArrowUpRight size={18} />
          </Button>
          <small>
            Ao continuar, você abre o WhatsApp com os dados preenchidos para
            falar com a equipe comercial. Nenhuma contratação é realizada aqui.
          </small>
          {contactUrl && (
            <p className="contact-fallback" role="status">
              Conversa preparada.{" "}
              <a href={contactUrl} target="_blank" rel="noopener noreferrer">
                Se o WhatsApp não abriu, continue por aqui.
              </a>
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
