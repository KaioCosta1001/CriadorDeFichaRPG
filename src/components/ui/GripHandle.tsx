"use client";

import type { ButtonHTMLAttributes } from "react";

import { DragHandleIcon } from "./icons";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  GRIP HANDLE — ÍCONE DE ARRASTE PADRÃO (adendo §3.3)                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM COMPONENTE E NÃO UMA CLASSE CSS
 *
 * O "⠿" (Braille U+283F) não existe mais no projeto — era um caractere de
 * texto dentro de um elemento sem `pointer-events`/`cursor`/tamanho adequados.
 * O ícone SVG de 6 pontos já era usado, mas o botão que o envolvia não tinha
 * `touch-action: none` nem área mínima de toque.
 *
 * Um componente centraliza as duas coisas: o ícone SVG e o botão com área
 * mínima de 32×32px, `touch-action: none`, `user-select: none` e
 * `cursor: grab`. Sem isso, cada tela reinventa o handle e esquece uma dessas
 * propriedades — que é o que acontecia com as listas (Perícias etc.).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE `touch-action: none`
 *
 * Sem isso, o celular interpreta o arraste como rolagem da página — o bloco
 * fica para trás do dedo e nada acontece. É o mesmo motivo das alças de
 * redimensionamento.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function GripHandle({
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Descrição da AÇÃO, para leitores de tela. */
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[
        "group/rune border-frame bg-surface-sunken relative grid size-8 place-items-center rounded-md border text-lg leading-none transition-[transform,box-shadow,color] duration-150 hover:shadow-[0_0_16px_-6px_var(--glow)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
        "cursor-grab active:cursor-grabbing",
        className,
      ].join(" ")}
      style={{ touchAction: "none", userSelect: "none" }}
      {...props}
    >
      <DragHandleIcon />
      {/* Área de toque estendida, sem efeito no layout. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 hidden size-10 -translate-x-1/2 -translate-y-1/2 min-[769px]:hidden"
      />
    </button>
  );
}
