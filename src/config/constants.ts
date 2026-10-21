/**
 * ============================================================================
 * CONSTANTES CONFIGURÁVEIS — FONTE ÚNICA DA VERDADE
 * ============================================================================
 *
 * REGRA DO PROJETO: nenhum limite, tamanho, cor ou tempo de animação aparece
 * "solto" no código. Tudo o que um mantenedor poderia querer ajustar está
 * neste arquivo, com comentário explicando o que o valor faz.
 *
 * Se um número mágico começar a aparecer em um componente, ele pertence aqui.
 * (Exceções aceitáveis: valores puramente matemáticos internos a `domain/`.)
 */

/* ===========================================================================
 * 1. PERSISTÊNCIA
 * ======================================================================== */

/**
 * Prefixo de TODAS as chaves usadas no storage.
 * Alterar aqui isola o app de dados de versões anteriores do projeto.
 */
export const STORAGE_PREFIX = "rpgv3";

/**
 * Versão do formato dos dados persistidos.
 *
 * Incrementar SEMPRE que o formato mudar, e adicionar a função de migração
 * correspondente em `src/domain/migrations.ts`. Dados antigos são migrados,
 * nunca descartados silenciosamente.
 */
export const SCHEMA_VERSION = 5;

/** Chaves derivadas de `STORAGE_PREFIX`, para não repetir template strings. */
export const STORAGE_KEYS = {
  /** Índice com a lista de fichas (resumo de cada documento). */
  sheets: `${STORAGE_PREFIX}:sheets`,
  /** Configurações globais do app (independentes da ficha). */
  settings: `${STORAGE_PREFIX}:settings`,
  /** Documentos corrompidos isolados, para o usuário exportar ou descartar. */
  quarantine: `${STORAGE_PREFIX}:quarantine`,
  /**
   * Chaves que o MUI pede para guardar em storage.
   *
   * O MUI separa DUAS coisas: o `mode` (claro/escuro) e o `colorScheme`
   * (o tema NOMEADO). Nossos dois temas — Grimório e Santuário — são ambos
   * escuros, então o `mode` é sempre "dark" e quem realmente muda é o
   * `colorScheme`. Manter as duas chaves distintas evita que o MUI leia
   * "grimoire" como se fosse um modo de brilho.
   */
  colorMode: `${STORAGE_PREFIX}:color-mode`,
  colorScheme: `${STORAGE_PREFIX}:color-scheme`,
} as const;

/**
 * Chave de UM documento de ficha.
 *
 * Uma chave por ficha (e não um array único) é deliberado: um documento
 * corrompido passa a afetar apenas a si mesmo, e a quarentena consegue guardar
 * o texto bruto intacto para o usuário exportar.
 */
export function sheetStorageKey(id: string): string {
  return `${STORAGE_PREFIX}:sheet:${id}`;
}

/** Chave de UM documento isolado na quarentena. */
export function quarantineStorageKey(id: string): string {
  return `${STORAGE_PREFIX}:quarantine:${id}`;
}

/**
 * Intervalo de agrupamento das escritas no storage (debounce).
 * Evita escrever a ficha inteira a cada tecla digitada.
 * Aumentar = menos escritas / maior chance de perder o último instante.
 */
export const SAVE_DEBOUNCE_MS = 400;

/**
 * Cota máxima estimada do localStorage (~5 MB na maioria dos navegadores).
 * Usada para detectar risco de quota excedida antes de a escrita estourar.
 */
export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

/** Fração da cota a partir da qual o app avisa que o armazenamento está cheio. */
export const STORAGE_QUOTA_WARN_RATIO = 0.8;

/** Quantos documentos corrompidos mantemos na quarentena antes de descartar os mais antigos. */
export const QUARANTINE_MAX_ITEMS = 10;

/* ===========================================================================
 * 2. INVENTÁRIO
 * ======================================================================== */

/** Máximo de linhas na aba "Armas". */
export const MAX_WEAPONS = 10;

/** Máximo de linhas na aba "Itens". */
export const MAX_ITEMS = 100;

/**
 * Abas do inventário.
 * Editar aqui cria/renomeia/remove abas (ajustes de UI ficam em
 * `src/components/panels/inventory`).
 */
export const INVENTORY_TABS = [
  { id: "weapons", label: "Armas" },
  { id: "items", label: "Itens" },
] as const;

export type InventoryTabId = (typeof INVENTORY_TABS)[number]["id"];

/* ===========================================================================
 * 3. ROLAGEM
 * ======================================================================== */

/** Máximo de rolagens mantidas no histórico do bloco de resultado. */
export const ROLL_HISTORY_LIMIT = 3;

/**
 * Faces do dado base de perícia e de atributo (adendo — clique direito).
 *
 * O adendo fixa: "Em ambos os casos o dado base é um único d20". A constante
 * existe para o dia em que alguém quiser o d10 do Old Dragon na perícia sem
 * precisar caçar o número por todo o código.
 */
export const ROLL_BASE_DIE = 20;

/**
 * Tempo de toque longo para abrir o menu de rolagem em telas de toque.
 *
 * 450 ms é o ponto em que o toque deixa de ser "toque" e vira "segurar" na
 * maioria das interfaces. Menor que isso o menu abre sozinho enquanto o
 * usuário ainda tentava rolar a lista; maior, ele acha que a ficha travou.
 */
export const LONG_PRESS_MS = 450;

