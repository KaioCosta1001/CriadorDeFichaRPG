"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";

import { RuneButton } from "@/components/ui/RuneButton";
import {
  CoinIcon,
  PencilIcon,
  PlusIcon,
  ScaleIcon,
} from "@/components/ui/icons";
import {
  CARRY_CAPACITY_MAX,
  DND_ACTIVATION_DISTANCE_PX,
  INVENTORY_TABS,
  MAX_ITEMS,
  MAX_WEAPONS,
  MONEY_LABEL_MAX_LENGTH,
  NOTICE_LIMIT_REACHED,
  type InventoryTabId,
} from "@/config/constants";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import { generateId } from "@/lib/id";
import type { Inventory, Item, Money, Weapon } from "@/schemas";

import {
  canAddItem,
  canAddWeapon,
  equipWeapon,
  removeItem,
  removeWeapon,
  renameItem,
  renameWeapon,
  sellItems,
  sellSingleItem,
  setWeaponIsItem,
  summarizeCarry,
  unequipWeapon,
} from "@/domain/inventory";
import { ItemRow } from "./ItemRow";
import { WeaponRow } from "./WeaponRow";
import type { PanelProps } from "../registry";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE INVENTÁRIO (seção 8.2)                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Duas abas — **Armas** e **Itens** — mais a barra de peso/dinheiro no rodapé.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O PESO ESTÁ NUMA BARRA E NÃO NUM TEXTO SOLTO
 * A §8.2 exige que o excesso fique em vermelho sem bloquear. Uma barra mostra
 * o quanto falta de uma vistazo; um texto obriga o jogador a subtrair de
 * cabeça — que é o trabalho que o app existe para eliminar. A cor faz o
 * alerta, a barra faz a conta.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A BARRA É SEMPRE VISÍVEL
 * Se ela só aparecesse quando o peso estourasse, o jogador só a conheceria
 * no pior momento. Sempre visível, ela ensina a capacidade antes de ser
 * preciso consultá-la.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * "VENDER TUDO" RESPETA O FAVORITO
 * A ação em massa nunca leva um item marcado como favorito — e o retorno de
 * `sellItems` diz quantos ficaram, para o painel avisar em vez de sumir com o
 * trabalho do usuário em silêncio.
 */
