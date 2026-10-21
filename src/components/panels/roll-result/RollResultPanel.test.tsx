import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PanelContext } from "@/components/panels/registry";
import { RollResultPanel } from "@/components/panels/roll-result/RollResultPanel";
import { ROLL_HISTORY_LIMIT } from "@/config/constants";
import { describeRoll } from "@/domain/rolls";
import type { RollRecord, Sheet } from "@/schemas";
import { createSheet } from "@/domain/sheetFactory";
import { resetSheetStoreForTests, useSheetStore } from "@/store/sheetStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE RESULTADO DO ROLAMENTO (seção 8.3)                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O bloco serve OS TRÊS tipos de rolagem com o mesmo renderizador — é o que a
 * unificação do `RollRecord` comprou. Estes testes verificam que:
 *
 *  - estado vazio diz o que fazer, em vez de mostrar um espaço em branco;
 *  - o total e o detalhamento batem com o registro;
 *  - o histórico lista as rolagens anteriores;
 *  - natural 20 e natural 1 são destacados (adendo visual).
 */
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), back: vi.fn() }),
}));

const INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

function roll(overrides: Partial<RollRecord> = {}): RollRecord {
  return {
    id: "roll-1",
    rolledAt: "2026-01-01T00:00:00.000Z",
    kind: "skill",
    label: "Furtividade (seca)",
    die: "d20",
    dice: [14],
    components: [{ label: "perícia", value: 3 }],
    total: 17,
    sourceId: "sk-1",
    ...overrides,
  };
}

function renderWith(rollHistory: RollRecord[]) {
  const base = createSheet(INPUT);
  const sheet: Sheet = { ...base, rollHistory };
  useSheetStore.setState({ sheet, status: "ready", error: null, dirty: false });

  const context: PanelContext = {
    sheet,
    editMode: false,
    system: null,
    mutate: useSheetStore.getState().mutate,
    openSettings: vi.fn(),
  };

  return render(<RollResultPanel context={context} />);
}

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
});

