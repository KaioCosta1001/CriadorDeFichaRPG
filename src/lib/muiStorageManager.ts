import type { StorageManager } from "@mui/system/cssVars";

import { STORAGE_KEYS } from "@/config/constants";
import type { ThemeId } from "@/config/palette";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Adaptador que entrega ao MUI a preferência de tema.
 *
 * O MUI fala "storage" através da interface `StorageManager` (get/set/
 * subscribe) e não precisa saber COMO o dado é guardado. Aproveitamos isso
 * para que ele não toque no `localStorage` diretamente: quem persiste é o
 * `settingsStore`, pelo `sheetRepository`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE DUAS CHAVES (`STORAGE_KEYS`)
 * O MUI separa DUAS coisas:
 *   - `mode`        → "light" | "dark" | "system"  (brilho)
 *   - `colorScheme` → o tema NOMEADO ("grimoire" | "santuario")
 *
 * Grimório e Santuário são AMBOS escuros, então o brilho é sempre "dark" e
 * quem muda é o esquema nomeado. Se devolvêssemos "grimoire" para a chave de
 * modo, o MUI receberia um modo de brilho inválido.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const muiStorageManager: StorageManager = ({ key }) => {
  return {
    get(defaultValue: unknown): unknown {
      // Chave de brilho: sempre escuro. Não é preference do usuário.
      if (key === STORAGE_KEYS.colorMode) return "dark";

      return useSettingsStore.getState().settings.theme ?? defaultValue;
    },

    set(value: unknown): void {
      if (key === STORAGE_KEYS.colorMode) return;
      if (value !== "grimoire" && value !== "santuario") return;

      // Grava pelo store → debounce → `sheetRepository.saveSettings()`.
      useSettingsStore.getState().setTheme(value as ThemeId);
    },

    subscribe(): () => void {
      // Não há "storage event" porque não há `localStorage` no caminho:
      // o store notifica quem o observa por re-render, e o `ThemeSync`
      // aplica a mudança no MUI.
      return () => undefined;
    },
  };
};
