import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SheetScreen } from "@/components/sheets/SheetScreen";
import {
  DEFAULT_PANEL_SQUARE_CELLS,
  sheetStorageKey,
} from "@/config/constants";
import { PANEL_TYPE_LABELS } from "@/config/panelTypes";
import { extraPanelId } from "@/domain/layout";
import { LocalStorageSheetRepository } from "@/repositories/localStorageSheetRepository";
import {
  flushSheet,
  resetSheetStoreForTests,
  useSheetStore,
} from "@/store/sheetStore";
import type { PanelLayout, Sheet } from "@/schemas";

/**
 * Testes de integração da Fase 4.
 *
 * Não simulamos arrasto/redimensionamento pixel a pixel: o jsdom não tem
 * engine de layout, e o cálculo do gesto já é coberto por
 * `domain/layout.test.ts`. O que verificamos aqui é o que o teste unitário
 * NÃO pega:
 *  - a grade renderiza os blocos da ficha;
 *  - o Editar Geral liga as molduras e o redimensionamento;
 *  - adicionar / remover / resetar persistem no storage;
 *  - bloco padrão não pode ser removido.
 *
 * A ficha é semeada NO REPOSITÓRIO, e não no store: o componente carrega do
 * repositório, então plantar direto no store seria testar um caminho que o
 * app nunca usa.
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

let repo: LocalStorageSheetRepository;

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
  repo = new LocalStorageSheetRepository();
  mocks.push.mockClear();
});

/** Cria a ficha no repositório, aplicando ajustes opcionais. */
async function seed(
  customize?: (sheet: Sheet) => Sheet,
  input: typeof INPUT = INPUT,
): Promise<Sheet> {
  const created = await repo.createSheet(input);
  return customize ? repo.updateSheet(created.id, customize(created)) : created;
}

function currentSheet(): Sheet {
  const sheet = useSheetStore.getState().sheet;
  if (!sheet) throw new Error("ficha não carregada");
  return sheet;
}

async function renderScreen(sheetId: string) {
  render(<SheetScreen sheetId={sheetId} />);
  await waitFor(() => expect(useSheetStore.getState().status).toBe("ready"));
}

async function enterEditMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Editar" }));
}

/**
 * Bloco do usuário pronto para ser exibido.
 *
 * As coordenadas são CÉLULAS desde o adendo §1. A versão anterior usava
 * `y: 3000, w: 420, h: 260` em pixels — que reprova o schema atual
 * (`w` máximo = `GRID_COLUMNS` = 48) e joga a ficha inteira para a quarentena.
 *
 * O `y` grande é de propósito: coloca o bloco bem abaixo dos padrões, para
 * que o teste prove que ele é renderizado mesmo longe da dobra.
 */
function withExtraPanel(
  sheet: Sheet,
  id: string,
  title: string,
  content = "",
): Sheet {
  const entry: PanelLayout = {
    panelId: extraPanelId(id),
    x: 0,
    y: 120,
    w: 12,
    h: 16,
    visible: true,
    order: 99,
  };
  return {
    ...sheet,
    extraPanels: [{ id, title, type: "text", content, entries: [] }],
    layout: [...sheet.layout, entry],
  };
}