/** Duração da animação de abertura do menu de contexto. */
export const CONTEXT_MENU_FADE_MS = 120;

/**
 * ───────────────────────────────────────────────────────────────────────────
 * PONTO EM ABERTO nº 1 — ROLAR ATRIBUTO SOMA A CONTRIBUIÇÃO?
 *
 * Padrão adotado: **sim** (d20 + a mesma contribuição que a arma usaria).
 *
 * A flag existe para o padrão ser uma LINHA de troca, como o adendo pede.
 * Ligar/desligar aqui muda o cálculo da rolagem de atributo em TODO o app —
 * o teste de domínio lê esta constante, então uma troca de decisão aparece
 * como falha de teste em vez de silêncio.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const ATTRIBUTE_ROLL_ADDS_CONTRIBUTION = true;

/** Rótulo exibido de uma rolagem no resultado e no histórico. */
export const ROLL_LABEL_MAX_LENGTH = 120;

/** Rótulo de uma parcela do detalhamento ("perícia", "Destreza", "+3"). */
export const ROLL_COMPONENT_LABEL_MAX_LENGTH = 40;

/** Dados disponíveis para rolagem (d4…d20). */
export const DICE_OPTIONS = [4, 6, 8, 10, 12, 20] as const;

export type DieFaces = (typeof DICE_OPTIONS)[number];

/**
 * Tipos de dado que a INTERFACE oferece para rolagem de arma.
 *
 * Este é exatamente o conjunto pedido no documento (d4…d20) e é o que
 * aparece no seletor da aba Armas (seção 8.2.1).
 */
export const WEAPON_DIE_TYPES = DICE_OPTIONS.map((faces) => `d${faces}`);

export type WeaponDieType = (typeof WEAPON_DIE_TYPES)[number];

/**
 * Dados RESERVADOS, fora da lista da interface.
 *
 * O Call of Cthulhu rola perícias em d100. A estrutura já aceita esse dado —
 * cada sistema declara seu próprio `skillDie` — mas o seletor de arma
 * continua mostrando apenas d4…d20, conforme a especificação.
 */
export const RESERVED_DIE_TYPES = ["d100"] as const;

/**
 * Todos os tipos de dado aceitos pelo schema.
 * É contra este conjunto que `DieTypeSchema` valida.
 *
 * O formato textual ("d20") é o gravado no storage: legível no JSON
 * exportado e estável mesmo se a ordem de `DICE_OPTIONS` mudar.
 */
export const ALL_DIE_TYPES = [
  ...WEAPON_DIE_TYPES,
  ...RESERVED_DIE_TYPES,
] as const;

export type DieType = (typeof ALL_DIE_TYPES)[number];

/** Converte "d20" em 20. */
export function dieTypeToFaces(die: DieType): number {
  return Number.parseInt(die.slice(1), 10);
}

/** Converte 20 em "d20", ou `null` se não for um dado conhecido. */
export function facesToDieType(faces: number): DieType | null {
  return (
    ALL_DIE_TYPES.find((candidate) => dieTypeToFaces(candidate) === faces) ??
    null
  );
}

/**
 * Teto de dados por rolagem — proteção contra travamento do navegador.
 * Uma arma com `diceCount` acima disso é automaticamente limitada.
 */
export const MAX_DICE_PER_ROLL = 100;

/** Menor valor aceito para `diceCount`. */
export const MIN_DICE_PER_ROLL = 1;

/** Duração da animação de "giro" dos dados, em ms. */
export const ROLL_ANIMATION_MS = 700;

/** Atraso mínimo entre rolagens consecutivas, em ms (evita "piscar" quando o usuário clica em sequência). */
export const ROLL_MIN_INTERVAL_MS = 120;

/* ===========================================================================
 * 5.1 ANIMACAO DE ROLAGEM (adendo 5)
 * ======================================================================== */

export const ROLL_ANIM_MS = 1600;
export const ROLL_SPEED_DEFAULT = 1;
export const ROLL_SPEED_MIN = 0.5;
export const ROLL_SPEED_MAX = 2;
export const ROLL_SPEED_STEP = 0.25;
export const ROLL_SPEED_PRESETS = {
  lenta: 0.6,
  normal: 1,
  rapida: 1.8,
} as const;
export const ROLL_NUMBER_TICK_MS = 40;
export const ROLL_NUMBER_SETTLE_MS = 250;

/** Atraso de abertura dos tooltips (detalhamento do resultado). */
export const TOOLTIP_DELAY_MS = 400;

/* ===========================================================================
 * 4. GRID DE PAINÉIS E REDIMENSIONAMENTO
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  O GRID É FINO DE PROPÓSITO, E AS DUAS CONSTANTES MUDAM A "RESOLUÇÃO"  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Com `GRID_COLUMNS = 48`, mover o mouse um dedo muda o bloco uma célula — dá
 * para ajustar com precisão e ainda assim tudo fica alinhado. É o estilo do
 * ajuste de painéis da Adobe: o grid AJUDA a alinhar, mas não RESTRINGE o
 * tamanho, porque o bloco pode ocupar qualquer quantidade de células.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `RESIZE_SNAP_PX` FOI REMOVIDO — LEIA ISTO
 *
 * A Fase 1 exigia snap de 5 px e, por isso, o layout era livre em pixels. Este
 * adendo substitui o requisito: o snap agora é a UNIDADE DO GRID. A constante
 * antiga saiu, e `snapToStep` foi redirecionado para o inteiro de célula
 * (`GRID_MIN_W` etc. são inteiros). Não há mais nenhum número fracionário
 * em `sheet.layout`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A COLUNA É FLUIDA, A LINHA NÃO
 *
 * `GRID_COLUMNS` colunas dividem a largura útil do container. Assim o grid
 * preenche a tela toda em vez de deixar uma faixa vazia à direita, que é o que
 * aconteceria com uma coluna de largura fixa.
 *
 * A ALTURA da linha é fixa em px: é o que dá o ajuste vertical fino (uma linha
 * a cada 10 px) sem depender de nada medido.
 *
 * O preço é que `layout.ts` não pode saber a largura do container — e é por
 * isso que TODA a matemática de célula vive na grade, e `domain/layout.ts`
 * continua puro, sem DOM.
 * ======================================================================== */

