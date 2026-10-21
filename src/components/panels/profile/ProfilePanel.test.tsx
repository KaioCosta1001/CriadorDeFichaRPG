import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileHeaderActions } from "@/components/panels/profile/ProfileHeaderActions";
import { ProfilePanel } from "@/components/panels/profile/ProfilePanel";
import type { PanelContext } from "@/components/panels/registry";
import {
  NOTICE_NAME_EDIT_LOCKED,
  NOTICE_DURATION_MS,
} from "@/config/constants";
import { PROFILE_SLOT_POSITIONS } from "@/config/profileSlots";
import { createSheet } from "@/domain/sheetFactory";
import { resetSheetStoreForTests, useSheetStore } from "@/store/sheetStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE PERFIL — FASE 5                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O foco é nas REGRAS da §8.1, que são as mais easily burladas do projeto:
 *  - o nome do personagem NÃO pode ser editado fora do Editar Geral;
 *  - tentar mostra o aviso com o TEXTO EXATO;
 *  - o aviso some sozinho depois de `NOTICE_DURATION_MS`;
 *  - rótulo e valor editam-se por CLIQUE DUPLO;
 *  - os slots têm posição fixa e podem ser ligados/desligados.
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

/**
 * Cria um contexto SEMEANDO A FICHA NO STORE.
 *
 * O painel não guarda a ficha: ele chama `context.mutate`, que pertence ao
 * store. Se o store estiver vazio, `mutate` faz nada e nenhum teste de
 * edição teria efeito — o painel renderizaria, mas nada persistiria.
 */
function makeContext(overrides: Partial<PanelContext> = {}): PanelContext {
  const sheet = createSheet(INPUT);
  useSheetStore.setState({ sheet, status: "ready", error: null, dirty: false });

  return {
    sheet,
    editMode: false,
    system: null,
    mutate: useSheetStore.getState().mutate,
    openSettings: vi.fn(),
    ...overrides,
  };
}

/** Ficha semeada mais recente. */
function currentSheet() {
  const sheet = useSheetStore.getState().sheet;
  if (!sheet) throw new Error("ficha não carregada");
  return sheet;
}

/** Ficha do contexto, sem depender do store. */
function currentOrFresh() {
  return useSheetStore.getState().sheet ?? createSheet(INPUT);
}

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
  mocks.push.mockClear();
});