describe("PanelGrid — Fase 4", () => {
  it("carrega a ficha e mostra o título", async () => {
    const sheet = await seed();
    await renderScreen(sheet.id);

    expect(
      screen.getByRole("heading", { level: 1, name: "Gandalf" }),
    ).toBeDefined();
  });

  it("renderiza uma moldura por bloco visível", async () => {
    const sheet = await seed();
    await renderScreen(sheet.id);

    for (const panel of sheet.layout) {
      const label = PANEL_TYPE_LABELS[panel.panelId as "profile"];
      expect(screen.getByRole("region", { name: label })).toBeDefined();
    }
  });

  it("não mostra moldura de bloco escondido", async () => {
    const sheet = await seed((current) => ({
      ...current,
      // O PRIMEIRO painel do layout padrão é o Perfil — que é INOCULTÁVEL.
      // O teste usa Atributos, o primeiro ocultável.
      layout: current.layout.map((panel) =>
        panel.panelId === "attributes" ? { ...panel, visible: false } : panel,
      ),
    }));
    await renderScreen(sheet.id);

    expect(screen.queryByRole("region", { name: "Atributos" })).toBeNull();
    // O contador vive no botão da BANDEJA, que mostra o selo de ocultos.
    expect(
      screen.getByRole("button", { name: /Painéis \(1 ocultos?\)/ }),
    ).toBeDefined();
  });

  it("esconder um bloco some com ele e avisa", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);
    await enterEditMode(user);

    await user.click(
      screen.getByRole("button", { name: "Esconder bloco Atributos" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Atributos" })).toBeNull();
    });
    expect(
      currentSheet().layout.find((p) => p.panelId === "attributes")?.visible,
    ).toBe(false);
  });

  it("as alças de redimensionamento só existem no Editar Geral", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);

    expect(
      screen.queryByRole("button", { name: /Redimensionar pelo canto/ }),
    ).toBeNull();

    await enterEditMode(user);
    expect(
      screen.getAllByRole("button", { name: /Redimensionar pelo canto/ })
        .length,
    ).toBeGreaterThan(0);
  });

  it("adiciona um bloco de texto com layout gravado", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);
    await enterEditMode(user);

    await user.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar bloco",
    });
    await user.click(
      within(dialog).getByRole("button", { name: /Bloco de texto/ }),
    );

    await waitFor(() => expect(currentSheet().extraPanels).toHaveLength(1));

    const extra = currentSheet().extraPanels[0]!;
    expect(extra.type).toBe("text");

    // O dado e a entrada de layout nascem juntos — nunca um sem o outro.
    const entry = currentSheet().layout.find(
      (panel) => panel.panelId === extraPanelId(extra.id),
    );
    expect(entry?.visible).toBe(true);
    expect(entry?.w).toBeGreaterThan(0);
  });

  it("o bloco novo aparece na grade com o nome escolhido", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);
    await enterEditMode(user);

    await user.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar bloco",
    });
    await user.click(
      within(dialog).getByRole("button", { name: /Bloco de texto/ }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Bloco de texto" }),
      ).toBeDefined(),
    );
  });

  it('"Em processo" aparece bloqueado e não cria nada', async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);
    await enterEditMode(user);

    await user.click(screen.getByRole("button", { name: "Adicionar bloco" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Adicionar bloco",
    });

    const blocked = within(dialog).getByRole("button", {
      name: /Em processo/,
    }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);

    await user.click(blocked);
    expect(currentSheet().extraPanels).toHaveLength(0);
  });

  it("remove um bloco do usuário junto com o layout", async () => {
    const user = userEvent.setup();
    const sheet = await seed((current) =>
      withExtraPanel(current, "b1", "Anotações"),
    );
    await renderScreen(sheet.id);
    await enterEditMode(user);

    await user.click(
      screen.getByRole("button", { name: "Remover bloco Anotações" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Remover bloco" });
    await user.click(within(dialog).getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(currentSheet().extraPanels).toHaveLength(0);
      expect(
        currentSheet().layout.some(
          (panel) => panel.panelId === extraPanelId("b1"),
        ),
      ).toBe(false);
    });
  });

  it("bloco padrão não tem botão de remover", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);
    await enterEditMode(user);

    expect(
      screen.queryByRole("button", { name: "Remover bloco Perfil" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remover bloco Inventário" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Esconder bloco Atributos" }),
    ).toBeDefined();
  });

  it("resetar o layout devolve posição e visibilidade, sem tocar no conteúdo", async () => {
    const user = userEvent.setup();
    const sheet = await seed((current) => {
      const messed = withExtraPanel(
        current,
        "b2",
        "Notas",
        "conteúdo importante",
      );
      return {
        ...messed,
        layout: messed.layout.map((panel) =>
          panel.panelId === "profile"
            ? // Fora da grade e escondido: o pior caso que uma ficha pode
              // entregar. Em células agora: `w: 1234` reprovaria o schema antes
              // de a tela chegar a renderizar.
              { ...panel, x: 40, y: 400, w: 30, h: 40, visible: false }
            : panel.panelId === extraPanelId("b2")
              ? { ...panel, visible: false }
              : panel,
        ),
      };
    });

    await renderScreen(sheet.id);
    await enterEditMode(user);

    // Dois blocos escondidos de propósito: o Perfil (que é INOCULTÁVEL e
    // por isso não conta) e o bloco de notas.
    expect(
      currentSheet().layout.filter((panel) => !panel.visible),
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Resetar layout" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Resetar layout?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Resetar" }));

    await waitFor(() => {
      const profile = currentSheet().layout.find(
        (panel) => panel.panelId === "profile",
      );
      expect(profile?.visible).toBe(true);
      expect(profile?.x).toBe(0);
      expect(profile?.y).toBe(0);
      // `DEFAULT_PANEL_SQUARE_CELLS` = `GRID_COLUMNS / 4` = 12 células.
      // Lendo a constante em vez do número, o teste continua valendo se o
      // grid for refinado.
      expect(profile?.w).toBe(DEFAULT_PANEL_SQUARE_CELLS);
      expect(profile?.h).toBe(DEFAULT_PANEL_SQUARE_CELLS);
    });

    // Bloco escondido reaparece…
    expect(
      currentSheet().layout.find(
        (panel) => panel.panelId === extraPanelId("b2"),
      )?.visible,
    ).toBe(true);

    // …e o CONTEÚDO é preservado.
    expect(currentSheet().extraPanels[0]?.content).toBe("conteúdo importante");
  });

  it("o layout alterado é gravado no storage", async () => {
    const user = userEvent.setup();
    const sheet = await seed();
    await renderScreen(sheet.id);

    await enterEditMode(user);
    await user.click(
      screen.getByRole("button", { name: "Esconder bloco Atributos" }),
    );

    await waitFor(() => expect(useSheetStore.getState().dirty).toBe(true));
    await flushSheet();

    const saved = JSON.parse(
      window.localStorage.getItem(sheetStorageKey(sheet.id)) ?? "{}",
    ) as Sheet;

    expect(
      saved.layout.find((panel) => panel.panelId === "attributes")?.visible,
    ).toBe(false);
  });

  it("o texto digitado no bloco de notas é salvo, com espaços", async () => {
    const user = userEvent.setup();
    const sheet = await seed((current) =>
      withExtraPanel(current, "b3", "Notas"),
    );
    await renderScreen(sheet.id);

    const textarea = screen.getByLabelText("Conteúdo do bloco Notas");
    await user.type(textarea, "lembrete importante");

    // Regra crítica: o `trim()` do schema NÃO pode comer o espaço entre
    // palavras. A gravação é por confirmação (blur), não a cada tecla.
    await user.tab();

    await waitFor(() =>
      expect(currentSheet().extraPanels[0]?.content).toBe(
        "lembrete importante",
      ),
    );

    await flushSheet();
    const saved = JSON.parse(
      window.localStorage.getItem(sheetStorageKey(sheet.id)) ?? "{}",
    ) as Sheet;
    expect(saved.extraPanels[0]?.content).toBe("lembrete importante");
  });

  it("avisa quando a ficha não existe", async () => {
    render(<SheetScreen sheetId="id-que-nao-existe" />);

    await waitFor(() =>
      expect(screen.getByText("Ficha não encontrada.")).toBeDefined(),
    );
  });
});

