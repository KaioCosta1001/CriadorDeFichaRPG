import { describe, expect, it } from "vitest";

import type { Attribute, Inventory, Item, Weapon } from "@/schemas";

import {
  canAddItem,
  canAddWeapon,
  canSell,
  canSellIndividually,
  computeCarryWeight,
  computeItemValue,
  equipWeapon,
  isMassSellable,
  isValidQuantity,
  lineTotals,
  protectedItems,
  removeItem,
  removeWeapon,
  resolveWeaponAttributes,
  sellItems,
  sellSingleItem,
  sellableItems,
  summarizeCarry,
  unequipWeapon,
} from "./inventory";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  REGRAS DO INVENTÁRIO (seção 8.2)                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * As duas decisões que mais importam são testadas com todos os olhos:
 *
 *  1. **Peso acima da capacidade NÃO BLOQUEIA** — só avisa;
 *  2. **Favoritos são protegidos de venda em massa**, e a venda individual de
 *     um favorito pede confirmação.
 *
 * A segunda é a que protege trabalho real do usuário: um clique distraído
 * num "vender tudo" não pode levar o que ele marcou de propósito.
 */

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    name: "Poção",
    weight: 0.5,
    quantity: 2,
    value: 10,
    color: null,
    favorite: false,
    weaponData: null,
    equippedWeaponId: null,
    ...overrides,
  };
}

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: "wp-1",
    name: "Espada",
    die: "d6",
    diceCount: 1,
    attackBonus: 3,
    attributeIds: [],
    color: null,
    itemId: null,
    isItem: false,
    ...overrides,
  };
}

function inventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    weapons: [],
    items: [],
    money: { label: "Ouro", value: 0 },
    carryCapacity: 50,
    ...overrides,
  };
}

/* ===========================================================================
 * PESO
 * ========================================================================== */

describe("computeCarryWeight", () => {
  it("multiplica peso pela quantidade", () => {
    // 0.5 kg × 2 = 1 kg. Um "0.5" na tela sem o ×2 seria mentira.
    expect(computeCarryWeight(inventory({ items: [item()] }))).toBe(1);
  });

  it("soma todas as linhas", () => {
    const total = computeCarryWeight(
      inventory({
        items: [
          item({ weight: 2, quantity: 3 }),
          item({ weight: 0.25, quantity: 4 }),
        ],
      }),
    );
    expect(total).toBe(7);
  });

  it("NÃO conta a arma em separado do item", () => {
    // `isItem` significa "esta arma também aparece como item" — é a MESMA
    // coisa. Contar as duas faria o peso dobrar a cada compra de espada.
    const espada = item({ id: "it-esp", weight: 3, quantity: 1 });
    const total = computeCarryWeight(
      inventory({
        items: [espada],
        weapons: [weapon({ isItem: true, itemId: espada.id })],
      }),
    );
    expect(total).toBe(3);
  });

  it("arma sem item correspondente não pesa", () => {
    // O peso vive no item; sem item, não há objeto carregado.
    const total = computeCarryWeight(
      inventory({ weapons: [weapon({ isItem: true, itemId: null })] }),
    );
    expect(total).toBe(0);
  });

  it("arma que não é item nunca pesa", () => {
    const total = computeCarryWeight(
      inventory({
        items: [item({ weight: 2, quantity: 5 })],
        weapons: [weapon({ isItem: false })],
      }),
    );
    expect(total).toBe(10);
  });

  it("arredonda para duas casas — nada de 0.30000000000000004 na tela", () => {
    const total = computeCarryWeight(
      inventory({ items: [item({ weight: 0.1, quantity: 3 })] }),
    );
    expect(total).toBe(0.3);
    expect(String(total)).not.toContain("0000");
  });

  it("ficha vazia pesa zero", () => {
    expect(computeCarryWeight(inventory())).toBe(0);
  });
});