export function InventoryPanel({ context }: PanelProps) {
  const [tab, setTab] = useState<InventoryTabId>("weapons");
  const [blockEdit, setBlockEdit] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSell, setConfirmSell] = useState<Item | null>(null);

  const { sheet } = context;
  const inventory = sheet.inventory;
  const sellEnabled = sheet.settings.sellEnabled;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const carry = summarizeCarry(inventory);

  /* ── Inventário ─────────────────────────────────────────────────────── */

  function setInventory(next: Inventory) {
    context.mutate((current) => ({ ...current, inventory: next }));
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║  POR QUE ESTES TRECHOS TÊM REGRA DENTRO (adendo §7)                       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * patchWeapon e patchItem escrevem UM campo. Os dois casos que precisam
   * tocar as DUAS listas ao mesmo tempo ficam aqui:
   *
   *  - 
ame: a arma é a fonte do nome e o item espelha (§7.4 — uma única
   *    fonte da verdade). Sem isso, renomear a arma deixa o item com o nome
   *    antigo, e o jogador vê duas entradas com nomes diferentes para a mesma
   *    coisa.
   *
   *  - isItem: é o botão "Isto é um item" (§7). A regra está em
   *    domain/inventory.ts; aqui só se traduz o locked numa mensagem.
   * ───────────────────────────────────────────────────────────────────────────
   */
  function patchWeapon(weaponId: string, change: Partial<Weapon>) {
    // Renomear propaga para o item espelhado.
    if (change.name !== undefined) {
      setInventory(renameWeapon(inventory, weaponId, change.name));
      return;
    }

    setInventory({
      ...inventory,
      weapons: inventory.weapons.map((weapon) =>
        weapon.id === weaponId ? { ...weapon, ...change } : weapon,
      ),
    });
  }

  function patchItem(itemId: string, change: Partial<Item>) {
    // Renomear na aba Itens propaga para a arma vinculada, pela mesma regra.
    if (change.name !== undefined) {
      setInventory(renameItem(inventory, itemId, change.name));
      return;
    }

    setInventory({
      ...inventory,
      items: inventory.items.map((item) =>
        item.id === itemId ? { ...item, ...change } : item,
      ),
    });
  }

  /**
   * Liga ou desliga "Isto é um item" (adendo §7).
   *
   * A regra inteira vive em setWeaponIsItem. Este passo só traduz o
   * locked numa mensagem — o limite de itens é um aviso, não um erro: o
   * jogador pode desmarcar e tentar de novo.
   */
  function toggleIsItem(weapon: Weapon) {
    const resultado = setWeaponIsItem(inventory, weapon.id, !weapon.isItem);

    setInventory(resultado.inventory);

    if (resultado.blocked === "limite-de-itens") {
      setNotice(NOTICE_LIMIT_REACHED(MAX_ITEMS, "itens"));
    }
  }

  /**
   * Equipa ou desequipa um item como arma (adendo §7.6).
   *
   * ───────────────────────────────────────────────────────────────────────────
   * EQUIPAR RESTAURA; DESEQUIPAR SÓ DESLIGA
   *
   * Equipar devolve o `weaponData` do item para a arma correspondente. Se a
   * arma não existe mais na aba Armas (o jogador a removeu de lá mantendo o
   * item), ela é RECRIADA a partir do arquivo — é esse o gesto que o §7.6
   * descreve: "equipar o item recria/relinka a arma".
   *
   * Desequipar é o inverso: a arma continua na aba Armas, com o que o jogador
   * tiver digitado. Perder a arma ao desequipar seria um botão destrutivo
   * disfarçado de operação de rotina.
   * ───────────────────────────────────────────────────────────────────────────
   */
  function toggleEquip(item: Item) {
    if (!item.weaponData) return;

    // Desequipar: a arma fica, perde só a ponte.
    if (item.equippedWeaponId) {
      setInventory(unequipWeapon(inventory, item.equippedWeaponId));
      return;
    }

    // Equipar: procura a arma de origem; se não houver, recria a partir do
    // arquivo.
    //
    // ───────────────────────────────────────────────────────────────────────
    // POR QUE HÁ TRÊS CAMINHOS DE BUSCA
    //
    // 1. `item.equippedWeaponId` — a arma que ESTE item equipou antes. É o
    //    caminho mais direto.
    //
    // 2. `weapon.itemId === item.id` — a arma que este item ORIGINOU, ainda na
    //    aba Armas e nunca desequipada. É o caso comum: o jogador marcou "Isto
    //    é um item" e agora quer equipar.
    //
    // 3. `weapon.name === item.name` — ficha importada ou digitada à mão, sem
    //    nenhum dos dois vínculos. Sem este passo, equipar criaria uma arma
    //    DUPLICADA de uma que já estava ali.
    //
    // O passo 3 casa por nome, que não é id — e por isso só acontece quando o
    // item tem `weaponData`, ou seja, quando PROVA que veio de uma arma. Com o
    // arquivo à mão, nome igual é boa evidência; sem ele, seria adivinhação.
    // ───────────────────────────────────────────────────────────────────────
    const origem =
      inventory.weapons.find((arma) => arma.id === item.equippedWeaponId) ??
      inventory.weapons.find((arma) => arma.itemId === item.id) ??
      inventory.weapons.find((arma) => arma.name === item.name);

    if (origem) {
      setInventory(equipWeapon(inventory, origem.id, item.id));
      return;
    }

    if (!canAddWeapon(inventory)) {
      setNotice(NOTICE_LIMIT_REACHED(MAX_WEAPONS, "armas"));
      return;
    }

    // A arma é montada UMA vez e usada duas vezes. Chamar `weaponFromItem`
    // nas duas posições geraria DOIS ids — e `equipWeapon` não encontraria
    // a arma que acabou de criar, deixando o item equipado com um id morto.
    const recriada = weaponFromItem(item);

    setInventory(
      equipWeapon(
        { ...inventory, weapons: [...inventory.weapons, recriada] },
        recriada.id,
        item.id,
      ),
    );
  }

  /**
   * Recria a arma a partir do arquivo do item (adendo §7.6).
   *
   * O `id` é NOVO de propósito: é a arma que o jogador não tem mais, não a
   * que ele apagou. O `itemId` e o `equippedWeaponId` se cruzam, e é esse
   * par que faz `equipWeapon` encontrar a arma na próxima vez em vez de criar
   * outra.
   */
  function weaponFromItem(item: Item): Weapon {
    const dados = item.weaponData;
    return {
      id: generateId(),
      name: item.name,
      die: dados?.die ?? "1d6",
      diceCount: dados?.diceCount ?? 1,
      attackBonus: dados?.attackBonus ?? 0,
      attributeIds: [...(dados?.attributeIds ?? [])],
      color: dados?.color ?? null,
      itemId: item.id,
      isItem: dados?.isItem ?? true,
    };
  }

  function patchMoney(change: Partial<Money>) {
    setInventory({ ...inventory, money: { ...inventory.money, ...change } });
  }

  /* ── Ações ──────────────────────────────────────────────────────────── */

  function addWeapon() {
    if (!canAddWeapon(inventory)) return;
    const weapon: Weapon = {
      id: generateId(),
      name: "",
      die: "d6",
      diceCount: 1,
      attackBonus: 0,
      attributeIds: [],
      color: null,
      itemId: null,
      isItem: false,
    };
    setInventory({ ...inventory, weapons: [...inventory.weapons, weapon] });
    setNotice(null);
  }

  function addItem() {
    if (!canAddItem(inventory)) return;
    const item: Item = {
      id: generateId(),
      name: "",
      weight: 0,
      quantity: 1,
      value: 0,
      color: null,
      favorite: false,
      weaponData: null,
      equippedWeaponId: null,
    };
    setInventory({ ...inventory, items: [...inventory.items, item] });
    setNotice(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (tab === "weapons") {
      const from = inventory.weapons.findIndex((w) => w.id === active.id);
      const to = inventory.weapons.findIndex((w) => w.id === over.id);
      if (from !== -1 && to !== -1) {
        setInventory({
          ...inventory,
          weapons: arrayMove(inventory.weapons, from, to),
        });
      }
    } else {
      const from = inventory.items.findIndex((i) => i.id === active.id);
      const to = inventory.items.findIndex((i) => i.id === over.id);
      if (from !== -1 && to !== -1) {
        setInventory({
          ...inventory,
          items: arrayMove(inventory.items, from, to),
        });
      }
    }
  }

  /**
   * Vende UM item. O favorito passa por confirmação explícita — pode ser
   * intencional ("já usei a Joia"), e o botão sozinho não distingue isso de
   * um engano.
   */
  function sellOne(item: Item) {
    if (item.favorite) {
      setConfirmSell(item);
      return;
    }

    const result = sellSingleItem(inventory, item, sellEnabled);
    setInventory(result.inventory);
    setNotice(`${item.name || "Item"} vendido por ${result.earned} 🪙.`);
  }

  function sellAll() {
    const result = sellItems(inventory, inventory.items, sellEnabled);

    setInventory(result.inventory);

    if (result.kept.length > 0) {
      const nomes = result.kept
        .map((item) => item.name || "Sem nome")
        .join(", ");
      setNotice(
        `Vendidos ${inventory.items.length - result.kept.length} itens por ${result.earned} 🪙. Favoritos preservados: ${nomes}.`,
      );
    } else {
      setNotice(
        `Vendidos ${inventory.items.length} itens por ${result.earned} 🪙.`,
      );
    }
  }

  /* ── Barras e rótulos ──────────────────────────────────────────────── */

  const weaponCount = inventory.weapons.length;
  const itemCount = inventory.items.length;

  const title =
    tab === "weapons"
      ? `${weaponCount} de ${MAX_WEAPONS} armas`
      : `${itemCount} de ${MAX_ITEMS} itens`;

  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      {/* ABAS */}
      <div
        role="tablist"
        aria-label="Abas do inventário"
        className="mb-2 flex gap-1"
      >
        {INVENTORY_TABS.map((candidate) => {
          const selected = tab === candidate.id;
          return (
            <RuneButton
              key={candidate.id}
              role="tab"
              aria-selected={selected}
              label={`Aba ${candidate.label}`}
              tone={selected ? "primary" : "accent"}
              className="px-2 text-xs"
              onClick={() => {
                setTab(candidate.id);
                setNotice(null);
              }}
            >
              {candidate.label}
            </RuneButton>
          );
        })}

        <span className="text-text-muted ml-auto min-w-0 flex-1 self-center truncate text-right text-xs">
          {title}
        </span>

        <RuneButton
          aria-pressed={blockEdit}
          label={blockEdit ? "Concluir edição do bloco" : "Editar bloco"}
          onClick={() => {
            setBlockEdit((value) => !value);
            setNotice(null);
          }}
        >
          <PencilIcon />
        </RuneButton>
      </div>

      {/* A barra de peso e dinheiro é SEMPRE visível — ver o cabeçalho. */}
      <CarryBar
        capacity={inventory.carryCapacity}
        moneyLabel={inventory.money.label}
        moneyValue={inventory.money.value}
        onCapacity={(value) =>
          setInventory({
            ...inventory,
            carryCapacity: Math.min(CARRY_CAPACITY_MAX, value),
          })
        }
        onMoneyLabel={(value) =>
          patchMoney({ label: value.slice(0, MONEY_LABEL_MAX_LENGTH) })
        }
        onMoneyValue={(value) => patchMoney({ value })}
        total={carry.total}
        editMode={blockEdit}
      />

      {notice ? (
        <p role="status" className="text-accent mt-1 text-xs">
          {notice}
        </p>
      ) : null}

      {/* A confirmação de venda de favorito mora AQUI, e não em cada linha:
          um `window.confirm` bloquearia a thread, e um Dialog por item
          pesaria mais que o item. */}
      {confirmSell ? (
        <ConfirmFavorito
          item={confirmSell}
          onCancel={() => setConfirmSell(null)}
          onConfirm={() => {
            const result = sellSingleItem(inventory, confirmSell, sellEnabled);
            setInventory(result.inventory);
            setNotice(
              `"${confirmSell.name || "Item"}" vendido por ${result.earned} 🪙.`,
            );
            setConfirmSell(null);
          }}
        />
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={
            tab === "weapons"
              ? inventory.weapons.map((w) => w.id)
              : inventory.items.map((i) => i.id)
          }
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {tab === "weapons"
              ? inventory.weapons.map((weapon) => (
                  <WeaponRow
                    key={weapon.id}
                    attributes={sheet.attributes}
                    context={context}
                    editMode={blockEdit}
                    reorderMode={blockEdit}
                    weapon={weapon}
                    onChange={(change) => patchWeapon(weapon.id, change)}
                    onToggleIsItem={() => toggleIsItem(weapon)}
                    onRemove={() =>
                      setInventory(removeWeapon(inventory, weapon.id))
                    }
                    onUnequip={() =>
                      setInventory(unequipWeapon(inventory, weapon.id))
                    }
                  />
                ))
              : inventory.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    editMode={blockEdit}
                    inventory={inventory}
                    item={item}
                    reorderMode={blockEdit}
                    sellEnabled={sellEnabled}
                    onChange={(change) => patchItem(item.id, change)}
                    onEquip={() => toggleEquip(item)}
                    onRemove={() =>
                      setInventory(removeItem(inventory, item.id))
                    }
                    onSell={() => sellOne(item)}
                  />
                ))}

            {tab === "weapons" && weaponCount === 0 ? (
              <EmptyRow>
                Nenhuma arma. Use o botão + no Editar Geral para criar.
              </EmptyRow>
            ) : null}
            {tab === "items" && itemCount === 0 ? (
              <EmptyRow>
                Nenhum item. Use o botão + no Editar Geral para criar.
              </EmptyRow>
            ) : null}
          </ul>
        </SortableContext>
      </DndContext>

      {/* RODAPÉ */}
      <div className="mt-2 flex items-center gap-1">
        {/* ─────────────────────────────────────────────────────────────
            O "+" SAI DO EDITAR GERAL E FICA NO LAPIS DA ABA (adendo, secao 1)

            O botao acompanha a ABA visivel: na aba Armas ele cria arma, na
            aba Itens cria item. Um "+" unico que agisse nas duasseria
            adivinhacao; o painel sabe qual aba esta aberta.
            ───────────────────────────────────────────────────────────── */}
        {blockEdit ? (
          <RuneButton
            disabled={
              tab === "weapons"
                ? !canAddWeapon(inventory)
                : !canAddItem(inventory)
            }
            label={
              tab === "weapons"
                ? canAddWeapon(inventory)
                  ? "Adicionar arma"
                  : "Limite de armas atingido"
                : canAddItem(inventory)
                  ? "Adicionar item"
                  : "Limite de itens atingido"
            }
            tone="primary"
            onClick={tab === "weapons" ? addWeapon : addItem}
          >
            <PlusIcon />
          </RuneButton>
        ) : null}

        {/* "Vender tudo" só existe com a venda habilitada (§11). */}
        {sellEnabled && tab === "items" && itemCount > 0 ? (
          <RuneButton
            label="Vender todos os itens não favoritos"
            tone="danger"
            className="px-2 text-xs"
            onClick={sellAll}
          >
            Vender tudo
          </RuneButton>
        ) : null}
      </div>
    </div>
  );
}

