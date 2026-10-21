import type { DieType } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  FORMATO DE UM SISTEMA DE RPG — TUDO AQUI É DADO, NÃO LÓGICA               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Um sistema novo = um arquivo novo em `config/systems/`, sem precisar mexer
 * em nenhum componente.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ PONTO EM ABERTO 14.1 — COMO CADA SISTEMA SOMA O ATRIBUTO NA ROLAGEM
 * O autor do projeto vai explicar a regra definitiva depois. O padrão
 * provisório está isolado em `src/domain/modifiers.ts`: trocar a regra
 * significa mexer em UM arquivo, sem tocar em componente nenhum.
 *
 * Cada sistema traz a PRÓPRIA função (padrão Strategy), então mudar a regra
 * do D&D não arrasta o Call of Cthulhu junto. E como o detalhamento da
 * rolagem (seção 8.3) mostra o valor bruto do atributo E o quanto ele somou,
 * qualquer regra é exibível sem mudar a interface.
 *
 * Padrão provisório (o que o documento pede):
 *   D&D 5e ......... modificador = floor((valor - 10) / 2)
 *   Old Dragon ..... o mesmo cálculo, isolado e trocável
 *   Call of Cthulhu  soma o valor direto, com perícia em d100
 * ───────────────────────────────────────────────────────────────────────────
 */

/* ===========================================================================
 * ESTRATÉGIA DE CONTRIBUIÇÃO DO ATRIBUTO
 * ========================================================================== */

/** O que está sendo rolado. Permite regras diferentes para arma e perícia. */
export type RollContext = "weapon" | "skill";

/** Tudo que uma estratégia precisa saber além do valor do atributo. */
export interface AttributeContributionContext {
  systemId: string;
  kind: RollContext;
}

/**
 * Retorna quanto o atributo soma ao resultado, já com sinal.
 *
 * Contrato — mantenha ao trocar a regra:
 *  - devolve um INTEIRO (a rolagem mostra "+3", nunca "+3.4");
 *  - atributo baixo pode devolver valor NEGATIVO;
 *  - nunca lança e nunca devolve `NaN`.
 */
export type AttributeContributionStrategy = (
  attributeValue: number,
  context: AttributeContributionContext,
) => number;

/* ===========================================================================
 * DADOS DE UM MODELO (template)
 * ========================================================================== */

/** Atributo inicial. `key` é estável e serve para vincular perícias. */
export interface AttributeSeed {
  /** Chave estável dentro do modelo ("forca"). Nunca muda. */
  key: string;
  name: string;
  value: number;
}

/** Perícia inicial. `attributeKey` aponta para um `AttributeSeed` do modelo. */
export interface SkillSeed {
  key: string;
  name: string;
  value: number;
  /** `null` = sem vínculo (rolagem é só dado + valor da perícia). */
  attributeKey: string | null;
}

/** Ajuste de layout aplicado sobre o layout padrão. */
export interface TemplateLayoutOverride {
  /** Chave do painel (`"profile"`, `"attributes"`, `"skills"`...). */
  panelId: string;
  visible?: boolean;
  order?: number;
  w?: number;
  h?: number;
}

/**
 * Ajuste dos slots do perfil.
 * `slotId` referencia `DEFAULT_PROFILE_SLOTS` (`config/profileSlots.ts`).
 */
export interface TemplateSlotOverride {
  slotId: string;
  enabled?: boolean;
  label?: string;
}

/** Um dos 3 modelos que todo sistema oferece. */
export interface SystemTemplate {
  /** Id estável, gravado na ficha (`templateId`). Nunca muda. */
  id: string;
  /** Nome em pt-BR exibido na escolha. */
  label: string;
  /** Frase curta explicando o que o modelo traz. */
  description: string;
  attributes: AttributeSeed[];
  skills: SkillSeed[];
  slots?: TemplateSlotOverride[];
  layout?: TemplateLayoutOverride[];
  /** `true` no modelo "Em branco": não cria atributos nem perícias. */
  blank?: boolean;
}

/* ===========================================================================
 * SISTEMA
 * ========================================================================== */

export interface RpgSystem {
  id: string;
  label: string;
  description: string;
  /** Dado base das rolagens de perícia (d20 no D&D/OD, d100 no CoC). */
  skillDie: DieType;
  /** Estratégia de soma do atributo (ponto em aberto 14.1). */
  attributeContribution: AttributeContributionStrategy;
  /** Resumo da regra em pt-BR, exibido ao usuário para não ficar no escuro. */
  attributeRuleDescription: string;
  /** Rótulo curto da regra, usado no detalhamento da rolagem. */
  attributeRuleLabel: string;
  templates: SystemTemplate[];
}
