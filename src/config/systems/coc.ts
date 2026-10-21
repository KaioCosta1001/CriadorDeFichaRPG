import { cthulhuAbilityValue } from "@/domain/modifiers";

import type { AttributeSeed, RpgSystem, SkillSeed } from "./types";

/* ===========================================================================
 * CALL OF CTHULHU 7e
 * ========================================================================== */

/** Os dez atributos do CoC 7e, todos de 0 a 99. */
const COC_ATTRIBUTES: AttributeSeed[] = [
  { key: "forca", name: "Força", value: 50 },
  { key: "tamanho", name: "Tamanho", value: 50 },
  { key: "destreza", name: "Destreza", value: 50 },
  { key: "aparencia", name: "Aparência", value: 50 },
  { key: "inteligencia", name: "Inteligência", value: 50 },
  { key: "poder", name: "Poder", value: 50 },
  { key: "sorte", name: "Sorte", value: 50 },
  { key: "sanes", name: "Sanidade", value: 50 },
  { key: "educacao", name: "Educação", value: 50 },
  { key: "vontade", name: "Vontade", value: 50 },
];

/**
 * Perícias do investigador padrão.
 *
 * No 7e o investigador marca praticamente todas; aqui está um conjunto sólido
 * das mais usadas. Este arquivo é DADO — acrescentar uma perícia é uma linha
 * nova, sem tocar em código.
 *
 * Cada `attributeKey` DEVE existir em `COC_ATTRIBUTES`. Isso é verificado
 * por teste (`systems.test.ts`): um vínculo quebrado aqui viraria uma
 * perícia sem atributo na ficha, e isso é difícil de enxergar na interface.
 */
const COC_SKILLS: SkillSeed[] = [
  {
    key: "antiguidade",
    name: "Antiguidade",
    value: 0,
    attributeKey: "educacao",
  },
  {
    key: "arqueologia",
    name: "Arqueologia",
    value: 0,
    attributeKey: "educacao",
  },
  {
    key: "arte_oficio",
    name: "Arte/Ofício",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "astronomia", name: "Astronomia", value: 0, attributeKey: "educacao" },
  {
    key: "avaliacao",
    name: "Avaliação",
    value: 0,
    attributeKey: "inteligencia",
  },
  {
    key: "armas_de_fogo",
    name: "Armas de Fogo",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
  { key: "charme", name: "Charme", value: 0, attributeKey: "aparencia" },
  { key: "chaveiro", name: "Chaveiro", value: 0, attributeKey: "destreza" },
  {
    key: "contabilidade",
    name: "Contabilidade",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "credito", name: "Crédito", value: 0, attributeKey: "educacao" },
  { key: "crime", name: "Crime", value: 0, attributeKey: "destreza" },
  { key: "direito", name: "Direito", value: 0, attributeKey: "educacao" },
  {
    key: "dirigir_auto",
    name: "Dirigir Automóvel",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "disfarce", name: "Disfarce", value: 0, attributeKey: "destreza" },
  {
    key: "eletricidade",
    name: "Eletricidade",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "escalar", name: "Escalar", value: 0, attributeKey: "forca" },
  { key: "esgrima", name: "Esgrima", value: 0, attributeKey: "destreza" },
  { key: "esquivar", name: "Esquivar", value: 0, attributeKey: "destreza" },
  {
    key: "furtividade",
    name: "Furtividade",
    value: 0,
    attributeKey: "destreza",
  },
  { key: "historia", name: "História", value: 0, attributeKey: "educacao" },
  { key: "intimidacao", name: "Intimidação", value: 0, attributeKey: "forca" },
  { key: "medicina", name: "Medicina", value: 0, attributeKey: "educacao" },
  {
    key: "mundo_natural",
    name: "Mundo Natural",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "navegacao", name: "Navegação", value: 0, attributeKey: "educacao" },
  { key: "nadar", name: "Nadar", value: 0, attributeKey: "forca" },
  { key: "observar", name: "Observar", value: 0, attributeKey: "inteligencia" },
  { key: "ocultismo", name: "Ocultismo", value: 0, attributeKey: "educacao" },
  {
    key: "operar_radio",
    name: "Operar Rádio",
    value: 0,
    attributeKey: "educacao",
  },
  { key: "persuasão", name: "Persuasão", value: 0, attributeKey: "aparencia" },
  { key: "pilotar", name: "Pilotar", value: 0, attributeKey: "destreza" },
  {
    key: "primeiros_socorros",
    name: "Primeiros Socorros",
    value: 0,
    attributeKey: "educacao",
  },
  {
    key: "psicologia",
    name: "Psicologia",
    value: 0,
    attributeKey: "inteligencia",
  },
  { key: "rastrear", name: "Rastrear", value: 0, attributeKey: "destreza" },
  { key: "saltar", name: "Saltar", value: 0, attributeKey: "forca" },
  { key: "sobreviver", name: "Sobreviver", value: 0, attributeKey: "vontade" },
];

/**
 * Sanidade ligada por padrão neste sistema.
 *
 * Antes usava `slot-extra`, que ficava no canto INFERIOR ESQUERDO. Com o
 * adendo §2 esse canto passou a ser o slot dedicado `slot-sanidade`, e o
 * `slot-extra` foi para o SUPERIOR DIREITO como reserva genérica.
 *
 * Usar o id certo importa por dois motivos: o rótulo "Sanidade" sai do próprio
 * nome do slot, e a posição passa a ser a que o adendo especifica.
 */
const COC_SANITY_SLOT = {
  slotId: "slot-sanidade",
  enabled: true,
  label: "Sanidade",
};

export const cthulhu: RpgSystem = {
  id: "coc",
  label: "Call of Cthulhu",
  description:
    "Dez atributos de 0 a 99, perícias testadas em d100 e o valor do atributo somando direto ao resultado.",
  skillDie: "d100",
  attributeContribution: cthulhuAbilityValue,
  attributeRuleDescription:
    "O atributo soma o valor direto ao resultado da perícia (1d100).",
  attributeRuleLabel: "Valor do atributo",
  templates: [
    {
      id: "coc-investigador",
      label: "Investigador padrão",
      description:
        "Os 10 atributos, Sanidade já habilitada no perfil e um conjunto amplo de perícias de investigador.",
      attributes: COC_ATTRIBUTES,
      skills: COC_SKILLS,
      // Requisito da seção 12: neste sistema o slot inferior esquerdo fica
      // ligado por padrão como "Sanidade".
      slots: [COC_SANITY_SLOT],
    },
    {
      id: "coc-simplificado",
      label: "Simplificado",
      description:
        "Os 10 atributos, Sanidade no perfil e 6 perícias essenciais.",
      attributes: COC_ATTRIBUTES,
      skills: [
        {
          key: "avaliacao",
          name: "Avaliação",
          value: 0,
          attributeKey: "inteligencia",
        },
        { key: "briga", name: "Briga", value: 0, attributeKey: "forca" },
        {
          key: "medicina",
          name: "Medicina",
          value: 0,
          attributeKey: "educacao",
        },
        {
          key: "observar",
          name: "Observar",
          value: 0,
          attributeKey: "inteligencia",
        },
        {
          key: "psicologia",
          name: "Psicologia",
          value: 0,
          attributeKey: "inteligencia",
        },
        {
          key: "furtividade",
          name: "Furtividade",
          value: 0,
          attributeKey: "destreza",
        },
      ],
      slots: [COC_SANITY_SLOT],
    },
    {
      id: "coc-branco",
      label: "Em branco",
      description: "Começa vazio: você monta os atributos do seu jeito.",
      attributes: [],
      skills: [],
      blank: true,
    },
  ],
};