/**
 * Colunas do grid. Quanto MAIOR, mais fino o snap horizontal.
 *
 * O valor é dividido pela largura útil do container: `48` dá passos de ~1/48 da
 * largura, ou seja, cerca de 30 px numa tela de 1600 px.
 */
export const GRID_COLUMNS = 48;

/** Altura de uma linha do grid, em px (snap vertical). */
export const GRID_ROW_HEIGHT_PX = 10;

/**
 * Lado da célula em px (referência). Com células quadradas, este valor é
 * a base para GRID_ROW_HEIGHT_PX e cell.h.
 *
 * Nota: a implementação atual usa células fluidas (cell.w = cell.h = containerWidth / GRID_COLUMNS),
 * mas este valor serve como referência para a altura de linha fixa.
 */
export const GRID_CELL_PX = GRID_ROW_HEIGHT_PX;

/**
 * Espaçamento entre células, em px.
 *
 * Entra duas vezes no cálculo do tamanho de um bloco: uma no meio (o vão entre
 * células vizinhas) e uma na borda (o vão do container até a primeira célula).
 */
export const GRID_GAP_PX = 12;

/**
 * Gap do grid em CELULAS: 1 célula entre blocos vizinhos.
 *
 * O gap em pixels ( GRID_GAP_PX) é convertido na grade. Em células, o vão vale 1 — usar 12 aqui empurrava o bloco 12 células para baixo.
 */
export const GRID_GAP_CELLS = 1;

/** Mostra as guias do grid por baixo dos blocos enquanto o Editar Geral está ligado. */
export const GRID_SHOW_GUIDES = true;

/**
 * Como o grid trata os vãos deixados ao arrastar.
 *
 * - `"vertical"`: um bloco sempre pode ser empurrado para baixo até achar
 *   lugar. É o comportamento previsível de "soltar sobre outro e ele escorrega".
 * - `"none"`: nada é compactado; se sobrar buraco, ele fica.
 */
export const LAYOUT_COMPACT_MODE: "vertical" | "none" = "vertical";

/**
 * Menores limites GLOBAIS, em células.
 *
 * São o PISO de segurança: o tamanho mínimo real é o maior entre isto e o
 * `minSize` do tipo do bloco (ver `PANEL_MIN_SIZE`), porque um bloco de perfil
 * espremido em 4×4 ficaria ilegível.
 */
export const GRID_MIN_W = 6;
export const GRID_MIN_H = 5;

/** Maior largura permitida, em células: o bloco pode ocupar a grade inteira. */
export const GRID_MAX_W = GRID_COLUMNS;

/** Teto de altura, em células (evita um painel de 5000 linhas que trava a grade). */
export const GRID_MAX_H = 200;

/* ===========================================================================
 * 4.1 LIMITES DE TAMANHO POR TIPO DE PAINEL (adendo 2)
 * ======================================================================== */

export const PANEL_SIZE_LIMITS = {
  profile: { minW: 8, maxW: 24, minH: 8, maxH: 60 },
  inventory: { minW: 9, maxW: 48, minH: 9, maxH: 80 },
  "roll-result": { minW: 8, maxW: 24, minH: 13, maxH: 60 },
  attributes: { minW: 16, maxW: 48, minH: 7, maxH: 40 },
  skills: { minW: 16, maxW: 48, minH: 8, maxH: 60 },
  text: { minW: 8, maxW: 48, minH: 8, maxH: 80 },
  list: { minW: 8, maxW: 48, minH: 8, maxH: 80 },
  placeholder: { minW: 8, maxW: 24, minH: 8, maxH: 40 },
} as const;

/**
 * Largura de referência usada para CONVERTER layouts antigos (em px) para
 * células na migração.
 *
 * A migração roda sem DOM: não existe container para medir. Como a conversão é
 * necessariamente aproximada (a §1.7 pede "tamanhos aproximados"), ela usa
 * esta largura como referência e o layout é normalizado logo em seguida — o
 * usuário nunca chega a ver um layout convertido torto.
 *
 * O valor bate com o `max-w-[1600px]` de `SheetScreen`, que é a largura máxima
 * que o grid ocupa em telas grandes.
 */
export const LAYOUT_MIGRATION_REFERENCE_WIDTH_PX = 1600;

/** Espaçamento (gap) entre painéis do grid, em px. */
export const PANEL_GAP_PX = GRID_GAP_PX;

/** Margem interna do container do grid, em px. */
export const PANEL_GRID_PADDING_PX = 16;

