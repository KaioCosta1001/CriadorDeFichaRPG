import {
  LAYOUT_MIGRATION_REFERENCE_WIDTH_PX,
  SCHEMA_VERSION,
  cellSize,
  pxToCells,
} from "@/config/constants";
import type { PanelType } from "@/config/panelTypes";
import {
  DEFAULT_PROFILE_SLOTS,
  LEGACY_PROFILE_SLOT_POSITIONS,
} from "@/config/profileSlots";
import { ProfileSlotSchema, type PanelLayout } from "@/schemas";

import { normalizeLayout } from "./layout";

/**
 * MOTOR DE MIGRAÇÃO (seção 5.8)
 * =============================================================================
 *
 * REGRA: "dados antigos devem ser migrados, nunca descartados silenciosamente".
 *
 * COMO FUNCIONA
 * Cada documento persistido carrega `schemaVersion`. Ao ler:
 *   1. Descobrimos a versão declarada (`v`).
 *   2. Aplicamos, em ordem, `MIGRATIONS[v]`, `MIGRATIONS[v + 1]`… até
 *      chegar em `SCHEMA_VERSION`.
 *   3. Só então validamos com o schema atual.
 *
 * COMO ADICIONAR UMA MIGRAÇÃO (ex.: ao mudar o formato na versão 2)
 *   1. Suba `SCHEMA_VERSION` para 2 em `config/constants.ts`.
 *   2. Escreva a função que transforma um documento v1 em v2:
 *
 *      ```ts
 *      const migrateV1toV2: Migration = (doc) => {
 *        // `doc` é `unknown`: não confie no formato. Devolva um objeto NOVO.
 *        return { ...(doc as object), newField: 0 };
 *      };
 *      ```
 *
 *   3. Registre: `MIGRATIONS[1] = migrateV1toV2;`
 *   4. Escreva um teste em `migrations.test.ts` partindo de um documento v1.
 *
 * REGRAS PARA ESQUEMA DAS FUNÇÕES
 *  - Recebem e devolvem `unknown`. Se a entrada não tem a forma esperada,
 *    devolva a entrada sem alterações (a validação final vai rejeitar e
 *    mandar para a quarentena — é melhor do que lançar).
 *  - NUNCA lançue e NUNCA descartem dados.
 *  - Devolva sempre um objeto novo; não mute o argumento.
 */

/** Transforma um documento de uma versão para a imediatamente seguinte. */
export type Migration = (document: unknown) => unknown;

/**
 * Registro de migrações, indexado pela versão DE ORIGEM.
 *
 * A v1 → v2 remove o vínculo fixo `Skill.attributeId` e remolda o registro
 * de rolagem. A v2 → v3 converte o layout de px para células. Ver abaixo.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
  4: migrateV4toV5,
};

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v3 → v4 — O PERFIL GANHA OS QUATRO CANTOS (adendo §2)                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Antes o Perfil tinha três slots: CA no superior esquerdo, PV no superior
 * direito e um "extra" sem nome no inferior esquerdo. O adendo §2 pede quatro,
 * com a foto ao centro:
 *
 *   CA (superior esq.)   extra (superior dir., desligado)
 *   Sanidade (inferior esq., desligada)
 *   PV (inferior dir.)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * REPOSICIONAR, NÃO RECRIAR
 *
 * O `id` do slot é o que preserva o rótulo e o valor digitados pelo jogador
 * (§8.1). Descartar os slots e recriá-los nos cantos novos zeraria "Sanidade:
 * 45" — e o usuário perderia dados por causa de uma mudança visual.
 *
 * Então o MESMO objeto é movido: mesmo `id`, mesmo `label`, mesmo `value`,
 * mesmo `max`. Só o `position` muda.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SÓ O QUE ESTÁ NO LUGAR ANTIGO MUDA
 *
 * A migração compara com `LEGACY_PROFILE_SLOT_POSITIONS` antes de mover. Um
 * slot que já estava fora do lugar — porque um modelo de sistema o pôs ali —
 * é deixado como está.
 *
 * Sem essa checagem, a migração jogaria para o canto um slot que um sistema
 * posicionou de propósito.
 * ───────────────────────────────────────────────────────────────────────────
 */
