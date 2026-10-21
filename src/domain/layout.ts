import {
  DEFAULT_LIST_PANEL_SIZE,
  DEFAULT_PLACEHOLDER_PANEL_SIZE,
  DEFAULT_TEXT_PANEL_SIZE,
  EDIT_MODE_TOOLBAR_HEIGHT_PX,
  GRID_COLUMNS,
  GRID_GAP_CELLS,
  GRID_GAP_PX,
  GRID_MIN_H,
  GRID_MIN_W,
  LAYOUT_COMPACT_MODE,
  snapToStep,
} from "@/config/constants";
import {
  PANEL_TYPE_LABELS,
  isPanelTypeHideable,
  maxSizeOf,
  minSizeOf,
  type PanelType,
} from "@/config/panelTypes";
import type { PanelLayout, Sheet } from "@/schemas";
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GRID DE PAINÉIS — REGRAS PURAS (sem React, sem DOM)                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * TUDO AQUI É INTEIRO, E NADA AQUI CONHECE A LARGURA DA JANELA
 *
 * As coordenadas são CÉLULAS, não pixels. Não existe meia célula. Este arquivo
 * nunca vê o tamanho do container — quem faz a conversão é a grade, em
 * `PanelGrid.tsx`. É essa separação que mantém tudo abaixo testável sem
 * navegador.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O MOTOR CONTINUA PRÓPRIO, E NÃO `react-grid-layout`
 *
 * O adendo §1.2 sugere `react-grid-layout` e permite outra escolha desde que
 * justificada e com o mesmo comportamento. A objeção da Fase 1 (o snap exigido
 * era de 5 px) deixou de valer — o adendo trocou o snap de pixel pelo de
 * célula, que é justamente o modelo da biblioteca. Mesmo assim, o motor
 * próprio continua sendo a escolha certa aqui, por três razões concretas:
 *
 * 1. **A grade é fluida e o projeto é Tailwind-first.** A coluna mede o
 *    container, o que exige medir o próprio nó. `react-grid-layout` resolve
 *    isso com um HOC de largura que quebra o SSR do App Router e traz CSS
 *    próprio para competir com o `@layer` do Tailwind — e a Fase 1 mediu essa
 *    disputa: com o MUI em `@layer mui`, qualquer folha extra precisa entrar
 *    na mesma hierarquia de camadas ou os utilitários do Tailwind perdem.
 *
 * 2. **O `@dnd-kit` já está no projeto** pelos motivos da §10: sensor de
 *    teclado com anúncios ARIA, toque com atraso e overlay sem portal.
 *    Adotar `react-grid-layout` traria um SEGUNDO motor de arraste para
 *    competir com ele dentro da mesma tela — que é a própria coisa que o
 *    adendo proíbe ("não usar dois sistemas de DnD competindo").
 *
 * 3. **O mínimo é por TIPO DE BLOCO** (§1.3), e `react-grid-layout` só aceita
 *    `minW`/`minH` por item. Aqui `minSizeOf(type)` resolve pelo tipo,
 *    inclusive para blocos criados pelo usuário.
 *
 * O que a biblioteca faria melhor — compactação madura — é o que
 * `normalizeLayout` faz, em poucas linhas e coberto por teste.
 * ───────────────────────────────────────────────────────────────────────────
 */
/** Tamanho { largura, altura } em CÉLULAS. */
export interface PanelSize {
  w: number;
  h: number;
}
/** Retângulo em células — a forma com que a sobreposição é testada. */
export interface PanelRect extends PanelSize {
  x: number;
  y: number;
}
/** Chave estável de um painel padrão (tipo puro). */
export function defaultPanelId(type: PanelType): string {
  return type;
}
/**
 * Chave estável de um bloco criado pelo usuário.
 * O prefixo evita colisão com o id de um painel padrão.
 */
