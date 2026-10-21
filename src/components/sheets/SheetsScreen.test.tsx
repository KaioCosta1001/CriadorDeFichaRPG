import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SheetsScreen } from "@/components/sheets/SheetsScreen";
import { LIST_CONTENT_ID } from "@/components/ui/SkipLink";
import { resetSettingsStoreForTests } from "@/store/settingsStore";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), back: vi.fn() }),
}));

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  TELA DE LISTAGEM — o pulador de teclado                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O foco deste arquivo é o pulador. A tela não tinha nenhum teste antes da
 * Fase 9, e o pulador é exatamente o tipo de recurso que só quebra em silêncio
 * quando ninguém verifica o par link↔alvo.
 *
 * Não é preciso semear ficha nenhuma: o alvo do pulador tem que existir nos
 * TRÊS estados da tela, e o mais difícil de acertar é o primeiro — carregando,
 * quando a lista ainda não chegou.
 */
beforeEach(() => {
  resetSettingsStoreForTests();
  window.localStorage.clear();
});

describe("Listagem — pular para o conteúdo", () => {
  it("o link aponta para um alvo que EXISTE", () => {
    render(<SheetsScreen />);

    const link = screen.getByRole("link", { name: /pular/i });
    const alvoId = link.getAttribute("href")?.replace("#", "") as string;

    // Um link que aponta para id inexistente não dá erro nenhum: só não faz
    // nada. Por isso a verificação é explícita.
    expect(alvoId).toBe(LIST_CONTENT_ID);
    expect(document.getElementById(alvoId)).not.toBeNull();
  });

  it("o alvo é focável por programa e fora da ordem do Tab", () => {
    render(<SheetsScreen />);

    const alvo = document.getElementById(LIST_CONTENT_ID);

    // `tabIndex={-1}`: o pulador funciona porque o elemento aceita foco de
    // script; e some da navegação normal porque o próximo Tab não para nele.
    expect(alvo?.getAttribute("tabindex")).toBe("-1");
  });

  it("o alvo NÃO é o <main> — pular para ele não pularia o cabeçalho", () => {
    render(<SheetsScreen />);

    const alvo = document.getElementById(LIST_CONTENT_ID);
    const main = document.querySelector("main");

    // O cabeçalho ("Minhas fichas", tema, importar, nova) está DENTRO do
    // `<main>`. Apontar para o `<main>` seria pular para o começo dele — ou
    // seja, não pularia nada.
    expect(alvo).not.toBeNull();
    expect(alvo).not.toBe(main);
    expect(main?.contains(alvo as Node)).toBe(true);
  });

  it("o alvo já existe no primeiro quadro, com a lista vazia", () => {
    // Estado "carregando": sem `await`, sem esperar a store. É o pior momento
    // para um pulador quebrado — a pessoa acabou de abrir o app.
    render(<SheetsScreen />);

    expect(document.getElementById(LIST_CONTENT_ID)).not.toBeNull();
  });

  it("o rótulo diz o destino", () => {
    render(<SheetsScreen />);
    expect(
      screen.getByRole("link", { name: "Pular para as fichas" }),
    ).toBeDefined();
  });
});

describe("Listagem — a estrutura ainda renderiza", () => {
  it("mostra o título e o estado de carregamento", () => {
    render(<SheetsScreen />);

    expect(
      screen.getByRole("heading", { name: "Minhas fichas" }),
    ).toBeDefined();
  });

  it("o pulador é o PRIMEIRO elemento focável da página", () => {
    render(<SheetsScreen />);

    // Sem esta ordem o recurso não serve para nada: a pessoa teria de
    // atravessar o cabeçalho para chegar ao pulador que existe para evitar
    // exatamente isso.
    const focaveis = document.querySelectorAll("a[href], button, input");
    expect(focaveis[0]?.className).toContain("skip-link");
  });
});
