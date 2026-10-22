"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ROLL_ANIM_MS, ROLL_NUMBER_TICK_MS } from "@/config/constants";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  NÚMERO ANIMADO (adendo §5)                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O resultado real é calculado antes (função pura). A animação é APENAS
 * apresentação e SEMPRE termina exatamente no valor calculado.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMO FUNCIONA
 *
 * 1. Ao receber um novo `value`, começa a animar
 * 2. Durante a animação, exibe números que trocam em alta frequência
 * 3. Desacelera gradualmente (ease-out) até travar no valor final
 * 4. Clicar pula direto para o valor final
 * 5. Respeita `prefers-reduced-motion`: sem giro, fade curto
 *
 * ───────────────────────────────────────────────────────────────────────────
 * VELOCIDADE
 *
 * A velocidade vem das settings (global do usuário). O multiplicador age
 * sobre `ROLL_ANIM_MS`: duração efetiva = ROLL_ANIM_MS / velocidade.
 * Com velocidade 2x, a duração é a metade.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PERFORMANCE
 *
 * Usa `requestAnimationFrame` e atualiza apenas o nó do número. Evita
 * re-render do painel inteiro. Descarta timers ao desmontar.
 * ───────────────────────────────────────────────────────────────────────────
 */

interface AnimatedNumberProps {
  /** O valor final a ser exibido. */
  value: number;
  /** Identificador único da rolagem (para cancelar animação anterior). */
  rollId: string;
  /** Classe CSS. */
  className?: string;
  /** Estilo. */
  style?: React.CSSProperties;
  /** Callback quando a animação termina. */
  onDone?: () => void;
}

export function AnimatedNumber({
  value,
  rollId,
  className = "",
  style,
  onDone,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const speed = useSettingsStore((s) => s.settings.rollAnimationSpeed);

  // O valor exibido — começa no valor final para não piscar no primeiro render
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  /**
   * O valor exibido, em um REF.
   *
   * ───────────────────────────────────────────────────────────────────
   * POR QUE UM REF E NÃO O ESTADO
   *
   * O `tick` precisa do valor ATUALMENTE exibido (para não repetir o mesmo
   * número em dois frames seguidos). Ler o estado dentro do `tick` daria
   * um valor obsoleto — o `setState` só chega no render seguinte — e o
   * `useCallback` acabaria com `displayValue` na lista de dependências,
   * o que faria a animação recomeçar a cada frame.
   *
   * O ref é o valor "de agora", sem depender do ciclo de render.
   * ───────────────────────────────────────────────────────────────────
   */
  const displayValueRef = useRef(value);

  /**
   * Grava o valor exibido — no estado E no ref.
   *
   * O ref é atualizado AQUI, e não durante o render: o React Compiler
   * proíbe escrever em ref durante o render (e com razão — o render pode
   * ser descartado).
   */
  const updateDisplay = useCallback((next: number) => {
    displayValueRef.current = next;
    setDisplayValue(next);
  }, []);

  // Refs para cancelar animação
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const skippedRef = useRef(false);

  // Função de animação
  const animate = useCallback(() => {
    // Cancelar animação anterior
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Se reduced-motion, não anima — mostra direto
    if (reduceMotion) {
      updateDisplay(value);
      setIsAnimating(false);
      onDone?.();
      return;
    }

    // Se velocidade é 0 (sem animação), mostra direto
    if (speed <= 0) {
      updateDisplay(value);
      setIsAnimating(false);
      onDone?.();
      return;
    }

    // Duração efetiva
    const duration = ROLL_ANIM_MS / speed;

    // Faixa de valores para a animação (1 até o valor final, ou mínimo)
    const minValue = 1;
    const maxValue = Math.max(value, minValue);

    // Início da animação
    setIsAnimating(true);
    startTimeRef.current = performance.now();
    skippedRef.current = false;

    const tick = (now: number) => {
      if (skippedRef.current) return;

      const elapsed = now - (startTimeRef.current ?? now);
      const progress = Math.min(1, elapsed / duration);

      // Ease-out: desacelera gradualmente
      // const eased = 1 - Math.pow(1 - progress, 3);

      // Valor atual: começa aleatório, termina no valor final
      let current: number;
      if (progress < 0.85) {
        // Fase de troca rápida: valores aleatórios
        const tickProgress = progress / 0.85;
        const interval = ROLL_NUMBER_TICK_MS / (1 + tickProgress * 2);
        const shouldTick = Math.floor(elapsed / interval) % 2 === 0;
        if (shouldTick) {
          current =
            Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
        } else {
          current = displayValueRef.current;
        }
      } else {
        // Fase de settle: desacelera até o valor final
        const settleProgress = (progress - 0.85) / 0.15;
        const settleEased = 1 - Math.pow(1 - settleProgress, 2);
        void settleEased;
        current = Math.round(minValue + (value - minValue) * settleEased);
      }

      updateDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Garante que o valor final é exatamente o calculado
        updateDisplay(value);
        setIsAnimating(false);
        onDone?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [value, speed, reduceMotion, onDone, updateDisplay]);

  // Iniciar animação quando o rollId muda
  useEffect(() => {
    // ───────────────────────────────────────────────────────────────────
    // A ANIMAÇÃO COMEÇA NO PRÓXIMO FRAME — E NÃO NO CORPO DO EFEITO
    //
    // O `animate()` faz `setState`. Chamá-lo direto no efeito dispara um
    // render em cascata (regra `react-hooks/set-state-in-effect`).
    //
    // Agendar num `requestAnimationFrame` tira o `setState` de dentro do
    // efeito — e casa a animação com o próximo painted frame, que é onde
    // ela pertence. O usuário não vê a diferença; o React para de
    // reclamar.
    // ───────────────────────────────────────────────────────────────────
    const primeiroFrame = requestAnimationFrame(() => {
      animate();
    });

    return () => {
      cancelAnimationFrame(primeiroFrame);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [rollId, animate]);

  // Clique para pular
  const handleClick = useCallback(() => {
    if (isAnimating) {
      skippedRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      updateDisplay(value);
      setIsAnimating(false);
      onDone?.();
    }
  }, [isAnimating, value, onDone, updateDisplay]);

  return (
    
    <span
      className={className}
      style={style}
      onClick={handleClick}
      role="button"
      aria-label={`Resultado: ${value}${isAnimating ? ". Clique para pular." : ""}`}
      tabIndex={0}
    >
     {displayValue}
    </span>
  );
}
