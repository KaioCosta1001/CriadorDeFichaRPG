/**
 * Tipos de painel (bloco) que a ficha pode ter.
 *
 * Adicionar um tipo novo aqui + registrá-lo em
 * `src/components/panels/registry.ts` (Fase 4) é tudo o que é preciso para
 * ele aparecer na lista de "adicionar bloco" e poder ser salvo na layout.
 */

import {
  GRID_MAX_H,
  GRID_MAX_W,
  GRID_MIN_H,
  GRID_MIN_W,
  PANEL_SIZE_LIMITS,
} from "./constants";

/** Identificadores de painel. */
export const PANEL_TYPES = [
  /** Perfil: foto + slots de posição fixa. */
  "profile",
  /** Inventário: abas de Armas e Itens. */
  "inventory",
  /** Resultado da última rolagem + histórico. */
  "roll-result",
  /** Atributos. */
  "attributes",
  /** Perícias. */
  "skills",
  /** Bloco de texto livre (adicionado pelo usuário). */
  "text",
  /** Bloco de lista (adicionado pelo usuário). */
  "list",
  /** Reservado para ideias futuras — hoje não pode ser criado. */
  "placeholder",
] as const;

export type PanelType = (typeof PANEL_TYPES)[number];

/** Rótulos em pt-BR exibidos na interface. */
export const PANEL_TYPE_LABELS: Record<PanelType, string> = {
  profile: "Perfil",
  inventory: "Inventário",
  "roll-result": "Resultado do Rolamento",
  attributes: "Atributos",
  skills: "Perícias",
  text: "Bloco de texto",
  list: "Bloco de lista",
  placeholder: "Em processo",
};

/**
 * Tipos que o usuário pode escolher ao adicionar um bloco no Editar Geral.
 *
 * `placeholder` NÃO entra aqui de propósito: ele é reservado para ideias
 * futuras e aparece na lista como opção DESABILITADA, marcada com um "x".
 * O bloqueio é de interface (Fase 4); o schema aceita o tipo para que um
 * documento já salvo continue válido.
 */
export const USER_ADDABLE_PANEL_TYPES = [
  "text",
  "list",
  "placeholder",
] as const;

export type UserAddablePanelType = (typeof USER_ADDABLE_PANEL_TYPES)[number];

/** `true` quando o usuário pode efetivamente criar um painel desse tipo. */
export function isPanelTypeAvailable(type: PanelType): boolean {
  return type !== "placeholder";
}

/**
 * Blocos que existem por padrão em toda ficha.
 * Não podem ser removidos (apenas escondidos) — seção 9.6.
 */
export const DEFAULT_PANEL_TYPES = [
  "profile",
  "inventory",
  "roll-result",
  "attributes",
  "skills",
] as const;

export type DefaultPanelType = (typeof DEFAULT_PANEL_TYPES)[number];

/**
 * Blocos que NUNCA podem ser ocultados.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ALGUNS DOIS NÃO PODEM SUMIR
 *
 * **Perfil** é onde ficam nome, foto, CA e PV. **Inventário** é onde ficam
 * armas, itens e peso. Esconder os dois deixa a ficha sem identidade e sem
 * bagagem — e a bandeja de blocos é justamente a função que FAZ o usuário
 * esconder coisas. Se ela pudesse esconder tudo, a ficha viraria um casulo
 * vazio do qual só se sai por "Resetar layout", que é um caminho muito mais
 * caro do que o problema.
 *
 * Os demais (Atributos, Perícias, Resultado e os blocos extras) podem: são
 * informacao que o jogador escolhe ter a vista neste momento.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const UNHIDEABLE_PANEL_TYPES = ["profile", "inventory"] as const;

export type UnhideablePanelType = (typeof UNHIDEABLE_PANEL_TYPES)[number];

/** `true` quando o bloco pode ser escondido pela bandeja. */
export function isPanelTypeHideable(type: string): boolean {
  return !UNHIDEABLE_PANEL_TYPES.includes(type as UnhideablePanelType);
}

/* ===========================================================================
 * TAMANHO MÍNIMO POR TIPO (adendo §1.3)
 * ========================================================================== */

/**
 * O menor tamanho, em CÉLULAS, que cada bloco aceita.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O MÍNIMO NÃO É UM NÚMERO ÚNICO
 *
 * Com um piso global só, o Perfil e o Inventário acabavam espremidos em 6×5
 * células — umas 190×95 px — e o conteúdo vira um borrão: a foto não cabe, os
 * slots de CA e PV se sobrepõem e o nome some.
 *
 * O piso real é o MAIOR entre o global (`GRID_MIN_W`/`GRID_MIN_H`) e este
 * mapa. O global continua existindo para o caso de um tipo novo não estar
 * listado aqui: melhor um piso modesto do que um `undefined` que derruba o
 * redimensionamento inteiro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * OS NÚMEROS
 *
 * Derivados de `GRID_ROW_HEIGHT_PX`: 12 células ≈ 156 px de altura, o menor
 * altura em que uma linha de lista com nome + valor + botões ainda cabe.
 *
 * `profile` tem o piso maior porque é o único bloco QUADRADO: espremer só a
 * largura encolheria a foto sem dar altura, e uma foto achatada parece um bug.
 * ───────────────────────────────────────────────────────────────────────────
 */
export const PANEL_MIN_SIZE: Record<PanelType, { w: number; h: number }> = {
  // Quadrado com foto: manter a proporção é o que impede a foto de "achatar".
  profile: { w: 12, h: 12 },
  // Três abas com barra de rolagem: precisa de largura para as abas caberem.
  inventory: { w: 18, h: 12 },
  // O número do resultado é enorme (text-5xl); abaixo de 10 colunas ele
  // encosta nas bordas e a linha de detalhamento quebra no meio da palavra.
  "roll-result": { w: 10, h: 10 },
  // Linhas de atributo: nome editável + valor + 4 botões.
  attributes: { w: 14, h: 10 },
  // Perícias em blocos compactos: many rows, largura média.
  skills: { w: 14, h: 10 },
  text: { w: 8, h: 6 },
  list: { w: 10, h: 8 },
  placeholder: { w: 8, h: 6 },
};

/**
 * O piso efetivo de um tipo: o maior entre o mínimo global e o do tipo.
 *
 * É a função que o redimensionamento, a normalização e a inserção de blocos
 * chamam — para que as três usem EXATAMENTE a mesma regra. Duas versões do
 * "tamanho mínimo" divergem na primeira correção feita num lado só, e o
 * sintoma é um bloco que espreme num lugar e não no outro.
 */
export function minSizeOf(type: string | null): { w: number; h: number } {
  const limits = type ? PANEL_SIZE_LIMITS[type as PanelType] : undefined;
  return {
    w: Math.max(GRID_MIN_W, limits?.minW ?? GRID_MIN_W),
    h: Math.max(GRID_MIN_H, limits?.minH ?? GRID_MIN_H),
  };
}

/** Limites máximos por tipo de painel, em células. */
export function maxSizeOf(type: string | null): { w: number; h: number } {
  const limits = type ? PANEL_SIZE_LIMITS[type as PanelType] : undefined;
  return {
    w: Math.min(GRID_MAX_W, limits?.maxW ?? GRID_MAX_W),
    h: Math.min(GRID_MAX_H, limits?.maxH ?? GRID_MAX_H),
  };
}
