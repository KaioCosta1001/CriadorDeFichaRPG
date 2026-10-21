import {
  ITEM_QUANTITY_MIN,
  ITEM_VALUE_MIN,
  MAX_ITEMS,
  MAX_WEAPONS,
} from "@/config/constants";
import type { Attribute, Inventory, Item, Weapon } from "@/schemas";
import { generateId } from "@/lib/id";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REGRAS DO INVENTÁRIO (seção 8.2)                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Funções puras — sem React, sem store. A interface só desenha o que estas
 * devolvem, e nada mais calcula peso, valor ou permissão de venda.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A REGRA MAIS IMPORTANTE: PESO ACIMA DA CAPACIDADE NÃO BLOQUEIA
 *
 * A §8.2 é explícita: o total acima da capacidade deixa o texto vermelho, mas
 * **não impede** a ação. Dois motivos práticos:
 *
 *  - o peso muda o tempo todo (o jogador joga, anota, esquece). Bloquear a
 *    edição porque a mochila "está cheia" transformaria o inventário num
 *    formulário que só aceita um estado, e o usuário passaria a anotar fora
 *    do app;
 *  - a capacidade é um número que o jogador ajusta conforme a ficha. Não é
 *    uma verdade do mundo que o app possa arbitrar.
 *
 * A cor vermelha é um AVISO, não uma trava. O único lugar com recusa real é
 * a venda em massa de favorito — e essa recusa existe para proteger trabalho
 * do usuário, não para arbitrar o jogo.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O PESO VIVE NOS ITENS, E SO NOS ITENS
 *
 * `Weapon.isItem` significa "esta arma também aparece como item na aba Itens"
 * — é a MESMA coisa vista de dois ângulos, não duas coisas. Se a arma
 * contasse no peso além do item, comprar uma espada mostraria 2 kg a mais a
 * cada compra.
 *
 * Consequência aceita: apagar o item zera a contribuição da arma. Isso é
 * correto do ponto de vista da fonte única da verdade — o peso é o do objeto
 * que o jogador carrega, e ele não existe mais. A alternativa (guardar peso
 * na arma) criaria dois números que discordam, e o jogador veria um peso que
 * muda sozinho ao trocar de aba.
 */

/** Resumo do peso da ficha. */
export interface CarrySummary {
  /** Peso total, já multiplicado pelas quantidades. */
  total: number;
  /** Limite configurado. */
  capacity: number;
  /** Quanto ainda cabe — nunca negativo. */
  remaining: number;
  /** `true` quando o peso passou da capacidade. */
  overweight: boolean;
  /** `0..1+` para a barra; acima de 1 a barra satura. */
  ratio: number;
}

/** Arredonda para duas casas, evitando `0.30000000000000004` na tela. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Peso total da ficha: `Σ (peso unitário × quantidade)` dos itens.
 *
 * Simples — e é essa simplicidade que garante que o número mostrado seja o peso
 * que o jogador somou de cabeça.
 */
export function computeCarryWeight(inventory: Inventory): number {
  return round2(
    inventory.items.reduce(
      (total, item) => total + item.weight * item.quantity,
      0,
    ),
  );
}

/** Resumo do peso, comparado à capacidade. */
export function summarizeCarry(inventory: Inventory): CarrySummary {
  const total = computeCarryWeight(inventory);
  const capacity = inventory.carryCapacity;

  return {
    total,
    capacity,
    // Mostrar "-3 kg disponíveis" seria pior do que mostrar 0: estourar a
    // capacidade é um aviso, não uma dívida.
    remaining: Math.max(0, round2(capacity - total)),
    overweight: total > capacity,
    // A razão SATURA em 1: a barra não tem como mostrar 1000%, e deixar o
    // clamp para o componente faria cada tela ter que lembrá-lo.
    ratio: capacity > 0 ? Math.min(1, total / capacity) : total > 0 ? 1 : 0,
  };
}

/**
 * Valor total em dinheiro dos itens.
 *
 * A arma não entra: ela tem o próprio `itemId`, e quem tem preço é o item.
 */
export function computeItemValue(items: readonly Item[]): number {
  return items.reduce((total, item) => total + item.value * item.quantity, 0);
}

/** A venda está disponível nesta ficha? (§11 — `Sheet.settings.sellEnabled`) */
export function canSell(sellEnabled: boolean): boolean {
  return sellEnabled;
}

/* ===========================================================================
 * VENDA
 * ========================================================================== */

