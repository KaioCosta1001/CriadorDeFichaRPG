import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/components/providers/AppProviders";

import {
  flushSettings,
  resetSettingsStoreForTests,
  useSettingsStore,
} from "./settingsStore";

/**
 * Teste de integração da fase de dados: prova que a hidratação acontece
 * DEPOIS da montagem (seção 5.7) e que a alteração de tema chega ao
 * repositório pelo caminho assíncrono correto.
 */

function Probe() {
  const status = useSettingsStore((state) => state.status);
  const theme = useSettingsStore((state) => state.settings.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("santuario")} type="button">
        escurecer
      </button>
    </div>
  );
}

describe("settingsStore + AppProviders", () => {
  beforeEach(() => {
    resetSettingsStoreForTests();
  });

  it("hidrata depois de montar, indo de 'loading' para 'ready'", async () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    // Primeiro render (servidor e hydration): ainda carregando.
    expect(screen.getByTestId("status")).toHaveTextContent("loading");

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );
  });

  it("lê o tema já salvo do repositório", async () => {
    window.localStorage.setItem(
      "rpgv3:settings",
      JSON.stringify({ theme: "santuario", rollAnimationSpeed: 1 }),
    );

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("santuario"),
    );
  });

  it("persiste a mudança de tema pelo repositório (com debounce)", async () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );

    fireEvent.click(screen.getByRole("button", { name: "escurecer" }));

    // O estado muda na hora (UI responsiva)…
    expect(screen.getByTestId("theme")).toHaveTextContent("santuario");

    // …mas a gravação é agrupada: precisa do flush.
    expect(window.localStorage.getItem("rpgv3:settings")).toBeNull();

    flushSettings();
    await waitFor(() =>
      expect(window.localStorage.getItem("rpgv3:settings")).toBe(
        JSON.stringify({ theme: "santuario", rollAnimationSpeed: 1 }),
      ),
    );
  });

  it("normaliza o tema antigo (light/dark) em vez de perder a preferência", async () => {
    // Quem testou o app nas Fases 1–4 tem "dark" salvo. Descartar isso
    // porque o app mudou seria perder dados do usuário de graça.
    window.localStorage.setItem(
      "rpgv3:settings",
      JSON.stringify({ theme: "dark" }),
    );

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("theme")).toHaveTextContent("santuario"),
    );
  });

  it("ignora a segunda chamada de hydrate (StrictMode chama efeito 2x)", async () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("ready"),
    );

    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().status).toBe("ready");
  });
});
