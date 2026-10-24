import { describe, expect, it } from "vitest";
import { calculatePlanCost, estimateUsage } from "./pricing";
describe("mensalidade base e excedentes progressivos", () => {
  it.each([
    [1, 0],
    [1500, 0],
    [1501, 300],
    [3000, 450000],
    [3001, 450240],
    [5000, 930000],
    [5001, 930180],
    [10000, 1830000],
    [10001, 1830120],
    [11000, 1950000],
  ])(
    "cobra corretamente nas fronteiras: %i veículos",
    (vehicles, excessCents) => {
      const result = calculatePlanCost("basic", vehicles, "monthly")!;
      expect(result.excessCents).toBe(excessCents);
      expect(result.monthlyCents).toBe(38990 + excessCents);
      expect(
        result.tiers.reduce((total, tier) => total + tier.quantity, 0),
      ).toBe(Math.max(0, vehicles - 1500));
    },
  );
  it("mantém os recursos independentes do volume e negocia Enterprise", () => {
    expect(estimateUsage(11000, "monthly")?.plan.id).toBe("basic");
    expect(estimateUsage(100, "monthly", true)?.plan.id).toBe("pro");
    expect(estimateUsage(100, "monthly", false, true)).toMatchObject({
      plan: { id: "enterprise" },
      baseCents: null,
      excessCents: null,
      monthlyCents: null,
      annualTotalCents: null,
      perVehicleCents: null,
      tiers: [],
    });
  });
  it.each([0, -1, NaN, Infinity, 1.5, 1000001])(
    "rejeita quantidade inválida: %s",
    (quantity) => {
      expect(estimateUsage(quantity, "monthly")).toBeNull();
    },
  );
  it("calcula cada faixa uma vez, sem aplicar a tarifa menor a toda a frota", () => {
    const result = calculatePlanCost("pro", 3500, "monthly")!;
    expect(
      result.tiers.map((tier) => [
        tier.quantity,
        tier.rateCents,
        tier.totalCents,
      ]),
    ).toEqual([
      [1500, 300, 450000],
      [500, 240, 120000],
    ]);
    expect(result.monthlyCents).toBe(623990);
    expect(result.perVehicleCents).toBe(178);
  });
  it("aplica o desconto anual apenas na base e mantém as tarifas do excedente", () => {
    const annual = calculatePlanCost("pro", 3500, "annual")!;
    expect(annual).toMatchObject({
      baseCents: 42990,
      excessCents: 570000,
      monthlyCents: 612990,
      annualTotalCents: 7355880,
      savingsCents: 132000,
    });
    expect(calculatePlanCost("basic", 1500, "annual")).toMatchObject({
      monthlyCents: 29990,
      annualTotalCents: 359880,
      savingsCents: 108000,
      excessVehicles: 0,
    });
  });
  it("nunca reduz a conta ao cruzar uma faixa de volume", () => {
    for (const [boundary, increment] of [
      [1500, 300],
      [3000, 240],
      [5000, 180],
      [10000, 120],
    ]) {
      expect(
        calculatePlanCost("basic", boundary + 1, "monthly")!.monthlyCents! -
          calculatePlanCost("basic", boundary, "monthly")!.monthlyCents!,
      ).toBe(increment);
    }
  });
});