/**
 * Menor largura permitida para um painel, em px.
 *
 * SUBSTITUÍDO pelos mínimos em células. Ainda existe porque é a única unidade
 * que o `ResizeHandles` usa para decidir o cursor e o `title` — e, mais
 * importante, porque a migração precisa de um piso em px para não encolher um
 * painel para zero antes de converter.
 */
export const PANEL_MIN_WIDTH_PX = 120;

/** Maior largura permitida para um painel, em px (teto de segurança). */
export const PANEL_MAX_WIDTH_PX = 2400;

/** Menor altura permitida para um painel, em px. */
export const PANEL_MIN_HEIGHT_PX = 100;

/** Maior altura permitida para um painel, em px (teto de segurança). */
export const PANEL_MAX_HEIGHT_PX = 2000;

/**
 * Abaixo desta largura de viewport o app entra em "modo empilhado":
 * os painéis ignoram o layout salvo e são empilhados verticalmente.
 * O redimensionamento e o arraste de painéis ficam indisponíveis (decisão
 * documentada da Fase 1); o DnD das listas internas continua funcionando.
 */
export const MOBILE_BREAKPOINT_PX = 768;

/* ── Geometria: célula ↔ pixel ────────────────────────────────────────────── */

/** Tamanho de uma célula, em px, para um container de `containerWidth`. */
export interface CellSize {
  /** Largura de uma coluna, em px (fracionária: a grade é fluida). */
  w: number;
  /** Altura de uma linha, em px (inteira: `GRID_ROW_HEIGHT_PX`). */
  h: number;
}

/**
 * Converte a largura do container no tamanho de uma célula.
 *
 * `Math.max(1, ...)` evita divisão por zero: com container de 0 px (antes da
 * medição, ou em jsdom) a célula cai em 1 px em vez de `NaN`, e um `NaN` no
 * estilo do painel deixa a grade inteira invisível.
 */
export function cellSize(
  containerWidth: number,
  columns: number = GRID_COLUMNS,
  gap: number = GRID_GAP_PX,
): CellSize {
  // CELULAS QUADRADAS: a altura da linha e igual a largura da coluna.
  // Antes, cell.w era fluida (~21px) e cell.h era fixa (10px), resultando
  // em celulas retangulares. "12x12 celulas" era 252x120px, nao quadrado.
  // Agora, cell.h = cell.w, e "12x12 celulas" e 252x252px (quadrado).
  const usable = containerWidth - gap * (columns - 1);
  const side = Math.max(1, usable / columns);
  return {
    w: side,
    h: side,
  };
}

/** Quantos pixels ocupa `cells` células no eixo, INCLUINDO os gaps internos. */
export function cellsToPx(
  cells: number,
  cell: number,
  gap = GRID_GAP_PX,
): number {
  // `Math.max(1, …)`: uma célula tem no mínimo 1 px de largura, senão um
  // container estreito com `cells = 0` daria 0 e o painel sumiria.
  return Math.max(1, Math.round(cells * cell + (cells - 1) * gap));
}

/** Quantas células cabem em `px`. Arredonda para a célula mais próxima. */
export function pxToCells(px: number, cell: number, gap = GRID_GAP_PX): number {
  const pitch = cell + gap;
  if (pitch <= 0) return 1;
  return Math.max(0, Math.round(px / pitch));
}

/**
 * Converte um DELTA em pixels para células.
 *
 * Diferente de `pxToCells` (que converte posição absoluta), esta função NÃO
 * adiciona o gap ao numerador — o gap só importa na conversão de posição,
 * não de deslocamento. Usar `pxToCells` para delta era a causa da deriva
 * para a esquerda: cada arraste perdia uma fração de célula.
 */
export function pxDeltaToCells(
  px: number,
  cell: number,
  gap = GRID_GAP_PX,
): number {
  const pitch = cell + gap;
  if (pitch <= 0) return 0;
  return Math.round(px / pitch);
}

/* ===========================================================================
 * 5. DRAG AND DROP
 * ======================================================================== */

/** Distância, em px, para o arraste começar com o mouse (evita cliques acidentais). */
export const DND_ACTIVATION_DISTANCE_PX = 6;

/** Atraso, em ms, para o arraste começar com o toque (permite scroll em listas). */
export const DND_TOUCH_ACTIVATION_DELAY_MS = 180;

/** Margem extra aplicada ao container durante o arraste, em px. */
export const DND_OVERLAY_PADDING_PX = 8;

/* ===========================================================================
 * 6. INTERFACE, AVISOS E ANIMAÇÃO
 * ======================================================================== */

/**
 * Tempo de exibição de um aviso (Snackbar/notificação).
 * Dotado com fade-out de `PROFILE_POPUP_FADE_MS`.
 */
export const NOTICE_DURATION_MS = 2500;

/** Duração do fade-out do aviso de "nome do personagem só no Editar Geral". */
export const PROFILE_POPUP_FADE_MS = 300;

/** Intervalo para o duplo clique abrir a edição inline. */
export const DOUBLE_CLICK_DELAY_MS = 250;

/** Duração padrão das transições de UI (hover, focus). */
export const UI_TRANSITION_MS = 150;

/** Opacidade inicial usada no fade-out do popup de nome. */
export const POPUP_FADE_FROM_OPACITY = 1;

/** Opacidade final usada no fade-out do popup de nome. */
export const POPUP_FADE_TO_OPACITY = 0;

/* ===========================================================================
 * 7. FOTO DE PERFIL
 * ======================================================================== */

