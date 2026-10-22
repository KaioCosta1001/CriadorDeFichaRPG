import {
  ATTRIBUTE_ROLL_ADDS_CONTRIBUTION,
  ROLL_BASE_DIE,
  ROLL_HISTORY_LIMIT,
} from "@/config/constants";
import type { RpgSystem } from "@/config/systems/types";
import type { Attribute, RollRecord, Skill, Weapon } from "@/schemas";

import { parseDieFaces, rollDice, rollDie, type Rng } from "./dice";
import { formatSigned } from "./stats";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  MONTAGEM DAS ROLAGENS (clique direito — adendo)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Converte "usuário pediu para rolar X" em um `RollRecord` pronto para o
 * histórico. Três tipos de rolagem, UMA estrutura — é o que permite o tooltip
 * e o histórico funcionarem sem uma linha de código por tipo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ARITMÉTICA
 *   perícia seca ......... d20 + valor da perícia
 *   perícia + atributo ... d20 + valor da perícia + contribuição do atributo
 *   atributo ............. d20 + contribuição do atributo
 *
 * A "contribuição" é o que a estratégia do sistema devolve — a MESMA função
 * que a arma usa (ponto em aberto 14.1). Nada aqui conhece o jogo: quem sabe
 * que D&D converte `(valor - 10) / 2` é `config/systems/dnd5e.ts`.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Rótulo da parcela do valor da perícia. */
const SKILL_COMPONENT_LABEL = "perícia";

/** Rótulo da parcela do valor do atributo numa rolagem só de atributo. */
const ATTRIBUTE_COMPONENT_LABEL = "atributo";

/**
 * O mínimo de uma perícia que uma rolagem precisa.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO `Skill`
 * `Skill` carrega `color`, que não entra em conta nenhuma na aritmética.
 * Declarar o mínimo aqui deixa o erro de "esqueci um campo" impossível por
 * construção: se a rolagem precisar de `value` um dia, o tipo passa a exigir.
 */
export type RollableSkill = Pick<Skill, "id" | "name" | "value">;

/** O mínimo de um atributo que uma rolagem precisa. */
export type RollableAttribute = Pick<Attribute, "id" | "name" | "value">;

/** Dependências injetáveis — é o que torna tudo testável sem sortear nada. */
export interface RollDependencies {
  /** Estratégia do sistema da ficha. `null` = ficha sem sistema carregado. */
  system: RpgSystem | null;
  /** Gerador de aleatoriedade. Injetado para dar resultado determinístico. */
  rng?: Rng;
  /** Gerador de id do registro. */
  makeId?: () => string;
  /** Relógio. Devolve a data em ISO, como `new Date().toISOString()`. */
  now?: () => string;
}

interface ResolvedDependencies {
  system: RpgSystem | null;
  rng: Rng;
  makeId: () => string;
  now: () => string;
}

function resolve(dependencies: RollDependencies): ResolvedDependencies {
  return {
    system: dependencies.system,
    rng: dependencies.rng ?? Math.random,
    makeId: dependencies.makeId ?? defaultMakeId,
    now: dependencies.now ?? defaultNow,
  };
}

