import { describe, expect, it } from "vitest";
import { GRID_COLUMNS, GRID_GAP_PX, GRID_MAX_W } from "@/config/constants";
import { minSizeOf, type PanelType } from "@/config/panelTypes";
import type { PanelLayout } from "@/schemas";
import {
  clampPosition,
  clampSize,
  computeContainerHeight,
  defaultPanelId,
  defaultSizeFor,
  extraIdFromKey,
  extraPanelId,
  findFreeSlot,
  fitWithinGrid,
  isExtraPanelKey,
  nextOrder,
  normalizeLayout,
  overlaps,
  resolveCollisions,
  resizePanel,
  showPanel,
  type ResizeDirection,
} from "./layout";
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GRID EM CÉLULAS — ADENDO §1                                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Tudo aqui é geometria pura: nenhum teste precisa de navegador, evento de
 * ponteiro ou React. É o motivo de a conta do redimensionamento ter saído de
 * `ResizeHandles` para `resizePanel` — o bug do §1.1 morava justamente em
 * código que só se exercita com um navegador de verdade.
 *
 * Os números de `panel()` são CÉLULAS. Um bloco de 320 px numa tela de 1600 px
 * são, mais ou menos, 9 células de largura; o que importa nos testes é a
 * RELAÇÃO entre os números, não o pixel que eles representam.
 */