export function extraPanelId(extraId: string): string {
  return `extra:${extraId}`;
}
/** `true` quando a chave é de um bloco criado pelo usuário. */
export function isExtraPanelKey(panelId: string): boolean {
  return panelId.startsWith("extra:");
}
/** Extrai o id do bloco a partir da chave `extra:<id>`. */
export function extraIdFromKey(panelId: string): string {
  return panelId.replace(/^extra:/, "");
}
/** Tamanho inicial sugerido para um tipo de painel criado pelo usuário. */
export function defaultSizeFor(type: PanelType): PanelSize {
  switch (type) {
    case "list":
      return { ...DEFAULT_LIST_PANEL_SIZE };
    case "placeholder":
      return { ...DEFAULT_PLACEHOLDER_PANEL_SIZE };
    default:
      return { ...DEFAULT_TEXT_PANEL_SIZE };
  }
}
/* ===========================================================================
 * LIMITES
 * ======================================================================== */
/**
 * Ajusta largura e altura para os limites do TIPO, arredondando para célula.
 *
 * O piso é o maior entre o global (`GRID_MIN_W`) e o do tipo (`minSizeOf`).
 * Passar o tipo é o que impede um bloco de Perfil de ser espremido a 6×5.
 */
export function clampSize(
  size: PanelSize,
  type: string | null = null,
): PanelSize {
  const min = minSizeOf(type);
  const max = maxSizeOf(type);
  return {
    w: snapToStep(Math.min(size.w, max.w), min.w, max.w),
    h: snapToStep(Math.min(size.h, max.h), min.h, max.h),
  };
}
export function clampPosition(
  x: number,
  y: number,
  w?: number,
): { x: number; y: number } {
  // O limite superior de x depende da largura do bloco: um bloco de 12 colunas
  // não pode começar em 40, porque terminaria em 52 (fora da grade de 48).
  const maxX = w ? GRID_COLUMNS - w : GRID_COLUMNS - 1;
  return {
    x: snapToStep(Math.max(0, Math.min(x, maxX)), 0),
    y: snapToStep(Math.max(0, y), 0),
  };
}
/** `true` quando os dois retângulos se sobrepõem (bordas encostando não conta). */
export function overlaps(a: PanelRect, b: PanelRect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
/* ===========================================================================
 * COLISÃO E NORMALIZAÇÃO
 * ======================================================================== */
/**
 * Resolve sobreposições empurrando blocos para baixo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE "EMPURRAR PARA BAIXO" E NÃO UM ALGORITMO DE COMPACTAÇÃO
 *
 * O usuário posiciona livremente; na maioria das vezes não há colisão. Quando
 * há, o comportamento previsível é "o bloco escorrega até achar lugar" — que é
 * o que se espera ao soltar algo sobre outro. Uma compactação completa moveria
 * blocos que o usuário posicionou de propósito, e isso seria pior que o
 * defeito.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `LAYOUT_COMPACT_MODE = "none"` DESLIGA O EMPURRÃO
 *
 * A constante existe para isso. Com `"none"`, o bloco que colide é deixado
 * como está — e `normalizeLayout` é quem garante que o layout salvo não tem
 * sobreposição. A escolha é do projeto, não por bloco.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * O algoritmo é determinístico (ordem por `y`, depois `x`, depois `order`), de
 * modo que o mesmo layout sempre produz o mesmo resultado. Sem isso o bloco
 * "pulava" entre um salvamento e outro.
 */
export function resolveCollisions(
  layout: readonly PanelLayout[],
  gap: number = GRID_GAP_CELLS,
): PanelLayout[] {
  // ───────────────────────────────────────────────────────────────────────────
  // O GAP AQUI É EM CÉLULAS, E O DEFAULT É 1
  //
  // A primeira versão usava `PANEL_GAP_PX` (12) como se fosse pixels — num
  // layout em células, isso empurrava o bloco 12 CÉLULAS para baixo, em vez
  // de uma. O bloco "pula" para o fim da grade ao soltar.
  //
  // O gap do grid é `GRID_GAP_PX` pixels entre células; em células, o vão
  // vale 1. A conversão para pixels acontece na grade, na borda.
  // ───────────────────────────────────────────────────────────────────────────
  if (LAYOUT_COMPACT_MODE === "none") return [...layout];

  // A ORDEM DE PROCESSAMENTO É POR POSIÇÃO, MAS A ORDEM DE SAÍDA É A ORIGINAL
  //
  // A versão anterior devolvia o array já ORDENADO por (y, x, order). Isso
  // embaralhava a ordem de leitura gravada: o painel que o jogador movesse
  // para baixo passava a vir antes dos outros no array, e a ordem do
  // arquivo deixava de bater com o campo `order`.
  //
  // Aqui a resolução é feita sobre uma cópia ordenada, e o resultado é
  // devolvido na ordem ORIGINAL — só as posições mudam.
  const indexes = layout.map((_, index) => index);
  const ordered = indexes.slice().sort((a, b) => {
    const pa = layout[a]!;
    const pb = layout[b]!;
    return pa.y - pb.y || pa.x - pb.x || pa.order - pb.order;
  });

  const resolved = new Map<number, PanelLayout>();

  for (const index of ordered) {
    const panel = layout[index]!;
    let current: PanelLayout = { ...panel };

    // Cada repetição empurra o painel para baixo de UM conflitante. O laço
    // repete porque o empurrão pode criar um novo conflito com outro painel.
    // O limite evita laço infinito mesmo com entrada corrompida.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const conflict = [...resolved.values()].find((other) =>
        overlaps(current, other),
      );
      if (!conflict) break;
      current = { ...current, y: conflict.y + conflict.h + gap };
    }

    resolved.set(index, current);
  }

  return layout.map((_, index) => resolved.get(index)!);
}
/**
 * Deixa um layout gravado em condições de ser desenhado: inteiro, dentro dos
 * limites do tipo, e SEM SOBREPOSIÇÃO.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISSO EXISTE E QUANDO RODA
 *
 * Três caminhos podem entregar layout sobreposto ou fora dos limites:
 *
 * 1. uma ficha importada de outra versão;
 * 2. a migração de px para célula, que é aproximada por natureza;
 * 3. o container estreitou e um bloco ficou largo demais.
 *
 * Nos três, o sintoma é o mesmo: dois blocos um em cima do outro, e o de baixo
 * intocável — um beco sem saída, porque o de baixo não tem como ser arrastado
 * para fora da pilha.
 *
 * Por isso `normalizeLayout` roda na CARGA, e não só quando o usuário mexe em
 * algo. É a barreira que garante a invariante "nenhum bloco sobrepõe outro".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ELA É PURA E RECEBE `typeOf`
 *
 * `typeOf` é injetado porque `domain/layout.ts` não conhece `Sheet` nem
 * `extraPanels` — conhece só a geometria. O chamador (a grade) sabe resolver
 * o tipo de uma chave e passa a função. Isso mantém `normalizeLayout` testável
 * com um dicionário de dois tipos.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function normalizeLayout(
  layout: readonly PanelLayout[],
  typeOf: (panelId: string) => PanelType | null,
): PanelLayout[] {
  // Passo 1 — limites e inteiros. Vem antes da colisão porque um bloco
  // espremido abaixo do mínimo deixa de colidir onde antes colidia, e
  // resolver a colisão antes deixaria o passo 2 criar sobreposição nova.
  const bounded = layout.map((panel) => {
    const type = typeOf(panel.panelId);
    const size = clampSize(panel, type);
    const position = clampPosition(panel.x, panel.y, size.w);
    return {
      ...panel,
      ...position,
      ...size,
      order: snapToStep(panel.order, 0),
    } satisfies PanelLayout;
  });
  // Passo 2 — sobreposição. `resolveCollisions` empurra para baixo, o que
  // pode empurrar para fora do limite superior de `y`; `y` não tem teto, só
  // piso, então nada é perdido aqui.
  return resolveCollisions(bounded);
}
/** Altura total necessária para o container conter todos os blocos, em CÉLULAS. */
export function computeContainerHeight(
  layout: readonly PanelLayout[],
  bottomPadding = 1,
): number {
  const lowest = layout.reduce(
    (max, panel) => Math.max(max, panel.y + panel.h),
    0,
  );
  return lowest + bottomPadding;
}
/**
 * Primeira posição livre para um bloco novo, em ordem de leitura.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE SEPARADO DO ARRASTE
 *
 * O adendo §1.6 é explícito: um bloco novo entra na PRIMEIRA posição livre,
 * nunca em cima de outro. A alternativa — "solte no centro da tela" — exige
 * uma varredura de sobreposição no componente, ou seja, regra de negócio dentro
 * de um componente.
 *
 * Aqui a regra é pura: dá para testar "adicionar 3 blocos seguidos nunca gera
 * sobreposição" sem renderizar nada, que é o teste obrigatório do §1.6.
 *
 * O laço é limitado a 500 descidas: com entrada corrompida (tamanho
 * negativo, por exemplo) ele termina em vez de travar a interface.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function findFreeSlot(
  layout: readonly PanelLayout[],
  size: PanelSize,
  gap: number = GRID_GAP_PX,
): { x: number; y: number } {
  let y = 0;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate: PanelRect = { x: 0, y, ...size };
    if (!layout.some((panel) => overlaps(candidate, panel))) return { x: 0, y };
    // Desce só até a base do painel que realmente colide na faixa X. Sem isso
    // um bloco baixo e estreito à direita empurraria o novo para bem abaixo
    // do que precisava.
    const inColumn = layout.filter(
      (panel) =>
        candidate.x < panel.x + panel.w && candidate.x + candidate.w > panel.x,
    );
    const bottom = inColumn.reduce(
      (max, panel) => Math.max(max, panel.y + panel.h),
      0,
    );
    y = Math.max(y + 1, bottom + gap);
  }
  return { x: 0, y };
}
/** Próxima ordem disponível (a maior atual + 1). */
export function nextOrder(layout: readonly PanelLayout[]): number {
  return layout.reduce((max, panel) => Math.max(max, panel.order), -1) + 1;
}
/** Altura da faixa reservada no topo quando o Editar Geral está ligado. */
export function toolbarOffset(editMode: boolean): number {
  return editMode ? EDIT_MODE_TOOLBAR_HEIGHT_PX : 0;
}
/**
 * Empurra um bloco para dentro da grade quando ele ficou largo demais.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O LIMITE É SOBRE `x + w`, E NÃO SOBRE CADA UM SOZINHO
 *
 * A primeira versão limitava `w` a `GRID_COLUMNS` e `x` a `GRID_COLUMNS - 1`,
 * e achava que isso bastava. Não basta: um bloco em `x = 40` com `w = 20` tem
 * os dois dentro do limite e ainda assim termina em 60, fora da grade de 48.
 *
 * O limite certo é sobre a BORDA DIREITA: `x` pode ser no máximo
 * `GRID_COLUMNS - w`. É o mesmo raciocínio de `clampPosition` aplicado à
 * largura, e a única forma de ele não voltar a falhar é ser explícito.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function fitWithinGrid(panel: PanelLayout): PanelLayout {
  const w = snapToStep(
    Math.min(panel.w, GRID_COLUMNS),
    GRID_MIN_W,
    GRID_COLUMNS,
  );
  return {
    ...panel,
    w,
    ...clampPosition(Math.min(panel.x, GRID_COLUMNS - w), panel.y),
  };
}
/* ===========================================================================
 * REDIMENSIONAMENTO
 * ======================================================================== */