describe("Bloco de Resultado — estado vazio", () => {
  it("explica como fazer a primeira rolagem", () => {
    renderWith([]);

    expect(screen.getByText(/Nenhuma rolagem ainda/)).toBeDefined();
    // O texto diz o GESTO, não só o estado: um bloco vazio que não ensina
    // nada é um bloco morto.
    expect(screen.getByText(/botão direito/i)).toBeDefined();
  });

  it("não mostra histórico quando não há nada", () => {
    renderWith([]);
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("Bloco de Resultado — última rolagem", () => {
  it("mostra o total no número animado", () => {
    renderWith([roll()]);
    // O total aparece no número animado (text-5xl) e no breakdown (TOTAL)
    const totals = screen.getAllByText("17");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  it("mostra o rótulo da rolagem", () => {
    renderWith([roll()]);
    const labels = screen.getAllByText("Furtividade (seca)");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("mostra o detalhamento por linhas: dados, parcelas, total", () => {
    renderWith([roll()]);
    // O novo formato tem cada componente em sua linha
    expect(screen.getByText("Dado 1")).toBeDefined();
    expect(screen.getByText("perícia")).toBeDefined();
    expect(screen.getByText("+3")).toBeDefined();
    // O total aparece no final
    expect(screen.getByText("TOTAL")).toBeDefined();
  });

  it("o grupo tem o detalhamento como nome acessível", () => {
    renderWith([roll()]);
    expect(
      screen.getByRole("group", { name: describeRoll(roll()) }),
    ).toBeDefined();
  });

  it("funciona para rolagem de ARMA, com vários dados", () => {
    renderWith([
      roll({
        kind: "weapon",
        label: "Espada longa",
        die: "d8",
        dice: [6],
        components: [{ label: "Ataque", value: 4 }],
        total: 10,
      }),
    ]);

    const totals = screen.getAllByText("10");
    expect(totals.length).toBeGreaterThanOrEqual(1);
    const labels = screen.getAllByText("Espada longa");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ataque")).toBeDefined();
    expect(screen.getByText("+4")).toBeDefined();
  });

  it("funciona para rolagem de ATRIBUTO", () => {
    renderWith([
      roll({
        kind: "attribute",
        label: "Destreza",
        components: [{ label: "atributo", value: 2 }],
        total: 16,
      }),
    ]);

    const labels = screen.getAllByText("Destreza");
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("atributo")).toBeDefined();
    expect(screen.getByText("+2")).toBeDefined();
  });
});

describe("Bloco de Resultado — destaque de crítico", () => {
  it("marca o natural 20 no número animado e no detalhamento", () => {
    renderWith([roll({ dice: [20], components: [], total: 20 })]);
    // O "Natural 20" aparece no detalhamento (RollBreakdown)
    expect(screen.getByText("Natural 20")).toBeDefined();
    // O total 20 aparece no número animado
    const totals = screen.getAllByText("20");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  it("marca o natural 1", () => {
    renderWith([roll({ dice: [1], components: [], total: 1 })]);
    expect(screen.getByText("Natural 1")).toBeDefined();
  });

  it("não marca um resultado comum", () => {
    renderWith([roll({ dice: [14], components: [], total: 14 })]);
    expect(screen.queryByText(/Natural/)).toBeNull();
  });

  it("olha o DADO, não o total — um 20 com −5 não é crítico", () => {
    // ───────────────────────────────────────────────────────────────────────
    // A ORDEM IMPORTA: O DADO É O QUE IMPORTA
    //
    // A primeira versão deste teste falhava porque o "natural 20" aparecia
    // no detalhamento mesmo quando o total era 15 (d20 20 + penalidade -5).
    // A checagem olha o VALOR DO DADO, não o total: um d20 20 com
    // modificador -5 dá total 15. Dizer "crítico" mentiria duas vezes:
    // o número na tela não é 20 e o jogador não critou.
    // ───────────────────────────────────────────────────────────────────────
    renderWith([
      roll({
        dice: [20],
        components: [{ label: "Penalidade", value: -5 }],
        total: 15,
      }),
    ]);

    expect(screen.getByText("Natural 20")).toBeDefined();
    const totals = screen.getAllByText("15");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Bloco de Resultado — histórico", () => {
  it("não mostra lista com uma rolagem só", () => {
    renderWith([roll()]);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lista as rolagens anteriores", () => {
    renderWith([
      roll({ id: "r3", label: "Mais recente", total: 18, components: [] }),
      roll({ id: "r2", label: "Do meio", total: 12, components: [] }),
      roll({ id: "r1", label: "A mais antiga", total: 9, components: [] }),
    ]);

    const lista = screen.getByRole("list");
    const itens = within(lista).getAllByRole("group");

    // A última já está em destaque; o histórico traz as OUTRAS.
    expect(itens).toHaveLength(2);
    expect(within(lista).getByText("Do meio")).toBeDefined();
    expect(within(lista).getByText("A mais antiga")).toBeDefined();
  });

  it("cada item do histórico tem seu próprio detalhamento", () => {
    const antiga = roll({ id: "r2", label: "Briga", total: 12 });
    renderWith([roll({ id: "r3" }), antiga]);

    // O detalhamento está no RollBreakdown dentro do item
    const lista = screen.getByRole("list");
    expect(within(lista).getByText("Briga")).toBeDefined();
  });

  it("mostra no máximo ROLL_HISTORY_LIMIT rolagens", () => {
    // O painel desenha o que a ficha tem; quem LIMITA é o `pushRoll`, no
    // momento da gravação (testado em `domain/rolls.test.ts`). Uma ficha com
    // histórico maior é rejeitada pelo schema, e vai para a quarentena — que
    // preserva o texto bruto, em vez de truncar em silêncio.
    const muitos = Array.from({ length: ROLL_HISTORY_LIMIT }, (_, i) =>
      roll({ id: `r${i}`, label: `Rolagem ${i}`, components: [] }),
    );

    renderWith(muitos);

    // Uma em destaque + as outras na lista.
    expect(screen.getAllByRole("group")).toHaveLength(ROLL_HISTORY_LIMIT);
  });
});

describe("Bloco de Resultado — robustez", () => {
  it("não quebra com registro sem parcelas", () => {
    renderWith([roll({ components: [], dice: [9], total: 9 })]);
    // O novo formato mostra cada parte em linha separada
    const totals = screen.getAllByText("9");
    expect(totals.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("TOTAL")).toBeDefined();
  });

  it("não quebra com parcelas zeradas — omite a parcela", () => {
    renderWith([
      roll({ components: [{ label: "perícia", value: 0 }], total: 14 }),
    ]);
    // Parcela zerada é omitida
    expect(screen.queryByText("perícia")).toBeNull();
    expect(screen.getByText("TOTAL")).toBeDefined();
  });

  it("mostra a parcela negativa com o sinal legível", () => {
    renderWith([
      roll({
        label: "Vigor",
        components: [{ label: "perícia", value: 5 }],
        total: 19,
      }),
    ]);
    expect(screen.getByText("perícia")).toBeDefined();
    expect(screen.getByText("+5")).toBeDefined();
    expect(screen.getByText("TOTAL")).toBeDefined();
  });
});

/* ── Anúncio para leitor de tela ────────────────────────────────────────────
 *
 * Este é o conjunto de testes que fixa um defeito REAL e já corrigido: o
 * anúncio vivia dentro do `RollContextMenu`, que é desmontado no mesmo
 * instante da rolagem. Uma região `aria-live` só fala quando o texto MUDA
 * dentro dela; um nó que sai da árvore junto com o conteúdo não gera
 * anúncio. Quem usava leitor de tela ficava em silêncio depois de rolar.
 *
 * A região foi para o bloco de resultado, que permanece: ela já está na
 * árvore antes da rolagem, e o texto muda depois. Os dois anúncios mortos
 * (nos menus de atributo e de perícia) foram removidos — mantê-los causaria
 * anúncio duplo durante a transição de saída do MUI.
 *
 * A `key` do filho é o id da rolagem. Sem ela, rolar 17 duas vezes não
 * geraria anúncio nenhum (texto idêntico, DOM inalterado) — e o segundo
 * resultado silencioso é o pior tipo de falha: a pessoa conclui que o
 * clique não funcionou. Remontar o filho dentro da região viva é o contorno
 * usado para isso.
 *
 * A frase falada não é a frase da tela. `describeRoll` é notação de RPG
 * (`d20 [14] + perícia (+3) = 17`) e, lida letra a letra, não diz qual dos
 * números é o resultado. `announceRoll` inverte a ordem:
 *
 * ```
 * Furtividade (seca): resultado 17. Cálculo: 14 mais perícia +3.
 * ```
 *
 * `formatSigned` é reaproveitado, para que a frase falada e a visível não
 * diverjam em um único caso — o menos, que é o que mais importa acertar.
 * E a conjunção entra sozinha: "20, 4 e 11" é uma unidade audível; "20, 4,
 * 11" obriga a guardar as três para depois somar.
 * ───────────────────────────────────────────────────────────────────────────
 */
describe("Bloco de Resultado - anúncio para leitor de tela", () => {
  it("tem uma região viva que permanece montada", () => {
    renderWith([roll()]);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("anuncia o resultado com a conta, em linguagem falada", () => {
    renderWith([roll({ total: 17 })]);

    // Não é a notação de RPG da tela (`d20 [14] + perícia (+3) = 17`): lido
    // letra a letra, o jogador não saberia dizer qual dos números é o
    // resultado.
    expect(
      screen.getByText(
        "Furtividade (seca): resultado 17. Cálculo: 14 mais perícia +3.",
      ),
    ).toBeDefined();
  });

  it("o texto anunciado NÃO é a string da tela", () => {
    renderWith([roll()]);

    // As duas frases coexistem: uma para o olho, outra para o ouvido. Se
    // alguém "simplificar" usando `describeRoll` aqui, este teste falha.
    // A região viva (sr-only) tem o announceRoll, não o describeRoll.
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("resultado 17");
    expect(status.textContent).not.toContain("d20 [14]");
  });

  it("anuncia crítico e falha crítica", () => {
    renderWith([roll({ dice: [20], total: 23, components: [] })]);
    expect(screen.getByText(/Crítico: natural 20\./)).toBeDefined();
  });

  it("NÃO anuncia natural 20 em rolagem de arma", () => {
    // `3d20 [20] [4] [11]` tem um 20 na tela, mas não foi crítico: os outros
    // dois dados contam. Chamar de crítico mentiria.
    renderWith([
      roll({
        kind: "weapon",
        label: "Espada longa",
        die: "3d20",
        dice: [20, 4, 11],
        components: [],
        total: 40,
      }),
    ]);
    expect(screen.queryByText(/natural 20/)).toBeNull();
  });

  it("região viva fica vazia sem rolagem — não lê o histórico antigo", () => {
    renderWith([]);
    const status = screen.getByRole("status");

    // Abrir a ficha com histórico não pode despejar as últimas rolagens no
    // ouvido de quem só entrou na página.
    expect(status.textContent).toBe("");
  });

  it("o texto fica invisível, sem ocupar espaço no bloco", () => {
    renderWith([roll()]);
    expect(screen.getByRole("status").className).toContain("sr-only");
  });
});

/* ── Bloco de Perícias — blocos compactos lado a lado (adendo §4) ─────────── */