describe("summarizeCarry", () => {
  it("diz quanto ainda cabe", () => {
    const summary = summarizeCarry(
      inventory({
        items: [item({ weight: 10, quantity: 2 })],
        carryCapacity: 50,
      }),
    );

    expect(summary.total).toBe(20);
    expect(summary.remaining).toBe(30);
    expect(summary.overweight).toBe(false);
    expect(summary.ratio).toBeCloseTo(0.4, 5);
  });

  it("acima da capacidade: AVISA, e é isso — não existe campo 'bloqueado'", () => {
    const summary = summarizeCarry(
      inventory({
        items: [item({ weight: 30, quantity: 2 })],
        carryCapacity: 50,
      }),
    );

    expect(summary.overweight).toBe(true);
    // "quanto cabe" nunca fica negativo: "-10 kg disponíveis" seria pior que 0.
    expect(summary.remaining).toBe(0);
  });

  it("a razão satura em 1 para a barra, mas o total continua exato", () => {
    const summary = summarizeCarry(
      inventory({
        items: [item({ weight: 100, quantity: 1 })],
        carryCapacity: 10,
      }),
    );

    expect(summary.ratio).toBe(1);
    expect(summary.total).toBe(100);
  });

  it("capacidade zero não divide por zero", () => {
    const summary = summarizeCarry(
      inventory({ items: [item()], carryCapacity: 0 }),
    );

    expect(Number.isFinite(summary.ratio)).toBe(true);
    expect(summary.overweight).toBe(true);
  });

  it("ficha vazia com capacidade zero é neutra", () => {
    const summary = summarizeCarry(inventory({ carryCapacity: 0 }));
    expect(summary.ratio).toBe(0);
    expect(summary.overweight).toBe(false);
  });
});

/* ===========================================================================
 * VALOR
 * ========================================================================== */

describe("computeItemValue", () => {
  it("multiplica valor pela quantidade", () => {
    expect(computeItemValue([item({ value: 10, quantity: 3 })])).toBe(30);
  });

  it("soma todas as linhas", () => {
    expect(
      computeItemValue([
        item({ value: 5, quantity: 2 }),
        item({ value: 1, quantity: 10 }),
      ]),
    ).toBe(20);
  });

  it("ignora a arma: quem tem preço é o item", () => {
    expect(computeItemValue([])).toBe(0);
  });
});

/* ===========================================================================
 * FAVORITOS — A PROTEÇÃO
 * ========================================================================== */

describe("sellableItems / protectedItems", () => {
  const items = [
    item({ id: "a", name: "Poção comum" }),
    item({ id: "b", name: "Joia", favorite: true }),
    item({ id: "c", name: "Corda" }),
  ];

  it("a ação em massa NUNCA inclui um favorito", () => {
    const vendable = sellableItems(items, true);

    expect(vendable.map((i) => i.id)).toEqual(["a", "c"]);
    expect(vendable.some((i) => i.favorite)).toBe(false);
  });

  it("a lista de protegidos diz exatamente quem ficou de fora", () => {
    expect(protectedItems(items).map((i) => i.id)).toEqual(["b"]);
  });

  it("com a venda DESLIGADA, nada é vendável", () => {
    expect(sellableItems(items, false)).toEqual([]);
  });

  it("isMassSellable combina as duas regras", () => {
    expect(isMassSellable(items[0]!, true)).toBe(true);
    expect(isMassSellable(items[1]!, true)).toBe(false); // favorito
    expect(isMassSellable(items[0]!, false)).toBe(false); // venda desligada
  });
});

