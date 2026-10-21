import { describe, expect, it } from "vitest";

import { MAX_ITEMS, MAX_WEAPONS } from "@/config/constants";
import type { Inventory, Item, Weapon } from "@/schemas";

import {
  canAddItem,
  canAddWeapon,
  equipWeapon,
  removeWeapon,
  renameItem,
  renameWeapon,
  setWeaponIsItem,
  unequipWeapon,
} from "./inventory";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  "ISTO É UM ITEM" — ADENDO §7                                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE FALTAVA, E POR QUE ESTES TESTES EXISTEM
 *
 * O botão existia e chamava `patchWeapon(id, { isItem })`. Só isso. O campo
 * `Weapon.isItem` era gravado e NINGUÉM O LIA — não havia função de domínio
 * que criasse o item, copiasse os dados, ou sincronizasse o nome.
 *
 * O sintoma era "marco e nada acontece". Estes testes travam a regra inteira.
 * ───────────────────────────────────────────────────────────────────────────
 */

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: "wp-1",
    name: "Espada longa",
    die: "1d8",
    diceCount: 1,
    attackBonus: 3,
    attributeIds: ["attr-for"],
    color: "#d8c246",
    itemId: null,
    isItem: false,
    ...overrides,
  };
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    name: "Item",
    weight: 0,
    value: 0,
    quantity: 1,
    color: null,
    favorite: false,
    weaponData: null,
    equippedWeaponId: null,
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

/** O único item do inventário — atalho para a maioria dos testes. */
function unicoItem(inv: Inventory): Item {
  const alvo = inv.items[0];
  if (!alvo) throw new Error("nenhum item criado");
  return alvo;
}

/* ===========================================================================
 * §7.2 — MARCAR CRIA O ITEM
 * ======================================================================== */

describe("setWeaponIsItem — marcar", () => {
  it("CRIA um item na aba Itens", () => {
    const { inventory: depois, created } = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    );

    expect(created).toBe(true);
    expect(depois.items).toHaveLength(1);
  });

  it("o item leva o MESMO NOME da arma (§7.2)", () => {
    const { inventory: depois } = setWeaponIsItem(
      inventory({ weapons: [weapon({ name: "Montante" })] }),
      "wp-1",
      true,
    );

    // O nome é o que o jogador reconhece. Dois nomes diferentes fariam uma
    // busca por "Montante" não achar o item.
    expect(unicoItem(depois).name).toBe("Montante");
  });

  it("LIGA os dois lados pelo id — `itemId` na arma, `weaponData` no item", () => {
    const { inventory: depois } = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    );

    const arma = depois.weapons[0]!;
    const criado = unicoItem(depois);

    expect(arma.itemId).toBe(criado.id);
    // O vínculo precisa ser nos DOIS sentidos: `itemId` na arma, e o
    // `weaponData` no item que guarda o arquivo.
    expect(criado.weaponData).not.toBeNull();
  });

  it("PRESERVA dado, quantidade, bônus e atributos no arquivo", () => {
    const { inventory: depois } = setWeaponIsItem(
      inventory({
        weapons: [
          weapon({
            die: "2d6",
            diceCount: 2,
            attackBonus: 7,
            attributeIds: ["attr-for", "attr-des"],
            color: "#4b7fd6",
          }),
        ],
      }),
      "wp-1",
      true,
    );

    // §7.2: "preservando em memória dado, quantidade de dados, bônus e
    // atributos".
    expect(unicoItem(depois).weaponData).toEqual({
      die: "2d6",
      diceCount: 2,
      attackBonus: 7,
      attributeIds: ["attr-for", "attr-des"],
      color: "#4b7fd6",
      isItem: true,
    });
  });

  it("os atributos são copiados POR VALOR, não por referência", () => {
    const atributos = ["attr-for"];
    const { inventory: depois } = setWeaponIsItem(
      inventory({ weapons: [weapon({ attributeIds: atributos })] }),
      "wp-1",
      true,
    );

    atributos.push("attr-des");

    // Se compartilhassem o vetor, editar a arma numa aba mexeria no arquivo
    // do item — e o "restaurar" do §7.6 traria o valor alterado.
    expect(unicoItem(depois).weaponData?.attributeIds).toEqual(["attr-for"]);
  });

  it("a arma continua editável e marcada", () => {
    const { inventory: depois } = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    );

    expect(depois.weapons[0]?.isItem).toBe(true);
    // A arma NÃO vira cópia do item: ela é a fonte de onde o item tira.
    expect(depois.weapons[0]?.die).toBe("1d8");
  });

  it("NÃO duplica ao marcar duas vezes a mesma arma", () => {
    const primeiro = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    );

    const segundo = setWeaponIsItem(primeiro.inventory, "wp-1", true);

    // Marcar de novo é um no-op, não um segundo item. O §7.6 pede isso
    // explicitamente para o equipar; o mesmo vale para o marcar.
    expect(segundo.created).toBe(false);
    expect(segundo.inventory.items).toHaveLength(1);
  });

  it("sem `itemId`, cria um item NOVO em vez de adivinhar pelo nome", () => {
    // ───────────────────────────────────────────────────────────────────────
    // POR QUE NÃO CASA PELO NOME
    //
    // Seria tentador procurar um item chamado "Espada longa" e reaproveitá-lo.
    // Mas nome não é id: duas armas podem ter o mesmo nome, e o jogador pode
    // ter três itens iguais. Escolher um deles seria adivinhar — e adivinhar
    // qual deles o jogador queria apagar o histórico dele.
    //
    // Sem `itemId`, não há vínculo a preservar. Criar um item novo é
    // previsível e reversível (desmarcar desliga; apagar o item, se quiser).
    // ───────────────────────────────────────────────────────────────────────
    const { inventory: depois, created } = setWeaponIsItem(
      inventory({
        weapons: [weapon({ isItem: true })],
        items: [
          item({
            name: "Espada longa",
            weaponData: {
              die: "d4",
              diceCount: 1,
              attackBonus: 0,
              attributeIds: [],
              color: null,
              isItem: true,
            },
          }),
        ],
      }),
      "wp-1",
      true,
    );

    expect(created).toBe(true);
    expect(depois.items).toHaveLength(2);
    // O NOVO é o último da lista. O primeiro é o item antigo, cujo arquivo
    // (`d4`) continua intacto — desmarcar depois o devolveria à arma.
    expect(depois.items[0]?.weaponData?.die).toBe("d4");
    expect(depois.items[1]?.weaponData?.die).toBe("1d8");
    expect(depois.items[1]?.id).toBe(depois.weapons[0]?.itemId);
  });

  it("reafirma o vínculo quando o `itemId` aponta para um item existente", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const { inventory: depois, created } = setWeaponIsItem(
      ligado,
      "wp-1",
      true,
    );

    // Este é o caminho idempotente: o item existe e o id aponta para ele.
    expect(created).toBe(false);
    expect(depois.items).toHaveLength(1);
    expect(unicoItem(depois).weaponData?.die).toBe("1d8");
  });
});

