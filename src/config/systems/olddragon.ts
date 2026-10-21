import { oldDragonAbilityModifier } from "@/domain/modifiers";

import type { AttributeSeed, RpgSystem, SkillSeed } from "./types";

/* ===========================================================================
 * OLD DRAGON
 * ========================================================================== */

/** Os dez atributos do Old Dragon. */
const OLD_DRAGON_ATTRIBUTES: AttributeSeed[] = [
  { key: "forca", name: "Força", value: 0 },
  { key: "destreza", name: "Destreza", value: 0 },
  { key: "constituicao", name: "Constituição", value: 0 },
  { key: "tamanho", name: "Tamanho", value: 0 },
  { key: "aparencia", name: "Aparência", value: 0 },
  { key: "inteligencia", name: "Inteligência", value: 0 },
  { key: "percepcao", name: "Percepção", value: 0 },
  { key: "vontade", name: "Vontade", value: 0 },
  { key: "presenca", name: "Presença", value: 0 },
  { key: "sorte", name: "Sorte", value: 0 },
];

const OLD_DRAGON_SKILLS: SkillSeed[] = [
  { key: "treinar", name: "Treinar", value: 0, attributeKey: null },
  { key: "escalar", name: "Escalar", value: 0, attributeKey: "destreza" },
  {
    key: "furtividade",
    name: "Furtividade",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "lutar", name: "Lutar", value: 0, attributeKey: "forca" },
  { key: "arremessar", name: "Arremessar", value: 0, attributeKey: "forca" },
  { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
  { key: "acrobacia", name: "Acrobacia", value: 0, attributeKey: "destreza" },
  { key: "medicina", name: "Medicina", value: 0, attributeKey: "inteligencia" },
  {
    key: "primeiros_socorros",
    name: "Primeiros Socorros",
    value: 0,
    attributeKey: "percepcao",
  },
  { key: "natureza", name: "Natureza", value: 0, attributeKey: "inteligencia" },
  {
    key: "astronomia",
    name: "Astronomia",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "historia", name: "História", value: 0, attributeKey: "inteligencia" },
  {
    key: "linguistica",
    name: "Linguística",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "enganacao", name: "Enganação", value: 0, attributeKey: "percepcao" },
  { key: "labia", name: "Lábia", value: 0, attributeKey: "presenca" },
  { key: "persuasão", name: "Persuasão", value: 0, attributeKey: "presenca" },
  {
    key: "intimidacao",
    name: "Intimidação",
    value: 0,
    attributeKey: "presenca",
  },
  {
    key: "vontade_teste",
    name: "Teste de Vontade",
    value: 0,
    attributeKey: "vontade",
  },
  { key: "rastrear", name: "Rastrear", value: 0, attributeKey: "percepcao" },
  { key: "escutar", name: "Escutar", value: 0, attributeKey: "percepcao" },
  { key: "sobreviver", name: "Sobreviver", value: 0, attributeKey: "vontade" },
];

export const oldDragon: RpgSystem = {
  id: "olddragon",
  label: "Old Dragon",
  description:
    "Dez atributos, incluindo Percepção, Vontade e Presença, e um bloco amplo de perícias chamadas Treinar.",
  skillDie: "d20",
  // provisório: mesma conta do D&D 5e, em função separada (ponto em aberto 14.1)
  attributeContribution: oldDragonAbilityModifier,
  attributeRuleDescription:
    "O atributo entra como modificador: (valor − 10) ÷ 2, arredondado para baixo. (Regra provisória, igual à do D&D 5e.)",
  attributeRuleLabel: "Modificador",
  templates: [
    {
      id: "olddragon-classico",
      label: "Clássico",
      description: "Os 10 atributos e 21 perícias do Old Dragon.",
      attributes: OLD_DRAGON_ATTRIBUTES,
      skills: OLD_DRAGON_SKILLS,
    },
    {
      id: "olddragon-simplificado",
      label: "Simplificado",
      description: "Os 10 atributos e 8 perícias essenciais.",
      attributes: OLD_DRAGON_ATTRIBUTES,
      skills: [
        { key: "treinar", name: "Treinar", value: 0, attributeKey: null },
        { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
        {
          key: "acrobacia",
          name: "Acrobacia",
          value: 0,
          attributeKey: "destreza",
        },
        {
          key: "furtividade",
          name: "Furtividade",
          value: 0,
          attributeKey: "destreza",
        },
        {
          key: "medicina",
          name: "Medicina",
          value: 0,
          attributeKey: "inteligencia",
        },
        {
          key: "rastrear",
          name: "Rastrear",
          value: 0,
          attributeKey: "percepcao",
        },
        {
          key: "intimidacao",
          name: "Intimidação",
          value: 0,
          attributeKey: "presenca",
        },
        {
          key: "vontade_teste",
          name: "Teste de Vontade",
          value: 0,
          attributeKey: "vontade",
        },
      ],
    },
    {
      id: "olddragon-branco",
      label: "Em branco",
      description: "Começa vazio: você monta os atributos do seu jeito.",
      attributes: [],
      skills: [],
      blank: true,
    },
  ],
};
