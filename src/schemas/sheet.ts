import { z } from "zod";

import {
  ALL_DIE_TYPES,
  ATTACK_BONUS_MAX,
  ATTACK_BONUS_MIN,
  ATTRIBUTE_NAME_MAX_LENGTH,
  CARRY_CAPACITY_MAX,
  FIELD_LABEL_MAX_LENGTH,
  FIELD_VALUE_MAX_LENGTH,
  ITEM_NAME_MAX_LENGTH,
  ITEM_QUANTITY_MAX,
  ITEM_QUANTITY_MIN,
  ITEM_VALUE_MAX,
  ITEM_VALUE_MIN,
  ITEM_WEIGHT_MAX,
  ITEM_WEIGHT_MIN,
  LIST_ENTRY_MAX_LENGTH,
  LIST_ENTRY_NUMBER_DEFAULT,
  LIST_ENTRY_NUMBER_MAX,
  LIST_ENTRY_NUMBER_MIN,
  MONEY_LABEL_MAX_LENGTH,
  MONEY_VALUE_MAX,
  MONEY_VALUE_MIN,
  MAX_ATTRIBUTES,
  MAX_DICE_PER_ROLL,
  MAX_EXTRA_PANELS,
  MAX_ITEMS,
  MAX_SKILLS,
  MAX_WEAPONS,
  MIN_DICE_PER_ROLL,
  GRID_MAX_H,
  GRID_MAX_W,
  GRID_MIN_H,
  GRID_MIN_W,
  PANEL_TITLE_MAX_LENGTH,
  PHOTO_DATA_URL_MAX_LENGTH,
  ROLL_COMPONENT_LABEL_MAX_LENGTH,
  ROLL_HISTORY_LIMIT,
  ROLL_LABEL_MAX_LENGTH,
  ROLL_SPEED_DEFAULT,
  ROLL_SPEED_MAX,
  ROLL_SPEED_MIN,
  SHEET_NAME_MAX_LENGTH,
  SHEET_TITLE_MAX_LENGTH,
  SKILL_NAME_MAX_LENGTH,
  STAT_VALUE_MAX,
  STAT_VALUE_MIN,
  SYSTEM_IDS,
  TEXT_BLOCK_MAX_LENGTH,
  WEAPON_NAME_MAX_LENGTH,
} from "@/config/constants";
import { PANEL_TYPES } from "@/config/panelTypes";
import { PROFILE_SLOT_POSITIONS } from "@/config/profileSlots";

import {
  boundedInt,
  boundedNumber,
  IdSchema,
  OwnerIdSchema,
  RowColorSchema,
  TimestampSchema,
  trimmedText,
} from "./common";

/* ===========================================================================
 * BLOCO: PERFIL
 * ========================================================================== */

/** Posição fixa de um slot no bloco de Perfil. */
export const ProfileSlotPositionSchema = z.enum(PROFILE_SLOT_POSITIONS);

export const ProfileSlotSchema = z.object({
  /** ID estável — mudar este valor perde o que o usuário digitou. */
  id: IdSchema,
  position: ProfileSlotPositionSchema,
  /** Slot ligado/desligado. Desligado = some da interface, some o valor não vai. */
  enabled: z.boolean(),
  /** Rótulo editável ("CA", "PV", "Sanidade"...). */
  label: trimmedText({
    max: FIELD_LABEL_MAX_LENGTH,
    label: "Rótulo do campo",
  }),
  /** Valor editável. */
  value: trimmedText({
    max: FIELD_VALUE_MAX_LENGTH,
    label: "Valor do campo",
  }),
  /**
   * Valor máximo do campo — APENAS para desenhar o preenchimento do orbe.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE É SÓ VISUAL
   * A especificação é explícita: "com nível proporcional se houver valor
   * máximo — apenas visual, sem criar regra nova". Nenhuma regra de jogo usa
   * isto; a rolagem e o peso do inventário não olham para cá.
   * `null` = sem máximo → o orbe vira só um medalhão com aro.
   *
   * `.default(null)` (e não `.optional()`) mantém documentos antigos válidos:
   * eles não têm o campo, e o parse preenche com `null`.
   * ───────────────────────────────────────────────────────────────────────────
   */
  max: boundedNumber({
    min: 0,
    max: STAT_VALUE_MAX,
    label: "Valor máximo",
    fallback: 0,
  })
    .nullable()
    .default(null),
  /**
   * Papel do orbe, detectado pelo rótulo.
   * `null` = detecção automática. Guardar o valor evita que renomear o rótulo
   * mude a cor do orbe sem querer.
   */
  orbRole: z
    .enum(["life", "mind", "armor", "generic"])
    .nullable()
    .default(null),
});

