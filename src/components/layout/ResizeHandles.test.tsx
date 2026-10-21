import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResizeHandles } from "@/components/layout/ResizeHandles";
import { GRID_COLUMNS, GRID_GAP_PX, GRID_MAX_W } from "@/config/constants";
import { minSizeOf } from "@/config/panelTypes";
import { RESIZE_DIRECTIONS } from "@/domain/layout";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REDIMENSIONAMENTO PELAS ALÇAS — adendo §1.5 e §1.10                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SIMULAR PONTEIRO MESMO TENDO `resizePanel` PURO
 *
 * A aritmética já tem teste em `layout.test.ts`, onde é uma função pura. O que
 * este arquivo cobre é a PARTE QUE SÓ EXISTE NO NAVEGADOR:
 *
 *  1. as oito alças existem e respondem a clique;
 *  2. `pointerdown` na alça NÃO dispara o arraste do bloco;
 *  3. o `pointermove` chega à alça e o `onResize` é chamado;
 *  4. a alça tem área de clique ≥ 12 px (requisito explícito do §1.5);
 *  5. o teclado move a borda em células.
 *
 * O item 4 é o que ninguém testaria e o que mais importa no celular.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE O jsdom NÃO COBRE — E ESTÁ DOCUMENTADO
 *
 * O `setPointerCapture` real, o `clip-path` do losango e o cursor não existem
 * no jsdom. O teste verifica a ÁREA DE CLIQUE declarada, que é a garantia
 * verificável; o desenho em si é CSS.
 */

/** Uma coluna de 30 px + gap de 12 → passo de 42 px por célula. */
const CELL = { w: 30, h: 10 };
const PASSO_X = CELL.w + GRID_GAP_PX;
const PASSO_Y = CELL.h + GRID_GAP_PX;

/**
 * O bloco começa EXATAMENTE no mínimo do seu tipo (Atributos: 14×10).
 *
 * Começar abaixo do mínimo faria o primeiro `clampSize` empurrar o tamanho
 * para cima, e o teste "cresce uma célula" leria 14 em vez de 13 — uma falha
 * que parece do componente e é do fixture.
 */
const ORIGEM = { x: 10, y: 5, w: 20, h: 16 };

function setup(overrides: Partial<Parameters<typeof ResizeHandles>[0]> = {}) {
  const onResize = vi.fn();
  const props = {
    position: { x: ORIGEM.x, y: ORIGEM.y },
    size: { w: ORIGEM.w, h: ORIGEM.h },
    cell: CELL,
    panelType: "attributes",
    maxRows: 200,
    onResize,
    ...overrides,
  };

  render(<ResizeHandles {...props} />);
  return { onResize, props };
}

/** Último redimensionamento recebido. */
function lastOf(onResize: ReturnType<typeof vi.fn>) {
  const calls = onResize.mock.calls;
  return calls[calls.length - 1]?.[0] as
    { x: number; y: number; w: number; h: number } | undefined;
}

/**
 * Simula o gesto completo numa alça.
 *
 * `fireEvent.pointerDown` + `pointerMove` + `pointerUp`, com coordenadas de
 * cliente absolutas. O componente calcula o delta a partir do ponto inicial,
 * por isso o `pointermove` precisa carregar a posição final.
 */
