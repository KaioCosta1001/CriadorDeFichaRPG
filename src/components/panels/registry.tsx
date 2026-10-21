"use client";

import type { ComponentType } from "react";

import type { RpgSystem } from "@/config/systems";
import {
  PANEL_TYPE_LABELS,
  isPanelTypeAvailable,
  type PanelType,
} from "@/config/panelTypes";
import type { ExtraPanel, PanelLayout, Sheet } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REGISTRO DE PAINÉIS                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMO ADICIONAR UM TIPO DE PAINEL NOVO
 *  1. Acrescente o id em `PANEL_TYPES` (`config/panelTypes.ts`).
 *  2. Escreva o componente em `components/panels/<pasta>/`.
 *  3. Registre UMA entrada em `panelRegistry` (no fim deste arquivo).
 * A partir daí ele aparece na lista de "adicionar bloco", ganha moldura,
 * resize, arraste, esconder e persistência — sem tocar em mais nada.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Tudo que um painel precisa saber sobre a ficha em que vive. */
export interface PanelContext {
  sheet: Sheet;
  /** `true` quando o Editar Geral está ligado. */
  editMode: boolean;
  /** Sistema da ficha (para regras de rolagem). */
  system: RpgSystem | null;
  /** Aplica uma transformação pura na ficha. Devolve `false` se recusada. */
  mutate: (recipe: (current: Sheet) => Sheet) => boolean;
  /**
   * Abre o Dialog central de Configurações (§11).
   *
   * Vive no contexto porque a regra é da §8.1: o botão de engrenagem fica no
   * BLOCO DE PERFIL. Passar o callback por props do painel até a grade seria
   * possible, mas o contexto já existe e é o caminho curto.
   */
  openSettings: () => void;
}

export interface PanelProps {
  context: PanelContext;
  /** Só presente em blocos criados pelo usuário. */
  extra?: ExtraPanel;
  /** Posição/tamanho atuais — útil para blocos que se adaptam ao espaço. */
  layout?: PanelLayout;
}

export interface PanelDefinition {
  type: PanelType;
  /** Nome em pt-BR exibido no cabeçalho e na lista de criação. */
  label: string;
  /**
   * O usuário pode criar este tipo no Editar Geral?
   * `placeholder` é `false`: aparece na lista, mas bloqueado (seção 9.5).
   */
  userAddable: boolean;
  /**
   * Blocos padrão NÃO podem ser removidos — só escondidos (seção 9.6).
   * Blocos do usuário são removíveis.
   */
  removable: boolean;
  /** Descrição curta para a lista de criação. */
  description: string;
  Component: ComponentType<PanelProps>;
  /**
   * Ações do CABEÇALHO do bloco, sempre visíveis (adendo §2.1).
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE ISTO EXISTE, E NÃO UM BOTÃO DENTRO DO PAINEL
   *
   * O cabeçalho é do `PanelFrame`; o painel é renderizado DENTRO dele. Um
   * botão do painel não sobe até o cabeçalho — ele fica na área de conteúdo.
   *
   * Foi exatamente o que aconteceu com a engrenagem do Perfil: mora dentro do
   * `ProfilePhoto`, colada no canto da foto, embaixo de tudo que rola. O §2.1
   * pede no header.
   *
   * Registrando aqui, o `PanelGrid` renderiza o que a definição declarar e a
   * grade continua sem saber nada sobre um tipo específico. Quem adiciona um
   * painel novo escreve UMA entrada, como o arquivo promete.
   */
  HeaderActions?: ComponentType<{ context: PanelContext }>;
}

/**
 * Registro central.
 *
 * `inventory` é o único bloco padrão que ainda usa o componente provisório,
 * que explica o que virá na Fase 7.
 */
