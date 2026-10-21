import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttributesPanel } from "@/components/panels/attributes/AttributesPanel";
import type { PanelContext } from "@/components/panels/registry";
import {
  DND_ACTIVATION_DISTANCE_PX,
  MAX_ATTRIBUTES,
  RARITY_PRESETS,
} from "@/config/constants";
import type { Sheet } from "@/schemas";
import { createSheet } from "@/domain/sheetFactory";
import { resetSheetStoreForTests, useSheetStore } from "@/store/sheetStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE ATRIBUTOS — FASE 6 (§8.4)                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * As regras que estes testes defendem:
 *
 *  - o "+" e o arraste (a QUANTIDADE e a ORDEM) só existem no Editar Geral;
 *  - o lápis do BLOCO libera cor e exclusão, e nada mais;
 *  - nome e valor editam-se por clique duplo, com `Enter` gravando;
 *  - texto não numérico no valor NÃO vira 0 — volta ao valor anterior;
 *  - remover um atributo desfaz o vínculo das perícias e avisa quantas foram.
 *
 * A última é a que mais importa: sem ela, apagar "Força" deixaria todas as
 * perícias de Força anunciando um "Modificador +3" que não existe mais.
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

interface HarnessProps {
  editMode?: boolean;
  system?: PanelContext["system"];
}

/**
 * Espelha o `SheetScreen`: assina o store e monta o contexto a partir da
 * ficha VIVA.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO PASSAR UM CONTEXTO ESTÁTICO
 * O painel recebe `context.sheet` por props; ele não assina o store. Passar
 * um objeto fixo faria o painel pintar uma FOTO congelada da ficha: o
 * `mutate` gravaria, mas a tela continuaria mostrando o estado antigo. Vários
 * testes passariam e o app estaria quebrado.
 *
 * `SheetScreen` assina `useSheetStore()` e reconstrói o contexto a cada
 * render — o harness faz o mesmo, então o teste exercita o caminho real.
 * ───────────────────────────────────────────────────────────────────────────
 */
function Harness({ editMode = false, system = null }: HarnessProps) {
  const sheet = useSheetStore((state) => state.sheet);
  const mutate = useSheetStore((state) => state.mutate);

  if (!sheet) return null;

  return (
    <AttributesPanel
      context={{ sheet, editMode, system, mutate, openSettings: vi.fn() }}
    />
  );
}

/** Semeia a ficha NO STORE — é de lá que o painel tira o que exibe. */
function seed(sheet?: Sheet) {
  const target = sheet ?? createSheet(INPUT);
  useSheetStore.setState({
    sheet: target,
    status: "ready",
    error: null,
    dirty: false,
  });
  return target;
}

function renderPanel(props: HarnessProps = {}) {
  seed();
  return render(<Harness {...props} />);
}

function currentSheet() {
  const sheet = useSheetStore.getState().sheet;
  if (!sheet) throw new Error("ficha não carregada");
  return sheet;
}

/** O aviso do painel. Não usa `role="status"`: o Tooltip do MUI também publica um. */
function notice() {
  return screen.getByText(/removido/);
}

/** Liga o lápis do bloco. */
async function openBlockEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Editar bloco" }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
});

