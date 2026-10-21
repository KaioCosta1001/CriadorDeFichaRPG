import { SYSTEM_IDS, SYSTEM_LABELS } from "@/config/constants";
import type { SystemId } from "@/schemas";

import { cthulhu } from "./coc";
import { dnd5e } from "./dnd5e";
import { oldDragon } from "./olddragon";
import type { RpgSystem, SystemTemplate } from "./types";

/**
 * Registro de sistemas de RPG.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO ADICIONAR UM SISTEMA
 *  1. Acrescente o id em `SYSTEM_IDS` (`config/constants.ts`) e o rótulo em
 *     `SYSTEM_LABELS`.
 *  2. Escreva `src/config/systems/<id>.ts` exportando um `RpgSystem`.
 *  3. Registre aqui em `SYSTEMS`.
 *  4. Escreva a estratégia de contribuição em `src/domain/modifiers.ts` e
 *     associe em `CONTRIBUTION_STRATEGIES`.
 * Nenhum componente precisa mudar: a tela de criação lê este registro.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Todos os sistemas, indexados por id. */
export const SYSTEMS: Record<SystemId, RpgSystem> = {
  dnd5e,
  olddragon: oldDragon,
  coc: cthulhu,
};

/** Lista na ordem em que aparecem na tela de criação. */
export const SYSTEM_LIST: RpgSystem[] = SYSTEM_IDS.map((id) => SYSTEMS[id]);

/** Rótulo do sistema, com fallback para um id desconhecido vindo do storage. */
export function getSystemLabel(systemId: SystemId | string): string {
  return SYSTEM_LABELS[systemId as SystemId] ?? "Sistema desconhecido";
}

/** Busca um sistema. Devolve `null` em vez de lançar — storage pode ser antigo. */
export function getSystem(systemId: SystemId | string): RpgSystem | null {
  return SYSTEMS[systemId as SystemId] ?? null;
}

/**
 * Busca um modelo dentro de um sistema.
 *
 * Devolve `null` se não existir (por exemplo, uma ficha importada de outra
 * versão do app). A fábrica trata isso caindo numa ficha "em branco" — é
 * melhor uma ficha vazia do que uma tela quebrada.
 */
export function getTemplate(
  systemId: SystemId | string,
  templateId: string,
): SystemTemplate | null {
  const system = getSystem(systemId);
  if (!system) return null;
  return (
    system.templates.find((template) => template.id === templateId) ?? null
  );
}

/** Todos os modelos de todos os sistemas (útil em testes e no catálogo). */
export function getAllTemplates(): {
  system: RpgSystem;
  template: SystemTemplate;
}[] {
  return SYSTEM_LIST.flatMap((system) =>
    system.templates.map((template) => ({ system, template })),
  );
}

export type {
  AttributeSeed,
  AttributeContributionContext,
  AttributeContributionStrategy,
  RollContext,
  RpgSystem,
  SkillSeed,
  SystemTemplate,
  TemplateLayoutOverride,
  TemplateSlotOverride,
} from "./types";