/** Tipos de imagem aceitos no upload da foto de perfil. */
export const PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Tamanho máximo do arquivo FAZENDO UPLOAD, antes da compressão, em bytes. */
export const PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Lado máximo (px) da imagem após redimensionamento no canvas.
 * Mantém a foto dentro da cota do localStorage mesmo com várias fichas.
 */
export const PHOTO_MAX_DIMENSION_PX = 512;

/** Qualidade JPEG usada na compressão (0–1). Menor = menor data URL. */
export const PHOTO_QUALITY = 0.8;

/** Formato de saída da compressão. */
export const PHOTO_OUTPUT_MIME_TYPE = "image/jpeg";

/** Tamanho estimado máximo do data URL após compressão, em bytes. */
export const PHOTO_MAX_OUTPUT_BYTES = 220 * 1024;

/**
 * Tamanho máximo do data URL da foto em CARACTERES (o que o storage
 * realmente guarda). Base64 custa ~4/3 do binário, e caracteres UTF-16
 * ocupam 2 bytes na cota: 220 KB binário ≈ 293 K caracteres base64 ≈
 * 587 KB de cota. Arredondamos para cima com folga.
 */
export const PHOTO_DATA_URL_MAX_LENGTH = 300_000;

/* ===========================================================================
 * 8. IMPORT / EXPORT
 * ======================================================================== */

/** Tamanho máximo aceito ao importar uma ficha, em bytes. */
export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Prefixo sugerido do arquivo exportado. */
export const EXPORT_FILE_PREFIX = "ficha";

/** Extensão do arquivo exportado. */
export const EXPORT_FILE_EXTENSION = ".json";

/* ===========================================================================
 * 9. LIMITES DE TEXTO
 * ======================================================================== */

/** Nome do personagem (dado). */
export const SHEET_NAME_MAX_LENGTH = 60;

/** Nome exibido da ficha na listagem (derivado do personagem, editável à parte). */
export const SHEET_TITLE_MAX_LENGTH = 60;

/** Rótulo de um slot do perfil ("CA", "PV", "Sanidade"...). */
export const FIELD_LABEL_MAX_LENGTH = 24;

/** Valor de um slot do perfil. */
export const FIELD_VALUE_MAX_LENGTH = 40;

/** Nome de um atributo. */
export const ATTRIBUTE_NAME_MAX_LENGTH = 24;

/** Nome de uma perícia. */
export const SKILL_NAME_MAX_LENGTH = 40;

/** Nome de uma arma. */
export const WEAPON_NAME_MAX_LENGTH = 60;

/** Nome de um item. */
export const ITEM_NAME_MAX_LENGTH = 60;

/** Descrição curta (usada em blocos de texto extras). */
export const TEXT_BLOCK_MAX_LENGTH = 5000;

/** Linha de um bloco de lista. */
export const LIST_ENTRY_MAX_LENGTH = 200;

/** Menor valor permitido para o número de uma linha de lista (adendo §8). */
export const LIST_ENTRY_NUMBER_MIN = 0;

/** Maior valor permitido para o número de uma linha de lista (adendo §8). */
export const LIST_ENTRY_NUMBER_MAX = 99999;

/** Valor padrão do número quando a linha é criada (adendo §8). */
export const LIST_ENTRY_NUMBER_DEFAULT = 0;

/** Etiqueta do bloco de texto ao criar o painel. */
export const PANEL_TITLE_MAX_LENGTH = 40;

/** Tamanho de texto: Rótulo do dinheiro (ex.: "Ouro", "Moeda de prata"). */
export const MONEY_LABEL_MAX_LENGTH = 24;

/* ===========================================================================
 * 9.1 SISTEMAS DE RPG
 * ========================================================================== */

/**
 * Sistemas suportados.
 * Novas entradas aqui exigem também um arquivo em `config/systems/` (Fase 3).
 */
export const SYSTEM_IDS = ["olddragon", "dnd5e", "coc"] as const;

/** Rótulos em pt-BR dos sistemas. */
export const SYSTEM_LABELS: Record<(typeof SYSTEM_IDS)[number], string> = {
  olddragon: "Old Dragon",
  dnd5e: "D&D 5e",
  coc: "Call of Cthulhu",
};

/* ===========================================================================
 * 10. LIMITES NUMÉRICOS
 * ======================================================================== */

/** Máximo de atributos por ficha. */
export const MAX_ATTRIBUTES = 40;

/** Máximo de perícias por ficha. */
export const MAX_SKILLS = 200;

/** Máximo de painéis extras por ficha. */
export const MAX_EXTRA_PANELS = 20;

/** Máximo de linhas em um bloco de lista. */
export const MAX_LIST_ENTRIES = 100;

/** Valor de atributo / perícia: mínimo. */
export const STAT_VALUE_MIN = -50;

/** Valor de atributo / perícia: máximo. */
export const STAT_VALUE_MAX = 999;

/** Bônus de ataque da arma: mínimo. */
export const ATTACK_BONUS_MIN = -50;

/** Bônus de ataque da arma: máximo. */
export const ATTACK_BONUS_MAX = 50;

/** Peso unitário de um item: mínimo. */
export const ITEM_WEIGHT_MIN = 0;

/** Peso unitário de um item: máximo. */
export const ITEM_WEIGHT_MAX = 9999;

/** Quantidade de um item: mínimo. */
export const ITEM_QUANTITY_MIN = 0;

