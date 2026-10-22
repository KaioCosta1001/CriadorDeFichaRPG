"use client";

import { Tooltip } from "@mui/material";

import { OrnateDivider } from "@/components/ui/ornaments";
import {
  announceRoll,
  describeRoll,
  isCritRoll,
  isFumbleRoll,
} from "@/domain/rolls";
import { RollBreakdown } from "./RollBreakdown";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import type { RollRecord } from "@/schemas";

import type { PanelProps } from "../registry";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  BLOCO DE RESULTADO DO ROLAMENTO (seção 8.3)                             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Mostra a ÚLTIMA rolagem em destaque e as anteriores em lista. Uma única
 * estrutura de registro serve para arma, perícia e atributo — por isso não há
 * três renderizadores aqui, e sim um.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ANIMAÇÃO DO DADO
 *
 * O número entra com uma "queda" curta — escala, opacidade e deslocamento.
 * A `key` do `motion.span` é o id da rolagem, então cada rolagem nova
 * reinicia a animação sem nenhum efeito e sem estado.
 *
 * A primeira versão animava o NÚMERO em si, trocando-o por quadros. Era pior
 * em dois sentidos: o valor mudava três vezes (ilegível), e exigia um
 * `useEffect` chamando `setState`, que a regra `react-hooks/set-state-in-
 * effect` do React Compiler proíbe. Animar a ENTRADA resolve os dois.
 *
 * Com `prefers-reduced-motion`, o número aparece direto, já no valor final:
 * some a animação, não a informação.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CRÍTICO E FUMBLE
 * Natural 20 e natural 1 são destacados, como pede o adendo visual (§"destaque
 * visual de crítico"). A checagem olha o VALOR DO DADO, não o total: um
 * "natural 20" que virou 14 por causa de um modificador negativo não é um
 * crítico da rolagem.
 */
export function RollResultPanel({ context }: PanelProps) {
  const history = context.sheet.rollHistory;
  const latest = history[0];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div role="status" aria-live="polite" className="sr-only">
        {latest ? <span key={latest.id}>{announceRoll(latest)}</span> : null}
      </div>

      {latest ? <LastRoll roll={latest} /> : <EmptyResult />}

      {history.length > 1 ? (
        <>
          <OrnateDivider className="h-2 w-full" />
          <ul className="flex flex-col gap-1">
            {history.slice(1).map((roll) => (
              <HistoryRow key={roll.id} roll={roll} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ── Estado vazio ──────────────────────────────────────────────────────────── */

function EmptyResult() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <span aria-hidden="true" className="text-accent/50 font-display text-3xl">
        ⚄
      </span>
      <p className="text-text-muted text-xs">
        Nenhuma rolagem ainda.
        <br />
        Clique com o botão direito em uma perícia ou em um atributo.
      </p>
    </div>
  );
}

/* ── Última rolagem ────────────────────────────────────────────────────────── */

function LastRoll({ roll }: { roll: RollRecord }) {
  return (
    <Tooltip enterDelay={500} title={describeRoll(roll)}>
      <div
        className="flex flex-col items-center gap-1 text-center"
        role="group"
        aria-label={describeRoll(roll)}
        tabIndex={0}
      >
        {/* O número animado: gira e desacelera até o valor real (§5). */}
        <AnimatedNumber
          value={roll.total}
          rollId={roll.id}
          className={[
            "font-display text-5xl leading-none font-bold tabular-nums",
            isCritRoll(roll)
              ? "text-accent"
              : isFumbleRoll(roll)
                ? "text-danger"
                : "text-text",
          ].join(" ")}
          style={
            isCritRoll(roll) || isFumbleRoll(roll)
              ? { textShadow: `0 0 24px var(--glow)` }
              : undefined
          }
        />

        {/* O detalhamento AGORA usa o RollBreakdown — mesmo componente do
            histórico e do foco, e o §5 pede essa organização visual. */}
        <RollBreakdown roll={roll} prominent />
      </div>
    </Tooltip>
  );
}

/* ── Histórico ─────────────────────────────────────────────────────────────── */

function HistoryRow({ roll }: { roll: RollRecord }) {
  return (
    <li>
      <Tooltip enterDelay={200} title={describeRoll(roll)}>
        <div
          tabIndex={0}
          role="group"
          aria-label={describeRoll(roll)}
          className="border-frame/60 bg-surface-sunken hover:border-accent/50 focus-visible:border-accent flex items-baseline justify-between gap-2 rounded-[var(--radius-sm)] border px-2 py-1 text-xs transition-colors"
        >
          <span className="text-text-muted min-w-0 truncate">{roll.label}</span>
          <span className="text-text font-display shrink-0 font-bold tabular-nums">
            {roll.total}
          </span>
        </div>
      </Tooltip>
    </li>
  );
}
