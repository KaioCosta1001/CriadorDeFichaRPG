import { describe, expect, it } from "vitest";

import { STAT_VALUE_MAX, STAT_VALUE_MIN } from "@/config/constants";

import { clampStat, formatSigned, parseStatValue } from "./stats";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NÚMEROS DE ATRIBUTO E PERÍCIA                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A regra que estes testes defendem: texto digitado pelo usuário vira um
 * número CORRETO ou o valor anterior — nunca um `0` inventado e nunca um
 * `NaN` que quebra a rolagem.
 */

describe("parseStatValue", () => {
  it("aceita número simples", () => {
    expect(parseStatValue("16", 10)).toBe(16);
    expect(parseStatValue("0", 10)).toBe(0);
    expect(parseStatValue("-3", 10)).toBe(-3);
  });

  it("aceita sinal explícito, que teclado numérico em celular não dá", () => {
    expect(parseStatValue("+3", 10)).toBe(3);
    expect(parseStatValue("+0", 10)).toBe(0);
  });

  it("ignora espaços em volta", () => {
    expect(parseStatValue("  7 ", 10)).toBe(7);
  });

  it("trunca decimal — o schema é inteiro", () => {
    // O teclado numérico de celular oferece "."; recusar "12.9" faria o
    // campo voltar ao valor antigo sem explicação.
    expect(parseStatValue("12.9", 10)).toBe(12);
    expect(parseStatValue("-3.7", 10)).toBe(-3);
    expect(parseStatValue("+0.4", 10)).toBe(0);
  });

  it("recusa notação científica — é erro de digitação, não intenção", () => {
    expect(parseStatValue("1e5", 12)).toBe(12);
    expect(parseStatValue("1E5", 12)).toBe(12);
  });

  it("LIMITA em vez de rejeitar", () => {
    // `boundedInt` reprovaria 99999 e o `mutate` devolveria `false` sem
    // aplicar nada: o usuário digita e o app parece travado. Aqui ele vê 999
    // no campo — o limite é visível.
    expect(parseStatValue("99999", 10)).toBe(STAT_VALUE_MAX);
    expect(parseStatValue("-99999", 10)).toBe(STAT_VALUE_MIN);
  });

  it("mantém texto que NÃO é número no valor anterior, sem virar 0", () => {
    expect(parseStatValue("abc", 12)).toBe(12);
    expect(parseStatValue("1e5", 12)).toBe(12);
    expect(parseStatValue("--3", 12)).toBe(12);
    expect(parseStatValue("NaN", 12)).toBe(12);
  });

  it("campo vazio volta ao valor anterior", () => {
    // Um "0" aparecer aqui seria pior que nada: o usuário acharia que a
    // perícia vale zero e jogaria com a ficha errada.
    expect(parseStatValue("", 12)).toBe(12);
    expect(parseStatValue("   ", 12)).toBe(12);
  });

  it("o fallback também é limitado — uma ficha importada com 99999 não propaga", () => {
    expect(parseStatValue("", 99999)).toBe(STAT_VALUE_MAX);
    expect(parseStatValue("abc", -99999)).toBe(STAT_VALUE_MIN);
  });

  it("nunca devolve NaN nem Infinity", () => {
    for (const raw of [
      "abc",
      "",
      "1e999",
      "-1e999",
      "9999999999999999999999",
    ]) {
      const result = parseStatValue(raw, 10);
      expect(Number.isFinite(result)).toBe(true);
    }
  });
});

describe("clampStat", () => {
  it("mantém valores dentro da faixa", () => {
    expect(clampStat(0)).toBe(0);
    expect(clampStat(STAT_VALUE_MAX)).toBe(STAT_VALUE_MAX);
  });

  it("trunca para inteiro", () => {
    expect(clampStat(3.7)).toBe(3);
    expect(clampStat(-3.7)).toBe(-3);
  });

  it("não propaga NaN nem Infinity", () => {
    expect(clampStat(Number.NaN)).toBe(0);
    expect(clampStat(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampStat(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("formatSigned", () => {
  it("sinal explícito para o bônus", () => {
    expect(formatSigned(3)).toBe("+3");
    expect(formatSigned(-2)).toBe("−2");
  });

  it("zero NÃO vira '+0'", () => {
    // "+0" sugere um bônus que existe e é nulo; "0" diz a verdade.
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(-0)).toBe("0");
  });

  it("arredonda antes de formatar", () => {
    expect(formatSigned(2.4)).toBe("+2");
    expect(formatSigned(2.6)).toBe("+3");
  });

  it("usa o sinal de menos tipográfico, legível em Cinzel", () => {
    expect(formatSigned(-1)).not.toContain("-");
  });

  it("nunca devolve NaN", () => {
    expect(formatSigned(Number.NaN)).toBe("0");
  });
});