/** Quantidade de um item: máximo. */
export const ITEM_QUANTITY_MAX = 9999;

/** Valor unitário de um item: mínimo. */
export const ITEM_VALUE_MIN = 0;

/** Valor unitário de um item: máximo. */
export const ITEM_VALUE_MAX = 999999;

/** Capacidade de carga total: máxima. */
export const CARRY_CAPACITY_MAX = 99999;

/** Saldo de dinheiro: mínimo. */
export const MONEY_VALUE_MIN = 0;

/** Saldo de dinheiro: máximo. */
export const MONEY_VALUE_MAX = 999999999;

/**
 * Teto de segurança para QUALQUER input numérico da UI.
 * Inputs numéricos são normalizados antes de chegar ao estado (nada de NaN).
 */
export const NUMERIC_INPUT_MAX = 999999999;

/* ===========================================================================
 * 10.1 VALORES INICIAIS DE UMA FICHA NOVA
 * ========================================================================== */

/** Dado usado como padrão numa arma nova (o maior disponível). */
export const DEFAULT_DIE_TYPE: DieType = "d20";

/** Dados sorteados por padrão numa arma nova. */
export const DEFAULT_DICE_COUNT = 1;

/** Rótulo inicial do dinheiro. */
export const DEFAULT_MONEY_LABEL = "Dinheiro";

/** Saldo inicial. */
export const DEFAULT_MONEY_VALUE = 0;

/**
 * Capacidade de carga inicial: 30 kg é a "mochila padrão" do D&D 5e.
 * Editável pelo usuário apenas no Editar Geral.
 */
export const DEFAULT_CARRY_CAPACITY = 30;

/**
 * Layout padrão, EM CÉLULAS (adendo §1.8).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISSO VIRA DADOS E NÃO CÓDIGO
 *
 * A §1.8 pede: linha superior com Perfil (quadrado), Inventário (o dobro da
 * largura do Perfil) e Resultado (quadrado); abaixo, Atributos e depois
 * Perícias, ambos de largura total.
 *
 * Em células isso é aritmética de inteiros, não de pixels: `12` colunas, `24`
 * colunas, `48` colunas. E o resultado é o MESMO em qualquer tela — o que é
 * justamente o ganho de migrar de px para células.
 *
 * A proporção 1 : 2 : 1 vem de `GRID_COLUMNS / 4`, `GRID_COLUMNS / 2`,
 * `GRID_COLUMNS / 4`: mudar `GRID_COLUMNS` reflowa o layout inteiro sozinho.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Lado dos blocos quadrados do topo (Perfil e Resultado), em células. */
export const DEFAULT_PANEL_SQUARE_CELLS = Math.round(GRID_COLUMNS / 4);

/** Altura inicial dos blocos de largura total (Atributos e Perícias), em células. */
export const DEFAULT_PANEL_ROW_CELLS = 20;

/** Tamanho inicial de um bloco de texto criado pelo usuário, em células. */
export const DEFAULT_TEXT_PANEL_SIZE = {
  w: Math.round(GRID_COLUMNS / 4),
  h: 16,
} as const;

/** Tamanho inicial de um bloco de lista criado pelo usuário, em células. */
export const DEFAULT_LIST_PANEL_SIZE = {
  w: Math.round(GRID_COLUMNS / 4),
  h: 18,
} as const;

/** Tamanho inicial do bloco reservado "Em processo", em células. */
export const DEFAULT_PLACEHOLDER_PANEL_SIZE = {
  w: Math.round(GRID_COLUMNS / 6),
  h: 12,
} as const;

/**
 * Altura da barra de ferramentas do Editar Geral, em px.
 * O grid reserva esta faixa no topo para o botão não cobrir o primeiro painel.
 */
export const EDIT_MODE_TOOLBAR_HEIGHT_PX = 56;

/* ===========================================================================
 * 4.2 FOTO DO PERFIL (adendo 4)
 * ======================================================================== */

export const PROFILE_PHOTO_SCALE = 0.92;

/**
 * Quantas células o painel anda por aperto de seta no teclado.
 *
 * SUBSTITUI `PANEL_KEYBOARD_STEP_PX`: o passo agora é uma célula, não um
 * pixel. Shift dá um passo maior, para quem quer mover rápido sem o mouse.
 */
export const PANEL_KEYBOARD_STEP_CELLS = 1;

/** Multiplicador do passo quando o teclado usa Shift (andar dez células). */
export const PANEL_KEYBOARD_STEP_LARGE_CELLS = 10;

/* ===========================================================================
 * 10.3 PERÍCIAS EM BLOCOS COMPACTOS (adendo §4)
 * ======================================================================== */

/**
 * Largura MÁXIMA do bloco de perícia, em px.
 *
 * O bloco se ajusta ao nome; este teto é o que impede uma perícia de nome
 * comprido ("Rastrear em Terreno Difícil") de ocupar a linha inteira e
 * empurrar as outras para baixo.
 *
 * Acima do teto o nome vira reticências, e o nome completo vai para o
 * `title` — que aparece ao passar o mouse e é lido pelo leitor de tela.
 */
export const SKILL_CHIP_MAX_WIDTH_PX = 190;

/**
 * Vão entre os blocos de perícia, em px.
 *
 * Pequeno de propósito: em `flex-wrap` o vão é o que separa visualmente dois
 * blocos vizinhos. Com o vão de uma linha de tabela, o conjunto voltaria a
 * parecer uma lista — que é o que o §4 quer eliminar.
 */