/**
 * Itens que uma ação em massa pode tocar.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * FAVORITOS SÃO PROTEGIDOS (seção 8.2)
 * Uma ação em massa ("vender tudo") não pode levar o que o usuário marcou
 * como favorito. Sem isso, um clique distraído apagaria exatamente aquilo que
 * ele teve o cuidado de preservar.
 *
 * A proteção é do CONJUNTO, não do botão: um item só é alcançável se estiver
 * na lista. A venda individual de um favorito continua possível — pode ser
 * intencional ("já usei a Joia") — mas pede confirmação extra, decidido pelo
 * componente, que tem como fazer a pergunta.
 */
export function sellableItems(
  items: readonly Item[],
  sellEnabled: boolean,
): Item[] {
  if (!sellEnabled) return [];
  return items.filter((item) => !item.favorite);
}

/** Itens que ficariam de fora de uma ação em massa, para o aviso. */
export function protectedItems(items: readonly Item[]): Item[] {
  return items.filter((item) => item.favorite);
}

/** Um item pode ser vendido em massa? */
export function isMassSellable(item: Item, sellEnabled: boolean): boolean {
  return sellEnabled && !item.favorite;
}

/**
 * Venda em MASSA.
 *
 * Os favoritos são **ignorados**, não removidos. O retorno traz `kept` para
 * que a interface possa dizer quantos ficaram — sumir com o trabalho do
 * usuário em silêncio é o pior modo de "não vendi o favorito".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA FUNÇÃO E `sellSingleItem` SÃO SEPARADAS
 * "Vender tudo" e "vender este item" tratam o favorito de formas OPOSTAS, e
 * misturar os dois num parâmetro (`force?: boolean`) esconderia essa
 * diferença do maior ponto de chamada:
 *
 *   - em massa, o favorito é **inalcançável** (§8.2: protegido);
 *   - individual, ele é vendável **com confirmação** — pode ser
 *     intencional ("já usei a Joia") e só o componente pode perguntar.
 *
 * Uma função só, com um booleano, exigiria que TODO chamador lembrasse qual
 * verdade está usando. Duas funções, cada uma com uma verdade só.
 */
export function sellItems(
  inventory: Inventory,
  items: readonly Item[],
  sellEnabled: boolean,
): { inventory: Inventory; earned: number; kept: Item[] } {
  if (!sellEnabled) {
    return { inventory, earned: 0, kept: [...items] };
  }

  const sellable = new Set(sellableItems(items, sellEnabled).map((i) => i.id));
  const earned = items
    .filter((item) => sellable.has(item.id))
    .reduce((total, item) => total + item.value * item.quantity, 0);

  return {
    inventory: {
      ...inventory,
      items: inventory.items.filter((item) => !sellable.has(item.id)),
      money: { ...inventory.money, value: inventory.money.value + earned },
    },
    earned,
    kept: items.filter((item) => !sellable.has(item.id)),
  };
}

/**
 * Venda INDIVIDUAL de um item, favorito ou não.
 *
 * A proteção do favorito é contra ação em massa; um clique no botão "Vender"
 * da própria linha é intenção explícita. A confirmação é do componente, e vem
 * de `canSellIndividually` — aqui a regra é simples: vende.
 */
export function sellSingleItem(
  inventory: Inventory,
  item: Item,
  sellEnabled: boolean,
): { inventory: Inventory; earned: number } {
  if (!sellEnabled) return { inventory, earned: 0 };

  const earned = item.value * item.quantity;

  return {
    inventory: {
      ...inventory,
      items: inventory.items.filter((candidate) => candidate.id !== item.id),
      money: { ...inventory.money, value: inventory.money.value + earned },
    },
    earned,
  };
}

/** Um item pode ser vendido individualmente? (favorita pede confirmação) */
export function canSellIndividually(
  item: Item,
  sellEnabled: boolean,
): { allowed: boolean; needsConfirmation: boolean } {
  if (!sellEnabled) return { allowed: false, needsConfirmation: false };
  return {
    allowed: true,
    needsConfirmation: item.favorite,
  };
}

/* ===========================================================================
 * ARMAS E ITENS — INTEGRIDADE
 * ========================================================================== */

/**
 * Remove uma arma.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ARMA E O ITEM SÃO DUAS COISAS DIFERENTES (§8.2)
 * Remover a arma da aba Armas **não** remove o item da aba Itens. O jogador
 * pode ter guardado a espada como item de coleção, ou ter comprado uma arma
 * e decidido que não é arma. Ligar as duas coisas faria uma operação comum
 * apagar trabalho sem relação.
 */