function migrateV3toV4(document: unknown): unknown {
  if (typeof document !== "object" || document === null) return document;
  const source = document as Record<string, unknown>;

  const profile = source.profile;
  if (typeof profile !== "object" || profile === null) return document;

  const slots = (profile as Record<string, unknown>).slots;
  if (!Array.isArray(slots)) return document;

  const alvos = new Map(
    DEFAULT_PROFILE_SLOTS.map((slot) => [slot.id, slot] as const),
  );

  const reposicionados = slots.map((entrada) => {
    if (typeof entrada !== "object" || entrada === null) return entrada;
    const slot = entrada as Record<string, unknown>;

    const id = typeof slot.id === "string" ? slot.id : "";
    const legado = LEGACY_PROFILE_SLOT_POSITIONS[id];
    const alvo = alvos.get(id);

    // Só move quem está exatamente onde o padrão antigo punha.
    if (!legado || !alvo || slot.position !== legado) return slot;

    return { ...slot, position: alvo.position };
  });

  // O slot de Sanidade é NOVO: nenhuma ficha antiga o tem. Cria-se desligado,
  // porque nem todo sistema tem esse campo — e um orbe vazio ocupa o mesmo
  // espaço que um preenchido, e se lê como "faltou preencher".
  const temSanidade = reposicionados.some(
    (entrada) =>
      typeof entrada === "object" &&
      entrada !== null &&
      (entrada as Record<string, unknown>).id === "slot-sanidade",
  );

  const finais = temSanidade
    ? reposicionados
    : [
        ...reposicionados,
        ProfileSlotSchema.parse({
          id: "slot-sanidade",
          position: "bottom-left",
          enabled: false,
          label: "Sanidade",
          value: "",
          max: null,
          orbRole: null,
        }),
      ];

  return {
    ...source,
    profile: { ...(profile as Record<string, unknown>), slots: finais },
  };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v2 → v3 — O LAYOUT PASSA DE PIXELS PARA CÉLULAS (adendo §1)              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A v2 guardava `x`, `y`, `w` e `h` em PIXELS livres, com snap de 5 px. A v3
 * guarda CÉLULAS inteiras, com grade de `GRID_COLUMNS` colunas. O layout
 * gravado pelo usuário precisa sobreviver à troca.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A CONVERSÃO USA UMA LARGURA DE REFERÊNCIA
 *
 * Uma célula mede uma FRAÇÃO da largura do container, e a migração roda sem
 * DOM — não existe container para medir. Usamos
 * `LAYOUT_MIGRATION_REFERENCE_WIDTH_PX`, que é a largura máxima que a grade
 * ocupa (`max-w-[1600px]` de `SheetScreen`).
 *
 * A conversão é portanto APROXIMADA: numa tela estreita os blocos podem ficar
 * proporcionalmente maiores. Isso é aceitável por dois motivos:
 *
 *  1. a §1.7 pede "tamanhos aproximados" ao migrar layout antigo;
 *  2. o resultado termina normalizado por `normalizeLayout`, que remove
 *     sobreposição e aplica os limites por tipo. O usuário nunca chega a ver
 *     um layout convertido torto — e o `Resetar layout` dá o arranjo exato a
 *     qualquer momento.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO DESCARTAR O LAYOUT
 *
 * "layouts antigos devem ser migrados, nunca descartados" (§5.8). Descartar o
 * layout jogaria fora o arranjo que o usuário montou à mão — que é a única
 * coisa que a migração precisa preservar. Preferimos um layout aproximado ao
 * layout padrão.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `visible` E `order` SÃO COPIADOS SEM TOQUE
 *
 * Eles não têm unidade: o bloco continua escondido ou visível, na mesma
 * posição da fila. Só o que mede distância é convertido.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A MIGRAÇÃO TERMINA NORMALIZADA
 *
 * Converter px para célula é ARREDONDAR, e arredondar cria colisões. Dois
 * blocos que em px estavam separados por 4 px podem cair na MESMA célula — e a
 * ficha abriria com os dois empilhados, o de baixo intocável.
 *
 * A conversão por si só não resolve isso, porque ela só conhece geometria.
 * Por isso a migração chama `normalizeLayout` no fim: é a mesma barreira que
 * a grade usa na carga, e é ela que garante a invariante "nenhum bloco
 * sobrepõe outro" num arquivo vindo de outra versão.
 * ───────────────────────────────────────────────────────────────────────────
 */
function migrateV2toV3(document: unknown): unknown {
  if (typeof document !== "object" || document === null) return document;
  const source = document as Record<string, unknown>;

  if (!Array.isArray(source.layout)) return document;

  const { w: cellW, h: cellH } = cellSize(LAYOUT_MIGRATION_REFERENCE_WIDTH_PX);

  const convertidos = source.layout.map((panel) => {
    if (typeof panel !== "object" || panel === null) return panel;
    const p = panel as Record<string, unknown>;

    return {
      ...p,
      x: pxToCells(Number(p.x) || 0, cellW) - 1,
      y: pxToCells(Number(p.y) || 0, cellH) - 1,
      w: pxToCells(Number(p.w) || 0, cellW),
      h: pxToCells(Number(p.h) || 0, cellH),
    };
  });

  // O resolvedor de tipo é montado AQUI, do próprio documento, porque a
  // migração recebe `unknown` e não tem um `Sheet` tipado em mãos.
  const extras = Array.isArray(source.extraPanels)
    ? (source.extraPanels as { id?: unknown; type?: unknown }[])
    : [];

  return {
    ...source,
    layout: normalizeLayout(convertidos as PanelLayout[], (panelId) => {
      if (!panelId.startsWith("extra:")) return panelId as PanelType;
      const extraId = panelId.slice("extra:".length);
      const match = extras.find((extra) => extra.id === extraId);
      return (match?.type as PanelType | undefined) ?? null;
    }),
  };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v1 → v2 — ADENDO DE ROLAGEM POR CLIQUE DIREITO                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Faz duas coisas, sem perder nada:
 *
 *  1. **Some `Skill.attributeId`.** A rolagem passa a escolher o atributo na
 *     hora (menu de clique direito). A migração APAGA o vínculo em vez de
 *     transformá-lo em atributo padrão, porque não existe equivalente fiel:
 *     a v1 guardava um vínculo FIXO e único, e a v2 permite escolher um
 *     diferente a cada rolagem. Guardar o antigo como "preferido" criaria um
 *     segundo lugar onde a escolha acontece — que é exatamente o problema que
 *     a mudança resolveu.
 *
 *  2. **Remolda `RollRecord`.** A estrutura antiga tinha `source`,
 *     `sourceName`, `attributeContributions` e `bonuses`; a nova tem `kind`,
 *     `label` e uma lista única de `components`. A conversão é fiel: as
 *     contribuições dos atributos e os bônus viram parcelas na mesma ordem.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO DESCARTAR O HISTÓRICO
 * "dados antigos devem ser migrados, nunca descartados silenciosamente"
 * (§5.8). Um jogador com três rolagens guardadas continua vendo as três — e o
 * detalhamento delas continua correto, porque o que importa (quanto cada
 * parcela somou) é preservado. O que se perde é o valor BRUTO do atributo
 * (`rawValue`), que não aparece em lugar nenhum da interface.
 * ───────────────────────────────────────────────────────────────────────────
 */
function migrateV1toV2(document: unknown): unknown {
  if (typeof document !== "object" || document === null) return document;
  const source = document as Record<string, unknown>;

  const next: Record<string, unknown> = { ...source };

  if (Array.isArray(source.skills)) {
    next.skills = source.skills.map((skill) => {
      if (typeof skill !== "object" || skill === null) return skill;
      const { attributeId: _removido, ...resto } = skill as Record<
        string,
        unknown
      >;
      return resto;
    });
  }

  if (Array.isArray(source.rollHistory)) {
    next.rollHistory = source.rollHistory.map(migrateRollRecord);
  }

  return next;
}

/** Converte um registro v1 para o formato v2. */
function migrateRollRecord(entry: unknown): unknown {
  if (typeof entry !== "object" || entry === null) return entry;
  const old = entry as Record<string, unknown>;

  const components: { label: string; value: number }[] = [];

  if (Array.isArray(old.attributeContributions)) {
    for (const item of old.attributeContributions) {
      if (typeof item !== "object" || item === null) continue;
      const source = item as Record<string, unknown>;
      const label =
        typeof source.attributeName === "string" ? source.attributeName : "";
      const value =
        typeof source.contribution === "number" ? source.contribution : 0;
      if (label) components.push({ label, value });
    }
  }

  if (Array.isArray(old.bonuses)) {
    for (const item of old.bonuses) {
      if (typeof item !== "object" || item === null) continue;
      const source = item as Record<string, unknown>;
      const label = typeof source.label === "string" ? source.label : "";
      const value = typeof source.value === "number" ? source.value : 0;
      if (label) components.push({ label, value });
    }
  }

  const label =
    typeof old.sourceName === "string" && old.sourceName
      ? old.sourceName
      : "Rolagem";

  return {
    id: old.id,
    rolledAt: old.rolledAt,
    kind: old.source === "weapon" ? "weapon" : "skill",
    label,
    die: old.die,
    dice: Array.isArray(old.dice) ? old.dice : [],
    components,
    total: typeof old.total === "number" ? old.total : 0,
    sourceId: typeof old.sourceId === "string" ? old.sourceId : null,
  };
}

/** Resultado de uma tentativa de migração. */
export type MigrationResult =
  | {
      status: "ok";
      document: unknown;
      /** Versões efetivamente aplicadas, em ordem. */
      applied: number[];
    }
  /** Documento de uma versão MAIS NOVA que a deste app (ex.: aberto em outro ambiente). */
  | { status: "too-new"; declared: number }
  /** Impossível determinar a versão declarada. */
  | { status: "unknown-version"; declared: unknown };

/** Lê `schemaVersion` de um documento sem confiar no formato. */
function readDeclaredVersion(document: unknown): unknown {
  if (typeof document !== "object" || document === null) return undefined;
  const value = (document as Record<string, unknown>).schemaVersion;
  return value;
}

/**
 * Executa a cadeia de migrações até a versão atual.
 *
 * Não valida: isso é responsabilidade do schema, chamado logo em seguida
 * pelo repositório. Separar as responsabilidades deixa o motor testável sem
 * precisar montar uma ficha inteira.
 *
 * @param document Documento cru, vindo do storage ou de um JSON importado.
 * @param targetVersion Versão de destino. Existe para os TESTES: como
 *   `SCHEMA_VERSION` é 1 enquanto não há formato anterior, só dá para
 *   exercitar a cadeia passando explicitamente uma versão-alvo maior.
 */
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  v4 → v5 — BLOCO DE LISTA GANHA O CAMPO "NÚMERO" (adendo §8)             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O bloco de lista personalizado ganha um campo `number` em cada linha,
 * além do `name` que já existia. A migração garante que entradas antigas
 * (sem o campo) recebam `number: 0` — o default do schema — sem perder o
 * `name` ou a `color`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O DEFAULT DO SCHEMA NÃO BASTA
 *
 * O schema tem `.default(0)` no campo `number`, que aplica o default quando
 * o campo está ausente. Mas a migração é quem garante que o documento
 * inteiro passe pelo schema SEM ir para a quarentena — e um `number`
 * ausente num documento v4 seria silenciosamente preenchido, mas um
 * documento corrompido (com `number: "abc"`) seria rejeitado.
 *
 * A migração não tenta consertar valor inválido — só garante a presença.
 * Valores inválidos caem no `normalizeLayout` da grade, não aqui.
 * ───────────────────────────────────────────────────────────────────────────
 */
function migrateV4toV5(document: unknown): unknown {
  if (typeof document !== "object" || document === null) return document;
  const source = document as Record<string, unknown>;

  if (!Array.isArray(source.extraPanels)) return document;

  return {
    ...source,
    extraPanels: source.extraPanels.map((panel) => {
      if (typeof panel !== "object" || panel === null) return panel;
      const p = panel as Record<string, unknown>;

      // Só blocos do tipo "list" têm entradas.
      if (p.type !== "list" || !Array.isArray(p.entries)) return p;

      return {
        ...p,
        entries: p.entries.map((entry) => {
          if (typeof entry !== "object" || entry === null) return entry;
          const e = entry as Record<string, unknown>;
          // Campos antigos são preservados; o `number` é acrescentado se
          // faltar. Um valor já presente é respeitado — não sobrescreve.
          return {
            ...e,
            number: typeof e.number === "number" ? e.number : 0,
          };
        }),
      };
    }),
  };
}

export function migrateDocument(
  document: unknown,
  targetVersion: number = SCHEMA_VERSION,
): MigrationResult {
  const declared = readDeclaredVersion(document);

  // Documento sem `schemaVersion`: tratado como versão 1 (o formato mais
  // antigo que já existiu). Se ele nem validar, vai para a quarentena.
  const from =
    typeof declared === "number" && Number.isInteger(declared) && declared >= 1
      ? declared
      : 1;

  if (from > targetVersion) {
    // NÃO tentamos adivinhar o formato de um app mais novo — isso corromperia
    // os dados. Devolvemos o erro e o repositório manda para a quarentena.
    return { status: "too-new", declared: from };
  }

  let current = document;
  const applied: number[] = [];

  for (let version = from; version < targetVersion; version += 1) {
    const migration = MIGRATIONS[version];
    if (!migration) continue; // sem migração registrada: nada a fazer
    current = migration(current);
    applied.push(version);
  }

  return { status: "ok", document: current, applied };
}