describe("Bloco de Atributos — leitura", () => {
  it("mostra nome e valor de cada atributo do modelo", () => {
    renderPanel();

    expect(screen.getByText("Força")).toBeDefined();
    expect(screen.getByText("Destreza")).toBeDefined();
    expect(screen.getByText("Carisma")).toBeDefined();
  });

  it("o valor tem nome acessível com o do atributo", () => {
    renderPanel();

    // Um leitor de tela anunciaria só "10" se o botão não dissesse a que
    // atributo o número pertence.
    expect(
      screen.getByRole("button", { name: /Valor do atributo Força: 10/ }),
    ).toBeDefined();
  });

  it("mostra a contagem contra o limite", () => {
    renderPanel();
    expect(screen.getByText(`6 de ${MAX_ATTRIBUTES} atributos`)).toBeDefined();
  });

  it("o valor grande é um botão de leitura, não um campo de texto", () => {
    renderPanel();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("Bloco de Atributos — as duas portas de edição", () => {
  it('o "+" NÃO existe fora do Editar Geral (§8.4: quantidade é sensível)', () => {
    renderPanel();
    expect(
      screen.queryByRole("button", { name: "Adicionar atributo" }),
    ).toBeNull();
  });

  it('o "+" NÃO aparece no Editar Geral — só no lápis do bloco', async () => {
    const user = userEvent.setup();
    renderPanel({ editMode: true });

    // Adendo, seção 1: criar atributo é decisão sobre o CONTEÚDO da ficha.
    expect(
      screen.queryByRole("button", { name: "Adicionar atributo" }),
    ).toBeNull();
    void user;
  });

  it('o "+" aparece no LÁPIS do bloco e cria um atributo', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Adicionar atributo" }),
    );

    await waitFor(() => expect(currentSheet().attributes).toHaveLength(7));
    // A interface também reflete: o contador sobe.
    expect(screen.getByText(`7 de ${MAX_ATTRIBUTES} atributos`)).toBeDefined();
    // Nasce preenchido: uma caixa vazia seria indistinguível de um cartão
    // que falhou ao carregar.
    expect(currentSheet().attributes.at(-1)?.name).toBe("NOVO");
  });

  it('o "+" funciona com os DOIS modos ligados ao mesmo tempo', async () => {
    const user = userEvent.setup();
    renderPanel({ editMode: true });
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Adicionar atributo" }),
    );

    await waitFor(() => expect(currentSheet().attributes).toHaveLength(7));
  });

  it('o segundo "+" não repete o nome', async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    const add = screen.getByRole("button", { name: "Adicionar atributo" });
    await user.click(add);
    await user.click(add);

    await waitFor(() => expect(currentSheet().attributes).toHaveLength(8));
    expect(currentSheet().attributes.at(-1)?.name).toBe("NOVO 2");
  });

  it("o handle de arraste só existe no Editar do BLOCO", async () => {
    // ───────────────────────────────────────────────────────────────────────
    // POR QUE MUDOU (adendo §3.4 e §3.5)
    //
    // Antes, o handle aparecia no Editar Geral — junto com o arraste dos
    // PAINÉIS. Duas coisas diferentes na mesma flag: o Editar Geral move o
    // PAINEL; o lápis do bloco edita e reordena o CONTEÚDO do bloco.
    //
    // O adendo §3.5 é explícito: "Com apenas o Editar Geral ligado, as listas
    // NÃO reordenam" e "Com o Editar do bloco desligado, o ⠿ não aparece".
    // ───────────────────────────────────────────────────────────────────────
    const user = userEvent.setup();
    renderPanel({ editMode: true });

    // Editar Geral LIGADO: o handle NÃO aparece.
    expect(
      screen.queryByRole("button", { name: "Reordenar Força" }),
    ).toBeNull();

    // Com o lápis do bloco ligado, o handle aparece.
    await openBlockEdit(user);
    expect(
      screen.getByRole("button", { name: "Reordenar Força" }),
    ).toBeDefined();
  });

  it("o lápis do bloco libera cor, exclusão E criação", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    expect(
      screen.getByRole("button", { name: "Remover atributo Força" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Raridade de Força: Comum" }),
    ).toBeDefined();
    // Adendo, seção 1: o "+" passou para o lápis do bloco.
    expect(
      screen.getByRole("button", { name: "Adicionar atributo" }),
    ).toBeDefined();
  });

  it("o lápis do bloco fica clicável COM o Editar Geral ligado", async () => {
    // A causa raiz do bug de "não clico em nada": o chanfro do modo editar
    // (`absolute inset-0 z-20`) ficava acima do conteúdo (`z-10`) e
    // engolia todo clique. Este teste é a rede de segurança.
    const user = userEvent.setup();
    renderPanel({ editMode: true });

    await openBlockEdit(user);

    expect(
      screen.getByRole("button", { name: "Remover atributo Força" }),
    ).toBeDefined();
  });

  it("os dois modos juntos não conflitam", async () => {
    const user = userEvent.setup();
    renderPanel({ editMode: true });
    await openBlockEdit(user);

    expect(
      screen.getByRole("button", { name: "Adicionar atributo" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Remover atributo Força" }),
    ).toBeDefined();
    // Reordenar é exclusivo do LÁPIS DO BLOCO (adendo §3.4): mesmo com o
    // Editar Geral ligado, quem abre o handle é o lápis.
    expect(
      screen.getByRole("button", { name: "Reordenar Força" }),
    ).toBeDefined();
  });
});

describe("Bloco de Atributos — edição inline", () => {
  it("duplo clique no nome abre o campo; Enter grava", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(screen.getByText("Força"));
    const input = screen.getByRole("textbox", {
      name: "Nome do atributo Força",
    });

    await user.clear(input);
    await user.type(input, "Vigor");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByText("Vigor")).toBeDefined());
    expect(
      currentSheet().attributes.find((a) => a.name === "Vigor")?.value,
    ).toBe(10);
  });

  it("Escape cancela e devolve o valor antigo", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(screen.getByText("Força"));
    const input = screen.getByRole("textbox", {
      name: "Nome do atributo Força",
    });
    await user.clear(input);
    await user.type(input, "Vigor");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.getByText("Força")).toBeDefined());
    expect(currentSheet().attributes.some((a) => a.name === "Vigor")).toBe(
      false,
    );
  });

  it("duplo clique no valor abre um campo; Enter grava", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(
      screen.getByRole("button", { name: /Valor do atributo Força: 10/ }),
    );
    const input = screen.getByRole("textbox", {
      name: "Valor do atributo Força",
    });

    await user.clear(input);
    await user.type(input, "18");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        currentSheet().attributes.find((a) => a.name === "Força")?.value,
      ).toBe(18),
    );
  });

  it("texto não numérico MANTÉM o valor anterior, em vez de virar 0", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(
      screen.getByRole("button", { name: /Valor do atributo Força: 10/ }),
    );
    const input = screen.getByRole("textbox", {
      name: "Valor do atributo Força",
    });

    await user.clear(input);
    await user.type(input, "abc");
    await user.keyboard("{Enter}");

    // Um "0" inventado seria pior que a recusa: o jogador acharia que Força
    // vale 0 e jogaria com a ficha errada.
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /Valor do atributo Força: 10\. Clique/,
        }),
      ).toBeDefined(),
    );
    expect(
      currentSheet().attributes.find((a) => a.name === "Força")?.value,
    ).toBe(10);
  });

  it("valor fora da faixa é LIMITADO, não recusado em silêncio", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(
      screen.getByRole("button", { name: /Valor do atributo Força: 10/ }),
    );
    const input = screen.getByRole("textbox", {
      name: "Valor do atributo Força",
    });

    await user.clear(input);
    await user.type(input, "99999");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        currentSheet().attributes.find((a) => a.name === "Força")?.value,
      ).toBe(999),
    );
  });
});