/* ===========================================================================
 * PULAR PARA O CONTEÚDO (WCAG 2.4.1 — Bypass Blocks)
 *
 * A ficha tem um cabeçalho inteiro antes dos blocos: voltar, título, tema. Sem
 * pulador, quem usa teclado atravessa tudo isso a cada visita.
 *
 * O risco do recurso não é faltar o link — é o link APONTAR para um id que não
 * existe, ou para um alvo que o navegador não consegue focar. As duas coisas
 * passam despercebidas na tela e só aparecem quando alguém usa teclado. Por
 * isso os testes verificam o par link↔alvo, não o estilo.
 * ========================================================================== */

describe("Pular para o conteúdo", () => {
  it("o link do pulador aponta para um alvo que EXISTE na tela", () => {
    render(<SheetScreen sheetId="qualquer" />);

    const link = screen.getByRole("link", { name: /pular/i });
    const alvoId = link.getAttribute("href")?.replace("#", "");

    // Sem isto o link é decoração: o clique não vai a lugar nenhum.
    expect(alvoId).toBeTruthy();
    expect(document.getElementById(alvoId as string)).not.toBeNull();
  });

  it("o alvo é focável por programa, mas fica FORA da ordem do Tab", () => {
    render(<SheetScreen sheetId="qualquer" />);

    const link = screen.getByRole("link", { name: /pular/i });
    const alvo = document.getElementById(
      link.getAttribute("href")?.replace("#", "") as string,
    );

    // `tabIndex` = -1: focável por script (é o que faz o pulador funcionar)
    // e ausente da navegação normal (senão o pulador viraria mais uma parada).
    expect(alvo?.getAttribute("tabindex")).toBe("-1");
  });

  it("o alvo está DENTRO do conteúdo, depois do cabeçalho", async () => {
    const sheet = await seed();
    await renderScreen(sheet.id);

    const link = screen.getByRole("link", { name: /pular/i });
    const alvo = document.getElementById(
      link.getAttribute("href")?.replace("#", "") as string,
    );
    const main = document.querySelector("main");

    // Pular para o próprio `<main>` não pula nada: o cabeçalho está dentro
    // dele. O alvo tem que estar abaixo da barra de título.
    expect(alvo).not.toBeNull();
    expect(main?.contains(alvo as Node)).toBe(true);
    expect(alvo).not.toBe(main);
  });

  it("o alvo existe MESMO com a ficha ainda carregando", () => {
    // Estado "loading", sem `await`: o alvo tem que existir desde o primeiro
    // quadro, senão o pulador não leva a lugar nenhum no momento em que a
    // pessoa mais precisa dele.
    render(<SheetScreen sheetId="qualquer" />);

    const link = screen.getByRole("link", { name: /pular/i });
    const alvoId = link.getAttribute("href")?.replace("#", "") as string;

    expect(document.getElementById(alvoId)).not.toBeNull();
  });

  it("o rótulo diz para onde vai, não só 'pular'", () => {
    render(<SheetScreen sheetId="qualquer" />);

    // "Pular" sozinho não informa nada; o rótulo precisa dizer o destino.
    expect(
      screen.getByRole("link", { name: "Pular para os blocos" }),
    ).toBeDefined();
  });
});