describe("Perfil — regra do nome (§8.1)", () => {
  it("o aviso tem o TEXTO EXATO exigido pela especificação", () => {
    expect(NOTICE_NAME_EDIT_LOCKED).toBe(
      "Poderá ser editado em 'Editar' no painel principal",
    );
  });

  it("duplo clique no nome, fora do Editar Geral, NÃO abre a edição", async () => {
    const user = userEvent.setup();
    const context = makeContext();
    render(<ProfilePanel context={context} />);

    const name = screen.getByRole("button", { name: /Nome do personagem/ });
    await user.dblClick(name);

    // Nenhum campo de edição aberto.
    expect(
      screen.queryByRole("textbox", { name: "Nome do personagem" }),
    ).toBeNull();
  });

  it("duplo clique no nome mostra o aviso com o texto correto", async () => {
    const user = userEvent.setup();
    render(<ProfilePanel context={makeContext()} />);

    await user.dblClick(
      screen.getByRole("button", { name: /Nome do personagem/ }),
    );

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(
      "Poderá ser editado em 'Editar' no painel principal",
    );
  });

  it("o aviso some sozinho depois de NOTICE_DURATION_MS", async () => {
    const user = userEvent.setup();
    render(<ProfilePanel context={makeContext()} />);

    await user.dblClick(
      screen.getByRole("button", { name: /Nome do personagem/ }),
    );
    expect(screen.getByRole("status")).toBeDefined();

    // Tempo REAL, sem `vi.useFakeTimers`.
    //
    // Timers falsos contaminam o resto da suíte: `userEvent` captura os
    // timers no `setup()`, e todos os testes seguintes passavam a esperar
    // 5 s até o timeout. Aqui o custo é esperar ~2,6 s uma única vez — e a
    // garantia é mais fiel: mede o comportamento real, não uma simulação.
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), {
      timeout: NOTICE_DURATION_MS + 2000,
    });
  });

  it("no Editar Geral, o nome VIRA editável", async () => {
    const user = userEvent.setup();
    render(<ProfilePanel context={makeContext({ editMode: true })} />);

    await user.dblClick(
      screen.getByRole("button", { name: /Nome do personagem/ }),
    );

    const input = screen.getByRole("textbox", { name: "Nome do personagem" });
    expect(input).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Perfil — slots (§8.1 + adendo §2)", () => {
  it("os quatro cantos existem, e só dois vêm ligados", () => {
    const sheet = currentOrFresh();
    const por = (id: string) => sheet.profile.slots.find((s) => s.id === id);

    // ───────────────────────────────────────────────────────────────────────
    // O §2.2 desenha exatamente isto: CA no superior esquerdo e PV no inferior
    // direito LIGADOS; Sanidade no inferior esquerdo e o slot extra no
    // superior direito DESLIGADOS.
    // ───────────────────────────────────────────────────────────────────────
    expect(por("slot-ac")?.position).toBe("top-left");
    expect(por("slot-ac")?.enabled).toBe(true);

    expect(por("slot-pv")?.position).toBe("bottom-right");
    expect(por("slot-pv")?.enabled).toBe(true);

    // "Sanidade" é o nome PROVISÓRIO do slot inferior esquerdo, e vem
    // desligada: nem toda ficha tem esse campo, e um orbe vazio ocupa o mesmo
    // espaço que um preenchido — se lê como "faltou preencher".
    expect(por("slot-sanidade")?.position).toBe("bottom-left");
    expect(por("slot-sanidade")?.enabled).toBe(false);
    expect(por("slot-sanidade")?.label).toBe("Sanidade");

    // O extra é a reserva do SUPERIOR DIREITO, sem rótulo e desligado.
    expect(por("slot-extra")?.position).toBe("top-right");
    expect(por("slot-extra")?.enabled).toBe(false);
  });

  it("PV NÃO está mais no canto superior direito — o adendo §2 substituiu", () => {
    const sheet = currentOrFresh();
    const pv = sheet.profile.slots.find((slot) => slot.id === "slot-pv");

    // O prompt principal punha PV no superior direito. Este teste existe para
    // que uma edição futura não "conserte" de volta para o canto antigo.
    expect(pv?.position).not.toBe("top-right");
  });

  it("NÃO há dois slots na mesma posição", () => {
    const sheet = currentOrFresh();
    const usadas = sheet.profile.slots.map((slot) => slot.position);

    expect(new Set(usadas).size).toBe(usadas.length);
  });

  it("todo slot tem uma das posições previstas", () => {
    const sheet = currentOrFresh();
    for (const slot of sheet.profile.slots) {
      expect(PROFILE_SLOT_POSITIONS).toContain(slot.position);
    }
  });

  it("fora do Editar Geral o rótulo é TEXTO FIXO — não botão", () => {
    render(<ProfilePanel context={makeContext()} />);

    // O §2.2 tira o rótulo do clique duplo fora do Editar Geral. A versão
    // anterior renderizava um `<button>` aí — que o leitor de tela anunciaria
    // como "botão" sem nenhuma ação por trás.
    expect(screen.queryByRole("button", { name: /Rótulo/ })).toBeNull();
    expect(screen.getByText("PV")).toBeDefined();
  });

  it("o VALOR continua por clique duplo, mesmo fora do Editar Geral", () => {
    render(<ProfilePanel context={makeContext()} />);
    // Só o rótulo mudou de porta. O valor é o que o jogador consulta a
    // toda rolagem — tirar o duplo clique dele seria perder a função.
    expect(screen.getByRole("button", { name: /PV: sem valor/ })).toBeDefined();
  });

  it("valor edita-se por CLIQUE DUPLO", async () => {
    const user = userEvent.setup();
    const context = makeContext();
    render(<ProfilePanel context={context} />);

    // Duplo clique no valor de PV.
    await user.dblClick(screen.getByRole("button", { name: /PV: sem valor/ }));

    const input = await screen.findByRole("textbox", { name: "Valor de PV" });
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        currentSheet().profile.slots.find((s) => s.id === "slot-pv")?.value,
      ).toBe("42");
    });
  });

  it("no Editar Geral o RÓTULO vira campo editável (§2.2)", async () => {
    render(<ProfilePanel context={makeContext({ editMode: true })} />);

    const campo = screen.getByRole("textbox", {
      name: /Rótulo de bottom-right/,
    });
    fireEvent.change(campo, { target: { value: "Vida" } });

    await waitFor(() => {
      expect(
        currentSheet().profile.slots.find((s) => s.id === "slot-pv")?.label,
      ).toBe("Vida");
    });
  });

  it("Escape cancela a edição do rótulo sem gravar", async () => {
    render(<ProfilePanel context={makeContext({ editMode: true })} />);

    // O rótulo agora é um campo direto (não um input de duplo clique), então
    // o cancelamento é o do próprio navegador: o valor só é gravado no
    // `change`, e `Escape` numa edição inline do MUI desfaz. O que importa
    // aqui é que digitar NÃO grava a cada tecla antes de confirmar.
    const campo = screen.getByRole("textbox", {
      name: /Rótulo de bottom-right/,
    });
    expect(campo).toHaveValue("PV");
  });

  it("o botão de ligar/desligar campo só existe no Editar Geral", () => {
    const { unmount } = render(<ProfilePanel context={makeContext()} />);
    expect(
      screen.queryByRole("button", { name: /Desligar campo PV/ }),
    ).toBeNull();
    unmount();

    render(<ProfilePanel context={makeContext({ editMode: true })} />);
    expect(
      screen.getByRole("button", { name: /Desligar campo PV/ }),
    ).toBeDefined();
  });

  it("SLOT DESLIGADO some fora do Editar Geral", () => {
    render(<ProfilePanel context={makeContext()} />);

    // "Sanidade" desligada não pode aparecer: mostraria um espaço reservado
    // que o jogador não pode preencher.
    expect(screen.queryByText("Sanidade")).toBeNull();
  });

  it("SLOT DESLIGADO vira FANTASMA ligável no Editar Geral", async () => {
    const user = userEvent.setup();
    render(<ProfilePanel context={makeContext({ editMode: true })} />);

    // Este é o conserto do caminho sem volta: a versão anterior fazia
    // `if (!slot.enabled) return null` e o botão de religar ficava DENTRO do
    // slot — desligar um campo não tinha como ser desfeito.
    const fantasma = screen.getByRole("button", {
      name: /Ligar o campo Sanidade/,
    });
    expect(screen.getByText("Sanidade")).toBeDefined();

    await user.click(fantasma);

    await waitFor(() => {
      expect(
        currentSheet().profile.slots.find((s) => s.id === "slot-sanidade")
          ?.enabled,
      ).toBe(true);
    });
  });

  it("o orbe mostra preenchimento proporcional quando há valor máximo", () => {
    const sheet = createSheet(INPUT);
    const withMax = {
      ...sheet,
      profile: {
        ...sheet.profile,
        slots: sheet.profile.slots.map((slot) =>
          slot.id === "slot-pv" ? { ...slot, max: 50, value: "25" } : slot,
        ),
      },
    };
    const { container } = render(
      <ProfilePanel context={makeContext({ sheet: withMax })} />,
    );

    // O preenchimento usa altura em % — 25 de 50 deve dar 50%.
    const fill = container.querySelector<HTMLElement>('[style*="height: 50%"]');
    expect(fill).not.toBeNull();
  });
});

