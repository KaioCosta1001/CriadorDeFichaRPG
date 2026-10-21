import { describe, expect, it } from "vitest";

import {
  GRID_COLUMNS,
  GRID_GAP_PX,
  LAYOUT_MIGRATION_REFERENCE_WIDTH_PX,
  cellSize,
} from "@/config/constants";
import { overlaps } from "@/domain/layout";
import { SheetSchema, type PanelLayout } from "@/schemas";

import { migrateDocument } from "./migrations";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v2 → v3 — O LAYOUT PASSA DE PIXELS PARA CÉLULAS (adendo §1.7)          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A v2 guardava `x`, `y`, `w`, `h` em pixels livres com snap de 5 px. A v3
 * guarda células inteiras.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE ESTA SÉRIE PROVA, E POR QUE IMPORTA
 *
 * Uma migração de geometria tem dois modos de falhar, e os dois são ruins:
 *
 *  1. **Descartar o layout.** O usuário perde o arranjo que montou à mão, que
 *     é a única coisa que a migração existe para preservar.
 *  2. **Gerar layout sobreposto.** Dois blocos em cima um do outro, e o de
 *     baixo intocável — o beco sem saída que o adendo manda eliminar.
 *
 * Por isso a conversão termina SEMPRE normalizada, e o teste mais importante
 * aqui é o de sobreposição.
 */
function v2Sheet(overrides: Record<string, unknown> = {}) {
  return {
    id: "sheet-1",
    ownerId: null,
    schemaVersion: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    name: "Gandalf",
    title: "Gandalf",
    system: "dnd5e",
    templateId: "dnd5e-completo",
    profile: { photo: null, slots: [] },
    // Sem este campo o schema reprova por `inventory`, e o teste passaria a
    // medir a fixture em vez da migração.
    inventory: {
      weapons: [],
      items: [],
      money: { label: "Ouro", value: 0 },
      carryCapacity: 30,
    },
    attributes: [],
    skills: [],
    extraPanels: [],
    rollHistory: [],
    settings: { sellEnabled: true },
    layout: [
      {
        panelId: "profile",
        x: 0,
        y: 0,
        w: 320,
        h: 320,
        visible: true,
        order: 0,
      },
      {
        panelId: "inventory",
        x: 332,
        y: 0,
        w: 652,
        h: 320,
        visible: true,
        order: 1,
      },
      {
        panelId: "attributes",
        x: 0,
        y: 332,
        w: 984,
        h: 200,
        visible: true,
        order: 2,
      },
    ],
    ...overrides,
  };
}

/**
 * O documento migrado, com o `layout` já tipado.
 *
 * `migrateDocument` devolve `unknown` por definição — ele não conhece o
 * documento, só o transforma. Este wrapper é o que permite aos testes
 * falar de `x` e `w` sem `any` (que o projeto proíbe).
 */
interface Migrated {
  layout: PanelLayout[];
}

function migrated(overrides: Record<string, unknown> = {}): Migrated {
  const result = migrateDocument(v2Sheet(overrides));
  if (result.status !== "ok") {
    throw new Error(`migração falhou: ${result.status}`);
  }
  return result.document as Migrated;
}