/** Borda ou canto que está sendo arrastado. */
export type ResizeDirection =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
/** As oito direções, na ordem em que são desenhadas (canto, borda, canto…). */
export const RESIZE_DIRECTIONS: readonly ResizeDirection[] = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
];
/**
 * Calcula o retângulo depois de arrastar uma alça.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO SAI DO COMPONENTE
 *
 * A versão anterior estava dentro de `ResizeHandles`, lendo o delta dos
 * eventos de ponteiro. Isso tornava a regra de redimensionamento impossível de
 * testar sem simular `pointerdown`/`pointermove`/`pointerup` com coordenadas
 * de tela — e é exatamente aí que mora o bug que o adendo §1.1 relatou.
 *
 * Com o cálculo aqui, o teste é "arraste a borda direita em +3 células e o `w`
 * cresce 3". Sem navegador, sem evento, sem `setPointerCapture`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A BORDA ESQUERDA/SUPERIOR ANDA JUNTO COM A POSIÇÃO
 *
 * Crescer para a esquerda significa que o bloco se expande para trás: se
 * apenas a largura mudasse, a alça ficaria parada longe do cursor e o bloco
 * "engordaria" para a direita. Por isso `x` anda junto com `w`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `delta` JÁ VEM EM CÉLULAS
 *
 * A conversão de pixel para célula é responsabilidade da grade, que é quem
 * conhece a largura da coluna. Passar pixels para cá reintroduziria a
 * dependência de DOM que este arquivo não deve ter.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function resizePanel(
  origin: PanelRect,
  direction: ResizeDirection,
  delta: { w: number; h: number },
  type: string | null = null,
): PanelRect {
  const min = minSizeOf(type);
  let { x, y } = origin;
  let w = origin.w;
  let h = origin.h;
  if (direction.includes("right")) {
    w = clampSize({ w: origin.w + delta.w, h: origin.h }, type).w;
    // Crescer para a direita nunca move a borda esquerda.
    w = Math.max(w, min.w);
  }
  if (direction.includes("bottom")) {
    h = clampSize({ w: origin.w, h: origin.h + delta.h }, type).h;
    h = Math.max(h, min.h);
  }
  if (direction.includes("left")) {
    const nextW = clampSize({ w: origin.w - delta.w, h: origin.h }, type).w;
    // A posição anda junto: o pixel que estava à esquerda continua o mesmo.
    x = origin.x + (origin.w - nextW);
    w = nextW;
  }
  if (direction.includes("top")) {
    const nextH = clampSize({ w: origin.w, h: origin.h - delta.h }, type).h;
    y = origin.y + (origin.h - nextH);
    h = nextH;
  }
  const size = clampSize({ w, h }, type);
  const position = clampPosition(x, y);
  // Depois de clampá-lo, o bloco pode ter encolhido: se a borda esquerda foi
  // empurrada contra 0, `x + w` não bate mais com `x + origin.w`.
  return { ...position, w: size.w, h: size.h };
}
/** `true` quando a direção mexe na largura. */
export function resizesWidth(direction: ResizeDirection): boolean {
  return (
    direction === "left" ||
    direction === "right" ||
    direction === "top-left" ||
    direction === "bottom-left" ||
    direction === "top-right" ||
    direction === "bottom-right"
  );
}
/** `true` quando a direção mexe na altura. */
export function resizesHeight(direction: ResizeDirection): boolean {
  return (
    direction === "top" ||
    direction === "bottom" ||
    direction === "top-left" ||
    direction === "bottom-right" ||
    direction === "top-right" ||
    direction === "bottom-left"
  );
}
/** Rótulo em pt-BR para leitores de tela. */
export const RESIZE_ARIA_LABEL: Record<ResizeDirection, string> = {
  "top-left": "Redimensionar pelo canto superior esquerdo",
  top: "Redimensionar pela borda superior",
  "top-right": "Redimensionar pelo canto superior direito",
  right: "Redimensionar pela borda direita",
  "bottom-right": "Redimensionar pelo canto inferior direito",
  bottom: "Redimensionar pela borda inferior",
  "bottom-left": "Redimensionar pelo canto inferior esquerdo",
  left: "Redimensionar pela borda esquerda",
};
/** Piso absoluto, reexportado para quem só precisa do número. */
export const GRID_FLOOR = { w: GRID_MIN_W, h: GRID_MIN_H } as const;
/* ===========================================================================
 * BLOCOS OCULTADOS
 * ======================================================================== */
