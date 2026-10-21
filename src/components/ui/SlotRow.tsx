"use client";

import type { CSSProperties, ReactNode, Ref } from "react";

/**
 * Linha-slot: a faixa horizontal do inventário, do bloco de lista e da
 * lista de perícias.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A COR DA LINHA É "RARIDADE"
 * O adendo visual pede que a cor escolhida pelo usuário apareça como uma
 * faixa na borda esquerda, com a convenção de raridade. Isso é bom para o
 * jogador — "tudo laranja é meu equipamento bom" — e não atrapalha o
 * recognition: o nome e o valor continuam sendo o elemento dominante.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ACESSIBILIDADE
 * A cor nunca é o ÚNICO sinal. `colorName` (ex.: "Lendário") entra como
 * texto acessível via `title`/Tooltip quando a linha tem cor definida, e o
 * símbolo do preset aparece visualmente. Quem não distingue as cores
 * continua lendo nome, valor e quantidade normalmente.
 * continua lendo nome, valor e quantidade normalmente.
 *
 * --------------------------------------------------------------------------
 * POR QUE EXISTE `contextMenuProps`
 * O menu de rolagem e disparado por `contextmenu`, e esse evento sobe pela
 * ARVORE. Se o gatilho ficasse num filho, um clique direito na borda direita
 * da linha - fora do conteudo - miraria o `<li>` e o menu nunca abriria.
 * Espalhar o gatilho aqui garante que a LINHA INTEIRA responda.
 */
export interface SlotRowProps {
  children: ReactNode;
  /** Cor da faixa esquerda (`null` = sem faixa). */
  color?: string | null;
  /** Glifo do preset de raridade, mostrado ao lado da faixa. */
  glyph?: string | null;
  /** Nome da cor, para o Tooltip — quem não distingue cores precisa dele. */
  colorName?: string | null;
  /** Estado de arraste. */
  dragging?: boolean;
  /** Handlers do menu de contexto, espalhados no `<li>` inteiro. */
  contextMenuProps?: Record<string, unknown>;
  /**
   * Ref do nó ARRASTÁVEL — o `<li>` desta linha.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE O REF FICA NO `<li>` E NÃO NUM `<span>` INTERNO
   *
   * O `restrictToParentElement` restringe o arraste ao pai IMEDIATO do nó
   * arrastável. Com o nó dentro da linha, esse pai é a própria LINHA — e o
   * item ficava preso dentro de si mesmo, sem para onde ir.
   *
   * No `<li>`, o pai imediato é o CONTAINER DA LISTA: que é o limite
   * correto (a lista rola; o item não sai dela).
   */
  nodeRef?: Ref<HTMLLIElement>;
  /**
   * Estilo do arraste (o `transform` do dnd-kit e a transição).
   *
   * Vai no `<li>` pelo mesmo motivo do `nodeRef`: o transform precisa
   * estar no elemento que o dnd-kit mede.
   */
  dragStyle?: CSSProperties;
  className?: string;
  /**
   * `row` (padrão) ocupa a largura toda; `chip` se ajusta ao conteúdo.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE UM PARÂMETRO E NÃO UM COMPONENTE NOVO
   *
   * A faixa de raridade, o glifo e o comportamento de arraste são idênticos
   * nos dois formatos. Duas implementações divergiriam na primeira correção
   * feita num lado só — e a divergência seria de COR, que não aparece em
   * nenhum teste.
   *
   * O que muda no `chip` é só a largura: `w-fit` mais um teto, para que um
   * nome longo vire reticências em vez de esticar a linha inteira.
   * ───────────────────────────────────────────────────────────────────────────
   */
  layout?: "row" | "chip";
}

export function SlotRow({
  children,
  color = null,
  glyph = null,
  colorName = null,
  dragging = false,
  contextMenuProps,
  nodeRef,
  dragStyle,
  className = "",
  layout = "row",
}: SlotRowProps) {
  return (
    <li
      ref={nodeRef}
      title={colorName ?? undefined}
      {...contextMenuProps}
      style={
        {
          ...(color ? { "--slot-accent": color } : {}),
          ...dragStyle,
        } as CSSProperties
      }
      className={[
        "relative flex items-center gap-2 rounded-[var(--radius-sm)] border",
        "border-border bg-surface-raised px-2 py-1",
        "transition-[box-shadow,background-color,transform] duration-150",
        "hover:bg-surface hover:shadow-[0_0_14px_-8px_var(--glow)]",
        // No `chip`, o bloco se ajusta ao texto; no `row`, ocupa a linha toda.
        layout === "chip" ? "w-fit max-w-full" : "w-full",
        dragging
          ? "z-10 opacity-80 shadow-[0_12px_28px_-12px_rgb(0_0_0/0.9)]"
          : "",
        className,
      ].join(" ")}
    >
      {/* Faixa de raridade. `width: 0` quando não há cor — sem espaço vazio. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-0 w-[3px] rounded-full"
        style={{
          background: color
            ? "var(--slot-accent)"
            : "color-mix(in srgb, var(--frame) 60%, transparent)",
          boxShadow: color ? "0 0 8px -2px var(--slot-accent)" : "none",
        }}
      />

      {glyph ? (
        <span
          aria-hidden="true"
          className="relative shrink-0 pl-1.5 text-sm leading-none"
          style={{ color: color ?? "var(--text-muted)" }}
        >
          {glyph}
        </span>
      ) : null}

      <div
        className={[
          "relative flex min-w-0 items-center gap-2",
          // No `chip` o conteúdo NÃO ocupa a largura toda — é o que deixa o
          // bloco se ajustar ao nome. No `row`, `flex-1` como sempre.
          layout === "chip" ? "" : "flex-1",
        ].join(" ")}
      >
        {children}
      </div>
    </li>
  );
}
