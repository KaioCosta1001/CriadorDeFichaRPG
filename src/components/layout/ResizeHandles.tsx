"use client";

import { GRID_GAP_PX, cellsToPx, type CellSize } from "@/config/constants";
import {
  RESIZE_ARIA_LABEL,
  RESIZE_DIRECTIONS,
  resizePanel,
  resizesHeight,
  resizesWidth,
  type ResizeDirection,
} from "@/domain/layout";
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

export type { ResizeDirection } from "@/domain/layout";

export interface ResizeResult {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ResizeHandlesProps {
  position: { x: number; y: number };
  size: { w: number; h: number };
  /** Tamanho de uma célula — é quem converte o delta do ponteiro em células. */
  cell: CellSize;
  /** Tipo do bloco, para aplicar o mínimo por tipo (§1.3). */
  panelType: string | null;
  /** Linhas do container, para a pré-visualização não passar da borda. */
  maxRows: number;
  onResize: (next: ResizeResult) => void;
}

/**
 * Alças de redimensionamento do Editar Geral (adendo §1.5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O BUG QUE ESTE COMPONENTE TINHA
 *
 * A versão anterior recebia `available` do `PanelGrid`, e o `PanelGrid` passava
 * `available={{ width: 0, height: 0 }}` — literalmente zero. Aí o cálculo fazia
 *
 *     w = Math.min(start.w + dx, available.width)
 *
 * ou seja `Math.min(algumaCoisa, 0)`, que é SEMPRE `0`. Arrastar a borda
 * direita ou inferior encolhia o bloco até o mínimo, em vez de crescê-lo. Era
 * por isso que "não dava para redimensionar com o mouse".
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A CORREÇÃO TEM DUAS PARTES
 *
 * 1. A conta saiu daqui e foi para `resizePanel`, em `domain/layout.ts`. Ela
 *    já recebia células, então não existe mais nenhum `Math.min(…, 0)` capaz
 *    de engolir o tamanho.
 *
 * 2. Este componente deixou de receber limite de espaço. O único teto é
 *    `GRID_MAX_W`/`GRID_MAX_H`, e a converter célula → pixel é trabalho da
 *    grade, que é quem conhece a largura real.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * `touch-action: none` NAS ALÇAS
 *
 * Sem isso, o navegador interpreta o arrasto como rolagem da página no
 * celular, e a alça "desliza" sem redimensionar nada. É o mesmo motivo do
 * `user-select: none` no handle de arraste.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function ResizeHandles({
  position,
  size,
  cell,
  panelType,
  maxRows,
  onResize,
}: ResizeHandlesProps) {
  const [active, setActive] = useState<ResizeDirection | null>(null);
  const [preview, setPreview] = useState<ResizeResult | null>(null);

  // Origem do gesto, capturada no `pointerdown`. Fica em `ref` para que um
  // re-render no meio do arraste não mude a referência e faça o bloco "pular".
  const origin = useRef<ResizeResult | null>(null);

  // Ponto do ponteiro onde o gesto começou. Fica em `ref` — e não em `state` —
  // porque ler `dataset` no `pointermove` evita um re-render por evento só para
  // isso.
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const compute = useCallback(
    (direction: ResizeDirection, deltaXPx: number, deltaYPx: number) => {
      const start = origin.current;
      if (!start) return;

      // ───────────────────────────────────────────────────────────────────
      // PIXEL DO PONTEIRO → CÉLULA → REGRA
      //
      // `pxToCells` arredonda, e é o arredondamento que produz o snap. O
      // passo é de ~1 célula por evento, então arrastar rápido não "pula"
      // posições: cada movimento soma pelo menos a uma célula.
      // ───────────────────────────────────────────────────────────────────
      const next = resizePanel(
        { x: start.x, y: start.y, w: start.w, h: start.h },
        direction,
        {
          w: Math.round(deltaXPx / (cell.w + GRID_GAP_PX)),
          h: Math.round(deltaYPx / (cell.h + GRID_GAP_PX)),
        },
        panelType,
      );

      // O topo não pode passar do container: empurraria o bloco para fora da
      // tela e o usuário não teria como trazê-lo de volta.
      const limited =
        next.y + next.h > maxRows
          ? { ...next, y: Math.max(0, maxRows - next.h) }
          : next;

      setPreview(limited);
      onResize(limited);
    },
    [cell.h, cell.w, maxRows, onResize, panelType],
  );

  function handlePointerDown(
    event: PointerEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) {
    // Impede que o clique na alça também inicie o arraste do bloco.
    event.stopPropagation();
    event.preventDefault();

    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: position.x, y: position.y, w: size.w, h: size.h };
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    setActive(direction);
  }

  function endGesture(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    origin.current = null;
    pointerOrigin.current = null;
    setActive(null);
    setPreview(null);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) {
    let dx = 0;
    let dy = 0;

    // Uma seta = uma célula. Shift = dez, para quem não usa mouse.
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;

    event.preventDefault();
    // No teclado não há gesto em curso: a origem é o estado atual.
    origin.current = { x: position.x, y: position.y, w: size.w, h: size.h };
    compute(
      direction,
      dx * (cell.w + GRID_GAP_PX),
      dy * (cell.h + GRID_GAP_PX),
    );
  }

  return (
    <>
      {RESIZE_DIRECTIONS.map((direction) => (
        <button
          key={direction}
          type="button"
          aria-label={RESIZE_ARIA_LABEL[direction]}
          className={HANDLE_CLASS[direction]}
          style={{
            ...(isEdge(direction) ? HANDLE_EDGE_STYLE : HANDLE_CORNER_STYLE),
            touchAction: "none",
          }}
          onKeyDown={(event) => handleKeyDown(event, direction)}
          onPointerCancel={endGesture}
          onPointerDown={(event) => handlePointerDown(event, direction)}
          onPointerMove={(event) => {
            const start = origin.current;
            const from = pointerOrigin.current;
            if (!start || !from || active === null) return;

            compute(active, event.clientX - from.x, event.clientY - from.y);
          }}
          onPointerUp={endGesture}
        />
      ))}

      {/*
       * Indicador de tamanho (§1.5).
       *
       * Aparece durante o gesto e mostra o tamanho FINAL em células, com os
       * pixels abaixo. Duas informações porque elas respondem perguntas
       * diferentes: as células dizem se encaixou no grid, os pixels dizem
       * quanto espaço na tela ficou.
       *
       * Fica ACIMA do bloco (`z-30`) porque o bloco tem `overflow: hidden` —
       * um indicador dentro dele seria cortado nas bordas.
       */}
      {preview && active ? (
        <SizeBadge direction={active} preview={preview} cell={cell} />
      ) : null}
    </>
  );
}

