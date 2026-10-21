import { createTheme } from "@mui/material/styles";

import { ORNAMENT, THEMES, type ThemeId, type ThemeTokens } from "./palette";

/**
 * ───────────────────────────────────────────────────────────────────────────
 * AUGMENTAÇÃO DE TIPO: OS DOIS TEMAS SÃO ESQUEMAS DO MUI
 *
 * O MUI aceita esquemas de cor extras por augmentação de módulo — é o
 * mecanismo oficial para apps com temas nomeados, e evita `as any`.
 * `ColorSchemeOverrides` é a interface que transforma as chaves de
 * `colorSchemes` em "grimoire" | "santuario".
 *
 * Efeito prático: `useColorScheme().mode` passa a devolver
 * `"grimoire" | "santuario"` já tipado, sem cast em lugar nenhum.
 * ───────────────────────────────────────────────────────────────────────────
 */
declare module "@mui/material/styles" {
  interface ColorSchemeOverrides extends Record<ThemeId, true> {}
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  TEMA DO MATERIAL UI                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COEXISTÊNCIA COM O TAILWIND
 *
 * `colorSchemeSelector: "data-theme"` faz o MUI gravar `data-theme="…"` no
 * `<html>` — o MESMO atributo que o Tailwind lê em `globals.css`. Um
 * atributo, um dono (o MUI), duas bibliotecas sempre em sincronia, sem script
 * nosso para manter os dois lados em acordo.
 *
 * O CSS do MUI vai para `@layer mui`, declarado como a camada de MENOR
 * prioridade em `globals.css`. Resultado: utilitários do Tailwind SEMPRE
 * vencem o MUI, sem `!important` e sem prefixo.
 *
 * Por isso NÃO usamos `StyledEngineProvider`: ele cria um `CacheProvider`
 * próprio, mais interno que o do App Router, e sombreia o cache — medido na
 * Fase 1, os `<style>` do MUI saíam DEPOIS do CSS do Tailwind e venciam.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE AS CORES VEM DE `var(--…)` E NÃO DE HEX
 * O MUI manipula canais de cor em alguns cálculos (transparência, gradientes
 * a partir de `main`/`light`/`dark`). Passar `var(--primary)` funciona para as
 * cores literais, mas quebra onde o MUI deriva matematicamente.
 *
 * Solução: cada esquema tem as cores em `hex` (para o MUI calcular) E o
 * `background.default/paper` em `var(--…)` (que o Tailwind usa). Assim os
 * dois leem a mesma fonte sem o MUI precisar derivar nada de uma variável.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * Escala mínima de uma cor semântica.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE `light` E `dark` SÃO EXPLICÍTOS
 * Com `cssVariables`, o MUI NÃO passa pelo `augmentColor` que derivaria
 * `light`/`dark` a partir de `main` — ele lê esses campos direto ao montar o
 * esquema (`palette.error.light`, `palette.info.dark`…). Sem eles, a criação
 * do tema quebra com "Cannot read properties of undefined".
 *
 * `light` recebe o tom de hover e `dark` o tom base: é uma aproximação
 * deliberada. Sombreamento automático exigiria uma função de cor aqui, e
 * esses tons só aparecem em variantes preenchidas que o app mal usa.
 * ───────────────────────────────────────────────────────────────────────────
 */
function scale(main: string, hover: string, contrastText: string) {
  return { main, light: hover, dark: main, contrastText };
}

/** Monta o bloco de paleta de um esquema a partir dos tokens. */
function toPalette(t: ThemeTokens) {
  return {
    primary: scale(t.primary, t.primaryHover, t.onPrimary),
    // O MUI lê `secondary.main` ao montar `LinearProgress`. No nosso caso
    // "secundário" é o dourado de detalhe — é o que dá nome aos adornos.
    secondary: scale(t.accent, t.glow, t.onPrimary),
    error: scale(t.danger, t.danger, "#ffffff"),
    success: scale(t.success, t.success, "#10140f"),
    warning: scale(t.warning, t.warning, "#1a1408"),
    info: scale(t.info, t.info, "#0d1116"),
    // Cores literais: o MUI precisa calculá-las.
    divider: t.frame,
    text: { primary: t.text, secondary: t.textMuted },
    grey: t.grey,
    // `common` é obrigatório quando o modo é "dark": o MUI escreve
    // `common.background` / `common.onBackground` ao montar o esquema, e sem
    // este objeto a criação do tema quebra.
    common: { background: "#000000", onBackground: "#ffffff" },
    // Referências: o Tailwind já tem a variável CSS injetada.
    background: { default: "var(--page-to)", paper: "var(--surface)" },
  } as const;
}

/**
 * Tema único com os DOIS esquemas de cor.
 *
 * Não criamos dois `createTheme`: um só com `colorSchemes` é o que permite
 * ao MUI trocar de esquema trocando um atributo — sem recriar a folha de
 * estilo, sem flash e sem "layout shift" ao mudar de tema (§10 do adendo).
 */
export const appTheme = createTheme({
  cssVariables: {
    // Prefixo das CSS variables geradas pelo MUI, para não colidir com as
    // nossas (`--surface`, `--primary`…).
    cssVarPrefix: "app",
    // Faz o MUI gravar `data-theme="grimoire" | "santuario"` no `<html>`.
    colorSchemeSelector: "data-theme",
  },

  colorSchemes: {
    grimoire: {
      palette: { mode: "dark" as const, ...toPalette(THEMES.grimoire) },
    },
    santuario: {
      palette: { mode: "dark" as const, ...toPalette(THEMES.santuario) },
    },
  },

  /**
   * Esquema usado na primeira renderização, antes de o usuário escolher.
   * O MUI só o troca quando `setColorScheme` é chamado (pela `ThemeSync`).
   */
  defaultColorScheme: "grimoire" as ThemeId,

  shape: {
    // Cantos discretos: o ornamento vem do chanfro, não de um raio enorme.
    borderRadius: Number.parseInt(ORNAMENT.radiusSm, 10),
  },

  typography: {
    fontFamily: 'var(--font-body), "EB Garamond", ui-serif, Georgia, serif',
    button: {
      // Botões com caixa-alta e espaçamento largo puxam a memória dos dois
      // temas de referência para "runa"/"inscrição".
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.04em",
    },
    // Rótulos e legendas em caixa-alta pequena, com espaçamento.
    caption: {
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      fontSize: "0.7rem",
    },
  },

  components: {
    /* ── Botões: placa de metal com brilho no hover ─────────────────────── */
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: ORNAMENT.radiusSm,
          textShadow: "none",
          transition: "transform 120ms ease, box-shadow 120ms ease",
          "&:hover": { boxShadow: "0 0 16px -6px var(--glow)" },
          // Aperto com "peso", sem passar de 1.02 (acima disso vira brinquedo).
          "&:active": { transform: "scale(0.98)" },
        },
        contained: {
          // A cor do botão vem da VARIÁVEL CSS, não do `palette.primary.main`
          // fixo do tema. Assim a troca de tema é só uma regra
          // `[data-theme="…"]` — o mesmo mecanismo que move o Tailwind — em
          // vez de depender de o MUI re-gerar a folha de estilo do esquema.
          backgroundColor: "var(--primary)",
          color: "var(--on-primary)",
          backgroundImage: "none",
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14)",
          "&:hover": {
            backgroundColor: "var(--primary-hover)",
            backgroundImage: "none",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.2), 0 0 20px -6px var(--glow)",
          },
          "&.Mui-disabled": { backgroundColor: "var(--frame)" },
        },
        outlined: {
          borderColor: "var(--frame)",
          "&:hover": { borderColor: "var(--accent)" },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 34,
          minHeight: 34,
          borderRadius: ORNAMENT.radiusSm,
          color: "var(--accent)",
          "&:hover": {
            backgroundColor: "rgb(255 255 255 / 0.05)",
            boxShadow: "0 0 14px -6px var(--glow)",
          },
        },
      },
    },

    /* ── Campos: efeito "gravado", rebaixados ───────────────────────────── */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: ORNAMENT.radiusSm,
          backgroundColor: "var(--surface-sunken)",
          // A borda metálica é o `notchedOutline` padrão do MUI, só que
          // usando o token — assim segue o tema sem CSS extra.
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--frame)" },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--accent)",
          },
          "&.Mui-focused": { backgroundColor: "var(--surface-sunken)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--focus)",
            borderWidth: 1,
          },
        },
        input: {
          "&::placeholder": { color: "var(--text-muted)", opacity: 0.7 },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: { color: "var(--text-muted)" },
        focused: { color: "var(--accent)" },
      },
    },

    /* ── Diálogo: pergaminho com moldura ─────────────────────────────────── */
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--frame)",
          boxShadow:
            "inset 0 0 0 1px var(--frame-inner), 0 24px 60px -20px rgb(0 0 0 / 0.85)",
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          // Recorte de canto, como uma folha arrancada de um grimório.
          clipPath:
            "polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))",
        },
      },
    },

    /* ── Tooltip: borda dourada, texto legível ───────────────────────────── */
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          backgroundColor: "var(--surface-raised)",
          color: "var(--text)",
          border: "1px solid var(--frame)",
          boxShadow: "0 0 20px -8px var(--glow)",
          fontSize: "0.78rem",
          lineHeight: 1.45,
        },
        arrow: { color: "var(--frame)" },
      },
    },

    /* ── Abas: realce da ativa + linha de luz ────────────────────────────── */
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 2,
          backgroundColor: "var(--primary)",
          boxShadow: "0 0 10px -2px var(--glow)",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: "var(--text-muted)",
          fontFamily: "var(--font-display)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontSize: "0.75rem",
          "&.Mui-selected": {
            color: "var(--accent)",
            textShadow: "0 0 12px -4px var(--glow)",
          },
        },
      },
    },

    /* ── Diversos ────────────────────────────────────────────────────────── */
    MuiCheckbox: {
      styleOverrides: {
        root: { color: "var(--frame)" },
        checked: { color: "var(--primary)" },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { color: "var(--frame)" },
        checked: { color: "var(--primary)" },
        thumb: { backgroundColor: "var(--surface-raised)" },
        track: { backgroundColor: "var(--surface-sunken)" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: ORNAMENT.radiusSm,
          backgroundColor: "var(--surface-sunken)",
          color: "var(--text)",
        },
        outlined: { borderColor: "var(--frame)" },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: "var(--accent)" },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: { color: "var(--text)" },
        secondary: { color: "var(--text-muted)" },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--frame)",
          color: "var(--text)",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--surface-sunken)",
          border: "1px solid var(--frame)",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: "rgb(255 255 255 / 0.05)" },
          "&.Mui-selected": {
            backgroundColor: "rgb(255 255 255 / 0.07)",
            color: "var(--accent)",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: "var(--surface-raised)",
          border: "1px solid var(--frame)",
        },
      },
    },
  },
});