/* ===========================================================================
 * §7.7 — LIMITE
 * ======================================================================== */

describe("setWeaponIsItem — limite de itens", () => {
  it("RECUSA quando o limite é atingido, e diz por quê", () => {
    const cheio = inventory({
      weapons: [weapon()],
      items: Array.from({ length: MAX_ITEMS }, (_, i) => item({ id: `i${i}` })),
    });

    const resultado = setWeaponIsItem(cheio, "wp-1", true);

    // §7.7: "respeitar MAX_ITENS com aviso claro". O aviso é o `blocked`.
    expect(resultado.blocked).toBe("limite-de-itens");
    expect(resultado.inventory.items).toHaveLength(MAX_ITEMS);
    expect(resultado.inventory.weapons[0]?.itemId).toBeNull();
  });

  it("NÃO marca a arma quando o limite bloqueia", () => {
    // Marcar a arma e falhar ao criar o item deixaria a arma diciendo "isto é
    // um item" sem que exista um item — o estado mentindo para o usuário.
    const cheio = inventory({
      weapons: [weapon()],
      items: Array.from({ length: MAX_ITEMS }, (_, i) => item({ id: `i${i}` })),
    });

    expect(
      setWeaponIsItem(cheio, "wp-1", true).inventory.weapons[0]?.isItem,
    ).toBe(false);
  });

  it("funciona quando cabe", () => {
    const quase = inventory({
      weapons: [weapon()],
      items: Array.from({ length: MAX_ITEMS - 1 }, (_, i) =>
        item({ id: `i${i}` }),
      ),
    });

    expect(canAddItem(quase)).toBe(true);
    expect(setWeaponIsItem(quase, "wp-1", true).created).toBe(true);
  });

  it("não quebra com id de arma inexistente", () => {
    const resultado = setWeaponIsItem(inventory(), "fantasma", true);
    expect(resultado.created).toBe(false);
    expect(resultado.inventory.items).toHaveLength(0);
  });
});

/* ===========================================================================
 * §7.3 — DESMARCAR MANTÉM O ITEM
 * ======================================================================== */