export const panelRegistry: Partial<Record<PanelType, PanelDefinition>> = {
  /* Blocos padrão das Fases 5 a 8. */
  profile: {
    type: "profile",
    label: PANEL_TYPE_LABELS.profile,
    userAddable: false,
    removable: false,
    description: "Foto ao centro, com CA, PV e Sanidade nos cantos.",
    Component: ProfilePanel,
    HeaderActions: ProfileHeaderActions,
  },
  inventory: {
    type: "inventory",
    label: PANEL_TYPE_LABELS.inventory,
    userAddable: false,
    removable: false,
    description: "Abas de Armas e Itens, com peso, valor e venda.",
    Component: InventoryPanel,
  },
  "roll-result": {
    type: "roll-result",
    label: PANEL_TYPE_LABELS["roll-result"],
    userAddable: false,
    removable: false,
    description: "Resultado da última rolagem e histórico.",
    Component: RollResultPanel,
  },
  attributes: {
    type: "attributes",
    label: PANEL_TYPE_LABELS.attributes,
    userAddable: false,
    removable: false,
    description: "Atributos que alimentam armas e perícias.",
    Component: AttributesPanel,
  },
  skills: {
    type: "skills",
    label: PANEL_TYPE_LABELS.skills,
    userAddable: false,
    removable: false,
    description: "Perícias vinculadas a atributos.",
    Component: SkillsPanel,
  },

  /* Blocos que o usuário cria no Editar Geral. */
  text: {
    type: "text",
    label: PANEL_TYPE_LABELS.text,
    userAddable: true,
    removable: true,
    description: "Bloco de texto livre (texto puro, com limite de tamanho).",
    Component: TextPanel,
  },
  list: {
    type: "list",
    label: PANEL_TYPE_LABELS.list,
    userAddable: true,
    removable: true,
    description:
      "Lista no estilo do inventário: linhas com nome e cor, sem cálculos.",
    Component: ListPanel,
  },
  placeholder: {
    type: "placeholder",
    label: PANEL_TYPE_LABELS.placeholder,
    // Reservado para ideias futuras: aparece na lista, mas não pode ser criado.
    userAddable: isPanelTypeAvailable("placeholder"),
    removable: true,
    description: "Tipo reservado para ideias futuras.",
    Component: PlaceholderPanel,
  },
};

/** Tipos que o usuário pode escolher na criação, na ordem da lista. */
export function getAddablePanelTypes(): PanelDefinition[] {
  return Object.values(panelRegistry).filter(
    (definition): definition is PanelDefinition =>
      definition !== undefined && definition.userAddable,
  );
}

/** Todos os tipos registrados, na ordem de `PANEL_TYPES`. */
export function getAllPanelDefinitions(): PanelDefinition[] {
  return Object.values(panelRegistry).filter(
    (definition): definition is PanelDefinition => definition !== undefined,
  );
}

/** Busca a definição de um tipo. `null` em vez de lançar. */
export function getPanelDefinition(type: PanelType): PanelDefinition | null {
  return panelRegistry[type] ?? null;
}

/** Título do painel para o cabeçalho da moldura. */
export function getPanelTitle(type: PanelType): string {
  return panelRegistry[type]?.label ?? PANEL_TYPE_LABELS[type];
}

/* ── Imports dos componentes do registro ─────────────────────────────────────
 * Fica no fim porque `registry.tsx` é importado por eles, e o TypeScript
 * resolve a referência para a função antes do módulo terminar de avaliar.
 */

import { AttributesPanel } from "./attributes/AttributesPanel";
import { InventoryPanel } from "./inventory/InventoryPanel";
import { ListPanel } from "./list/ListPanel";
import { PlaceholderPanel } from "./placeholder/PlaceholderPanel";
import { ProfileHeaderActions } from "./profile/ProfileHeaderActions";
import { ProfilePanel } from "./profile/ProfilePanel";
import { RollResultPanel } from "./roll-result/RollResultPanel";
import { SkillsPanel } from "./skills/SkillsPanel";
import { TextPanel } from "./notes/TextPanel";