export function removeWeapon(
  inventory: Inventory,
  weaponId: string,
): Inventory {
  return {
    ...inventory,
    weapons: inventory.weapons.filter((weapon) => weapon.id !== weaponId),
  };
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  "ISTO É UM ITEM" — A LIGAÇÃO ENTRE A ABA ARMAS E A ABA ITENS (§7)        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE FALTAVA
 *
 * O botão existia e chamava `patchWeapon(id, { isItem })`. Só isso: o campo
 * `Weapon.isItem` era gravado e NINGUÉM O LIA. Não havia função de domínio
 * que criasse o item, nem que copiasse dado/bonus/atributos, nem que
 * sincronizasse o nome.
 *
 * O sintoma era "marco e nada acontece". A regra mora aqui, e o componente
 * só chama — como toda regra do inventário.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A DIREÇÃO DO DADO: A ARMA É A FONTE, O ITEM GUARDA UMA CÓPIA
 *
 * Ao marcar, os dados da arma (dado, quantidade, bonus, atributos) são
 * gravados em `Item.weaponData`. A arma continua sendo editavel; o item guarda
 * a foto do momento.
 *
 * O caminho inverso é o `equipWeapon`, que devolve o arquivo para a arma.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AO DESMARCAR: O ITEM FICSA (padrão sugerido pelo §7)
 *
 * Desmarcar desvincula e MANTEM o item. Remover apagaria algo que o usuario
 * talvez queira guardar — e apagar é o unico jeito de perder dado sem
 * querer. O item fica com `weaponData: null`, que significa "comprado na
 * loja, nao veio de arma".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * AO RENOMEAR: UMA ÚNICA FONTE DA VERDADE
 *
 * O nome vive na ARMA. O item espelha. Assim nao ha dois lugares para editar
 * o mesmo texto — que e a divergencia que o §7 manda evitar.
 */

/** Resultado de uma operação de vínculo, com avisos para a interface. */
export interface WeaponItemLinkResult {
  inventory: Inventory;
  /** `true` quando um item foi criado agora. */
  created: boolean;
  /**
   * Motivo de recusa, quando `created` e `false` e nada aconteceu.
   * `null` na maioria dos casos.
   */
  blocked: "limite-de-itens" | null;
}

/**
 * Liga ou desliga "isto é um item" para uma arma.
 *
 * Sem duplicar: se a arma ja tem `itemId` e existe um item correspondente,
 * nada e criado — o vinculo e apenas reafirmado.
 */
export function setWeaponIsItem(
  inventory: Inventory,
  weaponId: string,
  isItem: boolean,
): WeaponItemLinkResult {
  const weapon = inventory.weapons.find(
    (candidate) => candidate.id === weaponId,
  );
  if (!weapon) return { inventory, created: false, blocked: null };

  // ── DESLIGAR ────────────────────────────────────────────────────────────
  if (!isItem) {
    // O item é localizado pelo `itemId` DA ARMA, e não pelo
    // `equippedWeaponId` do item.
    //
    // ───────────────────────────────────────────────────────────────────────
    // POR QUE ISSO JÁ FOI UM BUG
    //
    // A primeira versão procurava o item por `item.equippedWeaponId ===
    // weaponId`. Logo depois de MARCAR, esse campo é `null` — só o `equipWeapon`
    // o preenche. Então desmarcar logo após marcar não encontrava ninguém, e o
    // `weaponData` sobrevivia: a arma dizia "não é item" e o item continuava
    // com o arquivo, indicando para uma arma que já não o referência.
    // ───────────────────────────────────────────────────────────────────────
    const alvo = weapon.itemId;

    const items = inventory.items.map((item) =>
      item.id === alvo
        ? { ...item, weaponData: null, equippedWeaponId: null }
        : item,
    );

    return {
      inventory: {
        ...inventory,
        weapons: inventory.weapons.map((candidate) =>
          candidate.id === weaponId
            ? { ...candidate, isItem: false, itemId: null }
            : candidate,
        ),
        items,
      },
      created: false,
      blocked: null,
    };
  }

  // ── LIGAR ───────────────────────────────────────────────────────────────
  const weaponData = {
    die: weapon.die,
    diceCount: weapon.diceCount,
    attackBonus: weapon.attackBonus,
    attributeIds: [...weapon.attributeIds],
    color: weapon.color,
    isItem: true,
  };

  const patchedWeapon = { ...weapon, isItem: true };

  // O item JÁ existe e ainda aponta para esta arma: nada a fazer.
  if (weapon.itemId) {
    const alvo = inventory.items.find((item) => item.id === weapon.itemId);
    if (alvo) {
      return {
        inventory: {
          ...inventory,
          weapons: inventory.weapons.map((candidate) =>
            candidate.id === weaponId ? patchedWeapon : candidate,
          ),
          items: inventory.items.map((item) =>
            item.id === alvo.id ? { ...item, weaponData } : item,
          ),
        },
        created: false,
        blocked: null,
      };
    }
  }

  // Precisa criar. Antes, confere o limite — §7 pede aviso claro.
  if (!canAddItem(inventory)) {
    return { inventory, created: false, blocked: "limite-de-itens" };
  }

  const itemId = generateId();

  return {
    inventory: {
      ...inventory,
      weapons: inventory.weapons.map((candidate) =>
        candidate.id === weaponId ? { ...patchedWeapon, itemId } : candidate,
      ),
      items: [
        ...inventory.items,
        {
          id: itemId,
          name: weapon.name,
          weight: 0,
          value: 0,
          quantity: 1,
          color: weapon.color,
          favorite: false,
          weaponData,
          equippedWeaponId: null,
        },
      ],
    },
    created: true,
    blocked: null,
  };
}

/**
 * Renomear uma arma mantem o nome do item espelhado.
 *
 * O nome vive na arma; o item espelha. Se o item foi editado direto na aba
 * Itens, o espelho e atualizado para a arma — a fonte e sempre a arma.
 */
export function renameWeapon(
  inventory: Inventory,
  weaponId: string,
  name: string,
): Inventory {
  const weapon = inventory.weapons.find(
    (candidate) => candidate.id === weaponId,
  );
  if (!weapon) return inventory;

  return {
    ...inventory,
    weapons: inventory.weapons.map((candidate) =>
      candidate.id === weaponId ? { ...candidate, name } : candidate,
    ),
    items: inventory.items.map((item) =>
      item.id === weapon.itemId ? { ...item, name } : item,
    ),
  };
}

/**
 * Renomear um item propaga para a arma vinculada.
 *
 * O caminho inverso de {@link renameWeapon}: quem edita na aba Itens tambem
 * atualiza o nome da arma. A fonte da verdade continua sendo a arma, mas o
 * gesto parte de onde o usuario esta.
 */
export function renameItem(
  inventory: Inventory,
  itemId: string,
  name: string,
): Inventory {
  const item = inventory.items.find((candidate) => candidate.id === itemId);
  if (!item) return inventory;

  return {
    ...inventory,
    items: inventory.items.map((candidate) =>
      candidate.id === itemId ? { ...candidate, name } : candidate,
    ),
    // So propaga se o item realmente veio de uma arma.
    weapons:
      item.equippedWeaponId === null && item.weaponData === null
        ? inventory.weapons
        : inventory.weapons.map((weapon) =>
            weapon.itemId === itemId ? { ...weapon, name } : weapon,
          ),
  };
}

/** Remove um item e desfaz o vínculo de qualquer arma que o usasse. */
export function removeItem(inventory: Inventory, itemId: string): Inventory {
  return {
    ...inventory,
    items: inventory.items.filter((item) => item.id !== itemId),
    weapons: inventory.weapons.map((weapon) =>
      weapon.itemId === itemId ? { ...weapon, itemId: null } : weapon,
    ),
  };
}

/**
 * Desfaz o vínculo de uma arma com o item correspondente.
 *
 * A arma continua existindo, com dado, bônus e atributos intactos — só perde
 * a ponte para o item. Nada é destruído.
 */
export function unequipWeapon(
  inventory: Inventory,
  weaponId: string,
): Inventory {
  return {
    ...inventory,
    weapons: inventory.weapons.map((weapon) =>
      weapon.id === weaponId ? { ...weapon, itemId: null } : weapon,
    ),
    items: inventory.items.map((item) =>
      item.equippedWeaponId === weaponId
        ? { ...item, equippedWeaponId: null }
        : item,
    ),
  };
}

/**
 * Equipa a arma a partir de um item, **restaurando** dado, bonus e atributos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A DIRECAO DO FLUXO: O ITEM E O ARQUIVO, A ARMA E A COPIA DE TRABALHO
 *
 * A §8.2 diz que equipar "restaura dado, quantidade, bonus e atributos". Isso
 * fixa a direcao: o `Item.weaponData` e o **arquivo** — a versao guardada
 * quando o item nasceu de uma arma — e equipar **devolve esse arquivo para a
 * arma**.
 *
 * Sem isso, `weaponData` seria um campo morto: guardar uma copia que ninguem
 * le nao serve para nada. E o gesto que a especificacao descreve (equipar uma
 * espada antiga e ela voltar como estava) simplesmente nao acontecia.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A ARMA CONTINUA PODENDO SER EDITADA COM O ITEM EQUIPADO
 *
 * Porque editar a arma e equipar sao coisas diferentes. O jogador pode afiar a
 * espada (mudar o dado) e continuar usando; se depois desequipar e equipar
 * de novo, o arquivoassume o controle — que e o gesto que ele fez ao clicar.
 *
 * Sem carimbo de tempo por arma, a alternativa seria "a arma sempre vence" —
 * e então o arquivo nunca voltaria, que e o mesmo defeito com outro nome.
 */
export function equipWeapon(
  inventory: Inventory,
  weaponId: string,
  itemId: string,
): Inventory {
  const weapon = inventory.weapons.find((w) => w.id === weaponId);
  const item = inventory.items.find((i) => i.id === itemId);
  if (!weapon || !item) return inventory;

  return {
    ...inventory,
    items: inventory.items.map((candidate) => {
      // ⚠️ A ORDEM IMPORTA: o alvo e testado PRIMEIRO.
      //
      // Trocar os dois `if` faz o item alvo ser limpo em vez de equipado —
      // e o efeito e invisivel: o codigo parece certo, a arma fica ligada
      // ao item, e a aba Itens nunca mostra "equipada". Foi um bug real.
      if (candidate.id === itemId) {
        return { ...candidate, equippedWeaponId: weaponId };
      }

      // Libera qualquer OUTRO item que usasse esta arma. Sem isto, dois itens
      // ficariam com a mesma arma e "desequipar" seria ambiguo.
      if (candidate.equippedWeaponId === weaponId) {
        return { ...candidate, equippedWeaponId: null };
      }

      return candidate;
    }),
    weapons: inventory.weapons.map((candidate) => {
      if (candidate.id !== weaponId) return candidate;

      // O ARQUIVO assume: dado, quantidade, bonus, atributos e cor voltam do
      // item. Um item SEM arquivo (comprado na loja, não veio de arma) apenas
      // liga o vinculo — nao ha nada a restaurar.
      if (!item.weaponData) {
        return { ...candidate, itemId };
      }

      return {
        ...candidate,
        itemId,
        die: item.weaponData.die,
        diceCount: item.weaponData.diceCount,
        attackBonus: item.weaponData.attackBonus,
        attributeIds: [...item.weaponData.attributeIds],
        color: item.weaponData.color,
        isItem: item.weaponData.isItem,
      };
    }),
  };
}
/**
 * Atributos vinculados a uma arma, resolvendo ids órfãos.
 *
 * Uma arma pode ter vindo de outra versão do app, ou o usuário pode ter
 * apagado um dos atributos. Devolve só os que existem — mostrar "FOR +5" para
 * um atributo ausente da ficha seria mentira na tela.
 */
export function resolveWeaponAttributes(
  weapon: Weapon,
  attributes: readonly Attribute[],
): Attribute[] {
  return weapon.attributeIds
    .map((id) => attributes.find((attribute) => attribute.id === id))
    .filter((attribute): attribute is Attribute => attribute !== undefined);
}

/** O peso e o valor de uma linha já multiplicados pela quantidade. */
export function lineTotals(item: Item): { weight: number; value: number } {
  return {
    weight: round2(item.weight * item.quantity),
    value: item.value * item.quantity,
  };
}

/** O bloco aceita mais armas? */
export function canAddWeapon(inventory: Inventory): boolean {
  return inventory.weapons.length < MAX_WEAPONS;
}

/** O bloco aceita mais itens? */
export function canAddItem(inventory: Inventory): boolean {
  return inventory.items.length < MAX_ITEMS;
}

/**
 * Uma quantidade é válida?
 *
 * 0 é aceito de propósito: "tenho 0 destas" é informação CORRETA — o jogador
 * acabou de vender tudo. Proibir transformaria o campo de nota em gatilho de
 * erro.
 */
export function isValidQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= ITEM_QUANTITY_MIN;
}

/** Um valor de venda é válido? */
export function isValidValue(value: number): boolean {
  return Number.isFinite(value) && value >= ITEM_VALUE_MIN;
}
