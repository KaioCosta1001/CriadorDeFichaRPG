import type { Attribute, Skill } from "@/schemas";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE PERÍCIAS — REGRAS QUE NÃO SÃO DE ROLAGEM                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ O VÍNCULO FIXO PERÍCIA → ATRIBUTO FOI REMOVIDO
 *
 * A v1 do schema tinha `Skill.attributeId`: um atributo escolhido uma vez, no
 * modo editar. O adendo de rolagem inverteu a regra — o atributo é escolhido
 * **no momento da rolagem**, no menu de clique direito, e "rolar seca" é uma
 * opção de primeira classe.
 *
 * Tudo que dependia do vínculo fixo saiu daqui junto:
 *   - `computeSkillBonus` / `findLinkedAttribute` → `domain/rolls.ts`
 *   - `unlinkSkillsOfAttribute` / `findOrphanedSkills` → sem objeto: não há
 *     mais vínculo para desfazer nem para ficar órfão
 *   - `describeSkillRoll` → `describeRoll`, em `rolls.ts`
 *
 * O que sobra é o que a §8.5 continua exigindo: a perícia conversa **apenas**
 * com o bloco de Atributos. Isso continua verdade — só passou a acontecer no
 * instante da rolagem.
 */

/** Quanto o atributo soma — atalho sobre a estratégia do sistema. */
export { attributeContribution } from "./rolls";

/**
 * Os rótulos dos atributos na MESMA ordem em que aparecem no bloco, para o
 * menu de rolagem.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A ORDEM NÃO É REORDENADA NEM ORDENADA POR NOME
 * O menu é uma extensão da tela: o jogador procura "Destreza" passando o olho
 * pelasSkills e então procura o mesmo nome na lista de atributos. Reordenar
 * a lista quebraria essa correspondência visual. O adendo fixa este mesmo
 * comportamento no ponto em aberto nº 3.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function attributesForRollMenu(
  attributes: readonly Attribute[],
): Attribute[] {
  return [...attributes];
}

/**
 * Rótulo de uma opção do menu: `"Destreza (16)"`.
 *
 * O valor vai junto porque o jogador costuma querer escolher o atributo pelo
 * NÍVEL, não pelo nome — dois "Carisma" de NPCs com valores diferentes são
 * comuns em ficha de campanha.
 */
export function attributeMenuLabel(attribute: Attribute): string {
  return `${attribute.name || "Sem nome"} (${attribute.value})`;
}

/** Nome de exibição de uma perícia, com reserva para a que está vazia. */
export function skillDisplayName(skill: Skill): string {
  return skill.name || "Perícia sem nome";
}