describe("sellItems", () => {
  it("remove os não-favoritos e credita o dinheiro", () => {
    const inv = inventory({
      items: [
        item({ id: "a", value: 10, quantity: 2 }),
        item({ id: "b", name: "Joia", favorite: true, value: 999 }),
      ],
      money: { label: "Ouro", value: 100 },
    });

    const result = sellItems(inv, inv.items, true);

    expect(result.inventory.items.map((i) => i.id)).toEqual(["b"]);
    expect(result.inventory.money.value).toBe(120);
    expect(result.earned).toBe(20);
  });

  it("DEVOLVE os favoritos preservados — o painel avisa, não some", () => {
    const inv = inventory({
      items: [item({ id: "a" }), item({ id: "b", favorite: true })],
    });

    const result = sellItems(inv, inv.items, true);

    // Sem isto, o jogador veria o favorito sumir sem explicação nenhuma.
    expect(result.kept.map((i) => i.id)).toEqual(["b"]);
  });

  it("com a venda DESLIGADA, não vende NADA", () => {
    const inv = inventory({ items: [item({ id: "a" })] });
    const result = sellItems(inv, inv.items, false);

    expect(result.inventory.items).toHaveLength(1);
    expect(result.earned).toBe(0);
    expect(result.kept).toHaveLength(1);
  });

  it("em MASSA o favorito NUNCA é vendido, nem se for o único item", () => {
    // Este foi um bug real: `sellItems` filtrava o favorito mesmo numa
    // lista de um elemento, então o botão "Vender" da linha não fazia nada.
    const inv = inventory({
      items: [item({ id: "b", favorite: true, value: 50 })],
    });

    const result = sellItems(inv, inv.items, true);

    expect(result.inventory.items).toHaveLength(1);
    expect(result.earned).toBe(0);
  });

  it("INDIVIDUAL, o favorito é vendido (a confirmação é do componente)", () => {
    const inv = inventory({
      items: [item({ id: "b", favorite: true, value: 50, quantity: 2 })],
    });

    const result = sellSingleItem(inv, inv.items[0]!, true);

    expect(result.inventory.items).toHaveLength(0);
    expect(result.earned).toBe(100);
  });

  it("venda individual com a venda DESLIGADA não faz nada", () => {
    const inv = inventory({ items: [item({ id: "a" })] });
    const result = sellSingleItem(inv, inv.items[0]!, false);

    expect(result.inventory.items).toHaveLength(1);
    expect(result.earned).toBe(0);
  });

  it("não mexe no inventário recebido", () => {
    const inv = inventory({ items: [item({ id: "a" })] });
    const copia = structuredClone(inv);

    sellItems(inv, inv.items, true);

    expect(inv).toEqual(copia);
  });

  it("não quebra com lista vazia", () => {
    const inv = inventory();
    const result = sellItems(inv, [], true);

    expect(result.earned).toBe(0);
    expect(result.inventory.items).toEqual([]);
  });
});

describe("canSellIndividually", () => {
  it("com a venda desligada, nada é vendável", () => {
    expect(canSellIndividually(item(), false)).toEqual({
      allowed: false,
      needsConfirmation: false,
    });
  });

  it("item comum: vende sem confirmar", () => {
    expect(canSellIndividually(item(), true)).toEqual({
      allowed: true,
      needsConfirmation: false,
    });
  });

  it("favorito: vende, MAS com confirmação", () => {
    expect(canSellIndividually(item({ favorite: true }), true)).toEqual({
      allowed: true,
      needsConfirmation: true,
    });
  });
});

describe("canSell", () => {
  it("espelha Sheet.settings.sellEnabled", () => {
    expect(canSell(true)).toBe(true);
    expect(canSell(false)).toBe(false);
  });
});

/* ===========================================================================
 * ARMAS E ITENS — INTEGRIDADE
 * ========================================================================== */

describe("removeWeapon", () => {
  it("remove só a arma", () => {
    const inv = inventory({
      weapons: [weapon(), weapon({ id: "wp-2" })],
      items: [item({ id: "it-esp", equippedWeaponId: "wp-1" })],
    });

    const result = removeWeapon(inv, "wp-1");

    expect(result.weapons.map((w) => w.id)).toEqual(["wp-2"]);
  });

  it("NÃO remove o item correspondente (§8.2)", () => {
    // A arma e o item são coisas diferentes: apagar a arma não pode levar a
    // espada que o jogador guardou como item de coleção.
    const inv = inventory({
      weapons: [weapon({ itemId: "it-esp" })],
      items: [item({ id: "it-esp" })],
    });

    const result = removeWeapon(inv, "wp-1");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("it-esp");
  });

  it("não quebra quando a arma não existe", () => {
    const inv = inventory();
    expect(removeWeapon(inv, "fantasma").weapons).toEqual([]);
  });
});

describe("removeItem", () => {
  it("remove o item e desfaz o vínculo da arma", () => {
    const inv = inventory({
      items: [item({ id: "it-esp" })],
      weapons: [weapon({ itemId: "it-esp" })],
    });

    const result = removeItem(inv, "it-esp");

    expect(result.items).toHaveLength(0);
    expect(result.weapons[0]?.itemId).toBeNull();
  });

  it("NÃO remove a arma que usava o item", () => {
    const inv = inventory({
      items: [item({ id: "it-esp" })],
      weapons: [weapon({ itemId: "it-esp" })],
    });

    expect(removeItem(inv, "it-esp").weapons).toHaveLength(1);
  });
});