/* ── Barra de peso e dinheiro ───────────────────────────────────────────── */

function CarryBar({
  total,
  capacity,
  moneyLabel,
  moneyValue,
  editMode,
  onCapacity,
  onMoneyLabel,
  onMoneyValue,
}: {
  total: number;
  capacity: number;
  moneyLabel: string;
  moneyValue: number;
  editMode: boolean;
  onCapacity: (value: number) => void;
  onMoneyLabel: (value: string) => void;
  onMoneyValue: (value: number) => void;
}) {
  const overweight = total > capacity;
  const ratio = capacity > 0 ? Math.min(1, total / capacity) : 1;

  const label = useInlineEdit({
    value: moneyLabel,
    commit: onMoneyLabel,
  });

  return (
    <div className="border-frame/60 bg-surface-sunken mb-2 rounded-[var(--radius-sm)] border px-2 py-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          className={`flex items-center gap-1 ${overweight ? "text-danger font-bold" : "text-text-muted"}`}
        >
          <ScaleIcon />
          {total} / {capacity} kg
          {overweight ? " — acima da capacidade" : ""}
        </span>

        <span className="text-text-muted flex items-center gap-1">
          <CoinIcon />
          {label.editing ? (
            <input
              aria-label="Rótulo do dinheiro"
              className="border-accent bg-surface w-20 rounded border px-1 text-xs outline-none"
              value={label.draft}
              {...label.inputProps}
            />
          ) : (
            <button
              type="button"
              aria-label={`Rótulo do dinheiro: ${moneyLabel}. Clique duas vezes para editar.`}
              className="cursor-default"
              onDoubleClick={label.onDoubleClick}
            >
              {moneyLabel}
            </button>
          )}
          <MoneyValue
            label={moneyLabel}
            onCommit={onMoneyValue}
            value={moneyValue}
          />
        </span>
      </div>

      {/* A barra: saturada em vermelho quando estoura, mas sem travar nada. */}
      <div
        role="progressbar"
        aria-label="Peso contra a capacidade de carga"
        aria-valuenow={total}
        aria-valuemin={0}
        aria-valuemax={capacity}
        className="bg-frame/30 mt-1 h-1 overflow-hidden rounded-full"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${overweight ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      {/* A capacidade só é editável no lápis do bloco — é informação estrutural,
          igual a quantidade de itens. */}
      {editMode ? (
        <label className="text-text-muted mt-1 flex items-center gap-1 text-[10px]">
          <span>Capacidade</span>
          <input
            aria-label="Capacidade de carga em kg"
            className="border-frame bg-surface focus:border-accent w-16 rounded border px-1 font-mono outline-none"
            inputMode="numeric"
            value={capacity}
            onChange={(event) => onCapacity(Number(event.target.value) || 0)}
          />
          <span>kg</span>
        </label>
      ) : null}
    </div>
  );
}

/* ── Valor do dinheiro ────────────────────────────────────────────────────── */

/**
 * Saldo: duplo clique edita, igual a todo número do app.
 *
 * Fica como componente só para não repetir o `useInlineEdit` dentro do JSX
 * da barra — o hook precisa ser chamado incondicionalmente, e solta-lo no meio
 * da árvore faria o EDITAR prowess alternar a cada render.
 */
function MoneyValue({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (next: number) => void;
}) {
  const edit = useInlineEdit({
    value: String(value),
    commit: (next) => onCommit(Math.max(0, Number(next) || 0)),
  });

  if (edit.editing) {
    return (
      <input
        aria-label={`Saldo de ${label || "dinheiro"}`}
        className="border-accent bg-surface w-20 rounded border px-1 text-right font-mono text-xs outline-none"
        inputMode="numeric"
        value={edit.draft}
        {...edit.inputProps}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Saldo de ${label || "dinheiro"}: ${value}. Clique duas vezes para editar.`}
      className="text-text cursor-text font-mono tabular-nums"
      onDoubleClick={edit.onDoubleClick}
    >
      {value}
    </button>
  );
}
/* ── Confirmação de venda de favorito ───────────────────────────────────── */

function ConfirmFavorito({
  item,
  onConfirm,
  onCancel,
}: {
  item: Item;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={`Vender ${item.name || "item"}`}
      className="border-accent bg-surface-raised mt-1 rounded-[var(--radius-sm)] border p-2"
    >
      <p className="text-text-muted text-[11px]">
        <strong className="text-text">{item.name || "Este item"}</strong> é
        favorito. Ele fica protegido de venda em massa, mas você pode vender
        este específico.
      </p>
      <div className="mt-1.5 flex justify-end gap-1">
        <RuneButton label="Cancelar venda" onClick={onCancel}>
          ✕
        </RuneButton>
        <RuneButton
          label="Confirmar venda do favorito"
          tone="danger"
          onClick={onConfirm}
        >
          Vender
        </RuneButton>
      </div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-text-muted py-4 text-center text-xs">{children}</li>
  );
}
