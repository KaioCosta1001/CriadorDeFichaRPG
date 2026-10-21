"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ColorPicker } from "@/components/ui/ColorPicker";
import { RuneButton } from "@/components/ui/RuneButton";
import { GripHandle } from "@/components/ui/GripHandle";
import { ATTRIBUTE_NAME_MAX_LENGTH } from "@/config/constants";
import { parseStatValue } from "@/domain/stats";
import { useContextMenuTrigger } from "@/hooks/useContextMenuTrigger";
import { useInlineEdit } from "@/hooks/useInlineEdit";
import type { Attribute } from "@/schemas";

import { AttributeRollMenu } from "./AttributeRollMenu";
import type { PanelContext } from "../registry";

interface AttributeCardProps {
  context: PanelContext;
  attribute: Attribute;
  /** `true` quando o lápis do bloco está ligado: libera cor e exclusão. */
  editMode: boolean;
  /** `true` no Editar Geral: libera o arraste (reordenar é estrutural). */
  reorderMode: boolean;
  onChange: (patch: Partial<Attribute>) => void;
  onRemove: () => void;
}

/**
 * Uma caixa de atributo (seção 8.4 + adendo §5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE "PEDRA RUNEADA" E NÃO MAIS UM `<input>`
 * Atributo é o dado que o jogador olha o tempo todo — é o número que ele
 * consulta antes de toda rolagem. Um campo de formulário ali seria um convite
 * a editar sem querer. A caixa fecha o gesto: o duplo clique abre, `Enter`
 * grava, `Escape` cancela, e o resto do tempo é só leitura.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A COR É ARO, NÃO FUNDO
 * O adendo pede "cor do usuário como aro/brilho". Fundo colorido deixaria o
 * texto claro sobre cor clara em várias combinações e reprovaria em contraste
 * — o aro entrega a mesma informação sem competir com o número.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DUAS PORTAS DE EDIÇÃO, DE PROPÓSITO DIFERENTES
 * O lápis do BLOCO liga cor e exclusão (§8.4 manda explicitamente). O
 * Editar Geral liga o "+" e o arraste, porque mexer na QUANTIDADE e na ordem
 * dos atributos é informação sensível (§8.4 também). Ver `AttributesPanel`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O MENU DE ROLAGEM FICA NO PRÓPRIO CARTÃO
 * O `contextmenu` sobe pela árvore, e aqui o cartão É o ancestral do nome e
 * do valor — por isso o gatilho vai direto no `<div>` raiz. Um overlay por
 * cima engastraria o duplo clique; um botão interno deixaria a borda do
 * cartão sem resposta.
 */
export function AttributeCard({
  context,
  attribute,
  editMode,
  reorderMode,
  onChange,
  onRemove,
}: AttributeCardProps) {
  const displayName = attribute.name || "Sem nome";

  const name = useInlineEdit({
    value: attribute.name,
    commit: (next) =>
      onChange({ name: next.slice(0, ATTRIBUTE_NAME_MAX_LENGTH) }),
  });

  const value = useInlineEdit({
    value: String(attribute.value),
    commit: (next) =>
      onChange({ value: parseStatValue(next, attribute.value) }),
  });

  const {
    attributes: dragAttributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attribute.id, disabled: !reorderMode });

  // Desligado em QUALQUER modo de edição e durante o arraste (§3 do adendo):
  // em editar, o botão direito tem de sobrar para o navegador.
  const menu = useContextMenuTrigger({
    // O menu fecha nos DOIS modos: o botão direito em modo de
    // edição é do navegador (lá dentro ele moveria ou apagaria).
    disabled: context.editMode || editMode || reorderMode || isDragging,
    label: `Rolar ${displayName}`,
  });

  return (
    <div
      {...menu.triggerProps}
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        ...(attribute.color
          ? ({ "--attribute-accent": attribute.color } as React.CSSProperties)
          : {}),
      }}
      className={[
        "relative flex min-h-[76px] flex-col items-center justify-center",
        "border-border gap-0.5 rounded-[var(--radius)] border px-2 py-1.5 text-center",
        "bg-surface-raised transition-[box-shadow,transform] duration-150",
        "hover:-translate-y-px hover:shadow-[0_0_18px_-8px_var(--attribute-accent,var(--glow))]",
        isDragging
          ? "z-20 opacity-80 shadow-[0_14px_30px_-14px_rgb(0_0_0/0.9)]"
          : "",
      ].join(" ")}
    >
      {/* Aro na cor escolhida. Transparente quando não há cor — sem espaço
          reservado, e sem borda falsa. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[var(--radius)] border-2"
        style={{
          borderColor: attribute.color ?? "transparent",
          boxShadow: attribute.color
            ? `0 0 14px -6px ${attribute.color}, inset 0 0 16px -12px ${attribute.color}`
            : "none",
          opacity: attribute.color ? 0.85 : 0,
        }}
      />

      {reorderMode ? (
        <GripHandle
          label={`Reordenar ${displayName}`}
          {...dragAttributes}
          {...listeners}
        />
      ) : null}

      {/* NOME — caixa-alta pequena (adendo §5). */}
      {name.editing ? (
        <input
          aria-label={`Nome do atributo ${displayName}`}
          className="border-accent bg-surface w-full rounded-[var(--radius-sm)] border px-1 text-center text-[10px] tracking-[0.14em] uppercase outline-none"
          maxLength={ATTRIBUTE_NAME_MAX_LENGTH}
          value={name.draft}
          {...name.inputProps}
        />
      ) : (
        <button
          type="button"
          aria-label={`Nome do atributo: ${displayName}. Clique duas vezes para editar.`}
          className="label-caps w-full min-w-0 cursor-default truncate"
          onDoubleClick={name.onDoubleClick}
        >
          {displayName}
        </button>
      )}

      {/* VALOR — grande e central. */}
      {value.editing ? (
        <input
          aria-label={`Valor do atributo ${displayName}`}
          className="border-accent bg-surface font-display w-full rounded-[var(--radius-sm)] border px-1 text-center text-xl font-bold outline-none"
          inputMode="numeric"
          value={value.draft}
          {...value.inputProps}
        />
      ) : (
        <button
          type="button"
          aria-label={`Valor do atributo ${displayName}: ${attribute.value}. Clique duas vezes para editar.`}
          className="font-display text-text w-full min-w-0 cursor-default truncate text-2xl leading-tight font-bold tabular-nums"
          onDoubleClick={value.onDoubleClick}
        >
          {attribute.value}
        </button>
      )}

      {/* Controles do lápis do BLOCO: presets de raridade + cor livre + remover.
          Sempre visíveis enquanto o lápis está ligado — o usuário já pediu o
          modo de edição, escondê-lo no hover seria um segundo gate. */}
      {editMode ? (
        <div className="border-border/60 mt-1 flex w-full items-center justify-center gap-1 border-t pt-1">
          <ColorPicker
            className="justify-center"
            customLabel={`Cor personalizada de ${displayName}`}
            label={`Raridade de ${displayName}`}
            value={attribute.color}
            onChange={(color) => onChange({ color })}
          />
          <RuneButton
            label={`Remover atributo ${displayName}`}
            tone="danger"
            onClick={onRemove}
          >
            ✕
          </RuneButton>
        </div>
      ) : null}

      <AttributeRollMenu attribute={attribute} context={context} menu={menu} />
    </div>
  );
}
