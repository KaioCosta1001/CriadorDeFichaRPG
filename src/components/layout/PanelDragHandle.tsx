"use client";

import type { ButtonHTMLAttributes } from "react";

import { DragHandleIcon } from "@/components/ui/icons";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  HANDLE DE ARRASTE DE UM PAINEL (adendo §3.3)                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE UM COMPONENTE E NÃO UM `<button>` SOLTO NO `PanelFrame`
 *
 * O handle do painel e o handle das listas são o MESMO gesto: pegar e
 * arrastar. Quando são escritos à mão em cada tela, cada um esquece
 * alguma coisa — foi o que aconteceu: o handle do painel tinha 24×24 e
 * `touch-action` só num dos usos.
 *
 * Este é o irmão do `GripHandle` (que serve às LISTAS). A diferença é o
 * tamanho: o handle do painel fica no cabeçalho, ao lado do título, e por
 * isso é mais discreto — 28×28 em vez dos 32×32 do `GripHandle`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `touch-action: none` E `user-select: none`
 *
 * Sem o primeiro, o celular interpreta o arraste como rolagem da página e o
 * bloco fica para trás do dedo. Sem o segundo, arrastar no toque seleciona
 * texto — o que no navegador móvel pode abrir o menu de copiar.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function PanelDragHandle({
  label,
  title,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Descrição da AÇÃO, para leitores de tela. */
  label: string;
  /** Texto da dica (tooltip). */
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={[
        "text-accent hover:text-text grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded p-0 transition-colors active:cursor-grabbing",
        className,
      ].join(" ")}
      style={{ touchAction: "none", userSelect: "none" }}
      {...props}
    >
      <DragHandleIcon className="text-base" />
    </button>
  );
}