export type ProfileSlot = z.infer<typeof ProfileSlotSchema>;

export const ProfileSchema = z.object({
  /**
   * Foto em data URL, já redimensionada e comprimida no cliente.
   * Limitada por `PHOTO_DATA_URL_MAX_LENGTH` para caber na cota do storage.
   */
  photo: z.string().max(PHOTO_DATA_URL_MAX_LENGTH).nullable(),
  slots: z.array(ProfileSlotSchema).max(PROFILE_SLOT_POSITIONS.length),
});

export type Profile = z.infer<typeof ProfileSchema>;

/* ===========================================================================
 * BLOCO: ATRIBUTOS
 * ========================================================================== */

export const AttributeSchema = z.object({
  id: IdSchema,
  name: trimmedText({
    max: ATTRIBUTE_NAME_MAX_LENGTH,
    label: "Nome do atributo",
  }),
  value: boundedInt({
    min: STAT_VALUE_MIN,
    max: STAT_VALUE_MAX,
    label: "Valor do atributo",
  }),
  color: RowColorSchema,
});

export type Attribute = z.infer<typeof AttributeSchema>;

/* ===========================================================================
 * BLOCO: PERÍCIAS
 * ========================================================================== */

/**
 * Uma perícia (seção 8.5 + adendo de rolagem por clique direito).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `attributeId` FOI REMOVIDO (v2 do schema)
 *
 * A versão original previa um atributo vinculado FIXO por perícia, escolhido
 * no modo editar. O adendo de rolagem inverteu isso: agora o atributo é
 * escolhido **no momento da rolagem**, no menu de clique direito, e "rolar
 * seca" (só o d20 + a perícia) é uma opção de primeira classe.
 *
 * Guardar o vínculo não faria mal sozinho — o problema é a INTERFACE: dois
 * lugares para escolher a mesma coisa (o seletor do bloco e o menu da rolagem)
 * divergem, e o jogador não sabe qual manda. Um atributo fixo também prende a
 * perícia a um único atributo, o que não serve para quem joga com "qualquer
 * atributo serve aqui".
 *
 * O dado salvo é removido pela migração v1 → v2, sem perder o resto.
 */
export const SkillSchema = z.object({
  id: IdSchema,
  name: trimmedText({
    max: SKILL_NAME_MAX_LENGTH,
    label: "Nome da perícia",
  }),
  value: boundedInt({
    min: STAT_VALUE_MIN,
    max: STAT_VALUE_MAX,
    label: "Valor da perícia",
  }),
  color: RowColorSchema,
});

export type Skill = z.infer<typeof SkillSchema>;

/* ===========================================================================
 * BLOCO: INVENTÁRIO
 * ========================================================================== */

/**
 * Tipo de dado ("d4"…"d20", e "d100" para sistemas que o usam).
 *
 * Aceita `ALL_DIE_TYPES`, que é maior que a lista do seletor de arma —
 * a interface de arma só oferece `WEAPON_DIE_TYPES` (seção 8.2.1).
 */
export const DieTypeSchema = z.enum(ALL_DIE_TYPES);

/**
 * Uma arma da aba "Armas".
 *
 * REGRA CRÍTICA (seção 8.2.1): `diceCount` NÃO multiplica o valor do dado.
 * `2d20` significa "sorteie dois d20 independentes e some", nunca "o dobro".
 * Quem interpreta essa semântica é `src/domain/dice.ts` (Fase 8).
 */
