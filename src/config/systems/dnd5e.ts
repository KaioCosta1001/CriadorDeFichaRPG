import { dnd5eAbilityModifier } from "@/domain/modifiers";

import type { AttributeSeed, RpgSystem, SkillSeed } from "./types";

/* ===========================================================================
 * D&D 5e
 * ========================================================================== */

/** Os seis atributos clássico. */
const DND_ATTRIBUTES: AttributeSeed[] = [
  { key: "forca", name: "Força", value: 10 },
  { key: "destreza", name: "Destreza", value: 10 },
  { key: "constituicao", name: "Constituição", value: 10 },
  { key: "inteligencia", name: "Inteligência", value: 10 },
  { key: "sabedoria", name: "Sabedoria", value: 10 },
  { key: "carisma", name: "Carisma", value: 10 },
];

/** As 18 perícias clássicas, com o atributo que as governa. */
const DND_SKILLS: SkillSeed[] = [
  { key: "acrobacia", name: "Acrobacia", value: 0, attributeKey: "destreza" },
  {
    key: "arcanismo",
    name: "Arcanismo",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "atletismo", name: "Atletismo", value: 0, attributeKey: "forca" },
  {
    key: "apresentacao",
    name: "Apresentação",
    value: 0,
    attributeKey: "carisma",
  },
  { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
  { key: "charme", name: "Charme", value: 0, attributeKey: "carisma" },
  { key: "enganacao", name: "Enganação", value: 0, attributeKey: "carisma" },
  { key: "historia", name: "História", value: 0, attributeKey: "inteligencia" },
  {
    key: "intimidacao",
    name: "Intimidação",
    value: 0,
    attributeKey: "carisma",
  },
  {
    key: "investigacao",
    name: "Investigação",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "labia", name: "Lábia", value: 0, attributeKey: "carisma" },
  { key: "medicina", name: "Medicina", value: 0, attributeKey: "sabedoria" },
  { key: "natureza", name: "Natureza", value: 0, attributeKey: "inteligencia" },
  { key: "percepcao", name: "Percepção", value: 0, attributeKey: "sabedoria" },
  { key: "persuasão", name: "Persuasão", value: 0, attributeKey: "carisma" },
  {
    key: "prestidigitacao",
    name: "Prestidigitação",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "religiao", name: "Religião", value: 0, attributeKey: "inteligencia" },
  {
    key: "furtividade",
    name: "Furtividade",
    value: 0,
    attributeKey: "destreza",
  },
];

export const dnd5e: RpgSystem = {
  id: "dnd5e",
  label: "D&D 5e",
  description:
    "Seis atributos ( Força, Destreza, Constituição, Inteligência, Sabedoria, Carisma) e perícias que somam o modificador do atributo.",
  skillDie: "d20",
  attributeContribution: dnd5eAbilityModifier,
  attributeRuleDescription:
    "O atributo entra como modificador: (valor − 10) ÷ 2, arredondado para baixo.",
  attributeRuleLabel: "Modificador",
  templates: [
    {
      id: "dnd5e-completo",
      label: "Clássico completo",
      description: "6 atributos e as 18 perícias do clássico.",
      attributes: DND_ATTRIBUTES,
      skills: DND_SKILLS,
    },
    {
      id: "dnd5e-simplificado",
      label: "Simplificado",
      description: "Os 6 atributos e só as 8 perícias mais usadas.",
      attributes: DND_ATTRIBUTES,
      skills: [
        {
          key: "acrobacia",
          name: "Acrobacia",
          value: 0,
          attributeKey: "destreza",
        },
        {
          key: "atletismo",
          name: "Atletismo",
          value: 0,
          attributeKey: "forca",
        },
        { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
        {
          key: "investigacao",
          name: "Investigação",
          value: 0,
          attributeKey: "inteligencia",
        },
        {
          key: "medicina",
          name: "Medicina",
          value: 0,
          attributeKey: "sabedoria",
        },
        {
          key: "percepcao",
          name: "Percepção",
          value: 0,
          attributeKey: "sabedoria",
        },
        {
          key: "persuasão",
          name: "Persuasão",
          value: 0,
          attributeKey: "carisma",
        },
        {
          key: "furtividade",
          name: "Furtividade",
          value: 0,
          attributeKey: "destreza",
        },
      ],
    },
    {
      id: "dnd5e-branco",
      label: "Em branco",
      description: "Começa vazio: você monta os atributos do seu jeito.",
      attributes: [],
      skills: [],
      blank: true,
    },
  ],
};
