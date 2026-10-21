import type { SVGProps } from "react";

import { MOTION_DURATIONS, MOTION_EASING } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ORNAMENTOS                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Todos os ornamentos são SVG/CSS ORIGINAIS. Nada aqui é asset, traço,
 * textura, logomarca ou fonte de terceiros. A referência é a *atmosfera* de
 * grimórios e runneras sombrios — vergê, chanfro, lozango — não nenhum
 * desenho específico.
 *
 * Princípio de custo: ornamento que precisa de DOM só existe onde realmente
 * se vê. Bordas duplas, chanfros de canto e ruído são feitos em CSS puro
 * (`.frame-double`, `.corner-notch`, `.noise-surface`) e não ocupam um nó.
 */

/** Base comum dos SVGs: herda cor do texto e escala com `1em`. */
function Svg({
  children,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 120 12"
      width="100%"
      {...props}
    >
      {children}
    </svg>
  );
}

/**
 * Divisor ornamental: fio que some nas pontas + losango central.
 *
 * O "somar nas pontas" é um gradiente aplicado no próprio traço, então a
 * linha nunca encosta na borda do painel com um corte seco.
 */
export function OrnateDivider({
  className = "",
  glyph = "◈",
}: {
  className?: string;
  /** Glifo central. Vazio remove o losango, deixando só a linha. */
  glyph?: string;
}) {
  return (
    <Svg className={`text-accent opacity-60 ${className}`}>
      {/* Gradiente: transparente nas pontas, cor no miolo. */}
      <defs>
        <linearGradient id="ornate-divider-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 6 H46" stroke="url(#ornate-divider-fade)" strokeWidth={1} />
      <path d="M74 6 H120" stroke="url(#ornate-divider-fade)" strokeWidth={1} />
      {glyph ? (
        <>
          <path d="M60 2.5 63.5 6 60 9.5 56.5 6Z" fill="currentColor" />
          <path d="M48 6 h4M68 6 h4" stroke="currentColor" strokeWidth={1} />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Ornamentos de canto em SVG.
 *
 * Use onde o chanfro CSS não basta: moldura de retrato, mesa de rolagem.
 * São quatro "L" finos com um pequeno corte diagonal — o suficiente para
 * ler como metal trabalhado sem virar enfeite.
 */
export function CornerOrnaments({ className = "" }: { className?: string }) {
  const arm = (rotate: number) => (
    <g transform={`rotate(${rotate} 10 10)`}>
      <path d="M1 1 H13" strokeWidth={1.25} />
      <path d="M1 1 V13" strokeWidth={1.25} />
      <path d="M4 4 H7" strokeWidth={0.75} opacity={0.7} />
      <path d="M4 4 V7" strokeWidth={0.75} opacity={0.7} />
    </g>
  );

  return (
    <svg
      aria-hidden="true"
      className={`text-accent pointer-events-none absolute inset-0 h-full w-full ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      viewBox="0 0 20 20"
    >
      {arm(0)}
      <g transform="translate(20 0) scale(-1 1)">{arm(0)}</g>
      <g transform="translate(0 20) scale(1 -1)">{arm(0)}</g>
      <g transform="translate(20 20) scale(-1 -1)">{arm(0)}</g>
    </svg>
  );
}

/**
 * Moldura de retrato: arco com bisel.
 *
 * `PV` e `Sanidade` (medalhões do Perfil, Fase 5) usam a mesma silhueta com
 * preenchimento diferente — é o que faz o bloco parecer um conjunto.
 */
export function PortraitFrame({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`text-accent pointer-events-none absolute inset-0 h-full w-full ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 40 40"
    >
      <circle cx="20" cy="20" r="18" strokeWidth={1} opacity={0.55} />
      <circle cx="20" cy="20" r="16" strokeWidth={0.5} opacity={0.35} />
      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d="M20 0.5 V4"
          opacity={0.8}
          strokeWidth={1.25}
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
    </svg>
  );
}

/**
 * Halo radial atrás do dado na mesa de rolagem (Fase 8).
 * Deixa vir com o token `--glow`, então acompanha o tema sozinho.
 */
export function EmberHalo({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background:
          "radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--glow) 22%, transparent) 0%, transparent 62%)",
      }}
    />
  );
}

/** Duração/easing expostos para os componentes de animação reaproveitarem. */
export const ORNAMENT_MOTION = {
  duration: MOTION_DURATIONS.fast,
  ease: MOTION_EASING.standard,
} as const;