/* ── Indicador de tamanho ─────────────────────────────────────────────────── */

function SizeBadge({
  direction,
  preview,
  cell,
}: {
  direction: ResizeDirection;
  preview: ResizeResult;
  cell: CellSize;
}) {
  const widthPx = cellsToPx(preview.w, cell.w);
  const heightPx = cellsToPx(preview.h, cell.h);

  // O indicador foge para o lado OPOSTO ao da alça arrastada: puxando a
  // direita, ele aparece à esquerda do bloco. Assim ele nunca sai da tela.
  const anchor: CSSProperties = {
    position: "absolute",
    zIndex: 30,
    pointerEvents: "none",
    ...(resizesWidth(direction) ? {} : { left: "50%", translate: "-50% 0" }),
    ...(resizesHeight(direction) ? {} : { top: "50%", translate: "0 -50%" }),
    ...(resizesWidth(direction) && direction.includes("left")
      ? { right: "100%", marginRight: 8 }
      : {}),
    ...(resizesWidth(direction) && direction.includes("right")
      ? { left: "100%", marginLeft: 8 }
      : {}),
    ...(resizesHeight(direction) && direction.includes("top")
      ? { bottom: "100%", marginBottom: 8 }
      : {}),
    ...(resizesHeight(direction) && direction.includes("bottom")
      ? { top: "100%", marginTop: 8 }
      : {}),
  };

  return (
    <output
      aria-live="polite"
      style={anchor}
      className="border-accent/70 bg-surface-raised text-accent rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap tabular-nums shadow-[0_4px_16px_-6px_rgb(0_0_0/0.8)]"
    >
      {preview.w} × {preview.h} células
      <span className="text-text-muted">
        {" · "}
        {widthPx}×{heightPx}px
      </span>
    </output>
  );
}