describe("Bloco de Atributos — cor", () => {
  it("o preset de raridade grava a cor do atributo", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    const preset = RARITY_PRESETS[2];
    await user.click(
      screen.getByRole("button", {
        name: `Raridade de Força: ${preset.label}`,
      }),
    );

    await waitFor(() =>
      expect(
        currentSheet().attributes.find((a) => a.name === "Força")?.color,
      ).toBe(preset.color),
    );
  });

  it("o preset selecionado é anunciado por aria-pressed", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    const name = "Raridade de Força: Comum";
    expect(
      screen.getByRole("button", { name }).getAttribute("aria-pressed"),
    ).toBe("false");

    await user.click(screen.getByRole("button", { name }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
  });
});

describe("Bloco de Atributos — remoção", () => {
  it("remove o atributo escolhido", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Remover atributo Força" }),
    );

    await waitFor(() => expect(screen.queryByText("Força")).toBeNull());
    expect(currentSheet().attributes.some((a) => a.name === "Força")).toBe(
      false,
    );
  });

  it("não mexe nos outros atributos", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    const antes = currentSheet().attributes.length;

    await user.click(
      screen.getByRole("button", { name: "Remover atributo Força" }),
    );

    await waitFor(() =>
      expect(currentSheet().attributes).toHaveLength(antes - 1),
    );
    expect(screen.getByText("Destreza")).toBeDefined();
  });

  it("remover atributo SEM vínculo avisa só a remoção", async () => {
    const user = userEvent.setup();
    const base = createSheet(INPUT);
    seed({
      ...base,
      attributes: [
        ...base.attributes,
        { id: "attr-sozinho", name: "Sorte", value: 5, color: null },
      ],
    });
    render(<Harness />);
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Remover atributo Sorte" }),
    );

    await waitFor(() => expect(notice().textContent).toContain("removido"));
  });
});
describe("Bloco de Atributos — menu de rolagem", () => {
  /** O cartão do atributo. O gatilho fica no próprio `<div>` raiz. */
  function cardOf(name: string) {
    return screen.getByRole("button", {
      name: new RegExp(`Nome do atributo: ${name}\\.`),
    }).parentElement as HTMLElement;
  }

  /**
   * O alvo de teclado é o PRÓPRIO CARTÃO.
   *
   * O botão "Rolar" vive DENTRO do popup (decisão do autor), então não há
   * botão separado sobre o cartão. O `Tab` alcança o cartão — que tem
   * `aria-haspopup="menu"` e `aria-label="Rolar Força"` — e `Menu`/`Shift+F10`
   * abre o mesmo popup do clique direito.
   */
  function rollButtonOf(name: string) {
    return screen.getByRole("button", { name: `Rolar ${name}` });
  }

  it('o botão direito abre um menu com UM item só: "Rolar"', async () => {
    renderPanel();

    fireEvent.contextMenu(cardOf("Força"));

    const menu = await screen.findByRole("menu");
    const itens = within(menu).getAllByRole("menuitem");
    expect(itens).toHaveLength(1);
    expect(itens[0]).toHaveTextContent("Rolar");
    expect(menu.textContent).toContain("Força");
  });

  it('o menu NÃO tem "Rolar seca" — aqui o d20 já traz o atributo', async () => {
    renderPanel();

    fireEvent.contextMenu(cardOf("Força"));
    const menu = await screen.findByRole("menu");

    expect(within(menu).queryByRole("menuitem", { name: /seca/i })).toBeNull();
  });

  it('"Rolar" registra a rolagem com a conversão do SISTEMA', async () => {
    renderPanel();

    fireEvent.contextMenu(cardOf("Força"));
    await userEvent.setup().click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Rolar",
      }),
    );

    await waitFor(() => expect(currentSheet().rollHistory).toHaveLength(1));

    const [roll] = currentSheet().rollHistory;
    expect(roll?.kind).toBe("attribute");
    expect(roll?.label).toBe("Força");
    expect(roll?.die).toBe("d20");
    expect(roll?.components[0]?.label).toBe("atributo");
    expect(roll?.total).toBe(
      (roll?.dice[0] ?? 0) + (roll?.components[0]?.value ?? 0),
    );
  });

  it("o total bate com a conversão que a arma usaria", async () => {
    renderPanel();
    const forca = currentSheet().attributes.find((a) => a.name === "Força");

    fireEvent.contextMenu(cardOf("Força"));
    await userEvent.setup().click(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Rolar",
      }),
    );

    await waitFor(() => expect(currentSheet().rollHistory).toHaveLength(1));

    const [roll] = currentSheet().rollHistory;
    // D&D 5e: floor((10 - 10) / 2) = 0 → a parcela some do texto, mas o
    // registro continua guardando o valor.
    expect(roll?.components[0]?.value).toBe(0);
    expect(roll?.total).toBe(roll?.dice[0]);
    expect(forca?.value).toBe(10);
  });

  it("o bloco de rolagem é focável, com aria-haspopup e rótulo", () => {
    renderPanel();

    const button = rollButtonOf("Força");
    expect(button.getAttribute("tabindex")).toBe("0");
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    expect(button.getAttribute("aria-label")).toBe("Rolar Força");
  });

  it("a tecla Menu abre o mesmo menu", async () => {
    const user = userEvent.setup();
    renderPanel();

    rollButtonOf("Força").focus();
    await user.keyboard("{ContextMenu}");

    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Rolar",
      }),
    ).toBeDefined();
  });

  it("Shift+F10 abre o mesmo menu", async () => {
    const user = userEvent.setup();
    renderPanel();

    rollButtonOf("Força").focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");

    expect(
      within(await screen.findByRole("menu")).getByRole("menuitem", {
        name: "Rolar",
      }),
    ).toBeDefined();
  });

  it("o menu fecha com Esc", async () => {
    const user = userEvent.setup();
    renderPanel();

    fireEvent.contextMenu(cardOf("Força"));
    await screen.findByRole("menu");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("o menu NÃO abre no Editar Geral — o nativo do navegador fica", () => {
    renderPanel({ editMode: true });

    const evento = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    cardOf("Força").dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("o menu NÃO abre com o lápis do bloco ligado", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openBlockEdit(user);

    const evento = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10,
    });
    cardOf("Força").dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("o toque longo abre o menu", async () => {
    renderPanel();

    fireEvent.pointerDown(cardOf("Força"), {
      pointerId: 1,
      pointerType: "touch",
      clientX: 30,
      clientY: 40,
    });

    expect(await screen.findByRole("menu")).toBeDefined();
  });

  it("toque + movimento NÃO abre o menu (é arraste)", async () => {
    renderPanel();

    const card = cardOf("Força");
    fireEvent.pointerDown(card, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 30,
      clientY: 40,
    });
    fireEvent.pointerMove(card, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 30 + DND_ACTIVATION_DISTANCE_PX + 10,
      clientY: 40,
    });

    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("o clique esquerdo NÃO rola", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("Força"));

    expect(currentSheet().rollHistory).toHaveLength(0);
  });

  it("o clique duplo continua editando", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.dblClick(screen.getByText("Força"));

    expect(
      screen.getByRole("textbox", { name: "Nome do atributo Força" }),
    ).toBeDefined();
    expect(currentSheet().rollHistory).toHaveLength(0);
  });
});
describe("Bloco de Atributos — limite", () => {
  it('o "+" desativa no limite e diz por quê', async () => {
    const user = userEvent.setup();
    const base = createSheet(INPUT);
    seed({
      ...base,
      attributes: Array.from({ length: MAX_ATTRIBUTES }, (_, index) => ({
        id: `a${index}`,
        name: `AT${index}`,
        value: 10,
        color: null,
      })),
    });
    render(<Harness editMode />);
    await user.click(screen.getByRole("button", { name: "Editar bloco" }));

    const add = screen.getByRole("button", {
      name: "Limite de atributos atingido",
    });
    expect(add.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText(`${MAX_ATTRIBUTES} de ${MAX_ATTRIBUTES} atributos`),
    ).toBeDefined();

    await user.click(add);
    // Clicar num botão desativado não adiciona nada.
    expect(currentSheet().attributes).toHaveLength(MAX_ATTRIBUTES);
  });
});
