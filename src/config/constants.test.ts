import { describe, expect, it } from "vitest";

import {
  DICE_OPTIONS,
  GRID_COLUMNS,
  GRID_GAP_PX,
  GRID_MIN_H,
  GRID_MIN_W,
  GRID_ROW_HEIGHT_PX,
  INVENTORY_TABS,
  MAX_ITEMS,
  MAX_WEAPONS,
  ROLL_HISTORY_LIMIT,
  STORAGE_PREFIX,
  cellSize,
  cellsToPx,
  pxToCells,
  snapToStep,
} from "./constants";

/**
 * Estes testes existem para validar o ARRANQUE do harness (Vitest + jsdom +
 * alias `@/*`) e para travar as garantias da seção 4 do projeto: se um
 * mantenedor trocar um valor aqui e quebrar uma regra, o teste avisa.
 * A lógica de negócio séria entra a partir da Fase 2.
 */
describe("constantes configuráveis", () => {
  it("mantém os limites de inventário como números positivos e ordenados", () => {
    expect(Number.isInteger(MAX_WEAPONS)).toBe(true);
    expect(Number.isInteger(MAX_ITEMS)).toBe(true);
    expect(MAX_WEAPONS).toBeGreaterThan(0);
    expect(MAX_ITEMS).toBeGreaterThan(0);
  });

  it("mantém o histórico de rolagens inteiro e não negativo", () => {
    expect(Number.isInteger(ROLL_HISTORY_LIMIT)).toBe(true);
    expect(ROLL_HISTORY_LIMIT).toBeGreaterThanOrEqual(0);
  });

  it("oferece apenas dados válidos, em ordem crescente", () => {
    expect([...DICE_OPTIONS]).toEqual([4, 6, 8, 10, 12, 20]);
    expect(DICE_OPTIONS.every((faces) => faces >= 2)).toBe(true);
  });

  it("mantém as abas do inventário com id único e rótulo em pt-BR", () => {
    const ids = INVENTORY_TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of INVENTORY_TABS) {
      expect(tab.label).toMatch(/\S/);
    }
  });

  it("usa um prefixo de storage não vazio", () => {
    expect(STORAGE_PREFIX.length).toBeGreaterThan(0);
  });
});

describe("constantes do grid (adendo §1)", () => {
  it("o grid é fino: muitas colunas e linha baixa", () => {
    // Menos que 24 colunas deixa o passo horizontal grosso demais (o bloco
    // pula de 1/12 para 1/24 da largura); mais que 64 vira ruído visual.
    expect(GRID_COLUMNS).toBeGreaterThanOrEqual(24);
    expect(GRID_COLUMNS).toBeLessThanOrEqual(64);

    // Linha de 10 px dá ajuste vertical fino; acima de 20 o gesto fica
    // impreciso e o bloco cresce rápido demais.
    expect(GRID_ROW_HEIGHT_PX).toBeGreaterThanOrEqual(6);
    expect(GRID_ROW_HEIGHT_PX).toBeLessThanOrEqual(20);
  });

  it("todos os limites são INTEIROS — célula não tem fração", () => {
    for (const value of [
      GRID_COLUMNS,
      GRID_ROW_HEIGHT_PX,
      GRID_GAP_PX,
      GRID_MIN_W,
      GRID_MIN_H,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("o mínimo global cabe dentro da grade", () => {
    expect(GRID_MIN_W).toBeLessThan(GRID_COLUMNS);
    expect(GRID_MIN_H).toBeGreaterThan(0);
  });
});

describe("snapToStep", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // O PARÂMETRO `step` SUMIU
  //
  // Era o snap de 5 px da Fase 1. O adendo §1 trocou o snap de pixel pelo de
  // CÉLULA, e célula é discreta: não existe meia célula. Restou só o inteiro
  // mais próximo, com os limites.
  // ───────────────────────────────────────────────────────────────────────────

  it("arredonda para o inteiro mais próximo", () => {
    expect(snapToStep(12.2)).toBe(12);
    expect(snapToStep(12.6)).toBe(13);
    expect(snapToStep(-7.4)).toBe(-7);
  });

  it("NÃO existe passo fracionário — meia célula arredonda", () => {
    // Com o `step` removido, esta chamada não compila. O teste fica aqui para
    // documentar que a garantia é de TIPO, não de uso.
    expect(Number.isInteger(snapToStep(3.5))).toBe(true);
  });

  it("respeita os limites min e max", () => {
    expect(snapToStep(0, 10, 90)).toBe(10);
    expect(snapToStep(500, 10, 90)).toBe(90);
  });

  it("devolve o mínimo quando o valor não é finito", () => {
    expect(snapToStep(Number.NaN, 42)).toBe(42);
    expect(snapToStep(Number.POSITIVE_INFINITY, 42)).toBe(42);
  });
});

describe("cellSize", () => {
  it("divide a largura útil pelas colunas", () => {
    // 1600 - 47 gaps de 12 = 1036; 1036 / 48 ≈ 21.58
    const cell = cellSize(1600);

    expect(cell.w).toBeCloseTo((1600 - 47 * 12) / 48, 5);
    expect(cell.h).toBeCloseTo((1600 - 47 * 12) / 48, 5); // quadrado: h = w
  });

  it("NUNCA devolve célula de largura zero ou NaN", () => {
    // Com container de 0 px (antes da medição, ou em jsdom) a divisão daria
    // zero ou negativo, e um `NaN` no estilo do painel esconderia a grade
    // INTEIRA sem mensagem de erro.
    expect(cellSize(0).w).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(cellSize(0).w)).toBe(true);
    expect(Number.isFinite(cellSize(10).w)).toBe(true);
  });
});

describe("cellsToPx", () => {
  it("inclui os gaps internos", () => {
    // 3 células de 20 px com 2 gaps de 12: 20+12+20+12+20 = 84.
    expect(cellsToPx(3, 20, 12)).toBe(84);
  });

  it("uma célula é só a célula, sem gap", () => {
    expect(cellsToPx(1, 20, 12)).toBe(20);
  });

  it("NUNCA devolve zero — o bloco sumiria", () => {
    expect(cellsToPx(0, 20, 12)).toBeGreaterThanOrEqual(1);
    expect(cellsToPx(1, 0, 12)).toBeGreaterThanOrEqual(1);
  });
});

describe("pxToCells", () => {
  it("é a inversa aproximada de cellsToPx", () => {
    expect(pxToCells(cellsToPx(7, 20, 12), 20, 12)).toBe(7);
  });

  it("nunca devolve menos que 1", () => {
    // Zero de deslocamento = zero células. A versão anterior retornava 1,\n    // o que causava deriva ao arrastar.\n    expect(pxToCells(0, 20, 12)).toBe(0);\n    expect(pxToCells(-50, 20, 12)).toBe(0);
  });

  it("não quebra com célula de largura zero", () => {
    // Com `cell = 0` o passo é só o gap, e a conta continua valendo: 100 px
    // de coluna-zero cabem em 9 passos de 12 px. O que não pode acontecer é
    // `NaN` — daí o piso de 1.
    expect(pxToCells(100, 0, 12)).toBe(8);
    expect(Number.isFinite(pxToCells(100, 0, 12))).toBe(true);
  });

  it("com célula E gap zerados, devolve 1 em vez de dividir por zero", () => {
    // `pitch = 0` é o único caso degenerado de verdade: sem a guarda, isto
    // seria `Infinity`, e `Infinity` no `x` reprovaria o schema e derrubaria
    // o layout inteiro da ficha.
    expect(pxToCells(100, 0, 0)).toBe(1);
  });
});
