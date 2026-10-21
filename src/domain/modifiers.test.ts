import { describe, expect, it } from "vitest";

import {
  calculateAttributeContribution,
  cthulhuAbilityValue,
  dnd5eAbilityModifier,
  oldDragonAbilityModifier,
} from "./modifiers";

/**
 * Ponto em aberto 14.1 — estas travam o COMPORTAMENTO PROVISÓRIO.
 *
 * Quando a regra definitiva sair, é aqui que se ajusta o esperado. As
 * funções em si ficam em `modifiers.ts`, isoladas por sistema.
 */
describe("calculateAttributeContribution", () => {
  describe("D&D 5e — modificador de habilidade", () => {
    const roll = (value: number): number =>
      calculateAttributeContribution("dnd5e", value, "skill");

    it("subtrai 10 e divide por 2, arredondando para baixo", () => {
      expect(roll(1)).toBe(-5);
      expect(roll(8)).toBe(-1);
      expect(roll(9)).toBe(-1);
      expect(roll(10)).toBe(0);
      expect(roll(11)).toBe(0);
      expect(roll(14)).toBe(2);
      expect(roll(16)).toBe(3);
      expect(roll(20)).toBe(5);
    });

    it("arredonda sempre para BAIXO (nunca 0.5)", () => {
      // 13 → 1.5 → deve ser 1, nunca 2
      expect(roll(13)).toBe(1);
      expect(roll(15)).toBe(2);
    });
  });

  describe("Old Dragon", () => {
    it("usa o mesmo cálculo provisório do D&D 5e", () => {
      expect(calculateAttributeContribution("olddragon", 16, "skill")).toBe(3);
      expect(calculateAttributeContribution("olddragon", 8, "skill")).toBe(-1);
    });

    it("é uma função separada, para trocar sem afetar o D&D", () => {
      // Se alguém trocar a regra do Old Dragon, o D&D não deve mudar.
      expect(oldDragonAbilityModifier).not.toBe(dnd5eAbilityModifier);
    });
  });

  describe("Call of Cthulhu", () => {
    it("soma o valor direto", () => {
      expect(calculateAttributeContribution("coc", 50, "skill")).toBe(50);
      expect(calculateAttributeContribution("coc", 65, "skill")).toBe(65);
      expect(calculateAttributeContribution("coc", 0, "skill")).toBe(0);
    });

    it("mantém percentuais altos (diferente do modificador do D&D)", () => {
      // 75 no CoC vale +75; no D&D vira modificador 32 (floor de 32.5).
      expect(cthulhuAbilityValue(75, { systemId: "coc", kind: "skill" })).toBe(
        75,
      );
      expect(
        dnd5eAbilityModifier(75, { systemId: "dnd5e", kind: "skill" }),
      ).toBe(32);
    });
  });

  describe("robustez", () => {
    it("nunca devolve NaN nem Infinity", () => {
      for (const value of [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      ]) {
        const result = calculateAttributeContribution("dnd5e", value, "skill");
        expect(Number.isFinite(result)).toBe(true);
      }
    });

    it("arredonda para inteiro (o detalhamento mostra +3, nunca +3.4)", () => {
      for (const system of ["dnd5e", "olddragon", "coc"] as const) {
        const result = calculateAttributeContribution(system, 63, "weapon");
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it("usa o mesmo cálculo para arma e perícia (por enquanto)", () => {
      expect(calculateAttributeContribution("dnd5e", 16, "weapon")).toBe(
        calculateAttributeContribution("dnd5e", 16, "skill"),
      );
    });
  });
});
