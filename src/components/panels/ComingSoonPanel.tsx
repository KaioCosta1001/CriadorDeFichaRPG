"use client";

import { PANEL_TYPE_LABELS, type PanelType } from "@/config/panelTypes";

import type { PanelProps } from "./registry";

/**
 * Marcador dos blocos padrão que ainda não foram construídos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE EXISTE
 * A grade de painéis é da Fase 4, mas Inventário, Resultado, Atributos e
 * Perícias são das Fases 6 a 8. Sem este marcador, a Fase 4 entregaria uma
 * grade vazia, impossível de testar.
 *
 * Ele entra no registro com o rótulo CORRETO e é substituído por uma única
 * entrada no `panelRegistry` quando o bloco real chegar — nenhuma outra
 * parte do grid muda. O Perfil (Fase 5) já saiu daqui.
 * ───────────────────────────────────────────────────────────────────────────
 */
const PHASE_BY_TYPE: Partial<Record<PanelType, string>> = {
  inventory: "Fase 7",
  "roll-result": "Fase 8",
  attributes: "Fase 6",
  skills: "Fase 6",
};

export function ComingSoonPanel({ layout }: PanelProps) {
  const type = layout?.panelId as PanelType | undefined;
  const phase = (type && PHASE_BY_TYPE[type]) || "Fase futura";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
      <p className="label-caps opacity-70">
        {type ? PANEL_TYPE_LABELS[type] : "Bloco"}
      </p>
      <p className="text-text-muted/80 text-xs">
        {layout
          ? `${layout.w}×${layout.h} px · chega na ${phase}`
          : `chega na ${phase}`}
      </p>
    </div>
  );
}