export const WeaponSchema = z.object({
  id: IdSchema,
  name: trimmedText({
    max: WEAPON_NAME_MAX_LENGTH,
    label: "Nome da arma",
  }),
  die: DieTypeSchema,
  /** Quantidade de dados sorteados (nunca multiplica o valor do dado). */
  diceCount: boundedInt({
    min: MIN_DICE_PER_ROLL,
    max: MAX_DICE_PER_ROLL,
    label: "Quantidade de dados",
    fallback: MIN_DICE_PER_ROLL,
  }),
  /** Bônus somado ao resultado final. */
  attackBonus: boundedInt({
    min: ATTACK_BONUS_MIN,
    max: ATTACK_BONUS_MAX,
    label: "Bônus de ataque",
  }),
  /**
   * Atributos que somam na rolagem (ponto em aberto 14.4: vários são
   * permitidos e TODOS contribuem, somados).
   */
  attributeIds: z.array(IdSchema),
  /** Cor de identificação da linha. */
  color: RowColorSchema,
  /** Item correspondente na aba Itens, quando `isItem` é verdadeiro. */
  itemId: IdSchema.nullable(),
  /**
   * "Isto é um item": quando ligado, o nome da arma também vira item na aba
   * Itens. Remover a arma daqui NÃO remove o item de lá.
   */
  isItem: z.boolean(),
});

export type Weapon = z.infer<typeof WeaponSchema>;

/**
 * Dados de arma preservados quando o item veio da aba Armas.
 *
 * Ficam dentro de `Item.weaponData` e permanecem intactos mesmo com a arma
 * desequipada — é isso que permite "equipar" restaurar dado, quantidade,
 * bônus e atributos sem o usuário redigitar nada.
 *
 * `id` fica FORA de propósito: o vínculo é feito pelo id do próprio `Item`.
 */
export const WeaponDataSchema = WeaponSchema.pick({
  die: true,
  diceCount: true,
  attackBonus: true,
  attributeIds: true,
  color: true,
  isItem: true,
});

export type WeaponData = z.infer<typeof WeaponDataSchema>;

/** Um item da aba "Itens". */
export const ItemSchema = z.object({
  id: IdSchema,
  name: trimmedText({ max: ITEM_NAME_MAX_LENGTH, label: "Nome do item" }),
  weight: boundedNumber({
    min: ITEM_WEIGHT_MIN,
    max: ITEM_WEIGHT_MAX,
    label: "Peso",
  }),
  quantity: boundedInt({
    min: ITEM_QUANTITY_MIN,
    max: ITEM_QUANTITY_MAX,
    label: "Quantidade",
  }),
  value: boundedNumber({
    min: ITEM_VALUE_MIN,
    max: ITEM_VALUE_MAX,
    label: "Valor",
  }),
  color: RowColorSchema,
  /**
   * Item favorito: PROTEGIDO. Não é removido nem vendido por ações em massa,
   * e a remoção individual pede confirmação extra.
   */
  favorite: z.boolean(),
  /** Dados de arma preservados (só existe se o item veio da aba Armas). */
  weaponData: WeaponDataSchema.nullable(),
  /** Id da arma atualmente equipada a partir deste item, se houver. */
  equippedWeaponId: IdSchema.nullable(),
});

export type Item = z.infer<typeof ItemSchema>;

/** Dinheiro do personagem (rótulo editável, ex.: "Ouro"). */
export const MoneySchema = z.object({
  label: trimmedText({
    max: MONEY_LABEL_MAX_LENGTH,
    label: "Rótulo do dinheiro",
  }),
  value: boundedNumber({
    min: MONEY_VALUE_MIN,
    max: MONEY_VALUE_MAX,
    label: "Saldo",
  }),
});

export type Money = z.infer<typeof MoneySchema>;

export const InventorySchema = z.object({
  weapons: z.array(WeaponSchema).max(MAX_WEAPONS),
  items: z.array(ItemSchema).max(MAX_ITEMS),
  money: MoneySchema,
  /**
   * Capacidade de carga (peso máximo). Editável apenas no Editar Geral.
   * Peso acima da capacidade deixa o texto vermelho, mas NÃO bloqueia.
   */
  carryCapacity: boundedNumber({
    min: 0,
    max: CARRY_CAPACITY_MAX,
    label: "Capacidade de carga",
  }),
});