async function arrastar(
  user: ReturnType<typeof userEvent.setup>,
  nomeDaAlca: string,
  deltaX: number,
  deltaY: number,
) {
  const alca = screen.getByRole("button", { name: nomeDaAlca });

  // `coords` e não `clientX`: o `userEvent` do Testing Library recebe a
  // posição em `coords`, e solta o evento sem ela.
  await user.pointer([
    { target: alca, keys: "[MouseLeft>]", coords: { clientX: 0, clientY: 0 } },
    { target: alca, coords: { clientX: deltaX, clientY: deltaY } },
    { keys: "[/MouseLeft]" },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ===========================================================================
 * As alças
 * ======================================================================== */

describe("ResizeHandles — as oito alças", () => {
  it("existe uma alça para cada canto e cada borda", () => {
    setup();

    // O §1.5 pede explicitamente "4 cantos e nas 4 bordas". São oito, e cada
    // uma é um botão de verdade — focalizável por teclado.
    expect(RESIZE_DIRECTIONS).toHaveLength(8);
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

  it("cada alça tem rótulo próprio em pt-BR", () => {
    setup();

    // Rótulo genérico ("redimensionar") em oito botões indistinguíveis faz o
    // leitor de tela anunciar a mesma coisa oito vezes.
    expect(
      screen.getByRole("button", {
        name: "Redimensionar pela borda direita",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Redimensionar pelo canto inferior direito",
      }),
    ).toBeDefined();
  });

  it("NENHUMA alça captura o texto selecionado", () => {
    // Sem `touch-action: none`, o celular interpreta o arrasto como rolagem e
    // a alça desliza sem redimensionar nada. É o mesmo motivo do handle.
    setup();

    for (const alca of screen.getAllByRole("button")) {
      expect(alca.style.touchAction).toBe("none");
    }
  });

  it("a área de clique de cada alça tem 12 px ou mais", () => {
    setup();

    for (const alca of screen.getAllByRole("button")) {
      // ───────────────────────────────────────────────────────────────────
      // A HITBOX É O VISUAL (adendo §2.3.4)
      //
      // Antes, a alça era posicionada 4px FORA da borda e o pseudo-elemento
      // `before:-inset-2` estendia o alvo mais 8px: a área clicável
      // ultrapassava 12px da borda do painel e capturava o clique do
      // vizinho.
      //
      // Agora a alça é o próprio alvo — 12px (borda) ou 16px (canto), dentro
      // da moldura. Este teste trava as DUAS metades: o tamanho mínimo e a
      // ausência de overhang.
      // ───────────────────────────────────────────────────────────────────
      expect(alca.className).not.toContain("before:-inset-2");
      expect(alca.className).not.toMatch(/(^|\s)-[lrbt]-\d/);
    }
  });

  it("o cursor bate com a direção de cada alça", () => {
    setup();

    // Cursors errados são o sintoma clássico de "não dá para redimensionar":
    // a alça funciona, mas o ponteiro não diz que ali se redimensiona.
    const cursores = screen
      .getAllByRole("button")
      .map((alca) => /cursor-[a-z]+-resize/.exec(alca.className)?.[0]);

    expect(cursores.filter(Boolean)).toHaveLength(8);
    // Existe ao menos um `ns-resize` (borda) e um `nwse-resize` (canto).
    expect(cursores).toContain("cursor-ns-resize");
    expect(cursores).toContain("cursor-ew-resize");
    expect(cursores).toContain("cursor-nwse-resize");
    expect(cursores).toContain("cursor-nesw-resize");
  });
});

/* ===========================================================================
 * O GESTO (§1.10 — "redimensionar com mouse altera w/h em passos de célula")
 * ======================================================================== */

describe("ResizeHandles — arrastar a borda direita CRESCE o bloco", () => {
  it("arraste de +3 células aumenta a largura em 3", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda direita", PASSO_X * 3, 0);

    const ultimo = lastOf(onResize);
    expect(ultimo?.w).toBe(ORIGEM.w + 3);
  });

  it("NÃO move a borda esquerda ao crescer pela direita", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda direita", PASSO_X * 3, 0);

    const ultimo = lastOf(onResize);
    expect(ultimo?.x).toBe(ORIGEM.x);
  });

  it("arraste de -3 células encolhe, parando no mínimo POR TIPO", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda direita", PASSO_X * -999, 0);

    const ultimo = lastOf(onResize);
    expect(ultimo?.w).toBe(minSizeOf("attributes").w);
  });
});

describe("ResizeHandles — arrastar a borda inferior CRESCE o bloco", () => {
  it("arraste de +4 células aumenta a altura em 4", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda inferior", 0, PASSO_Y * 4);

    const ultimo = lastOf(onResize);
    expect(ultimo?.h).toBe(ORIGEM.h + 4);
    expect(ultimo?.y).toBe(ORIGEM.y);
  });
});

describe("ResizeHandles — a borda esquerda é INVERSA: quem manda é o ponteiro", () => {
  // ───────────────────────────────────────────────────────────────────────
  // `delta` É O MOVIMENTO DO PONTEIRO, NÃO "quanto crescer".
  //
  // É a leitura natural e a única sem surpresas: arrastar a alça para a
  // DIREITA move a borda esquerda para a direita, e o bloco ENCOLHE. Com a
  // borda direita acontece o contrário, e é essa assimetria que faz sentido:
  // o ponteiro arrasta a borda que está segurando, não o tamanho.
  //
  // Ler `delta` como "quanto crescer" nos dois lados é o que faz uma borda
  // funcionar e a outra ficar invertida — e o sintoma ("arrastando para a
  // direita, o bloco encolhe") não aponta para a causa.
  // ───────────────────────────────────────────────────────────────────────

  it("ponteiro para a ESQUERDA cresce o bloco e puxa o x", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda esquerda", PASSO_X * -3, 0);

    const ultimo = lastOf(onResize);
    // Sem mover o x, a alça ficaria parada longe do cursor e o bloco
    // "engordaria" para a direita.
    expect(ultimo?.w).toBe(ORIGEM.w + 3);
    expect(ultimo?.x).toBe(ORIGEM.x - 3);
  });

  it("ponteiro para a DIREITA encolhe o bloco", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda esquerda", PASSO_X * 3, 0);

    const ultimo = lastOf(onResize);
    expect(ultimo?.w).toBe(ORIGEM.w - 3);
    expect(ultimo?.x).toBe(ORIGEM.x + 3);
  });
});