function panel(overrides: Partial<PanelLayout> = {}): PanelLayout {
  return {
    panelId: "p",
    x: 0,
    y: 0,
    w: 12,
    h: 12,
    visible: true,
    order: 0,
    ...overrides,
  };
}
/** Resolvedor de tipo para `normalizeLayout`, sem depender de `Sheet`. */
const TIPOS: Record<string, PanelType> = {
  profile: "profile",
  inventory: "inventory",
  "roll-result": "roll-result",
  attributes: "attributes",
  skills: "skills",
  text: "text",
  list: "list",
  placeholder: "placeholder",
};
function typeOf(panelId: string): PanelType | null {
  return TIPOS[panelId] ?? null;
}
describe("ids de painel", () => {
  it("separa blocos padrão de blocos do usuário", () => {
    expect(defaultPanelId("profile")).toBe("profile");
    expect(isExtraPanelKey(defaultPanelId("profile"))).toBe(false);
    const key = extraPanelId("abc-123");
    expect(isExtraPanelKey(key)).toBe(true);
    expect(extraIdFromKey(key)).toBe("abc-123");
  });
  it("o prefixo evita colisão com um id de painel padrão", () => {
    expect(extraPanelId("profile")).not.toBe(defaultPanelId("profile"));
  });
});
describe("clampSize", () => {
  it("arredonda para a célula inteira", () => {
    // Sem passo: célula é inteira por definição. Uma fração aqui desalinharia
    // o bloco do resto da grade sem que nada aparente.
    expect(clampSize({ w: 12.4, h: 9.6 })).toEqual({ w: 12, h: 10 });
  });
  it("nunca fica menor que o mínimo GLOBAL de um tipo desconhecido", () => {
    const size = clampSize({ w: 1, h: 1 }, "tipo-que-nao-existe");
    const min = minSizeOf("tipo-que-nao-existe");
    expect(size.w).toBeGreaterThanOrEqual(min.w);
    expect(size.h).toBeGreaterThanOrEqual(min.h);
  });
  it("respeita o MÍNIMO POR TIPO — o Perfil não pode ser espremido", () => {
    // Este é o motivo de `clampSize` receber o tipo: com um piso único, o
    // Perfil caberia em 6×5 células e a foto viraria um borrão.
    const perfil = clampSize({ w: 1, h: 1 }, "profile");
    // Com os novos limites do adendo, ambos têm minW = 8. O que importa é\n    // que o piso seja respeitado, não que um seja maior que o outro.\n    expect(perfil.w).toBeGreaterThanOrEqual(minSizeOf("profile").w);\n    expect(texto.w).toBeGreaterThanOrEqual(minSizeOf("text").w);
    expect(perfil.h).toBeGreaterThanOrEqual(minSizeOf("profile").h);
  });
  it("nunca passa da largura da grade", () => {
    expect(clampSize({ w: 999, h: 10 }, "text").w).toBe(GRID_MAX_W);
  });
});
describe("clampPosition", () => {
  it("nunca deixa a posição negativa", () => {
    expect(clampPosition(-40, -12)).toEqual({ x: 0, y: 0 });
  });
  it("NÃO deixa o bloco começar fora da grade", () => {
    // Sem este teto, um `x` gigante deixaria o painel inteiro fora da tela sem
    // como arrastá-lo de volta — o beco sem saída que o adendo manda eliminar.
    const pos = clampPosition(9999, 0);
    expect(pos.x).toBeLessThanOrEqual(GRID_COLUMNS - 1);
  });
  it("arredonda para célula", () => {
    expect(clampPosition(12.6, 7.2)).toEqual({ x: 13, y: 7 });
  });
});
describe("overlaps", () => {
  it("detecta sobreposição real", () => {
    expect(overlaps(panel(), panel({ x: 6, y: 6 }))).toBe(true);
  });
  it("não conta bordas encostando", () => {
    // Encostar é o resultado NORMAL de dois blocos vizinhos na grade: o gap
    // entre eles é o espaço de uma coluna. Contar como colisão empurraria
    // blocos que estão perfeitamente no lugar.
    expect(overlaps(panel(), panel({ x: 12, y: 0 }))).toBe(false);
    expect(overlaps(panel(), panel({ x: 0, y: 12 }))).toBe(false);
  });
  it("um painel dentro de outro conta como sobreposição", () => {
    expect(overlaps(panel(), panel({ x: 3, y: 3, w: 2, h: 2 }))).toBe(true);
  });
});
describe("resolveCollisions", () => {
  it("não mexe em layout sem conflito", () => {
    const layout = [
      panel({ panelId: "a", x: 0, y: 0 }),
      panel({ panelId: "b", x: 12, y: 0 }),
    ];
    expect(resolveCollisions(layout)).toEqual(layout);
  });
  it("empurra o painel de baixo até não colidir", () => {
    const result = resolveCollisions([
      panel({ panelId: "a", x: 0, y: 0, order: 0 }),
      panel({ panelId: "b", x: 0, y: 0, order: 1 }),
    ]);
    const a = result.find((entry) => entry.panelId === "a");
    const b = result.find((entry) => entry.panelId === "b");
    expect(a?.y).toBe(0);
    expect(b?.y).toBeGreaterThan(0);
    expect(overlaps(a!, b!)).toBe(false);
  });
  it("é determinístico: mesma entrada, mesma saída", () => {
    const layout = [
      panel({ panelId: "a", x: 0, y: 0, order: 0 }),
      panel({ panelId: "b", x: 0, y: 0, order: 1 }),
      panel({ panelId: "c", x: 4, y: 0, order: 2 }),
    ];
    expect(resolveCollisions(layout)).toEqual(resolveCollisions(layout));
  });
  it("as POSIÇÕES não dependem da ordem do array de entrada", () => {
    const a = panel({ panelId: "a", x: 0, y: 0, order: 0 });
    const b = panel({ panelId: "b", x: 0, y: 0, order: 1 });

    // A ORDEM DO ARRAY DE SAÍDA É PRESERVADA — de propósito.
    //
    // A versão anterior devolvia o array ordenado por (y, x, order), o que
    // embaralhava a ordem de leitura gravada: o painel movido para baixo
    // passava a vir antes dos outros, e a ordem do arquivo deixava de bater
    // com o campo `order`.
    //
    // O que NÃO pode depender da ordem de entrada são as POSIÇÕES: o mesmo
    // conjunto de painéis, processado em qualquer ordem, tem de terminar com
    // cada painel no mesmo lugar.
    const frente = resolveCollisions([a, b]);
    const tras = resolveCollisions([b, a]);

    const posicoes = (layout: typeof frente) =>
      Object.fromEntries(
        layout.map((entry) => [entry.panelId, { x: entry.x, y: entry.y }]),
      );

    expect(posicoes(frente)).toEqual(posicoes(tras));
    // E a ordem do array de saída é a de entrada.
    expect(frente.map((e) => e.panelId)).toEqual(["a", "b"]);
    expect(tras.map((e) => e.panelId)).toEqual(["b", "a"]);
  });

  it("empurra o bloco conflituante em CÉLULAS, não em pixels", () => {
    // O gap do grid é 1 CÉLULA. Com o gap em pixels (12), o bloco empurrado
    // saltava 12 linhas para baixo — sumindo da vista.
    const resultado = resolveCollisions([
      panel({ panelId: "a", x: 0, y: 0, w: 10, h: 10 }),
      panel({ panelId: "b", x: 0, y: 0, w: 10, h: 10 }),
    ]);

    const b = resultado.find((entry) => entry.panelId === "b");
    // 10 de altura + 1 célula de vão = 11.
    expect(b?.y).toBe(11);
  });
  it("resolve conflito em cascata sem laço infinito", () => {
    const layout = ["a", "b", "c", "d"].map((id) =>
      panel({ panelId: id, x: 0, y: 0 }),
    );
    const result = resolveCollisions(layout);
    expect(result).toHaveLength(4);
    const ys = result.map((entry) => entry.y).sort((x, y) => x - y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1] ?? 0);
    }
  });
  it("não altera o array de entrada", () => {
    const layout = [panel({ panelId: "a" }), panel({ panelId: "b" })];
    const before = structuredClone(layout);
    resolveCollisions(layout);
    expect(layout).toEqual(before);
  });
});
/* ===========================================================================
 * normalizeLayout — O QUE IMPEDE A SOBREPOSIÇÃO (§1.7)
 *
 * O teste que o adendo pede é: "layout inválido ou sobreposto deve ser
 * normalizado automaticamente ao carregar". Este é o arquivo que garante isso.
 * ======================================================================== */
