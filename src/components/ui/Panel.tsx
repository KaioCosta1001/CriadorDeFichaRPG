"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { OrnateDivider } from "@/components/ui/ornaments";
import {
  MOTION_DURATIONS,
  MOTION_EASING,
  MOTION_STAGGER_MS,
} from "@/config/constants";

/* ===========================================================================
 * PAINEL
 * ========================================================================== */

interface PanelProps {
  children: ReactNode;
  /** `true` durante o Editar Geral: contorno tracejado dourado pulsando. */
  editing?: boolean;
  /** Faz o painel subir e ganhar sombra enquanto é arrastado. */
  lifted?: boolean;
  /** Texto lido por leitores de tela para o painel inteiro. */
  label: string;
  /** Texto do cabeçalho, opcional (alguns blocos não o usam). */
  className?: string;
  /** Atraso da animação de entrada, em ms (efeito cascata). */
  index?: number;
}

/**
 * O painel da ficha — "chapa gravada".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ONDE ESTÃO OS ORNAMENTOS
 * Todos consumem tokens; nenhum componente declara cor.
 *   - borda dupla   → `.frame-double` (borda + `box-shadow` interno/externo)
 *   - chanfro       → `.corner-notch` (dois pseudo-elementos em L)
 *   - textura       → `.noise-surface` (SVG `feTurbulence` a ~3% de opacidade)
 *   - divisores     → `<OrnateDivider />`
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ENTRADA COM CASCATA
 * O `index` vira atraso progressivo, para os blocos aparecerem em sequência
 * na ordem de leitura em vez de todos de uma vez.
 *
 * `prefers-reduced-motion` desliga a cascata E o pulso: o painel entra sem
 * deslocamento e o contorno tracejado fica estático.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function Panel({
  children,
  editing = false,
  lifted = false,
  label,
  className = "",
  index = 0,
}: PanelProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      aria-label={label}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: MOTION_DURATIONS.normal / 1000,
        delay: reduceMotion ? 0 : (index * MOTION_STAGGER_MS) / 1000,
        ease: MOTION_EASING.entrance,
      }}
      className={[
        // `flex-1 min-h-0`: a seção ocupa a altura da moldura, e o
        // conteúdo interno rola em vez de esticar o painel.
        "noise-surface relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)]",
        editing ? "frame-dashed" : "frame-double",
        editing && !reduceMotion ? "animate-ember-pulse" : "",
        lifted ? "scale-[1.01] shadow-[0_24px_48px_-20px_rgb(0_0_0/0.9)]" : "",
        className,
      ].join(" ")}
    >
      {editing ? (
        <span
          aria-hidden="true"
          className="corner-notch absolute inset-0 z-20"
          // ---------------------------------------------------------------
          // INLINE, E NAO SO NO CSS — por que?
          //
          // O chanfro e `absolute inset-0` em `z-20`, e o conteudo do painel
          // fica em `z-10`: sem `pointer-events: none`, o chanfro fica ACIMA
          // do conteudo e captura TODOS os cliques da ficha no modo Editar
          // Geral — botoes, campos, abas, alcas e o handle de arraste. Foi
          // esse o bug de "nao consigo clicar em nada".
          //
          // A regra equivalente existe em `globals.css`; repetir aqui em
          // inline e redundancia deliberada: a invariante nao depende de a
          // folha continuar com aquele nome de classe, e um teste consegue
          // verifica-la sem carregar o CSS.
          // ---------------------------------------------------------------
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {/* `z-10` coloca o conteúdo ACIMA da textura de ruído (que fica em
          `z-0`). Sem isto, o grão passaria por cima do texto. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </motion.section>
  );
}

/* ===========================================================================
 * CABEÇALHO
 * ========================================================================== */

interface PanelHeaderProps {
  /** Título em caixa-alta espacçada (Cinzel). */
  title: string;
  /** Ícones/ações à direita. */
  actions?: ReactNode;
  /** Handle de arraste, mostrado à esquerda no Editar Geral. */
  handle?: ReactNode;
  /** Linha ornamental abaixo do título. */
  divider?: boolean;
}

/**
 * Cabeçalho do painel: faixa de couro com título em Cinzel, divisor
 * ornamental e ações à direita.
 *
 * As ações ficam sempre visíveis no Editar Geral (o usuário precisa
 * encontrá-las) e no hover/foco fora dele — esconde-las só no hover deixaria
 * o teclado sem caminho para elas.
 */
export function PanelHeader({
  title,
  actions,
  handle,
  divider = true,
}: PanelHeaderProps) {
  return (
    <header className="relative z-10 shrink-0">
      <div className="bg-surface-sunken flex items-center gap-1.5 px-2 py-1">
        {handle}
        <h2 className="label-caps min-w-0 flex-1 truncate">{title}</h2>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
      {divider ? <OrnateDivider className="h-2 w-full px-1" /> : null}
    </header>
  );
}