export type Inventory = z.infer<typeof InventorySchema>;

/* ===========================================================================
 * PAINÉIS EXTRAS ADICIONADOS PELO USUÁRIO
 * ========================================================================== */

/** Uma linha de um bloco de lista. */
export const ListEntrySchema = z.object({
  id: IdSchema,
  name: trimmedText({ max: LIST_ENTRY_MAX_LENGTH, label: "Nome da linha" }),
  number: boundedInt({
    min: LIST_ENTRY_NUMBER_MIN,
    max: LIST_ENTRY_NUMBER_MAX,
    label: "Número da linha",
  }).default(LIST_ENTRY_NUMBER_DEFAULT),
  color: RowColorSchema,
});

export type ListEntry = z.infer<typeof ListEntrySchema>;

/**
 * Bloco criado pelo usuário no Editar Geral.
 *
 * `text` usa `content`; `list` usa `entries`. O outro campo fica vazio —
 * é mais simples e mais previsível do que uma união discriminada, e a
 * interface nunca mostra o campo que não pertence ao tipo.
 */
export const ExtraPanelSchema = z.object({
  id: IdSchema,
  title: trimmedText({
    max: PANEL_TITLE_MAX_LENGTH,
    label: "Nome do bloco",
    allowEmpty: false,
  }),
  type: z.enum(PANEL_TYPES),
  /** Texto do bloco de notas (texto puro, nunca HTML). */
  content: trimmedText({
    max: TEXT_BLOCK_MAX_LENGTH,
    label: "Conteúdo do bloco",
  }),
  /** Linhas do bloco de lista. */
  entries: z.array(ListEntrySchema),
});

export type ExtraPanel = z.infer<typeof ExtraPanelSchema>;

/* ===========================================================================
 * ROLAGENS
 * ======================================================================== */

/** De onde veio a rolagem. */
export const RollKindSchema = z.enum(["weapon", "skill", "attribute"]);

export type RollKind = z.infer<typeof RollKindSchema>;

/**
 * Uma parcela do detalhamento: o nome que aparece no tooltip e o que ela
 * somou.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SÓ `{ label, value }`
 * A estrutura antiga tinha `attributeContributions` e `bonuses` em listas
 * separadas, cada uma com seu próprio formato. Isso obrigava a UI a juntar
 * duas listas em três casos (arma, perícia, atributo) e a formatar nomes
 * diferentes conforme a rolagem. Uma lista única de parcelas resolve: o
 * detalhamento é a MESMA frase nos três casos, só muda o conteúdo.
 */
export const RollComponentSchema = z.object({
  /** "perícia", "Destreza", "Ataque"... */
  label: trimmedText({
    max: ROLL_COMPONENT_LABEL_MAX_LENGTH,
    label: "Parcela da rolagem",
  }),
  /** Quanto somou, com sinal. */
  value: z.number().int(),
});

export type RollComponent = z.infer<typeof RollComponentSchema>;

/**
 * Registro de uma rolagem — a MESMA estrutura para arma, perícia e atributo.
 *
 * Guarda o detalhamento INTEIRO, não só o total: é dele que sai o tooltip
 * "d20 [14] + perícia (+3) + Destreza (+2) = 19" (seção 8.3).
 */
export const RollRecordSchema = z.object({
  id: IdSchema,
  rolledAt: TimestampSchema,
  kind: RollKindSchema,
  /**
   * Rótulo EXATO como aparece no resultado e no histórico.
   * Ex.: `"Furtividade (seca)"`, `"Furtividade + Destreza"`, `"Destreza"`.
   *
   * Guardar pronto evita a UI precisar saber a regra do "(seca)" e evita que
   * a frase mude entre o resultado e o histórico.
   */
  label: trimmedText({
    max: ROLL_LABEL_MAX_LENGTH,
    label: "Rolagem",
  }),
  die: DieTypeSchema,
  /**
   * Valores sorteados, um por dado.
   *
   * Perícia e atributo rolam UM d20, então o array tem exatamente um item —
   * mas é array para arma (`3d20`) usar a MESMA estrutura, sem campo extra.
   */
  dice: z.array(z.number().int().min(1)).min(1),
  /** As parcelas que somam depois do dado. */
  components: z.array(RollComponentSchema),
  /** Resultado final, já com tudo somado. */
  total: z.number().int(),
  /**
   * O que originou a rolagem, quando aplicável. `null` em rolagem avulsa.
   *
   * Guardar o id permite, no futuro, destacar "a rolagem desta arma" na
   * lista. Sem ele, a única forma de ligar as duas coisas seria comparar
   * nomes — e o usuário pode editar o nome a qualquer momento.
   */
  sourceId: IdSchema.nullable(),
});

