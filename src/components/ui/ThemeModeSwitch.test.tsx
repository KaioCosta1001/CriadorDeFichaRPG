import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useColorScheme } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeModeSwitch } from "@/components/ui/ThemeModeSwitch";
import { THEME_LABELS } from "@/config/palette";
import { appTheme } from "@/config/theme";
import { sheetRepository } from "@/repositories";
import {
  flushSettings,
  resetSettingsStoreForTests,
  useSettingsStore,
} from "@/store/settingsStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  TROCAR O TEMA — adendo §6                                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O BUG QUE ESTES TESTES EXISTEM PARA IMPEDIR
 *
 * O botão do cabeçalho chamava `setColorScheme` do MUI e nada mais. A troca
 * era visível na hora — e por isso "parecia funcionar" — mas não era
 * persistida. No reload, `ThemeSync` lia o valor antigo do store e desfazia a
 * escolha.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO NÃO TESTA A COR NA TELA
 *
 * A cor visível é o `data-theme` no `<html>`, e quem o escreve é o MUI. Testar
 * isso exigiria o `ThemeProvider` com os dois esquemas — e aí o teste mediria
 * o MUI, não o botão.
 *
 * O que o botão é responsável, e o que estes testes verificam:
 *
 *  1. gravar a nova preferência no STORE;
 *  2. essa preferência SOBREVIVER ao repositório (a promessa de persistência);
 *  3. o rótulo dizer a ação certa, não o estado.
 *
 * A aplicação ao `<html>` fica para verificação no navegador, que não está
 * disponível no harness.
 * ───────────────────────────────────────────────────────────────────────────
 */

beforeEach(async () => {
  resetSettingsStoreForTests();
  window.localStorage.clear();
  vi.restoreAllMocks();

  // Simula uma sessão limpa: o store começa no padrão.
  await useSettingsStore.getState().hydrate();
});

/**
 * O botão do tema, sem a DUPLICATA que o `Tooltip` do MUI cria.
 *
 * O `Tooltip` renderiza uma cópia do filho marcada com
 * `data-mui-internal-clone-element` para medir a âncora. Fora de um
 * `ThemeProvider` o DOM tem SÓ essa cópia (é ela que recebe o `onClick`); dentro
 * de um `ThemeProvider` existem duas — a cópia e a âncora real.
 *
 * Por isso: prefere a que não tem o marcador, e cai para a primeira quando não
 * há nenhuma. Sem o fallback, metade dos testes deste arquivo quebraria
 *depending do provider estar montado.
 */
function botaoTema(nome: string): HTMLElement {
  const candidatos = screen.getAllByRole("button", { name: nome });

  return (
    candidatos.find(
      (elemento) => !elemento.hasAttribute("data-mui-internal-clone-element"),
    ) ?? candidatos[0]!
  );
}

describe("ThemeModeSwitch — troca de tema", () => {
  it("grava a nova preferência no STORE, não só no MUI", async () => {
    const user = userEvent.setup();
    const setTheme = vi.spyOn(useSettingsStore.getState(), "setTheme");

    render(<ThemeModeSwitch />);

    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`));

    // Este é o ponto do conserto. Antes, o botão chamava
    // `setColorScheme` do MUI e o store ficava intocado — o que fazia a
    // escolha ser perdida no reload.
    expect(setTheme).toHaveBeenCalledWith("santuario");
    expect(useSettingsStore.getState().settings.theme).toBe("santuario");
  });

  it("alterna para o OUTRO tema, não para um valor fixo", async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().setTheme("santuario");

    render(<ThemeModeSwitch />);

    // Já em Santuário, o botão oferece Grimório — nunca "santuario" de novo.
    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.grimoire}`));

    expect(useSettingsStore.getState().settings.theme).toBe("grimoire");
  });

  it("NÃO escreve direto no MUI — o store é o único dono", async () => {
    const user = userEvent.setup();
    render(<ThemeModeSwitch />);

    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`));

    // ───────────────────────────────────────────────────────────────────────
    // COMO VERIFICAR ISSO SEM LER O CÓDIGO-FONTE
    //
    // Um `vi.spyOn(useColorScheme())` fora de componente é hook fora de
    // componente. A saída é comportamental: monta-se o `ThemeProvider` SEM o
    // `ThemeSync` (que é a ponte legítima) e confirma-se que clicar no botão
    // NÃO move o esquema do MUI.
    //
    // Se um dia o botão voltar a chamar `setColorScheme`, o esquema muda aqui
    // e o teste reprova — que é exatamente a arquitetura que o §6 pede.
    // ───────────────────────────────────────────────────────────────────────
    let esquemaMui: string | undefined;

    function Sonda() {
      esquemaMui = useColorScheme().colorScheme;
      return null;
    }

    // Estado explícito: este teste mede a separação store ↔ MUI, e não deve
    // depender de qual tema o teste anterior deixou para trás.
    useSettingsStore.getState().setTheme("grimoire");

    render(
      <ThemeProvider theme={appTheme}>
        <Sonda />
        <ThemeModeSwitch />
      </ThemeProvider>,
    );

    const antes = esquemaMui;
    expect(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`)).toBeDefined();

    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`));

    expect(useSettingsStore.getState().settings.theme).toBe("santuario");
    // O store mudou; o MUI não. Quem muda o MUI é a `ThemeSync`, que só
    // existe dentro de `AppProviders`.
    expect(esquemaMui).toBe(antes);
  });

  it("a preferência SOBREVIVE ao repositório — a promessa de 'não volta sozinho'", async () => {
    const user = userEvent.setup();
    render(<ThemeModeSwitch />);

    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`));

    // `setTheme` agenda a gravação com debounce; `flushSettings` força.
    flushSettings();

    const salvo = await sheetRepository.getSettings();

    // Este é o conserto do §6. Antes, o botão mudava o MUI e o store ficava
    // no padrão — então o que voltava do repositório era o tema ANTIGO, e a
    // escolha se desfazia no reload. Aqui o que volta é a escolha.
    expect(salvo.theme).toBe("santuario");
    expect(salvo.theme).toBe(useSettingsStore.getState().settings.theme);
  });
});

describe("ThemeModeSwitch — rótulo", () => {
  it("descreve a AÇÃO, não o estado", async () => {
    useSettingsStore.getState().setTheme("grimoire");
    render(<ThemeModeSwitch />);

    // "Tema: Grimório" é informação que a interface já mostra. O rótulo do
    // botão precisa dizer o que ACONTECE ao clicar.
    expect(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`)).toBeDefined();
  });

  it("o ícone reflete o tema ATUAL", async () => {
    const user = userEvent.setup();
    useSettingsStore.getState().setTheme("grimoire");

    const { container } = render(<ThemeModeSwitch />);
    const antes = container.querySelector("svg")?.innerHTML;

    await user.click(botaoTema(`Ativar tema ${THEME_LABELS.santuario}`));

    await waitFor(() => {
      expect(container.querySelector("svg")?.innerHTML).not.toBe(antes);
    });
  });
});
