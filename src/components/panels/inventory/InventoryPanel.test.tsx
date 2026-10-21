import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PanelContext } from "@/components/panels/registry";
import { InventoryPanel } from "@/components/panels/inventory/InventoryPanel";
import { MAX_ITEMS, MAX_WEAPONS } from "@/config/constants";
import { getSystem } from "@/config/systems";
import type { Item, Sheet, Weapon } from "@/schemas";
import { createSheet } from "@/domain/sheetFactory";
import { sheetStorageKey } from "@/config/constants";
import { resetSheetStoreForTests, useSheetStore } from "@/store/sheetStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE INVENTÁRIO — FASE 7 (§8.2)                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * As regras que estes testes defendem, na ordem de importance:
 *
 *  - **Peso acima da capacidade NÃO bloqueia** — só fica vermelho;
 *  - **"Vender" só existe com `sellEnabled`**, e o botão some quando está
 *    desligado (não fica cinza: cinza sugere "quebrado", desligado é
 *    "desligado");
 *  - **o favorito sobrevive a "Vender tudo"**, e o painel avisa quantos
 *    ficaram em vez de sumir com eles;
 *  - a venda INDIVIDUAL de um favorito pede confirmação explícita;
 *  - **`2d8` é duas vezes o dado sorteado**, nunca o dobro.
 */

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), back: vi.fn() }),
}));

const INPUT = {
  system: "dnd5e",
  templateId: "dnd5e-completo",
  name: "Gandalf",
  title: "Gandalf",
} as const;

function weapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    id: "wp-1",
    name: "Espada longa",
    die: "d8",
    diceCount: 1,
    attackBonus: 3,
    attributeIds: [],
    color: null,
    itemId: null,
    isItem: false,
    ...overrides,
  };
}

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

function Harness({ editMode = false }: { editMode?: boolean }) {
  const sheet = useSheetStore((state) => state.sheet);
  const mutate = useSheetStore((state) => state.mutate);

  if (!sheet) return null;

  return (
    <InventoryPanel
      context={{
        sheet,
        editMode,
        system: getSystem(sheet.system) as PanelContext["system"],
        mutate,
        openSettings: vi.fn(),
      }}
    />
  );
}

/**
 * Semeia a ficha no STORE **e** no storage, pelo MESMO id.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O STORAGE PRECISA DA FICHA — este era um bug REAL DE TESTE
 *
 * `useSheetStore.mutate` agenda um autosave com debounce. O save chama
 * `sheetRepository.updateSheet(id, …)`, e uma ficha que existe só no store
 * não está no `localStorage`. O autosave então falha com "Ficha não
 * encontrada" e executa:
 *
 *     useSheetStore.setState({ status: "error" })
 *
 * E `mutate` recusa **em silêncio** quando o estado não está pronto:
 *
 *     if (!current || get().status !== "ready") return false;
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SÓ ÀS VEZES
 *
 * O autosave é debounced. Sob carga de CPU ele dispara dentro ou fora da
 * janela do teste. Por isso o teste passava rodando o arquivo sozinho e
 * falhava na suíte completa — a pior assinatura possível, porque parece
 * intermitência do produto quando é estado impossível.
 * ───────────────────────────────────────────────────────────────────────────
 */
async function seedSheet(sheet: Sheet): Promise<Sheet> {
  // Grava pelo id da PRÓPRIA ficha. Criar uma nova no repositório não
  // resolveria: `createSheet` sorteia outro id, e o `updateSheet` do autosave
  // procuraria o id do store — que não estaria lá.
  window.localStorage.setItem(sheetStorageKey(sheet.id), JSON.stringify(sheet));

  useSheetStore.setState({
    sheet,
    status: "ready",
    error: null,
    dirty: false,
  });
  return sheet;
}

const seedSheetWith = seedSheet;

/** Ficha com um item e uma arma prontos. */
async function seedWith(
  items: Item[],
  weapons: Weapon[],
  settings?: Sheet["settings"],
  editMode = false,
) {
  const base = createSheet(INPUT);
  const sheet = await seedSheet({
    ...base,
    inventory: {
      ...base.inventory,
      items,
      weapons,
      carryCapacity: 50,
      money: { label: "Ouro", value: 0 },
    },
    ...(settings ? { settings } : {}),
  });
  render(<Harness editMode={editMode} />);
  return sheet;
}

function currentSheet() {
  const sheet = useSheetStore.getState().sheet;
  if (!sheet) throw new Error("ficha não carregada");
  return sheet;
}