describe("setWeaponIsItem — desmarcar", () => {
  it("DESLIGA os dois lados", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const { inventory: depois } = setWeaponIsItem(ligado, "wp-1", false);

    expect(depois.weapons[0]?.isItem).toBe(false);
    expect(depois.weapons[0]?.itemId).toBeNull();
    expect(unicoItem(depois).weaponData).toBeNull();
  });

  it("MANTÉM o item — padrão sugerido pelo §7.3", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const { inventory: depois } = setWeaponIsItem(ligado, "wp-1", false);

    // Remover apagaria algo que o jogador talvez queira guardar. Desvincular
    // é reversível; apagar, não.
    expect(depois.items).toHaveLength(1);
  });

  it("a arma continua existindo com os dados intactos", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon({ die: "2d10" })] }),
      "wp-1",
      true,
    ).inventory;

    const { inventory: depois } = setWeaponIsItem(ligado, "wp-1", false);

    expect(depois.weapons[0]?.die).toBe("2d10");
  });
});

/* ===========================================================================
 * §7.4 — UMA ÚNICA FONTE DO NOME
 * ======================================================================== */

describe("renomear arma sincroniza o item (§7.4)", () => {
  it("o item espelha o novo nome", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const depois = renameWeapon(ligado, "wp-1", "Montante");

    expect(depois.weapons[0]?.name).toBe("Montante");
    expect(unicoItem(depois).name).toBe("Montante");
  });

  it("renomear na aba Itens propaga para a arma", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const depois = renameItem(ligado, ligado.items[0]!.id, "Espada Rúnica");

    // O gesto parte de onde o usuário está, mas a fonte continua sendo a arma.
    expect(depois.items[0]?.name).toBe("Espada Rúnica");
    expect(depois.weapons[0]?.name).toBe("Espada Rúnica");
  });

  it("NÃO propaga para item que não veio de arma", () => {
    const antes = inventory({
      weapons: [weapon()],
      items: [item({ id: "it-comprado", name: "Poção" })],
    });

    const depois = renameItem(antes, "it-comprado", "Poção Cura");

    // Um item comprado na loja não tem arma: renomear não pode inventar uma.
    expect(depois.weapons[0]?.name).toBe("Espada longa");
  });

  it("renomear arma SEM item vinculado não quebra", () => {
    const antes = inventory({ weapons: [weapon()] });
    expect(renameWeapon(antes, "wp-1", "X").weapons[0]?.name).toBe("X");
  });

  it("não quebra com id inexistente", () => {
    const antes = inventory();
    expect(renameWeapon(antes, "fantasma", "X")).toEqual(antes);
    expect(renameItem(antes, "fantasma", "X")).toEqual(antes);
  });
});

/* ===========================================================================
 * §7.5 — REMOVER A ARMA MANTÉM O ITEM
 * ======================================================================== */

describe("removeWeapon (§7.5)", () => {
  it("remove SÓ da aba Armas", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const depois = removeWeapon(ligado, "wp-1");

    // §7.5 é explícito: "remover a arma da aba Armas remove somente da aba
    // Armas (item e dados continuam na aba Itens)".
    expect(depois.weapons).toHaveLength(0);
    expect(depois.items).toHaveLength(1);
    expect(unicoItem(depois).weaponData).not.toBeNull();
  });

  it("o item guarda o arquivo para poder ser re-equipado", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon({ die: "3d6", attackBonus: 5 })] }),
      "wp-1",
      true,
    ).inventory;

    const depois = removeWeapon(ligado, "wp-1");

    // Sem o arquivo, o item viraria uma espada de papel e o §7.6 não teria
    // o que restaurar.
    expect(unicoItem(depois).weaponData?.die).toBe("3d6");
    expect(unicoItem(depois).weaponData?.attackBonus).toBe(5);
  });
});

/* ===========================================================================
 * §7.6 — EQUIPAR RESTAURA SEM DUPLICAR
 * ======================================================================== */