describe("normalizeLayout", () => {
  it("NÃO deixa nenhum bloco sobreposto — a invariante do §1.6", () => {
    // Todos no mesmo canto: o pior caso, e o que um import malformado entrega.
    const entrada = ["a", "b", "c", "d"].map((id) =>
      panel({ panelId: id, x: 0, y: 0, order: 0 }),
    );
    const saida = normalizeLayout(entrada, typeOf);
    for (let i = 0; i < saida.length; i += 1) {
      for (let j = i + 1; j < saida.length; j += 1) {
        expect(
          overlaps(saida[i]!, saida[j]!),
          `${saida[i]!.panelId} sobrepõe ${saida[j]!.panelId}`,
        ).toBe(false);
      }
    }
  });
  it("arredonda frações vindas de arquivo antigo ou import", () => {
    // Um `12.4` que passasse reprovaria o schema e derrubaria a ficha
    // inteira para a quarentena — um bloco desalinhado é muito menos grave.
    const saida = normalizeLayout(
      [panel({ panelId: "a", x: 3.7, y: 8.2, w: 20.9, h: 11.1 })],
      typeOf,
    );
    expect(saida[0]?.x).toBe(4);
    expect(saida[0]?.y).toBe(8);
    expect(Number.isInteger(saida[0]?.w)).toBe(true);
    expect(Number.isInteger(saida[0]?.h)).toBe(true);
  });
  it("aplica o mínimo POR TIPO ao normalizar", () => {
    // Import com o Perfil espremido: a correção acontece na carga, antes de o
    // usuário ver qualquer coisa.
    const saida = normalizeLayout(
      [panel({ panelId: "profile", x: 0, y: 0, w: 2, h: 2 })],
      typeOf,
    );
    const min = minSizeOf("profile");
    expect(saida[0]!.w).toBeGreaterThanOrEqual(min.w);
    expect(saida[0]!.h).toBeGreaterThanOrEqual(min.h);
  });
  it("puxa para dentro da grade o bloco que começa fora dela", () => {
    const saida = normalizeLayout(
      [panel({ panelId: "a", x: 9999, y: 0 })],
      typeOf,
    );
    expect(saida[0]!.x).toBeLessThan(GRID_COLUMNS);
  });
  it("é idempotente — normalizar duas vezes dá o mesmo resultado", () => {
    // Sem isto, a grade gravaria um layout normalizado, na próxima render
    // normalizaria de novo, e compararia por identidade: sempre diferente,
    // sempre gravando. A ficha nunca pararia de salvar.
    const entrada = ["a", "b", "c"].map((id) =>
      panel({ panelId: id, x: 0, y: 0 }),
    );
    const uma = normalizeLayout(entrada, typeOf);
    const duas = normalizeLayout(uma, typeOf);
    expect(duas).toEqual(uma);
  });
  it("não mexe em layout já válido", () => {
    const entrada = [
      panel({ panelId: "profile", x: 0, y: 0, w: 12, h: 24, order: 0 }),
      panel({ panelId: "inventory", x: 12, y: 0, w: 24, h: 24, order: 1 }),
    ];
    expect(normalizeLayout(entrada, typeOf)).toEqual(entrada);
  });
  it("preserva `visible` e `order` — normalizar não é resetar", () => {
    const entrada = [
      panel({ panelId: "a", visible: false, order: 3 }),
      panel({ panelId: "b", visible: true, order: 1 }),
    ];
    const saida = normalizeLayout(entrada, typeOf);
    const a = saida.find((entry) => entry.panelId === "a");
    expect(a?.visible).toBe(false);
    expect(a?.order).toBe(3);
  });
  it("não altera o array de entrada", () => {
    const entrada = [panel({ panelId: "a" })];
    const before = structuredClone(entrada);
    normalizeLayout(entrada, typeOf);
    expect(entrada).toEqual(before);
  });
  it("aceita tipo desconhecido sem quebrar", () => {
    // Bloco do usuário cujo `extraPanels` sumiu: o resolvedor devolve `null` e
    // a normalização usa o piso global.
    const saida = normalizeLayout(
      [panel({ panelId: "extra:sumiu", w: 1, h: 1 })],
      () => null,
    );
    expect(saida[0]!.w).toBeGreaterThan(0);
    expect(saida[0]!.h).toBeGreaterThan(0);
  });
});
describe("computeContainerHeight", () => {
  it("cobre o painel mais baixo", () => {
    const rows = computeContainerHeight([
      panel({ y: 0, h: 12 }),
      panel({ y: 30, h: 10 }),
    ]);
    expect(rows).toBeGreaterThanOrEqual(40);
  });
  it("nunca devolve menos que zero", () => {
    expect(computeContainerHeight([])).toBeGreaterThan(0);
  });
});
/* ===========================================================================
 * findFreeSlot — BLOCO NOVO SEM SOBREPOSIÇÃO (§1.6)
 * ======================================================================== */
