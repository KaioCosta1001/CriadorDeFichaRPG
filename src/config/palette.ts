/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DESIGN TOKENS — FONTE ÚNICA DE VERDADE DAS CORES                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * UMA FONTE, DOIS CONSUMIDORES
 * Este arquivo gera:
 *   1. as variáveis CSS (`--surface`, `--primary`…) via `<ThemeVariables />`,
 *      consumidas pelo Tailwind (`@theme inline`);
 *   2. os temas do MUI (`config/theme.ts`).
 *
 * Na Fase 1 as cores viviam duplicadas em `globals.css` E em `palette.ts`, com
 * um comentário avisando que elas "deviam evoluir juntas". Isso é exatamente
 * o tipo de promessa que se quebra em silêncio. Agora não há como divergir:
 * mudar uma cor aqui muda o app inteiro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * INSPIRAÇÃO, NÃO CÓPIA
 * A atmosfera vem de dois jogos de fantasia sombria: o calor dourado de um
 * grimório encadernado e o peso de carvão e brasa. NENHUM asset, nome de
 * marca, ícone, textura ou fonte proprietária foi usado. Tudo aqui é valor
 * hexadecimal escolhido à mão; os ornamentos são SVG/CSS originais.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Rampa neutra de 10 passos + tons de acento (exigida pelo MUI). */
export interface GreyRamp {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  A100: string;
  A200: string;
  A300: string;
  A400: string;
}

/** Um tema completo. */
export interface ThemeTokens {
  /** Fundo da página, do mais claro (centro) ao mais escuro (bordas). */
  pageFrom: string;
  pageTo: string;
  /** Fundo dos painéis. */
  surface: string;
  /** Fundo de cabeçalhos, campos e áreas afundadas. */
  surfaceSunken: string;
  /** Fundo elevado (menus, popovers, diálogos). */
  surfaceRaised: string;
  /** Borda externa do painel (metal/ouro). */
  frame: string;
  /** Borda interna fina, um tom mais claro que a externa. */
  frameInner: string;
  /** Divisores e contornos internos. */
  border: string;
  text: string;
  textMuted: string;
  /** Ação principal. */
  primary: string;
  primaryHover: string;
  /** Texto legível sobre a cor primária. */
  onPrimary: string;
  /** Cor de perigo/destrutiva. */
  danger: string;
  success: string;
  warning: string;
  /** Azul de informação (evite o verde de sucesso e o vermelho de perigo). */
  info: string;
  /**
   * Rampa neutra do tema.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * POR QUE PRECISA VIR AQUI
   * O MUI lê `palette.grey[900]` (e vizinhos) ao montar os componentes — e,
   * com `cssVariables`, ele NÃO mais a deriva automaticamente. Sem a rampa,
   * `createTheme` quebra com "Cannot read properties of undefined".
   *
   * Em vez de deixar o cinza puro do MUI brigar com a paleta quente do
   * Grimório, cada tema tem a SUA rampa: tons quentes no Grimório, frios no
   * Santuário. É o que faz os componentes do MUI parecerem parte do mesmo
   * mundo do resto da tela, e não um framework colado por cima.
   * ─────────────────────────────────────────────────────────────────────────
   */
  grey: GreyRamp;
  /** Cor do brilho (glow) — só em hover, foco e detalhes. */
  glow: string;
  /** Dourado opaco para títulos pequenos e detalhes. */
  accent: string;
  /** Anel de foco visível. */
  focus: string;
  /** Vinheta escura nas bordas da página (0 = desliga). */
  vignette: number;
  /** Ruído de textura no painel (0 = desliga). */
  noise: number;
}

/**
 * "GRIMÓRIO" — pergaminho e couro escuros, dourado envelhecido.
 * Atmosfera de grimório encadernado: quente, nobre, legível.
 */
