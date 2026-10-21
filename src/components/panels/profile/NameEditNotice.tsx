"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import {
  NOTICE_DURATION_MS,
  POPUP_FADE_FROM_OPACITY,
  POPUP_FADE_TO_OPACITY,
  PROFILE_POPUP_FADE_MS,
} from "@/config/constants";

/**
 * Aviso de "o nome só muda no Editar Geral" (seção 8.1).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * REGRAS DA ESPECIFICAÇÃO, UMA A UMA
 *  - Texto EXATO: "Poderá ser editado em 'Editar' no painel principal";
 *  - some com animação de opacidade (Motion);
 *  - a duração do fade vem de `PROFILE_POPUP_FADE_MS`;
 *  - o tempo de exibição vem de `NOTICE_DURATION_MS`.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `prefers-reduced-motion`
 * O aviso CONTINUA aparecendo e desaparecendo — só deixa de animar: some na
 * hora em vez de esmaecer. Esconder a informação é diferente de remover a
 * animação, e quem pediu menos movimento não pediu menos informação.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * O container é `pointer-events-none`: ele paira sobre o nome sem capturar o
 * clique. Se bloqueasse o ponteiro, o usuário não conseguiria nem clicar de
 * novo para ver o aviso outra vez.
 */
interface NameEditNoticeProps {
  open: boolean;
  message: string;
  onClosed: () => void;
}

export function NameEditNotice({
  open,
  message,
  onClosed,
}: NameEditNoticeProps) {
  const reduceMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;

    timer.current = setTimeout(onClosed, NOTICE_DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [onClosed, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.output
          // `role="status"` faz o leitor de tela anunciar sem roubar o foco.
          role="status"
          initial={{
            opacity: POPUP_FADE_FROM_OPACITY,
            y: reduceMotion ? 0 : 4,
          }}
          animate={{ opacity: POPUP_FADE_FROM_OPACITY, y: 0 }}
          exit={{
            opacity: POPUP_FADE_TO_OPACITY,
            y: reduceMotion ? 0 : -4,
            transition: {
              duration: PROFILE_POPUP_FADE_MS / 1000,
              ease: "easeOut",
            },
          }}
          transition={{ duration: PROFILE_POPUP_FADE_MS / 1000 }}
          className="border-accent bg-surface-raised text-text pointer-events-none absolute inset-x-2 top-1/2 z-40 mx-auto max-w-56 rounded-[var(--radius-sm)] border px-2 py-1.5 text-center text-xs leading-snug shadow-[0_0_20px_-6px_var(--glow)]"
        >
          {message}
        </motion.output>
      ) : null}
    </AnimatePresence>
  );
}