describe("unequipWeapon", () => {
  it("desfaz o vínculo dos DOIS lados", () => {
    const inv = inventory({
      weapons: [weapon({ itemId: "it-esp" })],
      items: [item({ id: "it-esp", equippedWeaponId: "wp-1" })],
    });

    const result = unequipWeapon(inv, "wp-1");

    expect(result.weapons[0]?.itemId).toBeNull();
    expect(result.items[0]?.equippedWeaponId).toBeNull();
  });

  it("a arma continua com dado, bônus e atributos intactos", () => {
    const inv = inventory({
      weapons: [
        weapon({ itemId: "it-esp", die: "d10", diceCount: 2, attackBonus: 5 }),
      ],
    });

    const result = unequipWeapon(inv, "wp-1");

    expect(result.weapons[0]?.die).toBe("d10");
    expect(result.weapons[0]?.diceCount).toBe(2);
    expect(result.weapons[0]?.attackBonus).toBe(5);
  });
});

describe("equipWeapon", () => {
  it("liga a arma ao item", () => {
    const inv = inventory({
      weapons: [weapon()],
      items: [item({ id: "it-esp" })],
    });

    expect(equipWeapon(inv, "wp-1", "it-esp").weapons[0]?.itemId).toBe(
      "it-esp",
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RESTAURAR (§8.2): o `Item.weaponData` é o ARQUIVO, e equipar devolve ele
  // para a arma. Sem isto o campo é morto — uma cópia que ninguém lê.
  // ───────────────────────────────────────────────────────────────────────────
  it("RESTAURA dado, quantidade e bônus a partir do arquivo do item", () => {
    const inv = inventory({
      // A arma está "gasta": 1d4, sem bônus. O arquivo tem outra coisa.
      weapons: [weapon({ die: "d4", diceCount: 1, attackBonus: 0 })],
      items: [
        item({
          id: "it-esp",
          weaponData: {
            die: "d10",
            diceCount: 3,
            attackBonus: 5,
            attributeIds: ["attr-for"],
            color: "#d8c246",
            isItem: true,
          },
        }),
      ],
    });

    const arma = equipWeapon(inv, "wp-1", "it-esp").weapons[0];

    expect(arma?.die).toBe("d10");
    expect(arma?.diceCount).toBe(3);
    expect(arma?.attackBonus).toBe(5);
    expect(arma?.attributeIds).toEqual(["attr-for"]);
    expect(arma?.color).toBe("#d8c246");
  });

  it("RESTAURA mesmo que a arma tenha sido editada depois de equipada", () => {
    // Este era o defeito documentado na Fase 7: desequipar + equipar de novo
    // devolvia o valor antigo. O item é o arquivo — equipar é o pedido
    // explícito de voltar a ele.
    const arquivo = {
      die: "d12" as const,
      diceCount: 2,
      attackBonus: 4,
      attributeIds: [],
      color: null,
      isItem: true,
    };
    const inv = inventory({
      weapons: [weapon({ die: "d4", diceCount: 1, attackBonus: 0 })],
      items: [item({ id: "it-esp", weaponData: arquivo })],
    });

    const armada = equipWeapon(inv, "wp-1", "it-esp");
    const desequipada = unequipWeapon(armada, "wp-1");
    const reequipada = equipWeapon(desequipada, "wp-1", "it-esp");

    expect(reequipada.weapons[0]?.die).toBe("d12");
    expect(reequipada.weapons[0]?.diceCount).toBe(2);
    expect(reequipada.weapons[0]?.attackBonus).toBe(4);
  });

  it("item SEM arquivo só liga o vínculo — não há o que restaurar", () => {
    const inv = inventory({
      weapons: [weapon({ die: "d8", attackBonus: 3 })],
      items: [item({ id: "it-comprado", weaponData: null })],
    });

    const arma = equipWeapon(inv, "wp-1", "it-comprado").weapons[0];

    expect(arma?.itemId).toBe("it-comprado");
    // Uma espada comprada na loja não sobrescreve a arma que o jogador afinou.
    expect(arma?.die).toBe("d8");
    expect(arma?.attackBonus).toBe(3);
  });

  it("restaura SEM tocar no nome da arma", () => {
    const inv = inventory({
      weapons: [weapon({ name: "Espada nomeada" })],
      items: [
        item({
          id: "it-esp",
          weaponData: {
            die: "d10",
            diceCount: 1,
            attackBonus: 0,
            attributeIds: [],
            color: null,
            isItem: false,
          },
        }),
      ],
    });

    // O nome é do jogador, na aba Armas. O arquivo não tem nome de propósito.
    expect(equipWeapon(inv, "wp-1", "it-esp").weapons[0]?.name).toBe(
      "Espada nomeada",
    );
  });

  it("copia os atributos por valor — não compartilha o vetor", () => {
    const atributos = ["attr-for"];
    const inv = inventory({
      weapons: [weapon()],
      items: [
        item({
          id: "it-esp",
          weaponData: {
            die: "d6",
            diceCount: 1,
            attackBonus: 0,
            attributeIds: atributos,
            color: null,
            isItem: false,
          },
        }),
      ],
    });

    const arma = equipWeapon(inv, "wp-1", "it-esp").weapons[0];
    atributos.push("attr-des");

    // Se compartilhasse o vetor, editar a arma numa aba mexeria no arquivo do
    // item — e desequipar + equipar traria o valor alterado.
    expect(arma?.attributeIds).toEqual(["attr-for"]);
  });

  it("só UM item fica com a mesma arma equipada", () => {
    const inv = inventory({
      weapons: [weapon()],
      items: [
        item({ id: "it-a", equippedWeaponId: "wp-1" }),
        item({ id: "it-b", equippedWeaponId: "wp-1" }),
      ],
    });

    const result = equipWeapon(inv, "wp-1", "it-b");
    const comArma = result.items.filter((i) => i.equippedWeaponId === "wp-1");

    expect(comArma.map((i) => i.id)).toEqual(["it-b"]);
  });

  it("não quebra com id inexistente", () => {
    const inv = inventory();
    expect(equipWeapon(inv, "fantasma", "fantasma")).toEqual(inv);
  });
});

describe("resolveWeaponAttributes", () => {
  const forca: Attribute = {
    id: "a-for",
    name: "Força",
    value: 16,
    color: null,
  };

  it("resolve os ids existentes", () => {
    const resolved = resolveWeaponAttributes(
      weapon({ attributeIds: ["a-for"] }),
      [forca],
    );
    expect(resolved.map((a) => a.name)).toEqual(["Força"]);
  });

  it("PULA atributo órfão — mostrar 'Força +5' seria mentira", () => {
    const resolved = resolveWeaponAttributes(
      weapon({ attributeIds: ["a-for", "a-perdido"] }),
      [forca],
    );
    expect(resolved).toHaveLength(1);
  });

  it("devolve vazio quando não há nenhum", () => {
    expect(resolveWeaponAttributes(weapon(), [forca])).toEqual([]);
  });
});

/* ===========================================================================
 * LINHA
 * ========================================================================== */

describe("lineTotals", () => {
  it("multiplica peso e valor pela quantidade", () => {
    expect(lineTotals(item({ weight: 1.5, value: 8, quantity: 4 }))).toEqual({
      weight: 6,
      value: 32,
    });
  });

  it("arredonda o peso", () => {
    expect(lineTotals(item({ weight: 0.1, quantity: 3 })).weight).toBe(0.3);
  });
});

/* ===========================================================================
 * LIMITES
 * ========================================================================== */

describe("canAddWeapon / canAddItem", () => {
  it("respeita o máximo de armas", () => {
    expect(canAddWeapon(inventory())).toBe(true);
    expect(
      canAddWeapon(
        inventory({
          weapons: Array.from({ length: 10 }, (_, i) =>
            weapon({ id: `w${i}` }),
          ),
        }),
      ),
    ).toBe(false);
  });

  it("respeita o máximo de itens", () => {
    expect(
      canAddItem(
        inventory({
          items: Array.from({ length: 100 }, (_, i) => item({ id: `i${i}` })),
        }),
      ),
    ).toBe(false);
  });
});

describe("isValidQuantity", () => {
  it("aceita ZERO de propósito", () => {
    // "tenho 0 destas" é informação CORRETA: o jogador acabou de vender tudo.
    expect(isValidQuantity(0)).toBe(true);
  });

  it("recusa negativo e NaN", () => {
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(Number.NaN)).toBe(false);
  });
});