export const grimoire: ThemeTokens = {
  pageFrom: "#1b1510",
  pageTo: "#14100c",
  surface: "#241b13",
  surfaceSunken: "#1a130d",
  surfaceRaised: "#2d2218",
  frame: "#6b5326",
  frameInner: "#3d2f18",
  border: "#4a3a24",
  text: "#e8dcc0",
  textMuted: "#b8a98a",
  primary: "#c9a24a",
  primaryHover: "#e2bd62",
  onPrimary: "#1a1206",
  danger: "#c86a60",
  success: "#8fc46b",
  warning: "#d9b04e",
  info: "#8fb0c8",
  /** Rampa neutra QUENTE: pergaminho envelhecido até couro curtido. */
  grey: {
    50: "#f8f4ec",
    100: "#efe8da",
    200: "#e0d5c1",
    300: "#c8baa0",
    400: "#a4967c",
    500: "#837660",
    600: "#655b4a",
    700: "#4b4336",
    800: "#342e25",
    900: "#221d16",
    A100: "#0f0d09",
    A200: "#1a1611",
    A300: "#241d15",
    A400: "#2e2519",
  },
  glow: "#e2bd62",
  accent: "#c9a24a",
  focus: "#e2bd62",
  vignette: 0.35,
  noise: 0.035,
};

/**
 * "SANTUÁRIO" — carvão, ferro e brasa.
 * Atmosfera de pedra e sangue: mais fria no fundo, com o vermelho sangro
 * reservado para ação e perigo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AJUSTE DE CONTRASTE (documentado de propósito)
 * A direção visual sugeria `#b3201f` como vermelho de brasa. Medido: sobre a
 * superfície `#1a1a1f` ele dá **2.59:1** — reprova o AA (4.5:1) com folga.
 *
 * Um vermelho escuro demais que falha em texto é um vermelho que não pode
 * ser ação principal.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AQUECIMENTO DAS SUPERFÍCIES (adendo §3)
 *
 * As superfícies eram quase-cinza frias: `#1a1a1f`, `#121216`, `#222228` —
 * canais 26/26/31, 18/18/22, 34/34/40. A diferença máxima entre canais era de
 * 6/255, e o teste de "nenhum cinza neutro" reprovava.
 *
 * Viraram carvão COM BRASA: ferro aquecido e resfriado, que é a matéria do
 * Santuário. O desvio entre canais passou de 0,02 para 0,03–0,09, e o tema
 * ganhou identidade em vez de parecer um preto genérico.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O VERMELHO SUBIU DE NOVO — PARA AAA
 *
 * Com `#e0564a`, o texto do botão (`#1a0c0a`) dava 5,09:1: passava em AA, mas
 * o §3 pede AAA para o texto do botão. O tom subiu para `#f77f6e`, que dá
 * **7,5:1** com o mesmo texto escuro.
 *
 * Escurecer o texto não resolvia: mesmo em preto puro, `#e0564a` chega a
 * 5,6:1. Para AAA era preciso o vermelho mais claro — e é o que a brasa acesa
 * realmente é.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const santuario: ThemeTokens = {
  pageFrom: "#191312",
  pageTo: "#120d0c",
  surface: "#201a17",
  surfaceSunken: "#171210",
  surfaceRaised: "#27201c",
  frame: "#5a4a42",
  frameInner: "#2a221e",
  border: "#3d332e",
  text: "#e4dcd2",
  textMuted: "#a99c90",
  primary: "#f77f6e",
  primaryHover: "#ffa094",
  onPrimary: "#1a0c0a",
  danger: "#e46b63",
  success: "#8fc46b",
  warning: "#d9b04e",
  info: "#7fa8cc",
  /** Rampa neutra FRIA: ferro e pedra lavados, do mais claro ao mais fundo. */
  grey: {
    50: "#f2f2f4",
    100: "#e2e2e6",
    200: "#c8c8d0",
    300: "#a5a5b0",
    400: "#7e7e8a",
    500: "#62626c",
    600: "#4a4a53",
    700: "#36363d",
    800: "#24242a",
    900: "#16161a",
    A100: "#0a0a0c",
    A200: "#131317",
    A300: "#1b1b20",
    A400: "#24242a",
  },
  glow: "#ffb3a4",
  accent: "#c0a054",
  focus: "#e8663f",
  vignette: 0.55,
  noise: 0.02,
};

