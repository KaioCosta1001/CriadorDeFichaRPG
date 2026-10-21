"use client";

import { useColorScheme } from "@mui/material/styles";
import { useEffect, useRef } from "react";

import { useMounted } from "@/hooks/useMounted";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Ponte entre o tema salvo e o MUI.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * QUEM DONA O QUE
 *   - O atributo `data-theme` no `<html>`: o MUI. Ele precisa de uma ação
 *     explícita (`setColorScheme`) para trocar de esquema.
 *   - A PREFERÊNCIA (Grimório ou Santuário): o `settingsStore`, que persiste
 *     pelo repositório.
 *
 * Sem esta ponte, o tema salvo só voltaria quando o usuário clicasse no botão
 * de tema — o MUI já leu o padrão no primeiro render, antes da hidratação do
 * store.
 *
 * POR QUE ESTE COMPONENTE NÃO CHAMA `setColorScheme` EM CADA RENDER
 * A chamada escreve no storage e provoca novo render do provider. O `ref`
 * garante que a sincronização acontece só quando o valor SALVO muda.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `mode` x `colorScheme` (a API mudou no MUI v9)
 * `mode` é o BRILHO ("light"/"dark") e `colorScheme` é o tema NOMEADO. Nossos
 * dois temas são escuros, então `mode` fica sempre "dark" e quem muda é
 * `colorScheme`. Usar `setMode` aqui não faria nada — eletrocaria o brilho.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function ThemeSync() {
  const mounted = useMounted();
  const theme = useSettingsStore((state) => state.settings.theme);
  const { colorScheme, setColorScheme } = useColorScheme();

  // Evita o laço "sincroniza → muda → sincroniza".
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    if (lastApplied.current === theme) return;
    if (colorScheme === theme) {
      lastApplied.current = theme;
      return;
    }

    lastApplied.current = theme;
    setColorScheme(theme);
  }, [colorScheme, mounted, setColorScheme, theme]);

  return null;
}
