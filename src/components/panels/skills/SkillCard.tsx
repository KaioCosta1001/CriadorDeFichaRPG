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
import { SlotRow } from "@/components/ui/SlotRow";
import {
  SKILL_CHIP_MAX_WIDTH_PX,
  SKILL_NAME_MAX_LENGTH,
} from "@/config/constants";
import { parseStatValue } from "@/domain/stats";
import { useContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import type { Skill } from "@/schemas";

import { SkillsRollMenu } from "./SkillsRollMenu";
import type { PanelContext } from "../registry";

interface SkillCardProps {
  context: PanelContext;
  skill: Skill;
  /** `true` quando o lápis do bloco está ligado: cor e exclusão. */
  editMode: boolean;
  /** `true` no Editar Geral: libera o arraste. */
  reorderMode: boolean;
  onChange: (patch: Partial<Skill>) => void;
  onRemove: () => void;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PERÍCIA COMO BLOCO COMPACTO (adendo §4)                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A versão anterior era uma LINHA: ocupava a largura toda do bloco, com nome
 * à esquerda, valor à direita e o resto vazio no meio. Com vinte perícias, o
 * bloco virava uma coluna de 20 faixas com 80% de espaço morto — e a
 * informação densa que um jogador de RPG mais consulta ficava enterrada.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O QUE MUDA, E O QUE NÃO MUDA
 *
 * MUDOU: a forma. O bloco se ajusta ao nome, os blocos ficam lado a lado com
 * quebra de linha, e o nome longo vira reticências com o texto completo no
 * `title`.
 *
 * NÃO MUDOU — e é o que interessa: clique duplo para editar, botão direito
 * para rolar, arraste para reordenar, cor de raridade, exclusão e "+" no
 * lápis do bloco. Nenhuma interação foi trocada por outra.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O NOME VAI NO `title`
 *
 * `truncate` sem `title` é um beco sem saída: o nome cortado é
 * irrecuperável na tela. Com `title`, o texto completo aparece ao passar o
 * mouse, e o leitor de tela lê o `aria-label` inteiro de qualquer jeito.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O CARTÃO É O ALVO DO TECLADO
 * O botão de rolar mora DENTRO do popup (decisão do autor), então não há
 * botão no cartão. O caminho de teclado é o próprio cartão: `Tab` alcança
 * ele (`tabIndex={0}`, `aria-haspopup="menu"`), e `Menu`/`Shift+F10` abre o
 * popup — exatamente como o botão direito.
 */
export function SkillCard({
  context,
  skill,
  editMode,
  reorderMode,
  onChange,
  onRemove,
}: SkillCardProps) {
  const displayName = skill.name || "Sem nome";

  const name = useInlineEdit({
    value: skill.name,
    commit: (next) => onChange({ name: next.slice(0, SKILL_NAME_MAX_LENGTH) }),
  });

  const value = useInlineEdit({
    value: String(skill.value),
    commit: (next) => onChange({ value: parseStatValue(next, skill.value) }),
  });

  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: skill.id, disabled: !reorderMode });

  // O menu é desligado em QUALQUER modo de edição e durante o arraste: em
  // editar, o botão direito tem de sobrar para o navegador (§2 do adendo).
  const menu = useContextMenuTrigger({
    // O menu fecha nos DOIS modos: o botão direito em modo de
    // edição é do navegador (lá dentro ele moveria ou apagaria).
    disabled: context.editMode || editMode || reorderMode || isDragging,
    label: `Rolar ${displayName}`,
  });

  return (
    <SlotRow
      nodeRef={setNodeRef}
      dragStyle={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      color={skill.color}
      colorName={colorLabelFor(skill.color)}
      contextMenuProps={menu.triggerProps}
      dragging={isDragging}
      glyph={colorGlyphFor(skill.color)}
      layout="chip"
      className="gap-1.5 py-0.5"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {/* NOME — com teto de largura, para virar reticências. */}
        {name.editing ? (
          <input
            aria-label={`Nome da perícia ${displayName}`}
            className="border-accent bg-surface w-28 rounded-[var(--radius-sm)] border px-1 py-0.5 text-xs outline-none"
            maxLength={SKILL_NAME_MAX_LENGTH}
            value={name.draft}
            {...name.inputProps}
          />
        ) : (
          <button
            type="button"
            // O `title` só importa quando o nome foi cortado — mas é inofensivo
            // quando não foi, e um `title` condicional exigiria medir o texto.
            title={displayName}
            aria-label={`Nome da perícia: ${displayName}. Clique duas vezes para editar.`}
            className="block min-w-0 truncate text-left text-xs"
            style={{ maxWidth: SKILL_CHIP_MAX_WIDTH_PX }}
            onDoubleClick={name.onDoubleClick}
          >
            {displayName}
          </button>
        )}

        {/* VALOR — medalhão ao lado do nome (adendo §4). */}
        {value.editing ? (
          <input
            aria-label={`Valor da perícia ${displayName}`}
            className="border-accent bg-surface font-display w-11 shrink-0 rounded-full border px-1 text-center text-xs font-bold outline-none"
            inputMode="numeric"
            value={value.draft}
            {...value.inputProps}
          />
        ) : (
          <button
            type="button"
            aria-label={`Valor da perícia ${displayName}: ${skill.value}. Clique duas vezes para editar.`}
            className="border-frame bg-surface-sunken font-display text-text grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums"
            onDoubleClick={value.onDoubleClick}
          >
            {skill.value}
          </button>
        )}

        {reorderMode ? (
          <GripHandle
            label={`Reordenar ${displayName}`}
            {...dragAttributes}
            {...listeners}
          />
        ) : null}
      </span>

      <SkillsRollMenu context={context} menu={menu} skill={skill} />

      {editMode ? (
        <div className="border-border/60 flex shrink-0 items-center gap-0.5 border-l pl-0.5">
          <ColorPicker
            customLabel={`Cor personalizada de ${displayName}`}
            label={`Raridade de ${displayName}`}
            value={skill.color}
            onChange={(color) => onChange({ color })}
          />
          <RuneButton
            label={`Remover perícia ${displayName}`}
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