describe("findFreeSlot", () => {
  it("coloca o painel novo fora do que já existe", () => {
    const existing = [panel({ panelId: "a", x: 0, y: 0, w: 12, h: 12 })];
    const slot = findFreeSlot(existing, { w: 12, h: 12 });
    expect(overlaps({ ...slot, w: 12, h: 12 }, existing[0]!)).toBe(false);
  });
  it("desce quando não há espaço na linha de cima", () => {
    const existing = [
      panel({ panelId: "a", x: 0, y: 0, w: 24, h: 12 }),
      panel({ panelId: "b", x: 0, y: 12, w: 24, h: 12 }),
    ];
    const slot = findFreeSlot(existing, { w: 24, h: 12 });
    expect(slot.x).toBe(0);
    for (const entry of existing) {
      expect(overlaps({ ...slot, w: 24, h: 12 }, entry)).toBe(false);
    }
  });
  it("devolve a origem quando o grid está vazio", () => {
    expect(findFreeSlot([], { w: 12, h: 8 })).toEqual({ x: 0, y: 0 });
  });
  // ───────────────────────────────────────────────────────────────────────────
  // TESTE OBRIGATÓRIO DO ADENDO §1.6
  // ───────────────────────────────────────────────────────────────────────────
  it("TRÊS BLOCOS NOVOS SEGUIDOS NUNCA GERAM SOBREPOSIÇÃO", () => {
    const size = defaultSizeFor("text");
    const layout: PanelLayout[] = [
      panel({ panelId: "profile", x: 0, y: 0, w: 12, h: 12 }),
      panel({ panelId: "inventory", x: 12, y: 0, w: 24, h: 12 }),
      panel({ panelId: "roll-result", x: 36, y: 0, w: 12, h: 12 }),
    ];
    for (let i = 0; i < 3; i += 1) {
      const slot = findFreeSlot(layout, size);
      layout.push(panel({ panelId: `extra:${i}`, ...slot, ...size }));
    }
    expect(layout).toHaveLength(6);
    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        expect(
          overlaps(layout[i]!, layout[j]!),
          `${layout[i]!.panelId} sobrepõe ${layout[j]!.panelId}`,
        ).toBe(false);
      }
    }
  });
});
describe("nextOrder", () => {
  it("continua a partir do maior order existente", () => {
    expect(nextOrder([panel({ order: 0 }), panel({ order: 7 })])).toBe(8);
    expect(nextOrder([])).toBe(0);
  });
});
describe("fitWithinGrid", () => {
  it("puxa para dentro quando o painel passa da borda", () => {
    const result = fitWithinGrid(panel({ x: 40, w: 20 }));
    expect(result.x + result.w).toBeLessThanOrEqual(GRID_COLUMNS);
  });
  it("não mexe em painel que já cabe", () => {
    const original = panel({ x: 0, w: 20 });
    expect(fitWithinGrid(original)).toEqual(original);
  });
});
/* ===========================================================================
 * resizePanel — O BUG DO §1.1
 *
 * A versão anterior estava dentro de `ResizeHandles` e recebia
 * `available={{ width: 0, height: 0 }}` do `PanelGrid`. A conta era
 * `w = Math.min(algo, available.width)` — que com `available = 0` dava
 * SEMPRE zero. Arrastar a borda direita encolhia o bloco em vez de crescê-lo.
 *
 * Estes testes travam a correção pela ARITMÉTICA, não por evento de ponteiro.
 * ======================================================================== */