/** Inventário vivo, direto do store. */
function currentInventory() {
  return currentSheet().inventory;
}

/* ===========================================================================
 * "ISTO É UM ITEM" — ADENDO §7, PELA INTERFACE
 *
 * A regra está em `domain/inventory.ts` e tem 32 testes lá. Estes aqui
 * verificam o que só existe na interface: que o botão chame a regra, que o
 * limite vire AVISO (e não erro), e que o botão "Equipar" exista.
 * ======================================================================== */

/** Liga o lápis do bloco, que é onde o toggle vive. */
async function openBlockEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Editar bloco" }));
}

describe('Inventário — "Isto é um item" (§7.2)', () => {
  it("o botão só aparece no lápis do bloco", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon()]);

    expect(
      screen.queryByRole("button", { name: /Tratar Espada longa como item/ }),
    ).toBeNull();

    await openBlockEdit(user);
    expect(
      screen.getByRole("button", { name: /Tratar Espada longa como item/ }),
    ).toBeDefined();
  });

  it("marcar CRIA o item na aba Itens, com o mesmo nome", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon({ name: "Montante" })]);

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Montante como item/ }),
    );

    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.items).toHaveLength(1);
      expect(inv.items[0]?.name).toBe("Montante");
      expect(inv.weapons[0]?.itemId).toBe(inv.items[0]?.id);
    });
  });

  it("o item criado aparece na ABA ITENS, não só no dado", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon({ name: "Montante" })]);

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Montante como item/ }),
    );

    await openTab(user, "Itens");
    expect(screen.getByText("Montante")).toBeDefined();
  });

  it("o botão reflete o estado: ligado mostra o glifo cheio", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon({ name: "Montante" })]);

    await openBlockEdit(user);
    const desligado = screen.getByRole("button", {
      name: /Tratar Montante como item/,
    });
    expect(desligado.getAttribute("aria-pressed")).toBe("false");

    await user.click(desligado);

    // O rótulo INVERTE junto com o estado: "deixar de tratar" só faz sentido
    // quando já se trata.
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Deixar de tratar Montante como item/,
        }),
      ).toBeDefined();
    });
  });

  it("funciona COM o Editar Geral ligado (adendo §7.8)", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon({ name: "Montante" })], undefined, true);

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Montante como item/ }),
    );

    // §7.8: o botão tem que funcionar com os dois modos ligados. Era o mesmo
    // tipo de conflito do chanfro (bug 2) — uma camada por cima engolindo o
    // clique.
    await waitFor(() => {
      expect(currentInventory().items).toHaveLength(1);
    });
  });

  it("desmarcar DESLIGA os dois lados e mantém o item (§7.3)", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon({ name: "Montante" })]);

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Montante como item/ }),
    );
    await waitFor(() => expect(currentInventory().items).toHaveLength(1));

    await user.click(
      screen.getByRole("button", {
        name: /Deixar de tratar Montante como item/,
      }),
    );

    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.weapons[0]?.itemId).toBeNull();
      expect(inv.weapons[0]?.isItem).toBe(false);
      // O item FICA — §7.3 sugere manter, porque remover pode apagar algo que
      // o usuário queira.
      expect(inv.items).toHaveLength(1);
      expect(inv.items[0]?.weaponData).toBeNull();
    });
  });

  it("renomear a arma ATUALIZA o item (§7.4)", async () => {
    const user = userEvent.setup();
    await seedWith([], [weapon()]);

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Espada longa como item/ }),
    );
    await waitFor(() => expect(currentInventory().items).toHaveLength(1));

    await user.dblClick(
      // O rótulo real é "Nome da arma: <nome>. Clique duas vezes para
      // editar." — com dois-pontos. Sem eles, o `getByRole` não casa.
      screen.getByRole("button", { name: /Nome da arma: Espada longa/ }),
    );
    const input = await screen.findByRole("textbox", { name: /Nome da arma/ });

    // ───────────────────────────────────────────────────────────────────────────
    // POR QUE `fireEvent` E NÃO `userEvent.type`
    //
    // `user.type` CLICA no campo antes de digitar. Esse clique provoca um
    // `blur`, e o `useInlineEdit` trata o blur como fim de edição:
    //
    //     const handleBlur = () => { if (draft !== value) commit(draft);
    //                                setEditing(false); }
    //
    // A edição fecha no meio da digitação, o resto das teclas vai para o
    // botão já renderizado de novo, e o Enter não encontra campo nenhum. O
    // sintoma é "o nome não mudou" — sem erro e sem aviso.
    //
    // O `fireEvent` monta o valor e despacha a tecla DIRETO no input, sem
    // foco, sem clique e sem blur no meio. É determinístico, e é o que o
    // componente realmente responde.
    // ───────────────────────────────────────────────────────────────────────────
    fireEvent.change(input, { target: { value: "Montante" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // §7.4: uma única fonte da verdade. Sem isso, o jogador via "Montante" na
    // aba Armas e "Espada" na aba Itens — e nenhuma das duas estava errada.
    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.weapons[0]?.name).toBe("Montante");
      expect(inv.items[0]?.name).toBe("Montante");
    });
  });

  it("o limite de itens vira AVISO, não erro (§7.7)", async () => {
    const user = userEvent.setup();
    await seedWith(
      Array.from({ length: MAX_ITEMS }, (_, i) =>
        item({ id: `i${i}`, name: `Item ${i}` }),
      ),
      [weapon({ name: "Montante" })],
    );

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Tratar Montante como item/ }),
    );

    // O jogador precisa saber o motivo, e a arma não pode ficar marcada sem
    // item — um estado que mente.
    expect(await screen.findByText(/Limite de .*itens atingido/)).toBeDefined();
    expect(currentInventory().weapons[0]?.isItem).toBe(false);
    expect(currentInventory().items).toHaveLength(MAX_ITEMS);
  });
});

