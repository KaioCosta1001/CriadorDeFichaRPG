"use client";

import { CrossIcon } from "@/components/ui/icons";

import type { PanelProps } from "../registry";

/**
 * Bloco reservado "Em processo" (seção 9.5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE TIPO NÃO PODE SER CRIADO
 * O tipo existe para guardar a forma do painel no schema e no registro, mas
 * a interface o apresenta DESABILITADO, marcado com um "x". Criar um bloco
 * vazio sem função só ocupa espaço na grade e confunde o usuário.
 *
 * Mostrar a opção explica que o espaço foi reservado; escondê-la deixaria o
 * usuário sem resposta quando procurasse por ela.
 *
 * O bloqueio é de interface (`panelRegistry.placeholder.userAddable === false`),
 * não de schema: se um documento já salvo tiver esse tipo, ele continua
 * abrindo normalmente em vez de virar arquivo corrompido.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function PlaceholderPanel({ extra }: PanelProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <CrossIcon className="text-text-muted/60 text-4xl" />
      <p className="font-display text-text-muted text-sm font-semibold tracking-[0.16em] uppercase">
        {extra?.title || "Em processo"}
      </p>
      <p className="text-text-muted/80 max-w-56 text-xs">
        Este tipo de bloco está reservado para uma ideia futura.
      </p>
    </div>
  );
}