export const SKILL_CHIP_GAP_PX = 6;

/* ===========================================================================
 * 10.2 RARIDADE — PRESETS DE COR DAS LINHAS
 * ========================================================================== */

/**
 * Presets de raridade para armas, itens, atributos e perícias.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE RARIDADE E NÃO SÓ "COR LIVRE"
 * Um seletor só com cores livres obriga o usuário a decorar o código
 * hexadecimal da cor que ele quer. Com presets nomeados, a cor escolhida
 * vira uma convenção compartilhável ("esse item é laranja = lendário") — e o
 * app continua oferecendo cor livre para quem quiser.
 *
 * ACESSIBILIDADE: raridade nunca é comunicada SÓ por cor. Cada preset tem
 * `symbol` (glifo mostrado junto ao nome) e `label` (lido em voz alta).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE "COMUM" É OSSO E NÃO CINZA (adendo §3)
 *
 * O `comum` era `#8d8a85` — um cinza quente, o tom que a §3 manda eliminar.
 * Trocado por `#cfc4ad`, um osso/pergaminho tirado da rampa neutra do Grimório
 * (`grey.200`, de `#e0d5c1`, escurecido um passo para não competir com "Raro").
 *
 * Sobre `--surface` (`#241b13`), o contraste é de **9,9:1** — acima de AAA
 * (7:1), não só de AA. A troca não custou legibilidade: um cinza médio sobre
 * superfície escura daria ~4:1, que era justamente o problema.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTES HEX NÃO VÊM DOS TOKENS DE TEMA
 *
 * Porque raridade é IDENTIDADE, não decoração. A espada lendária do jogador
 * tem de continuar laranja quando ele troca de tema — se a cor derivasse do
 * token, a mesma ficha pareceria outra coisa depois de um clique, e o nome
 * "lendário" deixaria de significar a mesma coisa.
 *
 * Os dois temas são escuros, então todos os seis funcionam nos dois; o teste
 * `palette.test.ts` verifica o contraste contra a superfície dos DOIS.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const RARITY_PRESETS = [
  { id: "comum", label: "Comum", color: "#cfc4ad", symbol: "•" },
  // `#4b7fd6` reprovava AA (4,27:1) sobre a superfície do Grimório. Subiu
  // para `#5f8fe8`, que dá 5,3:1 — e continua sendo "azul de magia", não um
  // azul-pastel.
  { id: "magico", label: "Mágico", color: "#5f8fe8", symbol: "✦" },
  { id: "raro", label: "Raro", color: "#d8c246", symbol: "✧" },
  { id: "lendario", label: "Lendário", color: "#e07a2c", symbol: "❖" },
  { id: "unico", label: "Único", color: "#c9a24a", symbol: "◈" },
  { id: "sagrado", label: "Sagrado", color: "#4fb08a", symbol: "✚" },
] as const;

export type RarityId = (typeof RARITY_PRESETS)[number]["id"];

/** Cor de um preset, para o tema chosen. `null` = cor livre. */
export const RARITY_COLORS: Record<RarityId, string> = Object.fromEntries(
  RARITY_PRESETS.map((preset) => [preset.id, preset.color]),
) as Record<RarityId, string>;

/** Rótulo de um preset, para Tooltip e leitor de tela. */
export const RARITY_LABELS: Record<RarityId, string> = Object.fromEntries(
  RARITY_PRESETS.map((preset) => [preset.id, preset.label]),
) as Record<RarityId, string>;

/* ===========================================================================
 * 10.3 MOTION
 * ========================================================================== */

/**
 * Durações das animações, em ms. Centralizadas para que "tudo um pouco mais
 * rápido" seja uma edição de um lugar, e não uma caça aos números.
 */
export const MOTION_DURATIONS = {
  /** Hover, foco, micro-feedback. */
  instant: 120,
  /** Botões, abas, troca de estado. */
  fast: 200,
  /** Diálogos, tooltips, painéis entrando. */
  normal: 320,
  /** Revelação do resultado da rolagem. */
  reveal: 450,
  /** Pulso lento (modo editar, peso excedido). */
  pulse: 2400,
} as const;

/**
 * Curvas de easing. `ember` tem uma saída mais seca, o que dá peso ao
 * movimento — é o que faz um clique parecer "com peso".
 */
export const MOTION_EASING = {
  standard: [0.4, 0, 0.2, 1],
  entrance: [0.16, 1, 0.3, 1],
  ember: [0.4, 0, 0.1, 1],
} as const;

/** Escala máxima no hover de um botão. Acima de ~1.05 fica com cara de brinquedo. */
export const MOTION_HOVER_SCALE = 2.02;

/** Atraso entre a entrada de cada painel, em ms (efeito cascata). */
export const MOTION_STAGGER_MS = 45;

/* ===========================================================================
 * 10.4 ALVOS DE TOQUE
 * ========================================================================== */

/**
 * Alvo mínimo de toque em telas pequenas. A diretriz é 44 px; usamos 40 px
 * como piso para caber em células compactas sem espremer o conteúdo.
 */
export const TOUCH_TARGET_MIN_PX = 40;

/** Lado dos losangos das alças de redimensionamento, em px. */
export const RESIZE_HANDLE_SIZE_PX = 10;