/** O tipo real de um painel, resolvendo blocos do usuário. */
export function panelTypeOf(sheet: Sheet, panelId: string): PanelType | null {
  if (!isExtraPanelKey(panelId)) return panelId as PanelType;
  const extraId = extraIdFromKey(panelId);
  const extra = sheet.extraPanels.find((candidate) => candidate.id === extraId);
  return extra?.type ?? null;
}
/** O título exibido de um painel, resolvendo blocos do usuário. */
export function panelTitleOf(sheet: Sheet, panelId: string): string {
  if (isExtraPanelKey(panelId)) {
    const extraId = extraIdFromKey(panelId);
    return (
      sheet.extraPanels.find((candidate) => candidate.id === extraId)?.title ||
      "Bloco"
    );
  }
  const type = panelTypeOf(sheet, panelId);
  return type ? PANEL_TYPE_LABELS[type] : "Bloco";
}
/**
 * Blocos que estão OCULTADOS e podem ser reexibidos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O FILTRO VIVE AQUI E NÃO NO COMPONENTE
 *
 * "Quantos blocos ocultos" aparece na barra (que não conhece `extraPanels`),
 * na bandeja e no chip de atalho. Se cada um contasse por conta própria, o
 * contador e a bandeja poderiam discordar — e um contador que mente é pior do
 * que nenhum.
 *
 * Blocos `UNHIDEABLE` não entram: se um `visible: false` antigo sobreviveu a
 * uma versão anterior (ou veio de um import), ele ainda assim tem de poder ser
 * reexibido — mas não pode inflar o contador.
 */
