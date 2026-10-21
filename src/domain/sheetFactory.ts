import {
  DEFAULT_CARRY_CAPACITY,
  DEFAULT_DICE_COUNT,
  DEFAULT_DIE_TYPE,
  DEFAULT_MONEY_LABEL,
  DEFAULT_MONEY_VALUE,
  DEFAULT_PANEL_ROW_CELLS,
  DEFAULT_PANEL_SQUARE_CELLS,
  GRID_COLUMNS,
  SCHEMA_VERSION,
} from "@/config/constants";
import { DEFAULT_PROFILE_SLOTS } from "@/config/profileSlots";
import { getTemplate, type SystemTemplate } from "@/config/systems";
import { DEFAULT_THEME_ID } from "@/config/palette";
import { generateId } from "@/lib/id";
import {
  AppSettingsSchema,
  AttributeSchema,
  ProfileSlotSchema,
  SheetSchema,
  SkillSchema,
  type AppSettings,
  type CreateSheetInput,
  type PanelLayout,
  type ProfileSlot,
  type Sheet,
  type SheetSummary,
} from "@/schemas";

/**
 * Fábrica de fichas.
 *
 * É o único lugar que cria dados de ficha "do zero". O resultado passa por
 * `SheetSchema.parse` no final: se um default violar o schema, o erro aparece
 * em desenvolvimento — e não só quando o usuário salvar.
 */

/** Configurações globais padrão (usadas quando o storage está vazio). */
export const DEFAULT_APP_SETTINGS: AppSettings = AppSettingsSchema.parse({
  theme: DEFAULT_THEME_ID,
});

/**
 * Monta os slots de perfil a partir da configuração padrão.
 *
 * O `id` do slot vem da configuração (é fixo, não gerado) para que a
 * etiqueta e o valor digitados pelo usuário sobrevivam a atualizações.
 */
function buildProfileSlots(template: SystemTemplate | null): ProfileSlot[] {
  const overrides = new Map(
    (template?.slots ?? []).map((override) => [override.slotId, override]),
  );

  return DEFAULT_PROFILE_SLOTS.map((slot) => {
    const override = overrides.get(slot.id);
    return ProfileSlotSchema.parse({
      id: slot.id,
      position: slot.position,
      enabled: override?.enabled ?? slot.enabled,
      label: override?.label ?? slot.label,
      value: "",
      max: slot.max,
      orbRole: null,
    });
  });
}

/**
 * Layout padrão dos blocos, no padrão do diagrama da seção 7:
 *
 *   ┌──────┬────────────────┬──────┐
 *   │PERFIL│   INVENTÁRIO   │RESULT│
 *   ├──────┴────────────────┴──────┤
 *   │          ATRIBUTOS           │
 *   │          PERÍCIAS            │
 *   └──────────────────────────────┘
 *
 * As medidas são px numa largura de referência (4 quadrados). O grid real
 * é quem escala isso para a tela disponível (Fase 4); o que importa aqui é
 * a PROPORÇÃO entre os blocos.
 *
 * `template` pode sobrescrever visibilidade, ordem e tamanho de blocos
 * específicos — é assim que "layout inicial" fica definido por modelo.
 *
 * EXPORTADO de propósito: o botão "Resetar layout" precisa reconstruir
 * exatamente o mesmo layout padrão, sem duplicar estes números.
 */
export function buildDefaultLayout(
  template: SystemTemplate | null = null,
): PanelLayout[] {
  // ─────────────────────────────────────────────────────────────────────────
  // EM CELULAS, E DERIVADO DE `GRID_COLUMNS`
  //
  // Com `GRID_COLUMNS = 48`: quadrado = 12, largo = 24, cheio = 48. Mudar
  // `GRID_COLUMNS` reflowa o layout inteiro sozinho, e a proporção pedida na
  // §1.8 (1 : 2 : 1 na linha de cima, largura total abaixo) continua valendo
  // em qualquer resolução.
  //
  // Não há mais `+ PANEL_GAP_PX` em lugar nenhum: o gap entre células é
  // responsabilidade da grade, que o aplica entre todos os blocos por igual.
  // Somar gap na posição E separar por margem na grade era a mesma ideia
  // escrita duas vezes — e as duas cópias divergiriam assim que um gap
  // mudasse.
  // ─────────────────────────────────────────────────────────────────────────
  const square = DEFAULT_PANEL_SQUARE_CELLS;
  const wide = DEFAULT_PANEL_SQUARE_CELLS * 2;
  const full = GRID_COLUMNS;
  const row = DEFAULT_PANEL_ROW_CELLS;

  const base: PanelLayout[] = [
    {
      panelId: "profile",
      x: 0,
      y: 0,
      w: square,
      h: square,
      visible: true,
      order: 0,
    },
    {
      panelId: "inventory",
      x: square,
      y: 0,
      w: wide,
      h: Math.max(square, 24),
      visible: true,
      order: 1,
    },
    {
      panelId: "roll-result",
      x: square + wide,
      y: 0,
      w: square,
      h: Math.max(square, 20),
      visible: true,
      order: 2,
    },
    {
      panelId: "attributes",
      x: 0,
      y: Math.max(square, 24),
      w: full,
      h: row,
      visible: true,
      order: 3,
    },
    {
      panelId: "skills",
      x: 0,
      y: Math.max(square, 24) + row,
      w: full,
      h: row,
      visible: true,
      order: 4,
    },
  ];

  const overrides = new Map(
    (template?.layout ?? []).map((override) => [override.panelId, override]),
  );

  return base.map((panel) => {
    const override = overrides.get(panel.panelId);
    if (!override) return panel;
    return {
      ...panel,
      visible: override.visible ?? panel.visible,
      order: override.order ?? panel.order,
      w: override.w ?? panel.w,
      h: override.h ?? panel.h,
    };
  });
}