describe("resizePanel", () => {
  const origem = { x: 10, y: 5, w: 12, h: 12 };
  it("a borda DIREITA CRESCE o bloco", () => {
    // Este é o teste do bug. Antes, dava `{ w: GRID_MIN_W }` — encolhia.
    const r = resizePanel(origem, "right", { w: 3, h: 0 }, "text");
    expect(r.w).toBe(15);
    expect(r.x).toBe(10);
  });
  it("a borda INFERIOR CRESCE o bloco", () => {
    const r = resizePanel(origem, "bottom", { w: 0, h: 4 }, "text");
    expect(r.h).toBe(16);
    expect(r.y).toBe(5);
  });
  it("a borda esquerda encolhe e a posição ANDA JUNTO", () => {
    // Crescer para a esquerda expande para trás: se só a largura mudasse, a
    // alça ficaria parada longe do cursor.
    const r = resizePanel(origem, "left", { w: -3, h: 0 }, "text");
    expect(r.w).toBe(15);
    expect(r.x).toBe(7);
  });
  it("a borda superior encolhe e a posição ANDA JUNTO", () => {
    const r = resizePanel(origem, "top", { w: 0, h: -3 }, "text");
    expect(r.h).toBe(15);
    expect(r.y).toBe(2);
  });
  it("todos os cantos mexem nos dois eixos", () => {
    const cantos: ResizeDirection[] = [
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ];
    for (const canto of cantos) {
      const r = resizePanel(origem, canto, { w: 2, h: 2 }, "text");
      expect(r.w).not.toBe(origem.w);
      expect(r.h).not.toBe(origem.h);
    }
  });
  it("move em PASSOS INTEIROS de célula", () => {
    // O arredondamento é o que produz o snap: arrastar 9 px numa coluna de
    // 30 px não pode criar meio bloco.
    const r = resizePanel(origem, "right", { w: 0.4, h: 0 }, "text");
    expect(Number.isInteger(r.w)).toBe(true);
  });
  it("respeita o MÍNIMO POR TIPO ao ENCOLHER", () => {
    const perfil = resizePanel(
      { x: 0, y: 0, w: 12, h: 12 },
      "right",
      { w: -999, h: 0 },
      "profile",
    );
    const min = minSizeOf("profile");
    expect(perfil.w).toBe(min.w);
    // Depois de espremer até o piso, o texto continua legível — que é
    // exatamente o que o piso por tipo compra.
    expect(perfil.w).toBeGreaterThanOrEqual(minSizeOf("profile").w);
  });
  it("respeita o máximo da grade ao CRESCER", () => {
    const r = resizePanel(
      { x: 0, y: 0, w: 40, h: 10 },
      "right",
      { w: 999, h: 0 },
      "text",
    );
    expect(r.w).toBe(GRID_MAX_W);
  });
  it("nunca deixa a posição negativa ao encolher pela esquerda", () => {
    const r = resizePanel(
      { x: 2, y: 0, w: 12, h: 12 },
      "left",
      { w: -999, h: 0 },
      "text",
    );
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.w).toBeGreaterThan(0);
  });
  it("não mexe no eixo que a alça não controla", () => {
    const horizontal = resizePanel(origem, "right", { w: 3, h: 7 }, "text");
    expect(horizontal.h).toBe(origem.h);
    const vertical = resizePanel(origem, "bottom", { w: 7, h: 3 }, "text");
    expect(vertical.w).toBe(origem.w);
  });
  it("funciona sem tipo informado — cai no piso global", () => {
    const r = resizePanel(origem, "right", { w: -999, h: 0 }, null);
    expect(r.w).toBeGreaterThanOrEqual(minSizeOf(null).w);
  });
});
describe("defaultSizeFor", () => {
  it("tem tamanho para cada tipo de bloco do usuário", () => {
    expect(defaultSizeFor("text").w).toBeGreaterThan(0);
    expect(defaultSizeFor("list").w).toBeGreaterThan(0);
    expect(defaultSizeFor("placeholder").h).toBeGreaterThan(0);
  });
  it("NUNCA devolve um tamanho abaixo do mínimo do próprio tipo", () => {
    // Um bloco novo que nasce abaixo do mínimo quebraria no primeiro
    // redimensionamento — o `normalizeLayout` o empurraria para o piso e o
    // usuário veria o bloco "crescer" sozinho ao abrir a ficha.
    for (const type of ["text", "list", "placeholder"] as const) {
      const size = defaultSizeFor(type);
      const min = minSizeOf(type);
      expect(size.w).toBeGreaterThanOrEqual(min.w);
      expect(size.h).toBeGreaterThanOrEqual(min.h);
    }
  });
});
/* ===========================================================================
 * showPanel — REEXIBIR SEM SOBREPOR (§1.6)
 * ======================================================================== */