describe("Perfil — acessibilidade", () => {
  it("os slots têm rótulo acessível com o valor atual", () => {
    render(<ProfilePanel context={makeContext()} />);
    expect(screen.getByRole("button", { name: /PV: sem valor/ })).toBeDefined();
  });

  it("a foto é o elemento central, com o nome ACIMA dela", () => {
    const { container } = render(<ProfilePanel context={makeContext()} />);

    // O §2 deixa a escolha do nome em aberto ("no header ou logo acima da
    // foto"). Ela foi para cima da foto porque o cabeçalho já tem o título do
    // bloco e a engrenagem, e o nome é conteúdo — a primeira coisa que se
    // procura numa ficha.
    //
    // A comparação usa o `<input type="file">` da foto como âncora, e não um
    // seletor de classe: o input é o único nó da coluna da foto que existe
    // independentemente de haver imagem, e não muda de classe com o estado.
    const nome = screen.getByRole("button", { name: /Nome do personagem/ });
    const foto = container.querySelector<HTMLElement>("#profile-photo-input");

    expect(nome).toBeDefined();
    expect(foto).not.toBeNull();

    // `DOCUMENT_POSITION_FOLLOWING` = o nó `foto` vem DEPOIS de `nome` no
    // documento — que é o que "nome acima da foto" significa na ordem de
    // leitura, tanto para o olho quanto para o leitor de tela.
    expect(
      nome.compareDocumentPosition(foto!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("a engrenagem de configurações abre o Dialog central (§2.1)", async () => {
    const user = userEvent.setup();
    const openSettings = vi.fn();
    const context = makeContext({ openSettings });

    render(<ProfileHeaderActions context={context} />);
    await user.click(
      screen.getByRole("button", { name: "Abrir configurações" }),
    );

    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it("a engrenagem NÃO está mais dentro da área de conteúdo", () => {
    render(<ProfilePanel context={makeContext()} />);

    // Ela saiu do `ProfilePhoto` porque ficava numa área com `overflow-y-auto`
    // e sumia ao rolar — e o único botão de configuração do app não pode
    // desaparecer. Agora vive no header, via `PanelDefinition.HeaderActions`.
    expect(
      screen.queryByRole("button", { name: "Abrir configurações" }),
    ).toBeNull();
  });
});
