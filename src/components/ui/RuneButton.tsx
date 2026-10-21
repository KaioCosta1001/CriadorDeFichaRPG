"use client";

import { Tooltip } from "@mui/material";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botão-runa: o controle circular com borda metálica do grimório.
 *
 * Usado no "+" do inventário, no lápis de cada bloco e nos controles
 * compactos. É a unidade visual mais repetida da interface, então merece um
 * componente próprio: garante raio, alvo de toque, foco e brilho idênticos
 * em todos os lugares.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ALVO DE TOQUE
 * Em telas pequenas o alvo mínimo é 40 px. O botão é 28 px visualmente, mas
 * `::after` invisível de 40 px estende a área clicável sem alterar o layout —
 * o alvo cresce sem o layout "pular".
 * ───────────────────────────────────────────────────────────────────────────
 */
export function RuneButton({
  label,
  children,
  tone = "accent",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Descrição da AÇÃO, para leitores de tela. */
  label: string;
  /** `accent` = dourado; `danger` = brasa; `primary` = cor do tema. */
  tone?: "accent" | "primary" | "danger";
  children: ReactNode;
}) {
  const toneClass = {
    accent: "text-accent hover:text-text",
    primary: "text-primary hover:text-text",
    danger: "text-danger hover:text-danger",
  }[tone];

  return (
    <Tooltip title={label}>
      <button
        type="button"
        aria-label={label}
        className={`group/rune border-frame bg-surface-sunken relative grid size-7 place-items-center rounded-md border text-lg leading-none transition-[transform,box-shadow,color] duration-150 hover:shadow-[0_0_16px_-6px_var(--glow)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${toneClass} ${className}`}
        {...props}
      >
        {/* Área de toque estendida, sem efeito no layout. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 hidden size-10 -translate-x-1/2 -translate-y-1/2 min-[769px]:hidden"
        />
        {children}
      </button>
    </Tooltip>
  );
}
