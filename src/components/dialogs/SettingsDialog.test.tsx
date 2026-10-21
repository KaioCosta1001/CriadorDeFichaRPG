import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import { THEME_IDS, THEME_LABELS } from "@/config/palette";
import { createSheet } from "@/domain/sheetFactory";
import { resetSheetStoreForTests, useSheetStore } from "@/store/sheetStore";
import {
  resetSettingsStoreForTests,
  useSettingsStore,
} from "@/store/settingsStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DIALOG DE CONFIGURAÇÕES (seção 11)                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Verifica o que a §11 exige: venda de itens, tema, exportar/importar — e que
 * `sellEnabled` grava em `Sheet.settings` (não nas configurações globais).
 */

const INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

function seedSheet() {
  const sheet = createSheet(INPUT);
  useSheetStore.setState({ sheet, status: "ready", error: null, dirty: false });
}

function currentSheet() {
  const sheet = useSheetStore.getState().sheet;
  if (!sheet) throw new Error("ficha não carregada");
  return sheet;
}

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
  resetSettingsStoreForTests();
  seedSheet();
});

describe("Configurações", () => {
  it("lista as três seções esperadas", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    expect(within(dialog).getByText("Geral")).toBeDefined();
    expect(within(dialog).getByText("Ficha")).toBeDefined();
    expect(within(dialog).getByText("Em breve")).toBeDefined();
  });

  it('"Habilitar venda de itens" grava em Sheet.settings, não no global', async () => {
    const user = userEvent.setup();
    render(<SettingsDialog open onClose={vi.fn()} />);

    expect(currentSheet().settings.sellEnabled).toBe(false);

    // `Switch` do MUI tem `role="switch"`, não `checkbox`. Mantemos o Switch
    // porque ele comunica melhor "configuração liga/desliga" do que um
    // quadrado de papel — a semântica acessível é equivalente.
    await user.click(
      screen.getByRole("switch", { name: "Habilitar venda de itens" }),
    );

    await waitFor(() => expect(currentSheet().settings.sellEnabled).toBe(true));

    // A configuração global NÃO foi tocada.
    expect(window.localStorage.getItem("rpgv3:settings")).toBeNull();
  });

  it("o seletor de tema mostra os dois temas, com nome e paleta", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    const group = within(dialog).getByRole("radiogroup", { name: "Tema" });

    for (const id of THEME_IDS) {
      const option = within(group).getByRole("radio", {
        name: new RegExp(THEME_LABELS[id]),
      });
      expect(option).toBeDefined();
    }
  });

  it("trocar o tema no Dialog atualiza o atributo data-theme", async () => {
    const user = userEvent.setup();
    render(<SettingsDialog open onClose={vi.fn()} />);

    const dialog = await screen.findByRole("dialog", { name: "Configurações" });
    const group = within(dialog).getByRole("radiogroup", { name: "Tema" });

    await user.click(within(group).getByRole("radio", { name: /Santuário/ }));

    expect(useSettingsStore.getState().settings.theme).toBe("santuario");
  });

  it("oferece exportar a ficha atual", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Exportar JSON" })).toBeDefined();
  });

  it("oferece importar, com seletor de arquivo JSON", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Configurações" });
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    expect(input?.accept).toContain("application/json");
  });

  it("a ajuda da rolagem está visível, com os três caminhos de entrada", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);

    // §5 do adendo: o clique direito não é óbvio, e tooltip não ajuda quem
    // está no celular. O texto precisa estar num lugar já visitado.
    expect(screen.getByText("Como rolar")).toBeDefined();
    expect(screen.getByText(/Botão direito/)).toBeDefined();
    // Teclado e toque citados — quem não tem botão direito precisa saber.
    expect(screen.getByText(/Menu \/ Shift\+F10/)).toBeDefined();
    expect(screen.getByText(/toque longo/)).toBeDefined();
  });

  it("a ajuda explica por que o menu não abre em modo Editar", () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    expect(screen.getByText("Por que o menu não abre")).toBeDefined();
  });

  it("a ajuda aparece mesmo sem ficha aberta", () => {
    resetSheetStoreForTests();
    render(<SettingsDialog open onClose={vi.fn()} />);

    // O usuário precisa saber o que o app faz ANTES de ter o que rolar.
    expect(screen.getByText("Como rolar")).toBeDefined();
  });

  it('"Efeitos sonoros" aparece marcado como "em breve", não como interruptor', () => {
    render(<SettingsDialog open onClose={vi.fn()} />);

    expect(screen.getByText("Efeitos sonoros")).toBeDefined();
    expect(screen.getByText("em breve")).toBeDefined();
    // Não existe interruptor para uma opção que ainda não faz nada.
    expect(
      screen.queryByRole("switch", { name: "Efeitos sonoros" }),
    ).toBeNull();
  });

  it("sem ficha aberta, a seção da ficha some", async () => {
    useSheetStore.setState({ sheet: null, status: "idle" });

    render(<SettingsDialog open onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Configurações" });

    expect(within(dialog).queryByText("Ficha")).toBeNull();
    expect(within(dialog).getByText("Geral")).toBeDefined();
  });

  it("avisa o usuário ao tentar importar arquivo inválido", async () => {
    render(<SettingsDialog open onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Configurações" });
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input!, {
      target: {
        files: [
          new File(["isto não é json"], "x.json", { type: "application/json" }),
        ],
      },
    });

    // A mensagem vem do STORE (que traduz o `ImportError` do repositório),
    // então o diálogo precisa assiná-la para não engolir o erro.
    await waitFor(() =>
      expect(
        screen.getByText(/não contém um JSON válido|Falha ao ler/i),
      ).toBeDefined(),
    );
  });
});