/**
 * Monta os atributos iniciais do modelo.
 *
 * Os ids são gerados aqui, e o mapa `chave -> id` é devolvido para que as
 * perícias possam apontar para o atributo certo — é este vínculo que faz
 * "Percepção soma Sabedoria" funcionar (ponto em aberto 14.2).
 */
function buildAttributes(template: SystemTemplate | null): {
  attributes: Sheet["attributes"];
  idsByKey: Map<string, string>;
} {
  const idsByKey = new Map<string, string>();

  const attributes = (template?.attributes ?? []).map((seed) => {
    const id = generateId();
    idsByKey.set(seed.key, id);
    return AttributeSchema.parse({
      id,
      name: seed.name,
      value: seed.value,
      color: null,
    });
  });

  return { attributes, idsByKey };
}

/**
 * Monta as perícias iniciais do modelo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O MODELO AINDA DECLARA `attributeKey`, E NÃO É USADO AQUI
 *
 * `SystemTemplate.skills[].attributeKey` continua existindo nos
 * `config/systems/*` — é a SUGESTÃO de qual atributo combina com a perícia, e
 * serve para sugerir a opção mais provável no menu de rolagem. A ficha, porém,
 * NÃO guarda o vínculo: desde o adendo, o jogador escolhe no menu, a cada
 * rolagem.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISSO NÃO É UM VÍNCULO FIXO DISFARÇADO
 * Guardar o vínculo "padrão" da v1 criaria um segundo lugar onde a escolha
 * acontece: o jogador ajustaria no modo editar e o menu usaria outra coisa,
 * sem ele saber qual manda. A aritmética fica em `domain/rolls`, que recebe
 * o atributo ESCOLHIDO como argumento.
 */
function buildSkills(template: SystemTemplate | null): Sheet["skills"] {
  return (template?.skills ?? []).map((seed) =>
    SkillSchema.parse({
      id: generateId(),
      name: seed.name,
      value: seed.value,
      color: null,
    }),
  );
}

/**
 * Cria uma ficha em BRANCO, ignorando o modelo escolhido.
 *
 * É o que acontece quando o `templateId` não é encontrado — por exemplo, numa
 * ficha importada de outra versão do app. Ficha vazia é melhor do que tela
 * quebrada.
 */
export function createBlankSheet(input: CreateSheetInput): Sheet {
  return assembleSheet(input, null);
}

/**
 * Cria uma ficha a partir do modelo (template) do sistema.
 *
 * É esta a função usada pelo repositório em `createSheet`.
 */
export function createSheet(input: CreateSheetInput): Sheet {
  return assembleSheet(input, getTemplate(input.system, input.templateId));
}

/** Monta e valida a ficha. Único ponto onde `schemaVersion` é aplicado. */
function assembleSheet(
  input: CreateSheetInput,
  template: SystemTemplate | null,
): Sheet {
  const now = new Date().toISOString();
  const { attributes } = buildAttributes(template);
  const skills = buildSkills(template);

  const base: Record<string, unknown> = {
    id: generateId(),
    ownerId: null,
    // A versão vem da CONSTANTE, nunca de um número solto: é ela que decide
    // quais migrações o repositório vai rodar ao ler este documento de volta.
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    name: input.name,
    title: input.title || input.name,
    system: input.system,
    templateId: template?.id ?? input.templateId,
    profile: { photo: null, slots: buildProfileSlots(template) },
    attributes,
    skills,
    inventory: {
      // A aba Armas começa com UMA linha genérica (seção 8.2.1).
      weapons: [
        {
          id: generateId(),
          name: "",
          die: DEFAULT_DIE_TYPE,
          diceCount: DEFAULT_DICE_COUNT,
          attackBonus: 0,
          attributeIds: [],
          color: null,
          itemId: null,
          isItem: false,
        },
      ],
      items: [],
      money: { label: DEFAULT_MONEY_LABEL, value: DEFAULT_MONEY_VALUE },
      carryCapacity: DEFAULT_CARRY_CAPACITY,
    },
    extraPanels: [],
    layout: buildDefaultLayout(template),
    rollHistory: [],
    settings: { sellEnabled: false },
  };

  // A ficha JÁ NASCE na versão atual, então a cadeia de migrações não tem
  // nada a fazer aqui. Ela fica por segurança: se alguém criar a base já com
  // `SCHEMA_VERSION` antigo, o documento ainda sai íntegro.
  let document: unknown = base;

  // `id` e timestamps são sempre os desta criação, mesmo se uma migração os
  // tiver tocado por engano.
  document = {
    ...(document as object),
    id: base.id,
    createdAt: now,
    updatedAt: now,
  };

  return SheetSchema.parse(document);
}

/** Reduz uma ficha ao resumo usado na tela de listagem. */
export function toSheetSummary(sheet: Sheet): SheetSummary {
  return {
    id: sheet.id,
    title: sheet.title || sheet.name,
    name: sheet.name,
    system: sheet.system,
    templateId: sheet.templateId,
    schemaVersion: sheet.schemaVersion,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
  };
}