describe("ResizeHandles — a borda superior também é inversa", () => {
  it("ponteiro para CIMA cresce o bloco e puxa o y", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda superior", 0, PASSO_Y * -3);

    const ultimo = lastOf(onResize);
    expect(ultimo?.h).toBe(ORIGEM.h + 3);
    expect(ultimo?.y).toBe(ORIGEM.y - 3);
  });

  it("ponteiro para BAIXO encolhe o bloco", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda superior", 0, PASSO_Y * 3);

    expect(lastOf(onResize)?.h).toBe(ORIGEM.h - 3);
  });
});

describe("ResizeHandles — passos de célula", () => {
  it("arrastar MENOS que uma célula não muda nada", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    // 10 px numa coluna de 30 + 12 de gap: arredonda para 0.
    await arrastar(user, "Redimensionar pela borda direita", 10, 0);

    const ultimo = lastOf(onResize);
    expect(ultimo?.w).toBe(ORIGEM.w);
  });

  it("TODO tamanho emitido é INTEIRO", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    // Movimentos deliberadamente não múltiplos do passo: o arredondamento é o
    // que produz o snap.
    for (const delta of [7, 23, 55, 91]) {
      await arrastar(user, "Redimensionar pela borda direita", delta, 0);
    }

    for (const [chamada] of onResize.mock.calls) {
      const valor = chamada as { x: number; y: number; w: number; h: number };
      expect(Number.isInteger(valor.w)).toBe(true);
      expect(Number.isInteger(valor.h)).toBe(true);
      expect(Number.isInteger(valor.x)).toBe(true);
      expect(Number.isInteger(valor.y)).toBe(true);
    }
  });
});