/* ===========================================================================
 * 10.6 MEDALHÕES DE STATUS (PERFIL)
 * ========================================================================== */

/**
 * Cores dos orbes do Perfil, por ROL do slot.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE POR ROLE E NÃO POR SLOT
 * O usuário pode renomear o slot ("PV" vira "Vida", "Sanidade" vira "Fôlego").
 * Se a cor estivesse presa ao slot, renomear deixaria o orbe com a cor
 * errada — e quem renomeou "PV" para "Vida" queria um orbe de vida, não o de
 * armadura. Por isso o esquema é `role` → cor, com detecção por rótulo como
 * padrão e sobreposição manual pelo usuário.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const ORB_COLORS = {
  /** PV / Vida / similar: brasa. */
  life: { fill: "#a8241f", glow: "#ff5a36" },
  /** Sanidade / Loucura / Foco: azul-violeta frio, contraste proposital. */
  mind: { fill: "#3b3f7a", glow: "#7b86d6" },
  /** CA / Armadura / defesa: aço frio. */
  armor: { fill: "#4a4a53", glow: "#a5a5b0" },
  /** Genérico, quando nada foi reconhecido. */
  generic: { fill: "#4b4336", glow: "#c9a24a" },
} as const;

export type OrbRole = keyof typeof ORB_COLORS;

/**
 * Rótulos que sugerem cada papel, em minúsculas.
 * Usado só como palpite inicial — o usuário pode trocar depois.
 */
export const ORB_ROLE_KEYWORDS: Record<OrbRole, readonly string[]> = {
  life: ["pv", "vida", "hp", "health", "pontos de vida", "vigor"],
  mind: ["sanidade", "sane", "loucura", "foco", "mento", "sanity"],
  armor: ["ca", "armadura", "defesa", "armor", "class armor"],
  generic: [],
} as const;

/** Detecta o papel de um slot pelo rótulo, com base nas palavras-chave. */
export function detectOrbRole(label: string): OrbRole {
  const normalized = label.trim().toLowerCase();
  if (normalized === "") return "generic";

  const entries = Object.entries(ORB_ROLE_KEYWORDS) as [
    OrbRole,
    readonly string[],
  ][];

  // Primeiro passe: igualdade exata.
  for (const [role, keywords] of entries) {
    if (keywords.some((keyword) => normalized === keyword)) return role;
  }

  // Segundo passe: a palavra-chave aparece no rótulo.
  //
  // ───────────────────────────────────────────────────────────────────────────
  // POR QUE NÃO BASTA `includes`
  // `"cascos".includes("ca")` é verdadeiro — e "Cascos" NÃO é classe de
  // armadura. O mesmo aconteceria com "Canto", "Casa" e qualquer palavra que
  // comece com "ca". Por isso a busca respeita LIMITES DE PALAVRA: a palavra
  // precisa começar e terminar onde não há letra nem número.
  //
  // `\p{L}`/`\p{N}` cobrem acentos: "Coração de Pedra" ainda casa "coração".
  // ───────────────────────────────────────────────────────────────────────────
  for (const [role, keywords] of entries) {
    if (keywords.some((keyword) => containsWord(normalized, keyword))) {
      return role;
    }
  }

  return "generic";
}

/** `true` se `keyword` aparece em `text` como palavra inteira. */
function containsWord(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\p{L}` = letra (qualquer alfabeto); `\p{N}` = número.
  const pattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`,
    "u",
  );
  return pattern.test(text);
}

/* ===========================================================================
 * 11. CORES
 * ======================================================================== */

/**
 * Paleta de cores livres para identificação de linhas/caixas.
 * `null` (padrão) significa "sem cor definida".
 *
 * Os PRESETS DE RARIDADE vêm primeiro no seletor — ver `RARITY_PRESETS`.
 */
export const ROW_COLOR_PALETTE = [
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#eab308", // amarelo
  "#22c55e", // verde
  "#14b8a6", // teal
  "#3b82f6", // azul
  "#8b5cf6", // violeta
  "#ec4899", // rosa
] as const;

export type RowColor = (typeof ROW_COLOR_PALETTE)[number] | null;

/* ===========================================================================
 * 12. MENSAGENS (pt-BR)
 * ======================================================================== */

/** Aviso exibido ao tentar editar o nome do personagem fora do Editar Geral. */
export const NOTICE_NAME_EDIT_LOCKED =
  "Poderá ser editado em 'Editar' no painel principal";

/** Aviso exibido quando um limite de linhas é atingido. */
export const NOTICE_LIMIT_REACHED = (max: number, label: string): string =>
  `Limite de ${max} ${label} atingido.`;

/* ===========================================================================
 * 13. HELPERS DERIVADOS DAS CONSTANTES
 * ======================================================================== */

/**
 * Ajusta `value` ao INTEIRO mais próximo e dentro de [min, max].
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O PASSO DEIXOU DE SER UM PARÂMETRO
 *
 * Antes isto arredondava para o múltiplo de `RESIZE_SNAP_PX` (5 px), e a
 * constante antiga era o padrão. O adendo §1 substituiu o snap em pixel pelo
 * snap em CÉLULA, e célula é sempre inteira — não existe "meia célula".
 *
 * Manter o `step` como argumento dava a ilusão de que ainda dava para ter
 * snap fracionário. Tira-se o parâmetro: quem chama com célula chama com
 * inteiro, e o tipo passa a garantir isso.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function snapToStep(
  value: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