export function hiddenPanels(sheet: Sheet): PanelLayout[] {
  return sheet.layout.filter((panel) => {
    if (panel.visible) return false;
    const type = panelTypeOf(sheet, panel.panelId);
    return type === null || isPanelTypeHideable(type);
  });
}
/** Quantos blocos estão ocultos e podem ser reexibidos. */
export function countHiddenPanels(sheet: Sheet): number {
  return hiddenPanels(sheet).length;
}
/**
 * Torna um bloco visível de novo, resolvendo sobreposições.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SÓ AO MOSTRAR
 *
 * Esconder guarda `x`, `y`, `w`, `h` e `order` — o bloco volta exatamente
 * onde estava. Mas o espaço vira terra de ninguém: o jogador pode ter arrastado
 * outro bloco para lá no meio tempo. Reexibir sem resolver a sobreposição
 * poria dois blocos um em cima do outro, e o de baixo ficaria intocável.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PRIMEIRO TENTA O LUGAR ANTIGO
 *
 * O adendo §1.6 manda "restaurar a posição anterior se livre; senão, primeira
 * posição livre". A posição antiga é tentada primeiro porque é o que o usuário
 * espera: ele escondeu um bloco e quer ele de volta onde estava.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function showPanel(
  layout: readonly PanelLayout[],
  panelId: string,
): PanelLayout[] {
  const target = layout.find((panel) => panel.panelId === panelId);
  if (!target) return [...layout];
  const shown = layout.map((panel) =>
    panel.panelId === panelId ? { ...panel, visible: true } : panel,
  );
  // O lugar antigo está livre? A pergunta ignora o próprio bloco, que
  // estava escondido e por isso não colide com nada.
  const others = shown.filter((panel) => panel.panelId !== panelId);
  const homeIsFree = !others.some((panel) => overlaps(target, panel));
  if (homeIsFree) {
    return shown.map((panel) =>
      panel.panelId === panelId
        ? { ...panel, x: target.x, y: target.y, w: target.w, h: target.h }
        : panel,
    );
  }
  // Ocupado: procura a primeira posição livre com o tamanho do bloco.
  const free = findFreeSlot(others, { w: target.w, h: target.h });
  return resolveCollisions(
    shown.map((panel) =>
      panel.panelId === panelId ? { ...panel, x: free.x, y: free.y } : panel,
    ),
  );
}
