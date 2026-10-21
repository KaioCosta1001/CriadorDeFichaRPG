"use client";

import { create } from "zustand";

import { SAVE_DEBOUNCE_MS } from "@/config/constants";
import { DEFAULT_APP_SETTINGS } from "@/domain/sheetFactory";
import { createDebouncedTask, type DebouncedTask } from "@/lib/debounce";
import { sheetRepository } from "@/repositories";
import type { AppSettings } from "@/schemas";

/**
 * Configurações globais do app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO SUBSTITUI O localStorage DIRETO DO MUI
 * Antes, a preferência de tema era gravada pelo MUI direto no `localStorage`
 * (via `src/lib/muiStorageManager.ts`). Isso criava um segundo caminho de
 * gravação, paralelo ao repositório — e o primeiro lugar onde esse tipo de
 * duplicação vira bug.
 *
 * Agora o `muiStorageManager` é apenas um adaptador LEVE sobre este store
 * (ele só sabe ler e escrever `theme`). Este store é a única fonte de
 * verdade e persiste pelo `sheetRepository`. Trocar o banco continua
 * significando trocar só `repositories/`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** `true` =_settings_ já foram lidos do repositório nesta sessão. */
let hydrated = false;

export type SettingsStatus = "loading" | "ready" | "error";

interface SettingsState {
  settings: AppSettings;
  status: SettingsStatus;
  error: string | null;
  /** Lê do repositório. Idempotente: chamar de novo não relê. */
  hydrate: () => Promise<void>;
  setTheme: (theme: AppSettings["theme"]) => void;
  setRollAnimationSpeed: (speed: number) => void;
}

/**
 * Gravação agrupada.
 *
 * O `theme` muda por clique, mas `setTheme` pode ser acionada em sequência
 * (o botão fica clicável); o debounce evita uma escrita por clique.
 */
const persistTask: DebouncedTask = createDebouncedTask(async () => {
  // Lemos o estado no momento da gravação, não no do clique: assim um clique
  // que chega durante o debounce não é perdido.
  const { settings } = useSettingsStore.getState();
  try {
    await sheetRepository.saveSettings(settings);
  } catch (error) {
    console.error("[configurações] Falha ao salvar.", error);
    useSettingsStore.setState({
      status: "error",
      error: "Não foi possível salvar as configurações.",
    });
  }
}, SAVE_DEBOUNCE_MS);

export const useSettingsStore = create<SettingsState>((set) => ({
  // Começa com o padrão e `status: "loading"`: nada de ler o storage durante
  // o render do servidor (hydration mismatch) nem antes de montar.
  settings: DEFAULT_APP_SETTINGS,
  status: "loading",
  error: null,

  async hydrate() {
    if (hydrated) return;
    hydrated = true;

    try {
      const settings = await sheetRepository.getSettings();
      set({ settings, status: "ready", error: null });
    } catch (error) {
      console.error("[configurações] Falha ao ler.", error);
      set({
        settings: DEFAULT_APP_SETTINGS,
        status: "error",
        error: "Não foi possível carregar as configurações.",
      });
    }
  },

  setTheme(theme) {
    set((state) => ({ settings: { ...state.settings, theme }, error: null }));
    persistTask.schedule();
  },

  setRollAnimationSpeed(speed) {
    set((state) => ({
      settings: { ...state.settings, rollAnimationSpeed: speed },
      error: null,
    }));
    persistTask.schedule();
  },
}));

/** Grava imediatamente o que estiver pendente (usado ao fechar/desmontar). */
export function flushSettings(): boolean {
  return persistTask.flush();
}

/**
 * Recomeça do zero. Só existe para os testes: cada teste precisa simular uma
 * sessão nova, senão o guard `hydrated` vazaria de um teste para o outro.
 */
export function resetSettingsStoreForTests(): void {
  hydrated = false;
  persistTask.cancel();
  useSettingsStore.setState({
    settings: DEFAULT_APP_SETTINGS,
    status: "loading",
    error: null,
  });
}
