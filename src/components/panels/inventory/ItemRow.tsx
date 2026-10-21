"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  ColorPicker,
  colorGlyphFor,
  colorLabelFor,
} from "@/components/ui/ColorPicker";
import { RuneButton } from "@/components/ui/RuneButton";
import { GripHandle } from "@/components/ui/GripHandle";
import { LinkIcon, StarIcon, UnlinkIcon } from "@/components/ui/icons";
import { SlotRow } from "@/components/ui/SlotRow";
import {
  ITEM_NAME_MAX_LENGTH,
  ITEM_QUANTITY_MAX,
  ITEM_VALUE_MAX,
  ITEM_WEIGHT_MAX,
} from "@/config/constants";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import type { Inventory, Item } from "@/schemas";

interface ItemRowProps {
  item: Item;
  inventory: Inventory;
  /** `true` no lápis do bloco: cor, favorito e exclusão. */
  editMode: boolean;
  /** `true` no Editar Geral: arraste. */
  reorderMode: boolean;
  /** A venda está habilitada nesta ficha? */
  sellEnabled: boolean;
  onChange: (patch: Partial<Item>) => void;
  /** Equipar/desequipar o item como arma (§7.6). */
  onEquip: () => void;
  onRemove: () => void;
  onSell: () => void;
}

/**
 * Uma linha da aba "Itens" (seção 8.2).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * TUDO NUMA LINHA SÓ
 * A lista pode ter 100 itens (§8.2) e o jogador precisa **varrer**
 * verticalmente, não ler um cartão por item. Nome, peso, quantidade, valor e
 * a faixa de raridade dividem uma linha; empilhar cada campo em bloco deixaria
 * metade da lista fora da tela.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CAMPOS NUMÉRICOS POR DUPLO CLIQUE, COMO NO RESTO DO APP
 * Peso, quantidade e valor são o que se ajusta o tempo todo. O duplo clique
 * mantém a leitura passiva; `Enter` grava, `Escape` cancela.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PESO ACIMA DA CAPACIDADE: VERMELHO, NÃO BLOQUEADO (§8.2)
 * Ver o cabeçalho de `domain/inventory.ts`: a capacidade é um número que o
 * jogador ajusta conforme a ficha, não uma verdade que o app possa arbitrar.
 * O vermelho é aviso; travar a edição transformaria o inventário num
 * formulário que só aceita um estado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O FAVORITO É SEMPRE VISÍVEL
 * A estrela não é um controle de edição — é ESTADO que o jogador consulta o
 * tempo todo: é ela que marca o que uma venda em massa vai preservar. Escondê-la
 * atrás do lápis tornaria impossível ver o que está protegido.
 */