/** Rótulo em pt-BR para leitores de tela. */
export { RESIZE_ARIA_LABEL };

/**
 * Classes CSS de cada alça.
 *
 * As de CANTO são losangos metálicos: `clip-path` recorta o quadrado em
 * losango, o que dá o aspecto de peça encaixada sem usar imagem alguma. As de
 * BORDA são barras finas, para poder redimensionar só na horizontal ou só na
 * vertical.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A ALÇA FICA DENTRO DO PAINEL (adendo §2.3.4)
 *
 * A versão anterior posicionava a alça FORA da borda (`-right-1`, isto é,
 * 4px para fora) e estendia a área de clique com `before:-inset-2` (mais 8px
 * para cada lado). O alvo visível media 12px, mas a área CLICÁVEL ultrapassava
 * 12px da borda — e capturava o clique do bloco vizinho.
 *
 * A HITBOX É O VISUAL: a alça agora é posicionada com `inset 0` (dentro da
 * moldura), tem espessura fixa de 12px (borda) ou 16px (canto), e não tem
 * pseudo-elemento. A área clicável é exatamente o desenho.
 * ───────────────────────────────────────────────────────────────────────────
 */
const HANDLE_CLASS: Record<ResizeDirection, string> = {
  "top-left": "cursor-nwse-resize left-0 top-0 size-4",
  top: "cursor-ns-resize top-0 left-1/2 h-3 w-10 -translate-x-1/2",
  "top-right": "cursor-nesw-resize right-0 top-0 size-4",
  right: "cursor-ew-resize right-0 top-1/2 h-10 w-3 -translate-y-1/2",
  "bottom-right": "cursor-nwse-resize bottom-0 right-0 size-4",
  bottom: "cursor-ns-resize bottom-0 left-1/2 h-3 w-10 -translate-x-1/2",
  "bottom-left": "cursor-nesw-resize bottom-0 left-0 size-4",
  left: "cursor-ew-resize left-0 top-1/2 h-10 w-3 -translate-y-1/2",
};

/**
 * Aparência da alça.
 *
 * A alça de canto é escura com aro dourado: sobre um painel escuro, um
 * quadrado claro chamaria mais atenção do que o próprio bloco. Com aro, ela
 * aparece quando o mouse chega perto — e some com `prefers-reduced-motion`
 * sem piscar.
 */
const HANDLE_CORNER_STYLE: CSSProperties = {
  position: "absolute",
  zIndex: 20,
  background: "var(--surface-sunken)",
  border: "1px solid var(--accent)",
  opacity: 0.8,
  transition: "opacity 120ms ease, box-shadow 120ms ease",
  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
};

const HANDLE_EDGE_STYLE: CSSProperties = {
  position: "absolute",
  zIndex: 20,
  background: "var(--accent)",
  opacity: 0.6,
  borderRadius: 999,
};

/** `true` quando a alça é de BORDA (só um eixo). */
function isEdge(direction: ResizeDirection): boolean {
  return (
    direction === "top" ||
    direction === "bottom" ||
    direction === "left" ||
    direction === "right"
  );
}