describe("Inventário — equipar o item (§7.6)", () => {
  it("o botão Equipar só aparece em item que VEIO de arma", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({
          id: "it-comprado",
          name: "Poção",
          weaponData: null,
        }),
      ],
      [],
    );

    await openTab(user, "Itens");

    // Um item comprado na loja não tem o que restaurar. Um botão "Equipar" que
    // não fizesse nada seria pior que botão nenhum.
    expect(screen.queryByRole("button", { name: "Equipar Poção" })).toBeNull();
  });

  it("aparece no item com arquivo e restaura a arma", async () => {
    const user = userEvent.setup();
    // ───────────────────────────────────────────────────────────────────────
    // FIXTURE REALISTA
    //
    // O §7.2 manda o item nascer com o MESMO nome da arma e ligado por
    // `itemId`. A primeira versão deste teste usava "Espada Rúnica" no item e
    // "Espada" na arma — o que o app nunca produz, e fazia o fallback por nome
    // (que só existe para ficha importada) não casar. O teste medindo uma
    // situação impossível é pior que não ter teste.
    // ───────────────────────────────────────────────────────────────────────
    await seedWith(
      [
        item({
          id: "it-espada",
          name: "Espada longa",
          weaponData: {
            die: "d8",
            diceCount: 2,
            attackBonus: 6,
            attributeIds: [],
            color: null,
            isItem: true,
          },
        }),
      ],
      // A arma que restaura: mantem o vínculo, mas já foi "gasta".
      [
        weapon({
          id: "wp-1",
          itemId: "it-espada",
          die: "d4",
          attackBonus: 0,
        }),
      ],
    );

    await openTab(user, "Itens");

    const equipar = screen.getByRole("button", {
      name: /^Equipar Espada longa/,
    });
    expect(equipar).toBeDefined();

    await user.click(equipar);

    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.weapons[0]?.die).toBe("d8");
      expect(inv.weapons[0]?.attackBonus).toBe(6);
      expect(inv.items[0]?.equippedWeaponId).toBe(inv.weapons[0]?.id);
    });
  });

  it("NÃO duplica a arma ao equipar duas vezes", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({
          id: "it-espada",
          name: "Espada longa",
          weaponData: {
            die: "d8",
            diceCount: 1,
            attackBonus: 0,
            attributeIds: [],
            color: null,
            isItem: true,
          },
        }),
      ],
      [weapon({ id: "wp-1", itemId: "it-espada" })],
    );

    await openTab(user, "Itens");

    await user.click(
      screen.getByRole("button", { name: /^Equipar Espada longa/ }),
    );
    await waitFor(() =>
      expect(currentInventory().items[0]?.equippedWeaponId).toBeTruthy(),
    );

    // Depois de equipada, o botão vira "Desequipar" — o próprio estado
    // impede o segundo toque de criar outra arma.
    await user.click(
      screen.getByRole("button", { name: /^Desequipar Espada longa/ }),
    );

    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.items[0]?.equippedWeaponId).toBeNull();
      expect(inv.weapons).toHaveLength(1);
    });
  });

  it("desequipar mantém a arma na aba Armas", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({
          id: "it-espada",
          name: "Espada longa",
          weaponData: {
            die: "d8",
            diceCount: 1,
            attackBonus: 0,
            attributeIds: [],
            color: null,
            isItem: true,
          },
        }),
      ],
      [weapon({ id: "wp-1", itemId: "it-espada" })],
    );

    await openTab(user, "Itens");
    await user.click(
      screen.getByRole("button", { name: /^Equipar Espada longa/ }),
    );
    await waitFor(() =>
      expect(currentInventory().items[0]?.equippedWeaponId).toBeTruthy(),
    );
    await user.click(
      screen.getByRole("button", { name: /^Desequipar Espada longa/ }),
    );

    // §7.6 e o princípio geral: desequipar é operação de rotina. Apagar a
    // arma seria um botão destrutivo disfarçado.
    await waitFor(() => {
      expect(currentInventory().weapons).toHaveLength(1);
    });
  });

  it("equipar um item SEM arma RECRIA a arma (§7.6)", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({
          id: "it-orfa",
          name: "Espada Perdida",
          weaponData: {
            die: "d6",
            diceCount: 2,
            attackBonus: 8,
            attributeIds: ["attr-for"],
            color: null,
            isItem: true,
          },
        }),
      ],
      // A aba Armas está vazia: o jogador removeu a espada e guardou o item.
      [],
    );

    await openTab(user, "Itens");
    await user.click(
      screen.getByRole("button", { name: /^Equipar Espada Perdida/ }),
    );

    // É esse o gesto que o §7.6 descreve: "equipar o item recria/relinka a
    // arma restaurando os dados salvos".
    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.weapons).toHaveLength(1);
      expect(inv.weapons[0]?.name).toBe("Espada Perdida");
      expect(inv.weapons[0]?.die).toBe("d6");
      expect(inv.weapons[0]?.attackBonus).toBe(8);
      expect(inv.weapons[0]?.attributeIds).toEqual(["attr-for"]);
    });
  });

  it("recriar a arma NOMEIA o id uma vez só", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({
          id: "it-orfa",
          name: "Espada Perdida",
          weaponData: {
            die: "d8",
            diceCount: 1,
            attackBonus: 0,
            attributeIds: [],
            color: null,
            isItem: true,
          },
        }),
      ],
      [],
    );

    await openTab(user, "Itens");
    await user.click(
      screen.getByRole("button", { name: /^Equipar Espada Perdida/ }),
    );

    // A arma recriada e o `equippedWeaponId` têm que apontar um para o
    // outro. Chamar o construtor duas vezes geraria dois ids, e o vínculo
    // ficaria apontando para uma arma que não existe.
    await waitFor(() => {
      const inv = currentInventory();
      expect(inv.items[0]?.equippedWeaponId).toBe(inv.weapons[0]?.id);
    });
  });
});

