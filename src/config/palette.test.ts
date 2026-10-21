import { describe, expect, it } from "vitest";

import { RARITY_PRESETS } from "./constants";
import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  buildThemeVariables,
  getThemeTokens,
} from "./palette";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  TESTES DE DESIGN TOKENS                                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Estes testes existem para o adendo visual ser VERIFICÁVEL, e não só
 * declarativo. Um token bonito no papel e ilegível na tela é um bug — e um
 * bug que ninguém percebe olhando o código.
 */

/* ── Contraste (WCAG 2.1) ─────────────────────────────────────────────────── */

/** Luminância relativa, conforme a fórmula da WCAG. */
function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const raw = value.slice(offset, offset + 2);
    const channel = Number.parseInt(raw, 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores, de 1 a 21. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ===========================================================================
 * AUDITORIA DE PALETA (adendo §3)
 *
 * O §3 não pede "verifique as cores" — pede que NENHUM cinza neutro avulso
 * sobre e que o contraste seja auditado nos DOIS temas. Estas verificações
 * existem para que a auditoria seja um TESTE e não uma leitura de código.
 * ======================================================================== */

/** Canais RGB de um hex de 6 dígitos. */
function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

/**
 * O quanto uma cor é "cinza": 0 = totalmente saturada, 1 = cinza puro.
 *
 * A métrica é o desvio entre os três canais. Um cinza neutro tem R ≈ G ≈ B;
 * um osso/pergaminho tem R > G > B com diferença clara entre os extremos.
 */
function grayness(hex: string): number {
  const [r = 0, g = 0, b = 0] = rgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

describe("auditoria de paleta — nenhum cinza neutro avulso (adendo §3)", () => {
  it("nenhum preset de raridade é cinza neutro", () => {
    for (const preset of RARITY_PRESETS) {
      // O `comum` era `#8d8a85`: canais 141/138/133, desvio de 0,031 — cinza
      // com um tiquinho de calor, que é a pior versão: parece publicada sem
      // pertencer a nenhuma paleta.
      expect(
        grayness(preset.color),
        `preset "${preset.id}" (${preset.color}) é cinza neutro`,
      ).toBeGreaterThan(0.08);
    }
  });

  it("o preset 'comum' é osso/pergaminho, e não cinza", () => {
    const comum = RARITY_PRESETS.find((preset) => preset.id === "comum");

    // Um osso é CLARO. Um cinza de "comum" seria escuro e sem personality —
    // e é a cor que o jogador mais vê, porque a maioria dos itens é comum.
    expect(comum).toBeDefined();
    expect(relativeLuminance(comum!.color)).toBeGreaterThan(0.4);
  });

  it("todos os presets têm contraste AA contra a superfície dos DOIS temas", () => {
    // A raridade aparece como borda, glifo e cor do nome. Sobre superfície
    // escura, um tom médio passaria batido — e "passar batido" é o mesmo que
    // "não existir" para quem olha a lista de itens.
    for (const preset of RARITY_PRESETS) {
      for (const id of THEME_IDS) {
        const t = getThemeTokens(id);
        expect(
          contrastRatio(preset.color, t.surface),
          `"${preset.label}" (${preset.color}) sobre ${id}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("nenhum TOKEN de superfície é cinza neutro", () => {
    // Tokens que são "quase cinza" são a origem do problema: o componente
    // herda um tom sem personalidade e o cinza se espalha pelo app inteiro.
    const alvos = [
      "surface",
      "surfaceSunken",
      "surfaceRaised",
      "frame",
    ] as const;

    for (const id of THEME_IDS) {
      const t = getThemeTokens(id);
      for (const token of alvos) {
        expect(
          grayness(t[token]),
          `${token} de ${id} (${t[token]}) é cinza neutro`,
        ).toBeGreaterThan(0.02);
      }
    }
  });

  it("as DUAS surfaces dão contraste AA ao texto em ambos os temas", () => {
    // `--surface-raised` é a superfície dos Dialogs e Menus; `--surface-sunken`
    // é a dos campos. Se qualquer uma das duas reprovasse, o defeito apareceria
    // só dentro de uma janela — o pior lugar para se lembrar dele.
    for (const id of THEME_IDS) {
      const t = getThemeTokens(id);
      for (const surface of [t.surfaceRaised, t.surfaceSunken]) {
        expect(
          contrastRatio(t.text, surface),
          `texto de ${id} sobre ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("botão de ação — contraste do texto sobre o fundo (adendo §3)", () => {
  for (const id of THEME_IDS) {
    const t = getThemeTokens(id);

    it(`${id}: o texto do botão contrasta com o fundo do botão (AAA)`, () => {
      // O §3 pede AAA para o texto do botão. `--primary` é dourado/brasa e
      // `--on-primary` é escuro: é esse par que precisa ser verificado.
      expect(contrastRatio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(7);
    });

    it(`${id}: o botão contrasta com a superfície onde ele aparece`, () => {
      // Um botão dourado sobre pergaminho escuro passa; o mesmo botão sobre
      // uma superfície clara (que os dois temas não têm, mas um terceiro tema
      // poderia) desapareceria.
      expect(contrastRatio(t.primary, t.surfaceRaised)).toBeGreaterThanOrEqual(
        3,
      );
    });
  }
});

describe("contraste WCAG AA (adendo §10)", () => {
  // Texto normal exige 4.5:1; texto grande (≥18.66px bold ou ≥24px) exige 3:1.
  const AA_NORMAL = 4.5;
  const AA_LARGE = 3;

  for (const id of THEME_IDS) {
    const t = getThemeTokens(id);

    it(`${id}: texto principal sobre superfície de painel`, () => {
      expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: texto principal sobre a página`, () => {
      expect(contrastRatio(t.text, t.pageTo)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it(`${id}: texto secundário sobre superfície de painel`, () => {
      // Texto secundário é usado em labels e legendas — precisa ser legível.
      expect(contrastRatio(t.textMuted, t.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: cor primária sobre superfície de painel (botões, links)`, () => {
      expect(contrastRatio(t.primary, t.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: texto sobre o botão primário`, () => {
      expect(contrastRatio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: cor de perigo sobre superfície (destrutivo)`, () => {
      expect(contrastRatio(t.danger, t.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: dourado de detalhe legível em texto pequeno`, () => {
      // O `accent` é usado nos títulos em caixa-alta, que são texto pequeno.
      expect(contrastRatio(t.accent, t.surface)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });

    it(`${id}: cores de aviso e sucesso distinguíveis (≥ 3:1)`, () => {
      // Usadas em Alerts e contadores: ainda precisam ser distinguíveis, mas
      // não carregam texto longo.
      expect(contrastRatio(t.warning, t.surface)).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
      expect(contrastRatio(t.success, t.surface)).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
      expect(contrastRatio(t.info, t.surface)).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it(`${id}: moldura do painel se distingue da superfície`, () => {
      // A moldura é informação visual (o limite do bloco). Se some, o painel
      // deixa de parecer um objeto — e texto pequeno em 1.4:1 também falha.
      expect(contrastRatio(t.frame, t.surface)).toBeGreaterThanOrEqual(1.6);
      expect(contrastRatio(t.border, t.surface)).toBeGreaterThanOrEqual(1.25);
    });

    it(`${id}: anel de foco visível sobre a superfície`, () => {
      expect(contrastRatio(t.focus, t.surface)).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    });
  }
});

/* ── Integridade dos tokens ───────────────────────────────────────────────── */

describe("tokens", () => {
  it("cada tema é um hex de 6 dígitos válido", () => {
    for (const id of THEME_IDS) {
      for (const [key, value] of Object.entries(getThemeTokens(id))) {
        if (typeof value !== "string") continue;
        if (key === "grey") continue;

        expect(value, `${id}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("a rampa neutra tem os 14 degraus que o MUI exige", () => {
    const required = [
      "50",
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
      "A100",
      "A200",
      "A300",
      "A400",
    ] as const;
    for (const id of THEME_IDS) {
      const grey = getThemeTokens(id).grey as unknown as Record<
        (typeof required)[number],
        string
      >;
      for (const step of required) {
        expect(grey[step], `${id}.grey.${step}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("a rampa neutra vai do mais claro ao mais escuro (monotônica)", () => {
    const steps = [
      "50",
      "100",
      "200",
      "300",
      "400",
      "500",
      "600",
      "700",
      "800",
      "900",
    ] as const;

    for (const id of THEME_IDS) {
      const grey = getThemeTokens(id).grey as unknown as Record<
        (typeof steps)[number],
        string
      >;
      for (let i = 1; i < steps.length; i += 1) {
        const previous = relativeLuminance(grey[steps[i - 1]!]);
        const current = relativeLuminance(grey[steps[i]!]);
        expect(
          current,
          `${id}.grey ${steps[i]} deve ser mais escuro que ${steps[i - 1]}`,
        ).toBeLessThan(previous);
      }
    }
  });

  it("a cor primária se distingue do fundo (não é invisível)", () => {
    for (const id of THEME_IDS) {
      const t = getThemeTokens(id);
      expect(t.primary).not.toBe(t.surface);
      expect(t.primary).not.toBe(t.pageTo);
    }
  });

  it("o brilho é mais claro que a cor primária (glow precisa brilhar)", () => {
    for (const id of THEME_IDS) {
      const t = getThemeTokens(id);
      expect(
        relativeLuminance(t.glow),
        `${id}: glow deveria ser mais claro que primary`,
      ).toBeGreaterThan(relativeLuminance(t.primary));
    }
  });

  it("a vinheta e o ruído ficam em faixa utilizável", () => {
    for (const id of THEME_IDS) {
      const t = getThemeTokens(id);
      expect(t.vignette).toBeGreaterThan(0);
      expect(t.vignette).toBeLessThanOrEqual(1);
      expect(t.noise).toBeGreaterThan(0);
      // Acima de ~6% o "grão" começa a parecer sujeira na tela.
      expect(t.noise).toBeLessThanOrEqual(0.06);
    }
  });

  it("tema desconhecido cai no padrão em vez de quebrar", () => {
    expect(getThemeTokens("inexistente")).toBe(THEMES[DEFAULT_THEME_ID]);
  });
});

/* ── Geração de CSS ───────────────────────────────────────────────────────── */

describe("buildThemeVariables", () => {
  it("emite um seletor que cobre :root e o atributo do tema", () => {
    const css = buildThemeVariables("santuario");
    expect(css.startsWith(":root,")).toBe(true);
    expect(css).toContain('[data-theme="santuario"]');
  });

  it("declara os tokens que o globals.css consome", () => {
    const css = buildThemeVariables("grimoire");
    for (const token of [
      "--surface",
      "--surface-sunken",
      "--frame",
      "--border",
      "--text",
      "--text-muted",
      "--primary",
      "--danger",
      "--glow",
      "--focus",
      "--vignette",
      "--noise",
      "--noise-texture",
      "--radius",
    ]) {
      expect(css, `falta ${token}`).toContain(`${token}:`);
    }
  });

  it("cada tema gera CSS diferente", () => {
    expect(buildThemeVariables("grimoire")).not.toBe(
      buildThemeVariables("santuario"),
    );
  });

  it("todo valor de cor sai do tema — nada é montado à mão", () => {
    // `buildThemeVariables` monta a string a partir de `THEMES`. Se alguém
    // começar a concatenar valor vindo de fora, isto vira injeção de CSS.
    const css = buildThemeVariables("grimoire");
    const theme = THEMES.grimoire;

    for (const value of [
      theme.surface,
      theme.frame,
      theme.text,
      theme.primary,
      theme.danger,
      theme.glow,
    ]) {
      expect(css).toContain(value);
    }

    // Fora dos tokens, não pode sobrar cor literal.
    const colorLiterals = css.match(/#[0-9a-f]{6}/gi) ?? [];
    for (const literal of colorLiterals) {
      expect(
        Object.values(theme).includes(literal.toLowerCase()) ||
          Object.values(theme.grey).includes(literal.toLowerCase()),
        `cor literal fora dos tokens: ${literal}`,
      ).toBe(true);
    }
  });
});