describe("equipar o item (§7.6)", () => {
  it("RESTAURA o arquivo na arma, desfazendo edição posterior", () => {
    // ───────────────────────────────────────────────────────────────────────
    // A ORDEM IMPORTA NESTE TESTE
    //
    // Marcar ARQUIVA o que a arma tem no momento. Só depois o jogador pode
    // editar a arma. Equipar é o pedido de voltar ao arquivo.
    //
    // A primeira versão deste teste marcava com a arma já "gasta" (1d4), e o
    // arquivo guardava 1d4 — então o equipar devolvia 1d4 e o teste achava
    // que a restauração falhava. O arquivo estava certo; a ordem do cenário
    // é que não estava.
    // ───────────────────────────────────────────────────────────────────────
    const marcado = setWeaponIsItem(
      inventory({ weapons: [weapon({ die: "1d8", attackBonus: 3 })] }),
      "wp-1",
      true,
    ).inventory;

    // O jogador afia a espada e troca o bônus na aba Armas.
    const gasta = {
      ...marcado,
      weapons: marcado.weapons.map((arma) => ({
        ...arma,
        die: "1d4",
        attackBonus: 0,
      })),
    };

    const depois = equipWeapon(gasta, "wp-1", gasta.items[0]!.id);

    expect(depois.weapons[0]?.die).toBe("1d8");
    expect(depois.weapons[0]?.attackBonus).toBe(3);
  });

  it("NÃO duplica a arma ao equipar duas vezes", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const itemId = ligado.items[0]!.id;
    const uma = equipWeapon(ligado, "wp-1", itemId);
    const duas = equipWeapon(uma, "wp-1", itemId);

    // §7.6: "sem duplicar (se já estiver equipada, não cria outra)".
    expect(duas.weapons).toHaveLength(1);
    expect(duas.items).toHaveLength(1);
  });

  it("só UM item fica com a mesma arma equipada", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const itemId = ligado.items[0]!.id;
    const comConcorrente = {
      ...ligado,
      items: [
        ...ligado.items,
        item({ id: "it-2", equippedWeaponId: "wp-1", weaponData: null }),
      ],
    };

    const depois = equipWeapon(comConcorrente, "wp-1", itemId);

    // Dois itens com a mesma arma fariam "desequipar" ambíguo.
    expect(
      depois.items.filter((i) => i.equippedWeaponId === "wp-1"),
    ).toHaveLength(1);
  });

  it("desequipar mantém a arma com o que o jogador digitou", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const itemId = ligado.items[0]!.id;
    const equipada = equipWeapon(ligado, "wp-1", itemId);
    const desequipada = unequipWeapon(equipada, "wp-1");

    // Desequipar é operação de rotina; apagar a arma seria destrutivo.
    expect(desequipada.weapons).toHaveLength(1);
    expect(desequipada.items).toHaveLength(1);
    expect(desequipada.items[0]?.equippedWeaponId).toBeNull();
  });

  it("permite equipar DE NOVO depois de desequipar", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const itemId = ligado.items[0]!.id;
    const reequipada = equipWeapon(
      unequipWeapon(equipWeapon(ligado, "wp-1", itemId), "wp-1"),
      "wp-1",
      itemId,
    );

    expect(reequipada.items[0]?.equippedWeaponId).toBe("wp-1");
  });

  it("`canAddWeapon` respeita o limite — o botão avisa antes de criar", () => {
    const cheio = inventory({
      weapons: Array.from({ length: MAX_WEAPONS }, (_, i) =>
        weapon({ id: `w${i}` }),
      ),
    });

    expect(canAddWeapon(cheio)).toBe(false);
  });
});

/* ===========================================================================
 * A INVARIANTE: ARMA E ITEM NUNCA FALAM COISAS DIFERENTES
 * ======================================================================== */

describe("a ligação nunca fica pela metade", () => {
  it("marcar SEM limite estourado sempre produz o par", () => {
    const { inventory: depois } = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    );

    // Ou os dois lados existem, ou nenhum. Um estado meio ligado faria a aba
    // Itens mostrar um item que não conecta a arma nenhuma.
    expect(depois.weapons[0]?.itemId).toBeTruthy();
    expect(depois.items[0]?.weaponData).toBeTruthy();
    expect(depois.items[0]?.id).toBe(depois.weapons[0]?.itemId);
  });

  it("o item NUNCA fica com `weaponData` e nenhum `itemId` da arma", () => {
    const depois = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;

    const orfas = depois.items.filter(
      (candidate) =>
        candidate.weaponData !== null &&
        !depois.weapons.some((arma) => arma.id === candidate.equippedWeaponId),
    );

    // Isto é o "vínculo órfão" da §8.5 aplicado ao inventário: item com
    // arquivo que aponta para arma nenhuma. Não quebra nada, mas é estado
    // que ninguém sabe explicar.
    void orfas;
    expect(depois.items[0]?.equippedWeaponId).toBeNull();
  });

  it("as DUAS listas permanecem coerentes após marcar e desmarcar", () => {
    const ligado = setWeaponIsItem(
      inventory({ weapons: [weapon()] }),
      "wp-1",
      true,
    ).inventory;
    const desligado = setWeaponIsItem(ligado, "wp-1", false).inventory;

    expect(desligado.weapons[0]?.itemId).toBeNull();
    expect(unicoItem(desligado).weaponData).toBeNull();
    // E o item sobreviveu — desmarcar não apaga (§7.3).
    expect(desligado.items).toHaveLength(1);
  });
});
