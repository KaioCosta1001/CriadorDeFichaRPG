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
import { LinkIcon, UnlinkIcon } from "@/components/ui/icons";
import { SlotRow } from "@/components/ui/SlotRow";
import {
  MAX_DICE_PER_ROLL,
  MIN_DICE_PER_ROLL,
  WEAPON_DIE_TYPES,
  WEAPON_NAME_MAX_LENGTH,
} from "@/config/constants";
import type { Attribute } from "@/schemas";
import { useContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import { useInlineEdit } from "@/hooks/useInlineEdit";

import { WeaponRollMenu, type WeaponForRoll } from "./WeaponRollMenu";
import type { PanelContext } from "../registry";

interface WeaponRowProps {
  context: PanelContext;
  weapon: WeaponLike;
  attributes: readonly Attribute[];
  /** `true` no lápis do bloco: cor, vínculo e exclusão. */
  editMode: boolean;
  /** `true` no Editar Geral: arraste. */
  reorderMode: boolean;
  onChange: (patch: Partial<WeaponLike>) => void;
  /**
   * Liga/desliga "Isto é um item" (adendo §7).
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE ISTO NÃO É `onChange({ isItem })`
   *
   * Era exatamente assim antes, e não funcionava: o botão gravava o booleano
   * e nada lia o campo. Nenhum item era criado, nenhum dado era copiado, e o
   * sintoma era "marco e nada acontece".
   *
   * A operação toca as DUAS listas ao mesmo tempo — cria o item, grava o
   * `weaponData`, liga os dois ids — e pode ser RECUSADA por limite. Isso
   * não cabe num `patch` de um campo, por isso é uma callback própria.
   * ───────────────────────────────────────────────────────────────────────────
   */
  onToggleIsItem: () => void;
  onRemove: () => void;
  onUnequip: () => void;
}

/** Tudo que a linha precisa saber da arma — `die` já validado pelo schema. */
type WeaponLike = WeaponForRoll & {
  color: string | null;
  itemId: string | null;
  isItem: boolean;
};

/**
 * Uma linha da aba "Armas" (seção 8.2).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A DÁDICA APARECE LITERALMENTE: `2d8`
 *
 * A §8.2.1 proíbe que `diceCount` multiplique o valor do dado, e a forma mais
 * honesta de garantir isso é DEIXAR A CONTA À MOSTA. O jogador lê "2d8" e
 * sabe exatamente o que está rolando; se o app escondesse o dado atrás de
 * "quantidade: 2", o mesmo número viraria ambíguo na tela.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A ARMA NÃO EDITA NÚMERO POR DUPLO CLIQUE
 * Dado e quantidade de dados são escolhas de few-shot — o jogador monta uma
 * arma uma vez e rola Loads de vezes. Trocar de "1d8" para "2d6" em dois
 * cliques num seletor é mais rápido do que abrir e editar dois campos.
 *
 * O bônus de ataque, ao contrário, muda a cada build. Fica por duplo clique,
 * como todo número do resto do app.
 */
export function WeaponRow({
  context,
  weapon,
  attributes,
  editMode,
  reorderMode,
  onChange,
  onToggleIsItem,
  onRemove,
  onUnequip,
}: WeaponRowProps) {
  const displayName = weapon.name || "Sem nome";

  const name = useInlineEdit({
    value: weapon.name,
    commit: (next) => onChange({ name: next.slice(0, WEAPON_NAME_MAX_LENGTH) }),
  });

  const bonus = useInlineEdit({
    value: String(weapon.attackBonus),
    commit: (next) =>
      onChange({ attackBonus: Math.max(-50, Math.min(50, Number(next) || 0)) }),
  });

  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: weapon.id, disabled: !reorderMode });

  // Desligado em qualquer modo de edicao e durante o arraste, como nas
  // Pericias: em editar, o botao direito sobrar para o navegador.
  const rollMenu = useContextMenuTrigger({
    // O menu fecha nos DOIS modos: o botão direito em modo de
    // edição é do navegador (lá dentro ele moveria ou apagaria).
    disabled: context.editMode || editMode || reorderMode || isDragging,
    label: `Rolar ${displayName}`,
  });

  // Atributo órfão é pulado na exibição: mostrar "FOR +5" para um atributo
  // que não está na ficha seria mentira na tela.
  const linked = weapon.attributeIds
    .map((id) => attributes.find((a) => a.id === id))
    .filter((a): a is Attribute => a !== undefined);

  return (
    <SlotRow
      nodeRef={setNodeRef}
      dragStyle={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      color={weapon.color}
      colorName={colorLabelFor(weapon.color)}
      contextMenuProps={rollMenu.triggerProps}
      dragging={isDragging}
      glyph={colorGlyphFor(weapon.color)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {name.editing ? (
          <input
            aria-label={`Nome da arma ${displayName}`}
            className="border-accent bg-surface min-w-0 flex-1 rounded-[var(--radius-sm)] border px-1 py-0.5 text-sm outline-none"
            maxLength={WEAPON_NAME_MAX_LENGTH}
            value={name.draft}
            {...name.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`Nome da arma: ${displayName}. Clique duas vezes para editar.`}
            className="min-w-0 flex-1 cursor-default truncate text-left text-sm"
            onDoubleClick={name.onDoubleClick}
          >
            {displayName}
          </button>
        )}

        {/* A DÁDICA — `2d8`, `3d6`, `1d20`. */}
        <span
          className="text-accent font-display shrink-0 text-sm font-bold tracking-wide"
          title={`${weapon.diceCount} ${weapon.die} — ${weapon.diceCount} sorteios independentes, somados`}
        >
          {weapon.diceCount}
          {weapon.die}
        </span>

        <span aria-hidden="true" className="text-text-muted shrink-0 text-xs">
          +
        </span>

        {bonus.editing ? (
          <input
            aria-label={`Bônus de ataque de ${displayName}`}
            className="border-accent bg-surface w-12 shrink-0 rounded-[var(--radius-sm)] border px-1 text-center font-mono text-xs outline-none"
            inputMode="numeric"
            value={bonus.draft}
            {...bonus.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`Bônus de ataque de ${displayName}: ${weapon.attackBonus}. Clique duas vezes para editar.`}
            className="text-text-muted w-12 shrink-0 cursor-text text-center font-mono text-xs tabular-nums"
            onDoubleClick={bonus.onDoubleClick}
          >
            {weapon.attackBonus > 0
              ? `+${weapon.attackBonus}`
              : weapon.attackBonus}
          </button>
        )}

        {/* Atributos vinculados: nome + valor, como diz a §8.2. */}
        {linked.length > 0 ? (
          <span className="text-text-muted min-w-0 truncate text-[10px]">
            {linked.map((a) => `${a.name || "?"} (${a.value})`).join(" · ")}
          </span>
        ) : null}

        {weapon.itemId ? (
          <span title="Equipada a partir de um item">
            <LinkIcon className="text-accent size-3.5" />
          </span>
        ) : null}

        {reorderMode ? (
          <GripHandle
            label={`Reordenar ${displayName}`}
            {...dragAttributes}
            {...listeners}
          />
        ) : null}
      </span>

      <WeaponRollMenu
        attributes={attributes}
        context={context}
        menu={rollMenu}
        weapon={weapon}
      />

      {editMode ? (
        <div className="border-border/60 flex shrink-0 items-center gap-1 border-l pl-1">
          {/* Dado e quantidade: seletores, porque são poucos valores
              fixos. Duplo clique em `<select>` não existe. */}
          <label className="flex items-center gap-1">
            <span className="sr-only">Dado de {displayName}</span>
            <select
              aria-label={`Dado de ${displayName}`}
              className="border-frame bg-surface focus:border-accent rounded-[var(--radius-sm)] border px-1 py-0.5 text-[11px] outline-none"
              value={weapon.die}
              onChange={(event) =>
                onChange({ die: event.target.value as WeaponLike["die"] })
              }
            >
              {WEAPON_DIE_TYPES.map((die) => (
                <option key={die} value={die}>
                  {die}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1">
            <span className="sr-only">
              Quantidade de dados de {displayName}
            </span>
            <select
              aria-label={`Quantidade de dados de ${displayName}`}
              className="border-frame bg-surface focus:border-accent w-12 rounded-[var(--radius-sm)] border px-1 py-0.5 text-center font-mono text-[11px] outline-none"
              value={weapon.diceCount}
              onChange={(event) =>
                onChange({
                  diceCount: Math.max(
                    MIN_DICE_PER_ROLL,
                    Math.min(
                      MAX_DICE_PER_ROLL,
                      Number.parseInt(event.target.value, 10) ||
                        MIN_DICE_PER_ROLL,
                    ),
                  ),
                })
              }
            >
              {Array.from(
                { length: MAX_DICE_PER_ROLL - MIN_DICE_PER_ROLL + 1 },
                (_, index) => MIN_DICE_PER_ROLL + index,
              ).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <AttributePicker
            attributes={attributes}
            onToggle={(attributeId) =>
              onChange({
                attributeIds: weapon.attributeIds.includes(attributeId)
                  ? weapon.attributeIds.filter((id) => id !== attributeId)
                  : [...weapon.attributeIds, attributeId],
              })
            }
            selected={weapon.attributeIds}
            weaponName={displayName}
          />

          <RuneButton
            aria-pressed={weapon.isItem}
            label={
              weapon.isItem
                ? `Deixar de tratar ${displayName} como item`
                : `Tratar ${displayName} como item`
            }
            onClick={onToggleIsItem}
          >
            {weapon.isItem ? "◆" : "◇"}
          </RuneButton>

          {weapon.itemId ? (
            <RuneButton label={`Desequipar ${displayName}`} onClick={onUnequip}>
              <UnlinkIcon />
            </RuneButton>
          ) : null}

          <ColorPicker
            customLabel={`Cor personalizada de ${displayName}`}
            label={`Raridade de ${displayName}`}
            value={weapon.color}
            onChange={(color) => onChange({ color })}
          />

          <RuneButton
            label={`Remover arma ${displayName}`}
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
 * Seletor de atributos da arma (ponto em aberto 14.4: vários, TODOS somam).
 *
 * `<select multiple>` seria mais curto, mas emula mal em mobile e o rótulo
 * "vários" não fica visível. Um botão por atributo, com `aria-pressed`,
 * deixa o estado visível e o clique é irreversívelmente simples.
 */
function AttributePicker({
  attributes,
  selected,
  onToggle,
  weaponName,
}: {
  attributes: readonly Attribute[];
  selected: readonly string[];
  onToggle: (attributeId: string) => void;
  weaponName: string;
}) {
  if (attributes.length === 0) return null;

  return (
    <label className="flex items-center gap-0.5">
      <span className="text-text-muted text-[10px] tracking-[0.12em] uppercase">
        Atrib.
      </span>
      <select
        aria-label={`Atributos que somam em ${weaponName}`}
        className="border-frame bg-surface focus:border-accent max-w-[8rem] rounded-[var(--radius-sm)] border px-1 py-0.5 text-[11px] outline-none"
        value=""
        onChange={(event) => {
          if (event.target.value) onToggle(event.target.value);
        }}
      >
        <option value="">+ somar…</option>
        {attributes.map((attribute) => (
          <option
            key={attribute.id}
            value={attribute.id}
            disabled={selected.includes(attribute.id)}
          >
            {attribute.name || "Sem nome"} ({attribute.value})
          </option>
        ))}
      </select>
    </label>
  );
}