export function ItemRow({
  item,
  inventory,
  editMode,
  reorderMode,
  sellEnabled,
  onChange,
  onEquip,
  onRemove,
  onSell,
}: ItemRowProps) {
  const displayName = item.name || "Sem nome";

  const name = useInlineEdit({
    value: item.name,
    commit: (next) => onChange({ name: next.slice(0, ITEM_NAME_MAX_LENGTH) }),
  });

  const weight = useInlineEdit({
    value: String(item.weight),
    commit: (next) =>
      onChange({ weight: Math.min(ITEM_WEIGHT_MAX, Number(next) || 0) }),
  });

  const quantity = useInlineEdit({
    value: String(item.quantity),
    commit: (next) =>
      onChange({ quantity: Math.min(ITEM_QUANTITY_MAX, Number(next) || 0) }),
  });

  const value = useInlineEdit({
    value: String(item.value),
    commit: (next) =>
      onChange({ value: Math.min(ITEM_VALUE_MAX, Number(next) || 0) }),
  });

  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !reorderMode });

  const lineWeight = item.weight * item.quantity;
  const overweight =
    inventory.carryCapacity > 0 && lineWeight > inventory.carryCapacity;

  return (
    <SlotRow
      nodeRef={setNodeRef}
      dragStyle={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      color={item.color}
      colorName={colorLabelFor(item.color)}
      dragging={isDragging}
      glyph={colorGlyphFor(item.color)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {name.editing ? (
          <input
            aria-label={`Nome do item ${displayName}`}
            className="border-accent bg-surface min-w-0 flex-1 rounded-[var(--radius-sm)] border px-1 py-0.5 text-sm outline-none"
            maxLength={ITEM_NAME_MAX_LENGTH}
            value={name.draft}
            {...name.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`Nome do item: ${displayName}. Clique duas vezes para editar.`}
            className="min-w-0 flex-1 cursor-default truncate text-left text-sm"
            onDoubleClick={name.onDoubleClick}
          >
            {displayName}
          </button>
        )}

        {/* O `title` dá o nome acessível sem depender do ícone: `BaseIcon`
            marca `aria-hidden`, porque ÍCONE decorativo não deve falar. */}
        {item.favorite ? (
          <span title="Favorito" role="img" aria-label="Favorito">
            <StarIcon className="text-accent size-3.5 shrink-0" />
          </span>
        ) : null}

        <NumCell
          editing={weight.editing}
          inputLabel={`Peso de ${displayName}`}
          inputProps={weight.inputProps}
          label={`Peso de ${displayName}: ${item.weight}. Clique duas vezes para editar.`}
          max={ITEM_WEIGHT_MAX}
          onDoubleClick={weight.onDoubleClick}
          suffix="kg"
          value={weight.draft}
          visible={item.weight}
          warn={overweight}
        />

        <span aria-hidden="true" className="text-text-muted shrink-0 text-xs">
          ×
        </span>

        <NumCell
          editing={quantity.editing}
          inputLabel={`Quantidade de ${displayName}`}
          inputProps={quantity.inputProps}
          label={`Quantidade de ${displayName}: ${item.quantity}. Clique duas vezes para editar.`}
          max={ITEM_QUANTITY_MAX}
          onDoubleClick={quantity.onDoubleClick}
          value={quantity.draft}
          visible={item.quantity}
        />

        <NumCell
          editing={value.editing}
          inputLabel={`Valor de ${displayName}`}
          inputProps={value.inputProps}
          label={`Valor de ${displayName}: ${item.value}. Clique duas vezes para editar.`}
          max={ITEM_VALUE_MAX}
          onDoubleClick={value.onDoubleClick}
          suffix="🪙"
          value={value.draft}
          visible={item.value}
        />

        {/* ── O selo "Arma" E o botão "Equipar" (§7.6) ───────────────────────
         *
         * O selo marca o item que preserva dado, bônus e atributos de uma
         * arma. O botão é o gesto da §7.6: equipar o item restaura esses
         * dados numa arma da aba Armas — sem duplicar, e sem criar uma arma
         * nova a cada clique.
         *
         * Ele SÓ aparece quando há arquivo (`weaponData`). Um item comprado
         * na loja não tem o que restaurar, e um botão "Equipar" que não faz
         * nada seria pior que botão nenhum.
         * ─────────────────────────────────────────────────────────────────── */}
        {item.weaponData ? (
          <>
            <span
              className="text-text-muted shrink-0 text-[10px] tracking-[0.12em] uppercase"
              title="Este item veio de uma arma e preserva os dados dela"
            >
              Arma
            </span>

            <RuneButton
              aria-pressed={item.equippedWeaponId !== null}
              // O texto longo vai no RÓTULO, e não num `title` à parte:
              // o `RuneButton` já alimenta o Tooltip e o `aria-label` com
              // `label`, e um `title` extra no mesmo elemento faria o MUI
              // avisar que há duas fontes competindo — e o Tooltip exibiria
              // a errada.
              label={
                item.equippedWeaponId
                  ? `Desequipar ${displayName}`
                  : `Equipar ${displayName} como arma`
              }
              onClick={onEquip}
            >
              {item.equippedWeaponId ? <UnlinkIcon /> : <LinkIcon />}
            </RuneButton>
          </>
        ) : null}

        {/* "Vender" só existe com `Sheet.settings.sellEnabled` ligado (§11).
            Fora disso, nem o botão aparece — um botão desabilitado aqui
            sugeriria que a venda está quebrada, e não desligada. */}
        {sellEnabled ? (
          <RuneButton
            label={`Vender ${displayName}`}
            tone="danger"
            onClick={onSell}
          >
            $
          </RuneButton>
        ) : null}

        {reorderMode ? (
          <GripHandle
            label={`Reordenar ${displayName}`}
            {...dragAttributes}
            {...listeners}
          />
        ) : null}
      </span>

      {editMode ? (
        <div className="border-border/60 flex shrink-0 items-center gap-1 border-l pl-1">
          <RuneButton
            aria-pressed={item.favorite}
            label={
              item.favorite
                ? `Desmarcar ${displayName} como favorito`
                : `Marcar ${displayName} como favorito`
            }
            onClick={() => onChange({ favorite: !item.favorite })}
          >
            <StarIcon />
          </RuneButton>
          <ColorPicker
            customLabel={`Cor personalizada de ${displayName}`}
            label={`Raridade de ${displayName}`}
            value={item.color}
            onChange={(color) => onChange({ color })}
          />
          <RuneButton
            label={`Remover item ${displayName}`}
            tone="danger"
            onClick={onRemove}
          >
            ✕
          </RuneButton>
        </div>
      ) : null}
    </SlotRow>
  );
}

/**
 * Célula numérica da linha.
 *
 * Fica como botão de leitura quando não está em edição: um `<input>` sempre
 * visível viraria um formulário dentro de uma lista, e o jogador passaria a
 * editar em vez de consultar.
 */
function NumCell({
  visible,
  editing,
  inputProps,
  inputLabel,
  label,
  onDoubleClick,
  max,
  warn,
  suffix,
}: {
  value: string;
  visible: number;
  editing: boolean;
  inputProps: React.ComponentProps<"input">;
  inputLabel: string;
  label: string;
  onDoubleClick: () => void;
  max: number;
  warn?: boolean;
  suffix?: string;
}) {
  const width = `${Math.max(3, String(max).length)}ch`;

  if (editing) {
    return (
      <input
        {...inputProps}
        aria-label={inputLabel}
        className="border-accent bg-surface shrink-0 rounded-[var(--radius-sm)] border px-1 text-center font-mono text-xs outline-none"
        inputMode="numeric"
        style={{ width }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onDoubleClick={onDoubleClick}
      style={{ width }}
      className={[
        "shrink-0 cursor-text font-mono text-xs tabular-nums",
        warn ? "text-danger font-bold" : "text-text-muted",
      ].join(" ")}
    >
      {visible}
      {suffix ? (
        <span aria-hidden="true" className="opacity-60">
          {" "}
          {suffix}
        </span>
      ) : null}
    </button>
  );
}
