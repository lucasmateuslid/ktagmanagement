// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import Landing from "../Landing";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("fluxo comercial da landing", () => {
  it("recomenda, sincroniza ciclos e leva a simulação ao formulário", () => {
    render(<Landing />);
    const quantity = screen.getByLabelText("Quantos veículos você gerencia?");
    fireEvent.change(quantity, { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Gestão avançada/ }));
    const billing = screen.getByRole("group", {
      name: "Ciclo de cobrança da simulação",
    });
    fireEvent.click(within(billing).getByRole("button", { name: /Anual/ }));
    const plansBilling = screen.getByRole("group", {
      name: "Ciclo de cobrança dos planos",
    });
    expect(
      within(plansBilling)
        .getByRole("button", { name: /Anual/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("link", { name: "Receber proposta deste plano" }),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Pro · Anual · 3.500 veículos",
    );
    fireEvent.change(quantity, { target: { value: "" } });
    expect(
      screen.queryByRole("link", { name: "Receber proposta deste plano" }),
    ).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "quantidade inteira",
    );
  });
  it("alterna a visualização de chips e gerencia menu mobile com Escape", () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole("button", { name: "Chips" }));
    expect(screen.getByRole("table").textContent).toContain("Ocioso");
    expect(
      screen.getByText("Menos linhas esquecidas. Mais controle."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(
      screen.getByRole("navigation", { name: "Navegação mobile" }),
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("navigation", { name: "Navegação mobile" }),
    ).toBeNull();
  });
  it("valida o telefone antes de preparar o WhatsApp, sem transmissão no teste", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { container } = render(<Landing />);
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: "Pessoa Teste" },
    });
    fireEvent.change(screen.getByLabelText("Empresa"), {
      target: { value: "Empresa Teste" },
    });
    fireEvent.change(screen.getByLabelText("E-mail corporativo"), {
      target: { value: "teste@example.com" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "123" },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(open).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "84999999999" },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/558440028922?text="),
      "_blank",
      "noopener,noreferrer",
    );
    expect(
      screen.getByRole("link", { name: /Se o WhatsApp não abriu/ }),
    ).toBeTruthy();
  });
});