describe("migração v2 → v3", () => {
  it("é aplicada ao documento v2", () => {
    const result = migrateDocument(v2Sheet());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // A v2 → v3 roda; a v3 → v4 (reposicionar os slots do Perfil) não, porque
    // esta ficha de teste não tem `profile.slots` e a migração sai cedo.
    expect(result.applied).toEqual([2, 3, 4]);
  });

  it("a ficha migrada passa no schema ATUAL", () => {
    // A prova definitiva. Se sobrasse um `w: 984` em px, o `.int().max(48)`
    // de `PanelLayoutSchema` reprovaria e a ficha iria para a quarentena —
    // sumindo da lista do jogador.
    expect(SheetSchema.safeParse(migrated()).success).toBe(true);
  });

  it("NÃO perde nenhum bloco", () => {
    const antes = v2Sheet().layout as { panelId: string }[];
    const depois = migrated().layout as { panelId: string }[];

    expect(depois.map((entry) => entry.panelId)).toEqual(
      antes.map((entry) => entry.panelId),
    );
  });

  /* ── A conversão ───────────────────────────────────────────────────────── */

  it("converte px para células INTEIRAS", () => {
    const layout = migrated().layout;

    for (const entry of layout) {
      expect(Number.isInteger(entry.w)).toBe(true);
      expect(Number.isInteger(entry.h)).toBe(true);
      expect(Number.isInteger(entry.x)).toBe(true);
    }
  });

  it("as células cabem dentro da grade", () => {
    const layout = migrated().layout;

    for (const entry of layout) {
      expect(entry.w).toBeLessThanOrEqual(GRID_COLUMNS);
      expect(entry.x + entry.w).toBeLessThanOrEqual(GRID_COLUMNS);
    }
  });

  it("PRESERVA a PROPORÇÃO entre os blocos — a ordem visual não inverte", () => {
    const byId = new Map(
      migrated().layout.map((entry) => [entry.panelId, entry] as const),
    );

    // Na v2 em px: Perfil 320, Inventário 652 (o dobro, mais os gaps).
    // Em células o inventário tem de continuar claramente mais largo.
    const perfil = byId.get("profile")!;
    const inventario = byId.get("inventory")!;

    expect(inventario.w).toBeGreaterThan(perfil.w);
    // E na mesma ordem da esquerda para a direita.
    expect(inventario.x).toBeGreaterThan(perfil.x);
  });

  it("PRESERVA a ordem vertical: o que estava abaixo continua abaixo", () => {
    const byId = new Map(
      migrated().layout.map((entry) => [entry.panelId, entry] as const),
    );

    const atributos = byId.get("attributes")!;
    const perfil = byId.get("profile")!;

    // `>=`, e não `>`: dois blocos que se ENCOSTAM não estão sobrepostos, e
    // encostar é exatamente o que a grade faz — o vão entre eles é o gap da
    // célula. Exigir folga aqui reprovaria o layout padrão correto.
    expect(atributos.y).toBeGreaterThanOrEqual(perfil.y + perfil.h);
  });

  it("PRESERVA `visible` e `order` — o bloco escondido continua escondido", () => {
    const layout = migrated({
      layout: [
        {
          panelId: "skills",
          x: 0,
          y: 500,
          w: 400,
          h: 200,
          visible: false,
          order: 7,
        },
      ],
    }).layout;

    expect(layout[0]?.visible).toBe(false);
    expect(layout[0]?.order).toBe(7);
  });

  /* ── A garantia que importa ─────────────────────────────────────────────── */

  it("NÃO deixa sobreposição depois de normalizar", () => {
    // O teste central desta migração. A conversão px → célula arredonda para
    // o inteiro mais próximo, e arredondar pode COLOCAR dois blocos que não
    // se tocavam exatamente um em cima do outro.
    //
    // Sem a normalização final, o usuário abriria a ficha com dois blocos
    // empilhados e o de baixo intocável.
    const layout = migrated({
      layout: [
        // Dois blocos de 4 px de diferença em `y` — distantes em px, mas
        // ambos arredondam para a MESMA célula.
        { panelId: "a", x: 0, y: 100, w: 100, h: 100, visible: true, order: 0 },
        { panelId: "b", x: 0, y: 104, w: 100, h: 100, visible: true, order: 1 },
      ],
    }).layout;

    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        expect(overlaps(layout[i]!, layout[j]!)).toBe(false);
      }
    }
  });

  it("a conversão é determinística — o layout não 'pula' entre salvamentos", () => {
    // Uma migração não determinística faria o mesmo arquivo produzir layouts
    // diferentes a cada abertura, e o usuário veria os blocos se mexendo sem
    // tocar em nada.
    expect(migrated()).toEqual(migrated());
  });

  it("não mexe em documento sem layout", () => {
    const semLayout = { ...v2Sheet(), layout: undefined };
    const result = migrateDocument(semLayout);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // As migrações RODARAM (por isso aparecem em `applied`) e decidiram não ter o
    // que converter. O que importa é que elas não inventaram um layout onde
    // não havia — nem derrubaram a ficha.
    expect(result.applied).toEqual([2, 3, 4]);
    expect((result.document as { layout?: unknown }).layout).toBeUndefined();
  });

  it("não quebra com layout vazio", () => {
    expect(migrated({ layout: [] }).layout).toEqual([]);
  });

  it("não quebra com campos de layout ausentes ou não numéricos", () => {
    // Documento corrompido é QUARENTENA por padrão, mas um import ruim não
    // pode derrubar a migração inteira: ela tem de devolver algo que a grade
    // consiga consertar na carga, não explodir no meio da conversão.
    //
    // `x: "nope"` e `w: undefined` chegam como `NaN` depois de
    // `Number(...) || 0`, e `normalizeLayout` tem de consertar.
    const layout = migrated({
      layout: [
        { panelId: "a", visible: true, order: 0 },
        {
          panelId: "b",
          x: "nope",
          y: null,
          w: undefined,
          visible: true,
          order: 1,
        },
      ],
    }).layout;

    expect(layout).toHaveLength(2);
    for (const entry of layout) {
      expect(Number.isInteger(entry.x)).toBe(true);
      expect(Number.isInteger(entry.w)).toBe(true);
      expect(entry.w).toBeGreaterThan(0);
    }
  });
});

describe("a referência de largura da migração", () => {
  it("corresponde a uma grade plausível", () => {
    // A conversão usa `LAYOUT_MIGRATION_REFERENCE_WIDTH_PX` porque não há
    // DOM para medir. Se a constante virar absurda (uma letra, ou um milhão),
    // a conversão começa a produzir células sem sentido.
    expect(LAYOUT_MIGRATION_REFERENCE_WIDTH_PX).toBeGreaterThan(600);
    expect(LAYOUT_MIGRATION_REFERENCE_WIDTH_PX).toBeLessThanOrEqual(4096);

    const cell = cellSize(LAYOUT_MIGRATION_REFERENCE_WIDTH_PX);
    expect(cell.w).toBeGreaterThan(8);
    expect(cell.w).toBeLessThan(80);
    expect(GRID_GAP_PX).toBeGreaterThan(0);
  });
});