export type RollRecord = z.infer<typeof RollRecordSchema>;

/* ===========================================================================
 * LAYOUT DOS PAINÉIS
 * ========================================================================== */

/**
 * Posição e tamanho de um painel, em CÉLULAS do grid.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE INTEIRO, E POR QUE CÉLULA
 *
 * O adendo §1 substituiu o snap de 5 px pelo snap na unidade do grid. Célula é
 * discreta: não existe meia célula, então `x`, `y`, `w` e `h` são INTEIROS.
 *
 * O `.int()` no schema não é vaidade — é a defesa contra arquivo importado ou
 * gravado por uma versão anterior, que guardava `173.5` (px) ou `12.4` (célula
 * fracionária de um grid futuro). Um `12.4` que passa faria o painel ocupar
 * 12,4 células e desalinharia a grade inteira silenciosamente.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O MÍNIMO É GLOBAL E NÃO POR TIPO
 *
 * O piso por TIPO (Perfil não pode ser 6×5) mora em `PANEL_MIN_SIZE` e é
 * aplicado por `minSizeOf`, na normalização e no redimensionamento.
 *
 * Aqui fica só o piso global, para que um `PanelLayout` isolado — o `default`
 * de um tipo novo, um layout temporário na grade — ainda seja válido. A regra
 * fina entra depois, no `normalizeLayout`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A MIGRAÇÃO
 *
 * Documento salvo em px (versão ≤ 2) é convertido por `migrateV2toV3`, em
 * `domain/migrations.ts`. A conversão é aproximada por natureza — não há
 * container para medir durante a migração — e por isso termina sempre
 * normalizada.
 */
export const PanelLayoutSchema = z.object({
  /** Chave estável do painel (`"panel:profile"`, `"extra:<id>"`...). */
  panelId: z.string().min(1).max(120),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(GRID_MIN_W).max(GRID_MAX_W),
  h: z.number().int().min(GRID_MIN_H).max(GRID_MAX_H),
  /** Bloco escondido no Editar Geral (só escondível, nunca removível). */
  visible: z.boolean(),
  /** Ordem de leitura/arraste, independente das coordenadas. */
  order: z.number().int().min(0),
});

export type PanelLayout = z.infer<typeof PanelLayoutSchema>;

/* ===========================================================================
 * CONFIGURAÇÕES
 * ========================================================================== */

/**
 * Temas da interface.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * VALORES ANTIGOS ("light" | "dark" | "system")
 * Nas Fases 1–4 o tema era claro/escuro. A direção visual pediu dois temas
 * escuros nomeados. Como as Configurações já podem estar salvas no
 * `localStorage` de quem testou o app, o schema NORMALIZA os valores antigos
 * em vez de rejeitá-los — descartar a preferência do usuário porque ele
 * atualizou o app seria uma perda de dados gratuita.
 *
 *   dark    → santuario  (era o mais próximo)
 *   light   → grimoire   (era o mais próximo)
 *   system  → grimoire   (o padrão)
 * ───────────────────────────────────────────────────────────────────────────
 */
export const THEME_IDS = ["grimoire", "santuario"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  dark: "santuario",
  light: "grimoire",
  system: "grimoire",
};

export const ThemeModeSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return LEGACY_THEME_MAP[value] ?? value;
}, z.enum(THEME_IDS));

/**
 * Configurações GLOBAIS do app (repository: `getSettings`/`saveSettings`).
 * Só entram aqui o que faz sentido sem uma ficha aberta — hoje, o tema.
 */