function defaultMakeId(): string {
  return `roll-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultNow(): string {
  return new Date().toISOString();
}

/** Monta o registro a partir das parcelas já calculadas. */
function build(
  kind: RollRecord["kind"],
  label: string,
  dieValue: number,
  components: { label: string; value: number }[],
  sourceId: string,
  deps: ResolvedDependencies,
): RollRecord {
  return {
    id: deps.makeId(),
    rolledAt: deps.now(),
    kind,
    label,
    die: `d${ROLL_BASE_DIE}`,
    dice: [dieValue],
    components: components.map((component) => ({ ...component })),
    total: [dieValue, ...components.map((c) => c.value)].reduce(
      (sum, value) => sum + value,
      0,
    ),
    sourceId,
  };
}

/**
 * Quanto o atributo soma, pela estratégia do sistema.
 *
 * `null` quando não há sistema (ficha sem sistema carregado) — somar zero é
 * melhor do que lançar no meio de um clique.
 */
export function attributeContribution(
  attribute: Pick<Attribute, "value">,
  system: RpgSystem | null,
): number {
  if (!system) return 0;
  const value = system.attributeContribution(attribute.value, {
    systemId: system.id,
    kind: "skill",
  });
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/**
 * Rola uma perícia SEM atributo: `d20 + valor da perícia`.
 *
 * O rótulo guardado é `"Furtividade (seca)"` — o "(seca)" viaja no dado para
 * que o resultado e o histórico não precisem saber quando aplicá-lo.
 */
export function rollSkillDry(
  skill: RollableSkill,
  dependencies: RollDependencies,
): RollRecord {
  const deps = resolve(dependencies);
  return build(
    "skill",
    `${skill.name} (Puro)`,
    rollDie(ROLL_BASE_DIE, deps.rng),
    [{ label: SKILL_COMPONENT_LABEL, value: skill.value }],
    skill.id,
    deps,
  );
}

/**
 * Rola uma perícia COM um atributo escolhido no momento:
 * `d20 + perícia + contribuição do atributo`.
 */
export function rollSkillWithAttribute(
  skill: RollableSkill,
  attribute: RollableAttribute,
  dependencies: RollDependencies,
): RollRecord {
  const deps = resolve(dependencies);
  return build(
    "skill",
    `${skill.name} + ${attribute.name}`,
    rollDie(ROLL_BASE_DIE, deps.rng),
    [
      { label: SKILL_COMPONENT_LABEL, value: skill.value },
      {
        label: attribute.name,
        value: attributeContribution(attribute, deps.system),
      },
    ],
    skill.id,
    deps,
  );
}

/**
 * Rola um atributo: `d20 + contribuição do atributo`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PONTO EM ABERTO Nº 1
 * `ATTRIBUTE_ROLL_ADDS_CONTRIBUTION` decide se a parcela entra. Desligar a flag
 * em `constants.ts` deixa o registro como `d20 puro` — e o teste que cobre
 * esta função lê a mesma constante, então a troca de padrão aparece como
 * FALHA DE TESTE, e não como um resultado silenciosamente diferente.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function rollAttribute(
  attribute: RollableAttribute,
  dependencies: RollDependencies,
): RollRecord {
  const deps = resolve(dependencies);
  const contribution = ATTRIBUTE_ROLL_ADDS_CONTRIBUTION
    ? attributeContribution(attribute, deps.system)
    : 0;

  return build(
    "attribute",
    attribute.name,
    rollDie(ROLL_BASE_DIE, deps.rng),
    ATTRIBUTE_ROLL_ADDS_CONTRIBUTION
      ? [{ label: ATTRIBUTE_COMPONENT_LABEL, value: contribution }]
      : [],
    attribute.id,
    deps,
  );
}

/**
 * Rola uma arma: `diceCount` dados independentes + ataque + atributos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ⚠️ §8.2.1 — `2d20` NÃO MULTIPLICA O VALOR DO DADO
 *
 * `diceCount` = 2 significa "sorteie dois d20 independentes e some". Nunca
 * "o dobro de um d20". Quem interpreta isso é ESTA função, e é a única que
 * multiplica dados — `rollSkill` e `rollAttribute` rolam exatamente um, como
 * o adendo determina.
 *
 * A diferença aparece já na primeira rolagem: dois d20 somam de 2 a 40 com
 * peso triangular (o 11 é bem mais comum que o 2), enquanto "o dobro" daria
 * uma distribuição chata. O jogador sentiria a diferença sem saber dizer
 * qual das duas está vendo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A SOMA DOS ATRIBUTOS (ponto em aberto 14.4)
 * Vários atributos são permitidos e TODOS contribuem, somados. A ordem
 * deles no vetor é a ordem de exibição do detalhamento.
 */
export function rollWeapon(
  weapon: Pick<Weapon, "id" | "name" | "die" | "diceCount" | "attackBonus">,
  attributeIds: readonly string[],
  attributes: readonly Attribute[],
  dependencies: RollDependencies,
): RollRecord {
  const deps = resolve(dependencies);
  const faces = parseDieFaces(weapon.die);
  const dice = rollDice(weapon.diceCount, faces, deps.rng);

  const components: { label: string; value: number }[] = [];

  if (weapon.attackBonus !== 0) {
    components.push({ label: "Ataque", value: weapon.attackBonus });
  }

  for (const attributeId of attributeIds) {
    const attribute = attributes.find((item) => item.id === attributeId);
    // Atributo órfão é PULADO, não mostrado como "-5": o jogador veria uma
    // parcela que não consegue relacionar com nada na ficha.
    if (!attribute) continue;

    components.push({
      label: attribute.name || "Atributo",
      value: attributeContribution(attribute, deps.system),
    });
  }

  return {
    id: deps.makeId(),
    rolledAt: deps.now(),
    kind: "weapon",
    label: weapon.name || "Arma",
    die: weapon.die,
    dice,
    components,
    total: [...dice, ...components.map((c) => c.value)].reduce(
      (sum, value) => sum + value,
      0,
    ),
    sourceId: weapon.id,
  };
}

/**
 * A rolagem acertou um natural 20?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * OLHA O DADO, NÃO O TOTAL — E É POR ISSO QUE ESTÁ AQUI
 *
 * Um `d20 [20]` com um modificador de `-5` dá total 15. Chamar aquilo de
 * crítico mentiria duas vezes: o número mostrado não é 20 e o jogador não
 * critou. O que o sistema chama de crítico é o DADO, não a soma.
 *
 * E arma nunca é crítica: `3d20` pode mostrar `[20]`, mas os outros dois dados
 * também contam. Sem esta exclusão, uma espada apareceria com "Natural 20".
 * ───────────────────────────────────────────────────────────────────────────
 */
export function isCritRoll(record: RollRecord): boolean {
  return record.kind !== "weapon" && record.dice[0] === 20;
}

/** A rolagem tirou natural 1? Mesmas duas regras de {@link isCritRoll}. */
export function isFumbleRoll(record: RollRecord): boolean {
  return record.kind !== "weapon" && record.dice[0] === 1;
}

/**
 * A frase que o LEITOR DE TELA lê quando a rolagem chega.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ELA EXISTE SEPARADA DA FRASE VISÍVEL
 *
 * O texto na tela usa notação de RPG: `d20 [14] + perícia (+3) = 17`. Um
 * leitor de tela lê isso letra por letra e o jogador não sabe se "17" é o
 * resultado ou um dos números. A frase falada é outra coisa, com o resultado
 * PRIMEIRO e a conta depois — é a ordem em que a pessoa precisa da informação.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE TEXTO NÃO VIVE DENTRO DO MENU
 *
 * Porque o menu é desmontado no mesmo instante da rolagem. Uma região
 * `aria-live` só anuncia quando o TEXTO MUDA dentro dela; se o nó inteiro
 * sai da árvore junto com o conteúdo, o leitor de tela não tem o que ler. Era
 * exatamente o que acontecia: o anúncio estava no componente certo, na região
 * errada. Quem anuncia é o bloco de resultado, que fica.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function announceRoll(record: RollRecord): string {
  const partes = [`${record.label}: resultado ${record.total}.`];

  if (isCritRoll(record)) partes.push("Crítico: natural 20.");
  else if (isFumbleRoll(record)) partes.push("Falha crítica: natural 1.");

  // O detalhamento só entra se houver o que detalhar.
  //
  // "Cálculo: 14." sozinho não acrescenta nada ao total já dito — por isso o
  // caso da perícia sem modificador é omitido. MAS com VÁRIOS dados a conta é
  // justamente o que interessa: ouvir "40" sem "20, 4 e 11" não diz quantos
  // sorteios houve nem se algum deles foi um 20.
  //
  // `formatSigned` em vez de montar o sinal à mão: é a mesma função que escreve
  // o `+3` na tela, e assim a frase falada e a visível não divergem em um
  // único caso — o menos, que é o que mais importa acertar.
  const parcelas = record.components
    .filter((component) => component.value !== 0)
    .map((component) => `${component.label} ${formatSigned(component.value)}`);

  if (parcelas.length > 0 || record.dice.length > 1) {
    // A conjunção vai por conta própria: "20, 4, 11" numa lista de três lida
    // em voz alta obriga a pessoa a guardar as três para depois somar, e
    // "20, 4 e 11" é uma unidade.
    const sorteios =
      record.dice.length > 1
        ? `${record.dice.slice(0, -1).join(", ")} e ${record.dice.at(-1)}`
        : String(record.dice[0] ?? 0);

    const termos =
      parcelas.length > 0
        ? `${sorteios} mais ${parcelas.join(", ")}`
        : sorteios;

    partes.push(`Cálculo: ${termos}.`);
  }

  return partes.join(" ");
}

/**
 * O detalhamento em texto, usado no tooltip e no histórico.
 *
 * `"Furtividade + Destreza: d20 [14] + perícia (+3) + Destreza (+2) = 19"`
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE MONTAR A FRASE AQUI E NÃO NO COMPONENTE
 * É a mesma frase nos três tipos de rolagem; só muda o conteúdo da lista de
 * parcelas. Deixar a montagem no componente faria o tooltip do resultado e a
 * linha do histórico montarem a string de jeitos ligeiramente diferentes —
 * o tipo de divergência que ninguém percebe até alguém comparar as duas.
 *
 * Para arma com vários dados, cada um vai entre colchetes:
 * `"3d20 [18] [4] [11] + Ataque (+5) = 39"`. A lista deixa claro que foram
 * três sorteios — é o que distingue "sortei três vezes" de "somei três vezes".
 * ───────────────────────────────────────────────────────────────────────────
 */
export function describeRoll(record: RollRecord): string {
  // Ficha importada de outra versão pode trazer registro sem `dice`. Sem o
  // fallback, a frase sairia `d20  = 0`, com um espaço duplo e nenhum número
  // — o que o jogador leria como um dado em branco.
  const sorteios =
    record.dice.length > 0
      ? record.dice.map((value) => `[${value}]`).join(" ")
      : "[0]";

  const parts = [`${record.die} ${sorteios}`];

  for (const component of record.components) {
    // Parcela zerada é omitida: "+ perícia (+0)" fingiria um bônus.
    if (component.value === 0) continue;
    parts.push(`+ ${component.label} (${formatSigned(component.value)})`);
  }

  return `${record.label}: ${parts.join(" ")} = ${record.total}`;
}

/**
 * Insere a rolagem no histórico: mais recente primeiro, limitado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O LIMITE EXISTE
 * O histórico vive dentro da ficha, e a ficha inteira é serializada para o
 * `localStorage` numa cota de ~5 MB. Um histórico ilimitado transformaria um
 * uso normal (rolar muito) num `QuotaExceededError` que perde a ficha
 * inteira — o pior tipo de bug de persistência.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function pushRoll(
  history: readonly RollRecord[],
  record: RollRecord,
): RollRecord[] {
  return [record, ...history].slice(0, ROLL_HISTORY_LIMIT);
}
