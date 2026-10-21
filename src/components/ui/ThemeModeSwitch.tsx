"use client";

import { Tooltip, useMediaQuery } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { THEME_LABELS, type ThemeId } from "@/config/palette";
import { useMounted } from "@/hooks/useMounted";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * Alterna entre os temas "Grimório" e "Santuário".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM ÚNICO BOTÃO E NÃO UM SELECT
 * Este componente é o atalho. A escolha completa, com a descrição de cada
 * tema, fica no Dialog de Configurações (Fase 5). Ter os dois é redundante
 * aqui e confunde: duas formas de mudar a mesma coisa, sem ganho.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  O BUG: O BOTÃO ESQUECIA O STORE (adendo §6)                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Este botão chamava `setColorScheme(next)` do MUI e NADA MAIS.
 *
 * O efeito era de dois estados, e por isso parecia funcionar: na hora da
 * troca, o atributo `data-theme` mudava e as cores mudavam junto. Mas o valor
 * **não era persistido** — `settingsStore.settings.theme` continuava antigo.
 *
 * Ao recarregar, `ThemeSync` lia o valor antigo do store e chamava
 * `setColorScheme(antigo)`: a escolha do usuário era desfeita sozinha.
 *
 * Pior: os dois caminhos de troca eram independentes. O botão do cabeçalho
 * escrevia no MUI; o seletor do Dialog escrevia no store. Duas fontes para o
 * mesmo dado, e só uma delas sobrevivia a um reload.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A CORREÇÃO
 *
 * O botão escreve no STORE, e só no store. O MUI é atualizado por
 * `ThemeSync`, que já existia e já estava certo — ele é a ponte entre a
 * preferência persistida e o esquema ativo.
 *
 * Assim há UM dono da verdade (`settingsStore`) e o MUI é detalhe de
 * apresentação, como deve ser.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE AINDA ASSIM LEMOS O `colorScheme` DO MUI
 *
 * Só para escolher o ÍCONE antes da hidratação. Antes de o store carregar não
 * sabemos qual é o tema salvo, e a preferência do sistema é um palpite
 * razoável para decidir entre lua e sol — sem gravar nada.
 *
 * Acessibilidade:
 *  - `aria-label` descreve a AÇÃO ("Ativar tema Santuário"), não o estado;
 *  - `Tooltip` dá a mesma informação visualmente;
 *  - os ícones são os mesmos dos dois temas em toda a interface, então a
 *    troca de ícone ensina o vocabulário.
 */
export function ThemeModeSwitch() {
  const mounted = useMounted();
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", {
    noSsr: true,
  });
  const { colorScheme } = useColorScheme();
  const theme = useSettingsStore((state) => state.settings.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  // Antes da hidratação só se pode PALPITAR, e apenas para escolher o ícone.
  // Depois, o store é a verdade.
  const current: ThemeId = mounted
    ? theme
    : colorScheme === "santuario" || colorScheme === "grimoire"
      ? colorScheme
      : prefersDark
        ? "santuario"
        : "grimoire";

  const next: ThemeId = current === "grimoire" ? "santuario" : "grimoire";
  const action = `Ativar tema ${THEME_LABELS[next]}`;

  if (!mounted) {
    return (
      <Tooltip title={action}>
        <button
          type="button"
          aria-label={action}
          disabled
          className="border-frame text-accent grid size-8 place-items-center rounded-[var(--radius-sm)] border text-xl"
        >
          <SunIcon />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={action}>
      <button
        type="button"
        aria-label={action}
        className="border-frame bg-surface-sunken text-accent hover:text-text grid size-8 place-items-center rounded-[var(--radius-sm)] border text-xl transition-[box-shadow,color,transform] duration-150 hover:shadow-[0_0_16px_-6px_var(--glow)] active:scale-95"
        onClick={() => setTheme(next)}
      >
        {current === "grimoire" ? <MoonIcon /> : <SunIcon />}
      </button>
    </Tooltip>
  );
}