export const AppSettingsSchema = z.object({
  theme: ThemeModeSchema,
  /** Multiplicador de velocidade da animação de rolagem (adendo §5.3). */
  rollAnimationSpeed: z
    .number()
    .min(ROLL_SPEED_MIN)
    .max(ROLL_SPEED_MAX)
    .default(ROLL_SPEED_DEFAULT),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

/**
 * Configuracoes POR FICHA (secao 13). Ficam dentro da Sheet porque so fazem
 * sentido com um personagem aberto (o botao Vender so existe no inventario).
 */
export const SheetSettingsSchema = z.object({
  /** Master switch de "Habilitar venda de itens" (secao 11). */
  sellEnabled: z.boolean(),
});

export type SheetSettings = z.infer<typeof SheetSettingsSchema>;

/* ===========================================================================
 * A FICHA
 * ========================================================================== */

/** Sistemas de RPG suportados. */
export const SystemIdSchema = z.enum(SYSTEM_IDS);

export type SystemId = z.infer<typeof SystemIdSchema>;

/**
 * A ficha completa.
 *
 * `schemaVersion` é o que permite migrar dados antigos sem descartá-los
 * (seção 5.8). Nunca remova um campo sem bump de versão + migração.
 */
export const SheetSchema = z.object({
  id: IdSchema,
  /** Reservado para o futuro multiusuário. Hoje é sempre `null`. */
  ownerId: OwnerIdSchema,
  schemaVersion: z.number().int().min(1),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,

  /** Nome do personagem. Editável APENAS no Editar Geral (seção 8.1). */
  name: trimmedText({ max: SHEET_NAME_MAX_LENGTH, label: "Nome" }),
  /**
   * Nome da ficha na listagem. Deriva de `name`, mas é editável à parte:
   * assim dá para ter "Gandalf (principal)" e "Gandalf (NPC)" sem mexer no
   * nome do personagem, que é informação sensível.
   */
  title: trimmedText({
    max: SHEET_TITLE_MAX_LENGTH,
    label: "Título da ficha",
  }),

  system: SystemIdSchema,
  templateId: trimmedText({ max: 64, label: "Modelo" }),

  profile: ProfileSchema,
  attributes: z.array(AttributeSchema).max(MAX_ATTRIBUTES),
  skills: z.array(SkillSchema).max(MAX_SKILLS),
  inventory: InventorySchema,
  extraPanels: z.array(ExtraPanelSchema).max(MAX_EXTRA_PANELS),
  layout: z.array(PanelLayoutSchema),
  rollHistory: z.array(RollRecordSchema).max(ROLL_HISTORY_LIMIT),
  settings: SheetSettingsSchema,
});

export type Sheet = z.infer<typeof SheetSchema>;

/** Os campos que `createSheet` recebe. O resto é gerado. */
export const CreateSheetInputSchema = z.object({
  system: SystemIdSchema,
  templateId: trimmedText({ max: 64, label: "Modelo" }),
  name: trimmedText({ max: SHEET_NAME_MAX_LENGTH, label: "Nome" }),
  title: trimmedText({ max: SHEET_TITLE_MAX_LENGTH, label: "Título" }),
});

export type CreateSheetInput = z.infer<typeof CreateSheetInputSchema>;

/**
 * Resumo usado na tela de listagem.
 *
 * Existe para a listagem NÃO precisar ler todos os documentos — o mesmo
 * formato que um índice no MongoDB teria.
 */
export const SheetSummarySchema = z.object({
  id: IdSchema,
  title: trimmedText({ max: SHEET_TITLE_MAX_LENGTH, label: "Título" }),
  name: trimmedText({ max: SHEET_NAME_MAX_LENGTH, label: "Nome" }),
  system: SystemIdSchema,
  templateId: trimmedText({ max: 64, label: "Modelo" }),
  schemaVersion: z.number().int().min(1),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type SheetSummary = z.infer<typeof SheetSummarySchema>;

/** Lista de resumos guardada no índice. */
export const SheetIndexSchema = z.array(SheetSummarySchema);