/** Troca para a aba pedida. */
async function openTab(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("tab", { name: `Aba ${label}` }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetSheetStoreForTests();
});

/* ===========================================================================
 * ABAS
 * ========================================================================== */

describe("Inventário — abas", () => {
  it("tem as duas abas da §8.2", async () => {
    await seedWith([], []);

    expect(screen.getByRole("tab", { name: "Aba Armas" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Aba Itens" })).toBeDefined();
  });

  it("abre em Armas", async () => {
    await seedWith([item()], [weapon()]);

    expect(screen.getByText("Espada longa")).toBeDefined();
    expect(screen.queryByText("Poção")).toBeNull();
  });

  it("troca para Itens", async () => {
    const user = userEvent.setup();
    await seedWith([item()], [weapon()]);

    await openTab(user, "Itens");

    expect(screen.getByText("Poção")).toBeDefined();
    expect(screen.queryByText("Espada longa")).toBeNull();
  });

  it("cada aba mostra a contagem contra o limite", async () => {
    const user = userEvent.setup();
    await seedWith([item()], [weapon()]);

    expect(screen.getByText(`1 de ${MAX_WEAPONS} armas`)).toBeDefined();

    await openTab(user, "Itens");
    expect(screen.getByText(`1 de ${MAX_ITEMS} itens`)).toBeDefined();
  });

  it("explica o que fazer quando está vazio", async () => {
    const user = userEvent.setup();
    await seedWith([], []);

    expect(screen.getByText(/Nenhuma arma/)).toBeDefined();

    await openTab(user, "Itens");
    expect(screen.getByText(/Nenhum item/)).toBeDefined();
  });
});

/* ===========================================================================
 * PESO — A REGRA QUE NÃO BLOQUEIA
 * ========================================================================== */

describe("Inventário — peso e capacidade (§8.2)", () => {
  it("mostra peso total e capacidade", async () => {
    const user = userEvent.setup();
    await seedWith([item({ weight: 3, quantity: 4 })], []);

    await openTab(user, "Itens");
    // 3 × 4 = 12
    expect(screen.getByText(/12 \/ 50 kg/)).toBeDefined();
  });

  it("acima da capacidade: VERMELHO, mas o item continua editável", async () => {
    const user = userEvent.setup();
    await seedWith([item({ weight: 40, quantity: 2 })], []);

    await openTab(user, "Itens");

    expect(screen.getByText(/acima da capacidade/)).toBeDefined();

    // A §8.2 é explícita: avisa sem bloquear. Travar a edição transformaria o
    // inventário num formulário que só aceita um estado.
    await user.dblClick(
      screen.getByRole("button", { name: /Quantidade de Poção/ }),
    );
    expect(
      screen.getByRole("textbox", { name: /Quantidade de Poção/ }),
    ).toBeDefined();
  });

  it("a barra expõe peso e capacidade como progressbar", async () => {
    const user = userEvent.setup();
    await seedWith([item({ weight: 5, quantity: 2 })], []);

    await openTab(user, "Itens");

    const bar = screen.getByRole("progressbar", {
      name: "Peso contra a capacidade de carga",
    });
    expect(bar.getAttribute("aria-valuenow")).toBe("10");
    expect(bar.getAttribute("aria-valuemax")).toBe("50");
  });

  it("a capacidade só edita no lápis do bloco", async () => {
    const user = userEvent.setup();
    await seedWith([item()], []);

    expect(
      screen.queryByRole("textbox", { name: /Capacidade de carga/ }),
    ).toBeNull();

    await openBlockEdit(user);
    expect(
      screen.getByRole("textbox", { name: /Capacidade de carga/ }),
    ).toBeDefined();
  });

  it("mudar a capacidade atualiza a barra", async () => {
    const user = userEvent.setup();
    await seedWith([item({ weight: 10, quantity: 2 })], []);
    await openBlockEdit(user);

    const input = screen.getByRole("textbox", { name: /Capacidade de carga/ });
    await user.clear(input);
    await user.type(input, "500");

    await waitFor(() => expect(screen.getByText(/20 \/ 500 kg/)).toBeDefined());
  });
});

/* ===========================================================================
 * VENDA
 * ========================================================================== */

describe("Inventário — venda (§11)", () => {
  it("sem sellEnabled, o botão Vender NÃO EXISTE", async () => {
    const user = userEvent.setup();
    await seedWith([item()], [], { sellEnabled: false });

    await openTab(user, "Itens");

    // Cinza sugeriria "quebrado". Desligado é "desligado".
    expect(screen.queryByRole("button", { name: "Vender Poção" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Vender tudo/ })).toBeNull();
  });

  it("com sellEnabled, o botão Vender aparece", async () => {
    const user = userEvent.setup();
    await seedWith([item()], [], { sellEnabled: true });

    await openTab(user, "Itens");
    expect(screen.getByRole("button", { name: "Vender Poção" })).toBeDefined();
  });

  it("vender um item comum não pede confirmação", async () => {
    const user = userEvent.setup();
    await seedWith([item({ value: 10, quantity: 2 })], [], {
      sellEnabled: true,
    });
    await openTab(user, "Itens");

    await user.click(screen.getByRole("button", { name: "Vender Poção" }));

    await waitFor(() => expect(currentSheet().inventory.items).toHaveLength(0));
    expect(currentSheet().inventory.money.value).toBe(20);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("vender um FAVORITO pede confirmação explícita", async () => {
    const user = userEvent.setup();
    await seedWith([item({ favorite: true })], [], { sellEnabled: true });
    await openTab(user, "Itens");

    await user.click(screen.getByRole("button", { name: "Vender Poção" }));

    // Pode ser intencional ("já usei a Joia") — o botão sozinho não
    // distingue isso de um engano.
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("favorito");

    // Nada foi vendido ainda.
    expect(currentSheet().inventory.items).toHaveLength(1);
  });

  it("cancelar a confirmação não vende", async () => {
    const user = userEvent.setup();
    await seedWith([item({ favorite: true })], [], { sellEnabled: true });
    await openTab(user, "Itens");

    await user.click(screen.getByRole("button", { name: "Vender Poção" }));
    await user.click(screen.getByRole("button", { name: "Cancelar venda" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(currentSheet().inventory.items).toHaveLength(1);
  });

  it("confirmar a venda do favorito vende", async () => {
    const user = userEvent.setup();
    await seedWith([item({ favorite: true, value: 7, quantity: 3 })], [], {
      sellEnabled: true,
    });
    await openTab(user, "Itens");

    await user.click(screen.getByRole("button", { name: "Vender Poção" }));
    await user.click(
      screen.getByRole("button", { name: "Confirmar venda do favorito" }),
    );

    await waitFor(() => expect(currentSheet().inventory.items).toHaveLength(0));
    expect(currentSheet().inventory.money.value).toBe(21);
  });

  it("'Vender tudo' NÃO leva os favoritos, e avisa quantos ficaram", async () => {
    const user = userEvent.setup();
    await seedWith(
      [
        item({ id: "a", name: "Corda", value: 5, quantity: 1 }),
        item({
          id: "b",
          name: "Joia",
          value: 999,
          quantity: 1,
          favorite: true,
        }),
        item({ id: "c", name: "Tocha", value: 1, quantity: 1 }),
      ],
      [],
      { sellEnabled: true },
    );
    await openTab(user, "Itens");

    await user.click(
      screen.getByRole("button", { name: /Vender todos os itens/ }),
    );

    await waitFor(() =>
      expect(currentSheet().inventory.items.map((i) => i.id)).toEqual(["b"]),
    );
    expect(currentSheet().inventory.money.value).toBe(6);

    // O aviso é obrigatório: sumir com o favorito em silêncio é o pior modo
    // de "não vendi o favorito".
    const notice = screen.getByText(/Favoritos preservados: Joia/);
    expect(notice).toBeDefined();
  });

  it("'Vender tudo' sem favoritos avisa só o total", async () => {
    const user = userEvent.setup();
    await seedWith([item({ value: 4, quantity: 1 })], [], {
      sellEnabled: true,
    });
    await openTab(user, "Itens");

    await user.click(
      screen.getByRole("button", { name: /Vender todos os itens/ }),
    );

    await waitFor(() =>
      expect(screen.getByText(/Vendidos 1 itens por 4/)).toBeDefined(),
    );
  });

  it("'Vender tudo' só aparece na aba Itens", async () => {
    await seedWith([item()], [weapon()], { sellEnabled: true });

    expect(screen.queryByRole("button", { name: /Vender tudo/ })).toBeNull();
  });
});

/* ===========================================================================
 * FAVORITO
 * ========================================================================== */

describe("Inventário — favorito", () => {
  it("é visível SEM modo de edição — é estado, não controle", async () => {
    const user = userEvent.setup();
    await seedWith([item({ favorite: true })], []);

    await openTab(user, "Itens");
    expect(screen.getByTitle("Favorito")).toBeDefined();
  });

  it("só pode MARCAR no lápis do bloco", async () => {
    const user = userEvent.setup();
    await seedWith([item()], []);
    await openTab(user, "Itens");

    expect(
      screen.queryByRole("button", { name: /Marcar Poção como favorito/ }),
    ).toBeNull();

    await openBlockEdit(user);
    await user.click(
      screen.getByRole("button", { name: /Marcar Poção como favorito/ }),
    );

    await waitFor(() =>
      expect(currentSheet().inventory.items[0]?.favorite).toBe(true),
    );
  });
});

/* ===========================================================================
 * ARMAS
 * ========================================================================== */

describe("Inventário — armas", () => {
  it("mostra a dádica com a quantidade de dados", async () => {
    await seedWith([], [weapon({ diceCount: 2, die: "d6" })]);

    expect(screen.getByText("2d6")).toBeDefined();
  });

  it('a dádica NÃO multiplica o dado: 3d6 continua escrito "3d6"', async () => {
    // A §8.2.1 proíbe que `diceCount` multiplique o valor. Mostrar a conta
    // pronta na tela seria mostrar "18" e o jogador não saberia se são
    // três sorteios ou um multiplied.
    await seedWith([], [weapon({ diceCount: 3, die: "d6" })]);

    expect(screen.getByText("3d6")).toBeDefined();
    expect(screen.queryByText("18")).toBeNull();
  });

  it("mostra os atributos vinculados com o valor", async () => {
    // O `seedWith` DEVOLVE a ficha semeada — só assim o id do atributo é o
    // mesmo que existe no bloco. Com duas fichas distintas, o vínculo viraria
    // órfão e o teste passaria errado.
    const base = createSheet(INPUT);
    const forca = base.attributes.find((a) => a.name === "Força")!;

    const sheet = await seedSheetWith({
      ...base,
      inventory: {
        ...base.inventory,
        weapons: [weapon({ attributeIds: [forca.id] })],
        items: [],
      },
    });
    render(<Harness />);

    expect(
      screen.getByText(new RegExp(`^${forca.name} \\(${forca.value}\\)$`)),
    ).toBeDefined();
    expect(sheet.inventory.weapons[0]?.attributeIds).toEqual([forca.id]);
  });

  it("ATRIBUTO ÓRFÃO não é mostrado — seria mentira na tela", async () => {
    await seedWith([], [weapon({ attributeIds: ["fantasma"] })]);

    expect(screen.queryByText(/fantasma/)).toBeNull();
  });

  it("o botão de rolar fica no POPUP, não sobre a linha", async () => {
    await seedWith([], [weapon()]);

    expect(screen.queryByRole("menuitem", { name: /^Rolar$/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rolar Espada longa" }),
    ).toBeDefined();
  });

  it("o popup da arma tem UM item só, e mostra a dádica", async () => {
    await seedWith([], [weapon({ diceCount: 2, die: "d8" })]);

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "Rolar Espada longa" }),
    );

    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    expect(menu.textContent).toContain("2d8");
  });

  it("rolar a arma registra o resultado com os dados independentes", async () => {
    await seedWith([], [weapon({ diceCount: 2, die: "d8" })]);

    fireEvent.contextMenu(
      screen.getByRole("button", { name: "Rolar Espada longa" }),
    );
    const menu = await screen.findByRole("menu");
    await userEvent
      .setup()
      .click(
        within(menu).getByRole("menuitem", { name: "Rolar Espada longa" }),
      );

    await waitFor(() => expect(currentSheet().rollHistory).toHaveLength(1));

    const [roll] = currentSheet().rollHistory;
    expect(roll?.kind).toBe("weapon");
    expect(roll?.label).toBe("Espada longa");
    // DOIS valores sorteados, não um dobrado.
    expect(roll?.dice).toHaveLength(2);
    const registro = roll!;
    expect(registro.total).toBe(
      registro.dice.reduce((a, b) => a + b, 0) +
        registro.components.reduce((a, b) => a + b.value, 0),
    );
  });

  it("remover a arma NÃO remove o item correspondente", async () => {
    const user = userEvent.setup();
    await seedWith(
      [item({ id: "it-esp", name: "Espada guardada" })],
      [weapon({ itemId: "it-esp" })],
    );
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Remover arma Espada longa" }),
    );

    await waitFor(() =>
      expect(currentSheet().inventory.weapons).toHaveLength(0),
    );
    expect(currentSheet().inventory.items).toHaveLength(1);
  });

  it("desequipar desliga o vínculo dos dois lados", async () => {
    const user = userEvent.setup();
    await seedWith(
      [item({ id: "it-esp", equippedWeaponId: "wp-1" })],
      [weapon({ itemId: "it-esp" })],
    );
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: /^Desequipar Espada longa/ }),
    );

    await waitFor(() =>
      expect(currentSheet().inventory.weapons[0]?.itemId).toBeNull(),
    );
    expect(currentSheet().inventory.items[0]?.equippedWeaponId).toBeNull();
  });
});

/* ===========================================================================
 * CRIAÇÃO E LIMITE
 * ========================================================================== */

describe("Inventário — criação", () => {
  it('o "+" NAO aparece no Editar Geral', async () => {
    await seedWith([], [], undefined, true);

    // Adendo, secao 1: criar e decisao sobre o CONTEUDO da ficha. O modo de
    // reorganizacao da tela nao e o lugar dela.
    expect(screen.queryByRole("button", { name: "Adicionar arma" })).toBeNull();
    void 0;
  });

  it('o "+" acompanha a aba visivel, pelo lapis do bloco', async () => {
    const user = userEvent.setup();
    await seedWith([], []);

    // Fora do lapis, nenhuma aba mostra o "+".
    expect(screen.queryByRole("button", { name: "Adicionar arma" })).toBeNull();

    await openBlockEdit(user);
    // Aba Armas: o "+" cria ARMA.
    expect(
      screen.getByRole("button", { name: "Adicionar arma" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Adicionar item" })).toBeNull();

    await openTab(user, "Itens");
    // Aba Itens: o MESMO "+" cria ITEM. Um botao que agisse nas duas seria
    // adivinhacao; o painel sabe qual aba esta aberta.
    expect(
      screen.getByRole("button", { name: "Adicionar item" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Adicionar arma" })).toBeNull();
  });

  it("criar item adiciona a ficha", async () => {
    const user = userEvent.setup();
    await seedWith([], []);
    await openBlockEdit(user);
    await openTab(user, "Itens");

    await user.click(screen.getByRole("button", { name: "Adicionar item" }));

    await waitFor(() => expect(currentSheet().inventory.items).toHaveLength(1));
    expect(currentSheet().inventory.items[0]?.quantity).toBe(1);
  });

  it("criar arma adiciona a ficha", async () => {
    const user = userEvent.setup();
    await seedWith([], []);
    await openBlockEdit(user);

    await user.click(screen.getByRole("button", { name: "Adicionar arma" }));

    await waitFor(() =>
      expect(currentSheet().inventory.weapons).toHaveLength(1),
    );
    expect(currentSheet().inventory.weapons[0]?.diceCount).toBe(1);
  });

  it('o "+" desativa no limite de itens', async () => {
    const user = userEvent.setup();
    const base = createSheet(INPUT);
    await seedSheet({
      ...base,
      inventory: {
        ...base.inventory,
        items: Array.from({ length: MAX_ITEMS }, (_, i) =>
          item({ id: `i${i}`, name: `Item ${i}` }),
        ),
      },
    });
    render(<Harness editMode />);
    await user.click(screen.getByRole("button", { name: "Editar bloco" }));
    await openTab(user, "Itens");

    const add = screen.getByRole("button", {
      name: "Limite de itens atingido",
    });
    expect(add.hasAttribute("disabled")).toBe(true);

    await user.click(add);
    expect(currentSheet().inventory.items).toHaveLength(MAX_ITEMS);
  });
});

/* ===========================================================================
 * EDIÇÃO INLINE
 * ========================================================================== */

describe("Inventário — edição inline", () => {
  it("duplo clique no nome edita; Enter grava", async () => {
    const user = userEvent.setup();
    await seedWith([item()], []);
    await openTab(user, "Itens");

    await user.dblClick(screen.getByText("Poção"));
    const input = screen.getByRole("textbox", { name: /Nome do item Poção/ });

    await user.clear(input);
    await user.type(input, "Tônico");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(currentSheet().inventory.items[0]?.name).toBe("Tônico"),
    );
  });

  it("duplo clique no valor edita; Enter grava", async () => {
    const user = userEvent.setup();
    await seedWith([item({ value: 10 })], []);
    await openTab(user, "Itens");

    await user.dblClick(
      screen.getByRole("button", { name: /Valor de Poção: 10/ }),
    );
    const input = screen.getByRole("textbox", { name: /Valor de Poção/ });

    await user.clear(input);
    await user.type(input, "99");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(currentSheet().inventory.items[0]?.value).toBe(99),
    );
  });

  it("texto não numérico no peso vira 0, não o texto", async () => {
    const user = userEvent.setup();
    await seedWith([item({ weight: 5 })], []);
    await openTab(user, "Itens");

    await user.dblClick(
      screen.getByRole("button", { name: /Peso de Poção: 5/ }),
    );
    const input = screen.getByRole("textbox", { name: /Peso de Poção/ });

    await user.clear(input);
    await user.type(input, "abc");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(currentSheet().inventory.items[0]?.weight).toBe(0),
    );
  });

  it("o preset de raridade grava a cor do item", async () => {
    const user = userEvent.setup();
    await seedWith([item()], []);
    await openTab(user, "Itens");
    await openBlockEdit(user);

    await user.click(
      screen.getByRole("button", { name: "Raridade de Poção: Raro" }),
    );

    await waitFor(() =>
      expect(currentSheet().inventory.items[0]?.color).not.toBeNull(),
    );
  });

  it("o dinheiro edita por duplo clique", async () => {
    const user = userEvent.setup();
    await seedWith([], []);

    await user.dblClick(screen.getByRole("button", { name: /Saldo de Ouro/ }));
    const input = screen.getByRole("textbox", { name: /Saldo de Ouro/ });

    await user.clear(input);
    await user.type(input, "250");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(currentSheet().inventory.money.value).toBe(250));
  });
});
