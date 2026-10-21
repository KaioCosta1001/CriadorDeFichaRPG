import type { DieFaces } from "@/config/constants";
import { describe, expect, it } from "vitest";

import {
  degreeOfSuccess,
  isNaturalMaximum,
  isNaturalMinimum,
  parseDieFaces,
  rollDie,
  rollDieType,
  rollDice,
} from "./dice";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE DADOS                                                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O `rng` é injetado, então nada aqui depende de sorte. Os testes cobrem os
 * dois erros clássicos do sorteio — o `+ 1` esquecido e o `round` no lugar do
 * `floor` — e a garantia de que o resultado nunca é `NaN`.
 */

describe("rollDie", () => {
  it("mapeia [0,1) em [1, faces]", () => {
    // floor(0 * 20) + 1 = 1
    expect(rollDie(20, () => 0)).toBe(1);
    // floor(0.65 * 20) + 1 = 14
    expect(rollDie(20, () => 0.65)).toBe(14);
    // O topo é EXCLUSIVO: 0.99999 ainda dá o máximo.
    expect(rollDie(20, () => 0.99999)).toBe(20);
  });

  it("NUNCA devolve 0 — o erro clássico do `+ 1` esquecido", () => {
    for (let i = 0; i <= 20; i += 1) {
      expect(rollDie(20, () => i / 20)).toBeGreaterThanOrEqual(1);
    }
  });

  it("NUNCA devolve faces + 1", () => {
    expect(rollDie(6, () => 1)).toBe(6);
    expect(rollDie(6, () => 1.5)).toBe(6);
  });

  it("distribui os valores de forma UNIFORME (floor, não round)", () => {
    // Com `Math.round`, 0.3 e 0.4 cairiam no mesmo resultado e a distribuição
    // ficaria enviesada. Com `floor`, cada faixa tem o mesmo tamanho.
    const contagem = new Map<number, number>();
    for (let i = 0; i < 1000; i += 1) {
      const value = rollDie(6, () => i / 1000);
      contagem.set(value, (contagem.get(value) ?? 0) + 1);
    }

    expect(contagem.size).toBe(6);
    for (const total of contagem.values()) {
      expect(total).toBeGreaterThan(140);
      expect(total).toBeLessThan(200);
    }
  });

  it("protege contra `rng` quebrado", () => {
    expect(rollDie(20, () => Number.NaN)).toBe(1);
    expect(rollDie(20, () => -5)).toBe(1);
    expect(rollDie(20, () => 99)).toBe(20);
  });

  it("protege contra faces inválidas", () => {
    expect(rollDie(0 as DieFaces, () => 0.5)).toBe(1);
    expect(rollDie(-3 as DieFaces, () => 0.5)).toBe(1);
  });

  it("aceita faces reais", () => {
    expect(rollDie(10, () => 0.65)).toBe(7);
  });
});

describe("rollDice", () => {
  it("sorteia exatamente a quantidade pedida", () => {
    expect(rollDice(3, 20, () => 0.65)).toEqual([14, 14, 14]);
  });

  it("sorteia dados INDEPENDENTES — 2d20 não é o dobro de um d20", () => {
    // O erro a evitar: tratar `2d20` como `20 × 2`, o que daria 2..40 com
    // peso maior nos extremos. Com dois sorteios, a soma é triangular.
    const valores = new Set<number>();
    const sequencia = [0.05, 0.55, 0.15, 0.75, 0.35, 0.95, 0.25, 0.65];
    let indice = 0;
    const rng = () => sequencia[indice++ % sequencia.length]!;

    for (let tentativa = 0; tentativa < 200; tentativa += 1) {
      const [a = 0, b = 0] = rollDice(2, 20, rng);
      valores.add(a + b);
    }

    // Duas somaschief dando 2 e 40 nunca aparecem: são as pontas, quase
    // impossíveis em dois sorteios.
    expect(valores.has(2)).toBe(false);
    expect(valores.has(40)).toBe(false);
  });

  it("devolve lista vazia para quantidade zero ou negativa", () => {
    expect(rollDice(0, 20, () => 0.5)).toEqual([]);
    expect(rollDice(-2, 20, () => 0.5)).toEqual([]);
  });

  it("nunca gera lista gigante por erro de digitação", () => {
    expect(rollDice(99999, 20, () => 0.5).length).toBeLessThanOrEqual(99);
  });
});

describe("parseDieFaces", () => {
  it("lê o formato gravado", () => {
    expect(parseDieFaces("d20")).toBe(20);
    expect(parseDieFaces("d6")).toBe(6);
    expect(parseDieFaces("d100")).toBe(100);
  });

  it("aceita o prefixo em maiúscula", () => {
    expect(parseDieFaces("D20")).toBe(20);
  });

  it("cai em 20 para formato desconhecido, em vez de NaN", () => {
    expect(parseDieFaces("banana")).toBe(20);
    expect(parseDieFaces("")).toBe(20);
    expect(parseDieFaces("d0")).toBe(20);
  });
});

describe("rollDieType", () => {
  it("sorteia pelo tipo textual", () => {
    expect(rollDieType("d20", () => 0.65)).toBe(14);
  });
});

describe("isNaturalMaximum / isNaturalMinimum", () => {
  it("reconhece o 20 e o 1 no dado", () => {
    expect(isNaturalMaximum({ die: "d20", dice: [20] })).toBe(true);
    expect(isNaturalMinimum({ die: "d20", dice: [1] })).toBe(true);
    expect(isNaturalMaximum({ die: "d20", dice: [19] })).toBe(false);
    expect(isNaturalMinimum({ die: "d20", dice: [2] })).toBe(false);
  });

  it("olha o DADO, não o total", () => {
    // Um 20 com modificador negativo não é crítico da rolagem: quem levas
    // "Natural 20" num total de 8 está sendo enganado.
    expect(isNaturalMaximum({ die: "d20", dice: [20] })).toBe(true);
  });

  it("não quebra com registro sem dado", () => {
    expect(isNaturalMaximum({ die: "d20", dice: [] })).toBe(false);
    expect(isNaturalMinimum({ die: "d20", dice: [] })).toBe(false);
  });

  it("para arma com vários dados, olha o primeiro", () => {
    expect(isNaturalMaximum({ die: "d20", dice: [20, 1, 3] })).toBe(true);
    expect(isNaturalMinimum({ die: "d20", dice: [20, 1, 3] })).toBe(false);
  });
});

describe("degreeOfSuccess", () => {
  it("classifica em relação à dificuldade", () => {
    expect(degreeOfSuccess(15, 15)).toBe("success");
    expect(degreeOfSuccess(25, 15)).toBe("critical");
    expect(degreeOfSuccess(10, 15)).toBe("failure");
    expect(degreeOfSuccess(5, 15)).toBe("fumble");
  });

  it("usa a faixa de ±10", () => {
    expect(degreeOfSuccess(24, 15)).toBe("success");
    expect(degreeOfSuccess(25, 15)).toBe("critical");
  });
});