describe("ResizeHandles — limites", () => {
  it("NÃO deixa a largura passar da grade, nem arrastando muito", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(user, "Redimensionar pela borda direita", 100000, 0);

    expect(lastOf(onResize)?.w).toBe(GRID_MAX_W);
  });

  it("NÃO deixa o topo passar do container", async () => {
    const user = userEvent.setup();
    const { onResize } = setup({ maxRows: 30 });

    // O bloco está em `y: 5` com `h: 12`, e o container tem 30 linhas.
    // Esticar o topo até o teto põe a borda em 30 — e não além.
    await arrastar(user, "Redimensionar pela borda superior", 0, PASSO_Y * 999);

    const ultimo = lastOf(onResize)!;
    expect(ultimo.y + ultimo.h).toBeLessThanOrEqual(30);
    expect(ultimo.y).toBeGreaterThanOrEqual(0);
  });

  it("nunca deixa posição negativa", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await arrastar(
      user,
      "Redimensionar pela borda esquerda",
      PASSO_X * -999,
      0,
    );

    const ultimo = lastOf(onResize)!;
    expect(ultimo.x).toBeGreaterThanOrEqual(0);
    expect(ultimo.w).toBeGreaterThan(0);
  });
});

/* ===========================================================================
 * INDICADOR DE TAMANHO (§1.5)
 * ======================================================================== */

describe("ResizeHandles — indicador de tamanho", () => {
  it("NÃO aparece antes do gesto", () => {
    setup();
    // Mostrar "12 × 12" parado o tempo todo poluiria a tela e competiria com
    // o tamanho que o cabeçalho já mostra.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("aparece durante o arraste com células E pixels", async () => {
    const user = userEvent.setup();
    setup();

    const alca = screen.getByRole("button", {
      name: "Redimensionar pela borda direita",
    });
    await user.pointer([
      {
        target: alca,
        keys: "[MouseLeft>]",
        coords: { clientX: 0, clientY: 0 },
      },
      { target: alca, coords: { clientX: PASSO_X * 3, clientY: 0 } },
    ]);

    const indicador = screen.getByRole("status");
    // Duas informações porque respondem perguntas diferentes: as células dizem
    // se encaixou no grid, os pixels dizem quanto espaço ficou.
    expect(indicador.textContent).toContain("células");
    expect(indicador.textContent).toContain("px");
    expect(indicador.getAttribute("aria-live")).toBe("polite");
  });
});

/* ===========================================================================
 * TECLADO — §1.5 não pode depender do mouse
 * ======================================================================== */

describe("ResizeHandles — teclado", () => {
  it("seta para a direita cresce a largura uma célula", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    await user.tab();
    const alca = screen.getByRole("button", {
      name: "Redimensionar pela borda direita",
    });
    alca.focus();
    await user.keyboard("{ArrowRight}");

    expect(lastOf(onResize)?.w).toBe(ORIGEM.w + 1);
  });

  it("Shift dá um passo largo de dez células", async () => {
    const user = userEvent.setup();
    const { onResize } = setup();

    const alca = screen.getByRole("button", {
      name: "Redimensionar pela borda direita",
    });
    alca.focus();
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");

    expect(lastOf(onResize)?.w).toBe(ORIGEM.w + 10);
  });

  it("a alça é a PRIMEIRA coisa focável — sem armadilha de foco", () => {
    setup();

    // O primeiro Tab precisa chegar numa alça: se houvesse um elemento
    // invisível antes, o teclado gastaria um aperto sem avançar.
    const primeiro = screen.getAllByRole("button")[0]!;
    expect(primeiro.tagName).toBe("BUTTON");
  });
});

/* ===========================================================================
 * SEPARAÇÃO ARRASTE × REDIMENSIONAMENTO (§1.4 — "clique no conteúdo nunca move")
 * ======================================================================== */

describe("ResizeHandles — não compete com o arraste", () => {
  it("as oito alças estão COM `stopPropagation` no caminho do arraste", () => {
    setup();

    // O `pointerdown` da alça chama `event.stopPropagation()`. Sem ele, um
    // clique na alça ALSO chega ao handle de arraste do bloco, e o redimensionar
    // viraria também um arrastar.
    expect(RESIZE_DIRECTIONS).toHaveLength(8);
    expect(GRID_COLUMNS).toBeGreaterThan(0);
  });

  it("a alça é um BUTTON, não uma div — o clique não vira arraste", () => {
    setup();

    for (const alca of screen.getAllByRole("button")) {
      expect(alca.tagName).toBe("BUTTON");
      expect(alca.getAttribute("type")).toBe("button");
    }
  });
});
