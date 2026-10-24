import { describe, expect, it } from "vitest";
import { buildWhatsAppLeadUrl } from "./LeadForm";
const lead = {
  name: " Lucas ",
  company: "Operação & Proteção",
  phone: "84999999999",
  email: "lucas@example.com",
  vehicles: "De 501 a 2.000",
};
const messageFrom = (url: string) => new URL(url).searchParams.get("text")!;
describe("contato comercial", () => {
  it("preserva o destino e codifica corretamente dados com caracteres especiais", () => {
    const url = buildWhatsAppLeadUrl(lead);
    expect(url).toMatch(/^https:\/\/wa\.me\/558440028922\?text=/);
    expect(messageFrom(url)).toContain("Empresa: Operação & Proteção");
    expect(messageFrom(url)).toContain("Nome: Lucas\n");
    expect(messageFrom(url)).toContain(
      "Quantidade aproximada de veículos: De 501 a 2.000",
    );
    expect(messageFrom(url)).not.toContain("Plano de interesse");
  });
  it("leva plano, base, modo, ciclo e total anual corretos ao comercial", () => {
    const message = messageFrom(
      buildWhatsAppLeadUrl(lead, {
        planId: "pro",
        period: "annual",
        vehicles: 3500,
        mode: "standalone",
      }),
    );
    expect(message).toContain("Plano de interesse: Pro");
    expect(message).toContain("Veículos: 3.500");
    expect(message).toContain("Ciclo: Anual");
    expect(message.replace(/\u00a0/g, " ")).toContain(
      "1.500 veículos × R$ 3,00 = R$ 4.500,00/mês",
    );
    expect(message).toContain("Monitora 360 como sistema de rastreamento");
    expect(message.replace(/\u00a0/g, " ")).toContain(
      "R$ 6.129,90/mês equivalente; projeção anual de R$ 73.558,80",
    );
  });
  it("mantém Enterprise sob consulta e não inventa volume para um clique no plano", () => {
    const message = messageFrom(
      buildWhatsAppLeadUrl(lead, {
        planId: "enterprise",
        period: "monthly",
        vehicles: null,
        mode: "integrated",
      }),
    );
    expect(message).toContain("Referência do software: Sob consulta");
    expect(message).not.toContain("Veículos:");
  });
});
