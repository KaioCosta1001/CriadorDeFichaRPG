import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/components/providers/AppProviders";
import { ThemeModeSwitch } from "@/components/ui/ThemeModeSwitch";
import {
  THEME_LABELS,
  THEMES,
  THEME_IDS,
  buildThemeVariables,
} from "@/config/palette";
import {
  flushSettings,
  resetSettingsStoreForTests,
} from "@/store/settingsStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  TROCA DE TEMA — TESTE DE INTEGRAÇÃO                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O teste unitário de `palette.ts` garante que as cores têm contraste. Este
 * garante a outra metade do contrato: que trocar o tema REALMENTE muda o
 * atributo `data-theme` no `<html>`, e que a folha de estilo injetada tem as
 * regras dos DOIS temas.
 *
 * É esse atributo que move tudo: o Tailwind lê por seletor
 * `[data-theme="…"]` e os `styleOverrides` do MUI lêem `var(--…)`. Se um dia
 * alguém trocar o MUI para re-gerar a folha por esquema e esquecer o
 * Tailwind (ou o contrário), este teste avisa.
 */

function currentThemeAttribute(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

/** CSS que o app injeta no `<head>`, montado dos tokens. */
function injectedStylesheet(): string {
  return THEME_IDS.map(buildThemeVariables).join("\n");
}

describe("troca de tema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSettingsStoreForTests();
    document.documentElement.setAttribute("data-theme", "grimoire");
  });

  it("começa no tema padrão", async () => {
    render(
      <AppProviders>
        <ThemeModeSwitch />
      </AppProviders>,
    );
    await waitFor(() => expect(currentThemeAttribute()).toBe("grimoire"));
  });

  it("o botão alterna entre os dois temas", async () => {
    render(
      <AppProviders>
        <ThemeModeSwitch />
      </AppProviders>,
    );
    await waitFor(() => expect(currentThemeAttribute()).toBe("grimoire"));

    fireEvent.click(
      screen.getByRole("button", {
        name: `Ativar tema ${THEME_LABELS.santuario}`,
      }),
    );
    expect(currentThemeAttribute()).toBe("santuario");

    fireEvent.click(
      screen.getByRole("button", {
        name: `Ativar tema ${THEME_LABELS.grimoire}`,
      }),
    );
    expect(currentThemeAttribute()).toBe("grimoire");
  });

  it("a folha injetada tem regras para os DOIS temas", () => {
    const css = injectedStylesheet();
    for (const id of THEME_IDS) {
      expect(css, `falta regra para ${id}`).toContain(`[data-theme="${id}"]`);
      expect(css).toContain(THEMES[id].surface);
    }
  });

  it("cada tema tem o seu próprio conjunto de valores", () => {
    const grimoireCss = buildThemeVariables("grimoire");
    const santuarioCss = buildThemeVariables("santuario");

    // Se os dois gerassem o mesmo texto, trocar de tema não mudaria nada.
    expect(grimoireCss).not.toBe(santuarioCss);
    expect(santuarioCss).toContain(THEMES.santuario.primary);
    expect(grimoireCss).toContain(THEMES.grimoire.primary);
  });

  it("a preferência é persistida e restaurada", async () => {
    render(
      <AppProviders>
        <ThemeModeSwitch />
      </AppProviders>,
    );
    await waitFor(() => expect(currentThemeAttribute()).toBe("grimoire"));

    fireEvent.click(
      screen.getByRole("button", {
        name: `Ativar tema ${THEME_LABELS.santuario}`,
      }),
    );
    flushSettings();

    await waitFor(() =>
      expect(window.localStorage.getItem("rpgv3:settings")).toBe(
        JSON.stringify({ theme: "santuario", rollAnimationSpeed: 1 }),
      ),
    );
  });

  it("restaura o tema salvo ao carregar a página", async () => {
    window.localStorage.setItem(
      "rpgv3:settings",
      JSON.stringify({ theme: "santuario", rollAnimationSpeed: 1 }),
    );

    render(
      <AppProviders>
        <ThemeModeSwitch />
      </AppProviders>,
    );

    await waitFor(() => expect(currentThemeAttribute()).toBe("santuario"));
  });
});