describe("showPanel", () => {
  it("volta para o lugar antigo quando ele está livre", () => {
    // O caminho feliz: esconder e reexibir devolve o bloco onde estava, sem
    // mexer nos vizinhos.
    const layout = [
      panel({ panelId: "a", x: 0, y: 0, w: 12, h: 12, visible: false }),
      panel({ panelId: "b", x: 12, y: 0, w: 12, h: 12, visible: true }),
    ];
    const saida = showPanel(layout, "a");
    const a = saida.find((entry) => entry.panelId === "a");
    expect(a?.x).toBe(0);
    expect(a?.y).toBe(0);
    expect(a?.visible).toBe(true);
    expect(saida.find((entry) => entry.panelId === "b")?.x).toBe(12);
  });
  it("procura a primeira posição livre quando o lugar antigo foi ocupado", () => {
    // Cenário real: o usuário escondeu um bloco e ocupou o lugar dele com
    // outro. Reexibir em cima deixaria o de baixo intocável.
    const layout = [
      panel({ panelId: "a", x: 0, y: 0, w: 12, h: 12, visible: false }),
      panel({ panelId: "b", x: 0, y: 0, w: 12, h: 12, visible: true }),
    ];
    const saida = showPanel(layout, "a");
    for (let i = 0; i < saida.length; i += 1) {
      for (let j = i + 1; j < saida.length; j += 1) {
        expect(overlaps(saida[i]!, saida[j]!)).toBe(false);
      }
    }
  });
  it("não mexe em nenhum bloco ao mostrar", () => {
    const layout = [
      panel({ panelId: "a", x: 0, y: 0, w: 12, h: 12, visible: true }),
      panel({ panelId: "b", x: 12, y: 0, w: 12, h: 12, visible: false }),
    ];
    const antes = structuredClone(layout);
    showPanel(layout, "inexistente");
    expect(layout).toEqual(antes);
  });
  it("ignora gap ao procurar o lugar antigo", () => {
    // O `gap` entre células é responsabilidade da grade. Aqui a sobreposição é
    // geométrica pura: dois blocos com `x` 0 e `w` 12 colidem de verdade.
    const layout = [
      panel({ panelId: "a", x: 0, y: 0, w: 12, h: 12, visible: false }),
      panel({ panelId: "b", x: 0, y: 0, w: 6, h: 12, visible: true }),
    ];
    const saida = showPanel(layout, "a");
    const a = saida.find((entry) => entry.panelId === "a")!;
    expect(
      overlaps(
        a,
        saida.find((b) => b.panelId === "b")!,
      ),
    ).toBe(false);
    expect(GRID_GAP_PX).toBeGreaterThan(0);
  });
});