/** Os dois temas, na ordem em que aparecem nas Configurações. */
export const THEMES = {
  grimoire,
  santuario,
} as const satisfies Record<string, ThemeTokens>;

export type ThemeId = keyof typeof THEMES;

/** Ids de tema, na ordem em que aparecem nas Configurações. */
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
/** Nomes em pt-BR dos temas. */
export const THEME_LABELS: Record<ThemeId, string> = {
  grimoire: "Grimório",
  santuario: "Santuário",
};

/** Descrição curta, exibida no seletor de tema. */
export const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  grimoire: "Pergaminho e couro escuros, com dourado envelhecido.",
  santuario: "Carvão, ferro e brasa, com vermelho de brasa.",
};

/** Tema padrão. */
export const DEFAULT_THEME_ID: ThemeId = "grimoire";

/** Busca os tokens de um tema, com fallback para o padrão. */
export function getThemeTokens(themeId: string): ThemeTokens {
  return THEMES[themeId as ThemeId] ?? THEMES[DEFAULT_THEME_ID];
}

/* ===========================================================================
 * ORNAMENTOS — VALORES QUE O CSS USA
 * ========================================================================== */

/**
 * Medidas e efeitos dos ornamentos.
 * Ficam aqui para que `palette.ts` seja a única fonte de verdade visual.
 */
export const ORNAMENT = {
  /** Largura da borda dupla externa. */
  frameWidth: "1px",
  /** Raio padrão de painel. */
  radius: "10px",
  /** Raio dos controles pequenos (botões, campos). */
  radiusSm: "6px",
  /** Espessura da linha ornamental do cabeçalho. */
  dividerHeight: "1px",
  /** Opacidade da textura de ruído. Vem somada por `ThemeTokens.noise`. */
  noiseBase: 0.02,
} as const;

/**
 * Texto da textura de ruído, usado no Grimório.
 *
 * É um `feTurbulence` em baixíssima opacidade: dá a irregularidade de papel
 * sem custo de imagem (o navegador resolve o filtro uma vez e reutiliza).
 * Escrito como data-URI para não custar uma requisição.
 */
export const NOISE_TEXTURE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>`;

/**
 * Monta o bloco `:root { --token: valor }` de um tema.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE GERAR O CSS EM TYPEScript E NÃO ESCREVER EM `globals.css`
 * Com as cores em dois lugares, uma delas sempre envelhece. Aqui existe UM
 * lugar; o `globals.css` consome com `var(--surface)` e nunca declara hex.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function buildThemeVariables(themeId: ThemeId): string {
  const t = THEMES[themeId];

  const declarations: [string, string][] = [
    ["page-from", t.pageFrom],
    ["page-to", t.pageTo],
    ["surface", t.surface],
    ["surface-sunken", t.surfaceSunken],
    ["surface-raised", t.surfaceRaised],
    ["frame", t.frame],
    ["frame-inner", t.frameInner],
    ["border", t.border],
    ["text", t.text],
    ["text-muted", t.textMuted],
    ["primary", t.primary],
    ["primary-hover", t.primaryHover],
    ["on-primary", t.onPrimary],
    ["danger", t.danger],
    ["success", t.success],
    ["warning", t.warning],
    ["glow", t.glow],
    ["accent", t.accent],
    ["focus", t.focus],
    ["vignette", String(t.vignette)],
    ["noise", String(t.noise)],
    ["radius", ORNAMENT.radius],
    ["radius-sm", ORNAMENT.radiusSm],
    ["frame-width", ORNAMENT.frameWidth],
    // A textura de ruído viaja como variável, para que `.noise-surface`
    // possa referenciá-la sem repetir o data-URI em cada tema.
    ["noise-texture", `url("data:image/svg+xml,${NOISE_TEXTURE_SVG}")`],
  ];

  const body = declarations
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");

  return `:root,\n[data-theme="${themeId}"] {\n${body}\n}`;
}
