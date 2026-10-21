"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createCellSnapModifier } from "@/lib/cellSnapModifier";
import { useMediaQuery } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { GridGuides } from "@/components/layout/GridGuides";
import { PanelFrame } from "@/components/layout/PanelFrame";
import {
  getPanelDefinition,
  type PanelContext,
  type PanelProps,
} from "@/components/panels/registry";
import { isPanelTypeHideable } from "@/config/panelTypes";
import {
  DND_ACTIVATION_DISTANCE_PX,
  GRID_COLUMNS,
  GRID_GAP_PX,
  MOBILE_BREAKPOINT_PX,
  PANEL_KEYBOARD_STEP_CELLS,
  PANEL_KEYBOARD_STEP_LARGE_CELLS,
  PANEL_GRID_PADDING_PX,
  cellSize,
  cellsToPx,
  pxDeltaToCells,
} from "@/config/constants";
import { PANEL_TYPE_LABELS, type PanelType } from "@/config/panelTypes";
import {
  clampPosition,
  computeContainerHeight,
  extraIdFromKey,
  isExtraPanelKey,
  normalizeLayout,
  panelTypeOf,
  resolveCollisions,
} from "@/domain/layout";
import type { PanelLayout, Sheet } from "@/schemas";

interface PanelGridProps {
  sheet: Sheet;
  context: PanelContext;
  editMode: boolean;
  pendingRemoval: { panelId: string; title: string } | null;
  onRequestRemove: (panelId: string, title: string) => void;
  /** Liga/desliga a visibilidade, pela bandeja. */
  onToggleVisible: (panelId: string, nextVisible: boolean) => void;
  onCancelRemove: () => void;
  onLayoutChange: (layout: PanelLayout[]) => void;
  /**
   * Remove um bloco INTEIRO — entrada no layout E, se for um bloco do usuário,
   * o conteúdo em `extraPanels`.
   *
   * São duas escritas separadas de propósito: deixar `extraPanels` intacto
   * guardaria para sempre o texto de um bloco apagado, e o arquivo cresceria a
   * cada bloco criado e removido.
   */
  onRemovePanel: (panelId: string) => void;
}

/**
 * Grade de painéis em unidades de CÉLULA (adendo §1).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE A GRADE É RESPONSÁVEL PELA CONVERSÃO
 *
 * `domain/layout.ts` trabalha só com inteiros e não conhece a largura da
 * janela. Quem mede o container e converte célula ↔ pixel é ESTE componente. É a
 * separação que mantém toda a regra de layout testável sem navegador.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * MÓVEL (decisão mantida da Fase 1)
 *
 * Abaixo de `MOBILE_BREAKPOINT_PX` o layout salvo é IGNORADO: os blocos
 * empilham verticalmente na ordem salva, e arraste/redimensionamento ficam
 * indisponíveis. Motivo: numa tela de 360 px, um bloco de 12 colunas ocupa
 * quase tudo, e acertar uma alça de 12 px com o dedo erra o alvo a cada
 * tentativa. O DnD das listas INTERNAS continua funcionando — esse nunca foi
 * desligado, e é onde o toque importa de verdade.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * QUANDO O LAYOUT É GRAVADO
 *
 * Só no FIM do gesto (arraste solto ou alça liberada), nunca a cada célula.
 * Gravar durante o arraste dispararia dezenas de escritas por segundo no
 * `sheetStore` — que é exatamente o que o debounce existe para evitar.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O LAYOUT É NORMALIZADO ANTES DE SER DESENHADO
 *
 * Uma ficha importada, uma migração de px para célula ou um container que
 * estreitou podem entregar layout sobreposto ou fora dos limites. Desenhar
 * isso primeiro deixaria dois blocos empilhados, e o de baixo intocável — um
 * beco sem saída. `normalizeLayout` roda na renderização, e é ele que garante a
 * invariante "nenhum bloco sobrepõe outro".
 * ───────────────────────────────────────────────────────────────────────────
 */
export function PanelGrid({
  sheet,
  context,
  editMode,
  pendingRemoval,
  onRequestRemove,
  onToggleVisible,
  onCancelRemove,
  onLayoutChange,
  onRemovePanel,
}: PanelGridProps) {
  const isNarrow = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT_PX - 1}px)`, {
    noSsr: true,
  });
  const interactive = !isNarrow;

  /* ── Medição do container ──────────────────────────────────────────────
   *
   * A coluna do grid é FLUIDA: `GRID_COLUMNS` colunas dividem a largura útil.
   * Isso é o que faz a grade preencher a tela em vez de deixar uma faixa
   * vazia à direita.
   *
   * `useState` + `ResizeObserver` em vez de ler a largura no render: a largura
   * só é conhecida depois que o nó está na tela, e ler direto no render
   * causaria hydration mismatch (§5.7) e um laço render → medir → render.
   */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => setContainerWidth(node.clientWidth);
    measure();

    // `ResizeObserver` e não o evento `resize` da janela: este dispara também
    // quando a barra lateral do navegador some, ou quando um painel empurrado
    // muda o tamanho do container. Ouvir só a janela errava a largura.
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cell = useMemo(() => cellSize(containerWidth), [containerWidth]);

  /**
   * Retângulo em pixels a partir das células.
   *
   * O gap entra AQUI, uma única vez, em vez de ser margem de cada painel.
   * Somar gap na posição E aplicar margem na grade era a mesma ideia escrita
   * duas vezes — e as duas cópias divergiriam no primeiro ajuste de `GRID_GAP_PX`.
   */
  const toPixels = useCallback(
    (panel: PanelLayout) => ({
      left: panel.x * (cell.w + GRID_GAP_PX),
      top: panel.y * (cell.h + GRID_GAP_PX),
      width: cellsToPx(panel.w, cell.w),
      height: cellsToPx(panel.h, cell.h),
    }),
    [cell],
  );

  const sensors = useSensors(
    // Distância mínima: um clique no cabeçalho não pode virar arraste.
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE_PX },
    }),
    // O sensor de teclado do dnd-kit já publica os anúncios ARIA de
    // "item movido para a posição N".
    useSensor(KeyboardSensor),
  );

  /**
   * O tipo de cada chave, para a normalização e para os mínimos por tipo.
   *
   * Vai num `useMemo` porque `normalizeLayout` roda a CADA render: sem
   * memoizar o resolver, um mapa novo a cada render faria a normalização
   * devolver sempre um array novo, e um layout normalizado é comparado por
   * identidade antes de ser gravado — sem memo, ele nunca seria considerado
   * "igual" e a grade reescreveria a ficha em loop.
   */
  const typeOf = useCallback(
    (panelId: string): PanelType | null => panelTypeOf(sheet, panelId),
    [sheet],
  );

  const visible = useMemo(() => {
    const renderable = sheet.layout.filter(
      (panel) =>
        panel.visible || !isPanelTypeHideable(typeOf(panel.panelId) ?? ""),
    );

    // Normaliza ANTES de ordenar e desenhar: um layout importado sobreposto ou
    // fora dos limites precisa ser corrigido na entrada, não só quando o
    // usuário mexer em algo.
    return [...normalizeLayout(renderable, typeOf)].sort(
      (a, b) => a.order - b.order || a.y - b.y || a.x - b.x,
    );
  }, [sheet.layout, typeOf]);

  /** Escreve o layout normalizado de volta. Só grava se mudou de verdade. */
  const commit = useCallback(
    (next: PanelLayout[]) => {
      const changed = next.some(
        (panel, index) =>
          panel.x !== sheet.layout[index]?.x ||
          panel.y !== sheet.layout[index]?.y ||
          panel.w !== sheet.layout[index]?.w ||
          panel.h !== sheet.layout[index]?.h,
      );
      if (changed) onLayoutChange(next);
    },
    [onLayoutChange, sheet.layout],
  );

  const patchPanel = useCallback(
    (panelId: string, patch: Partial<PanelLayout>) => {
      commit(
        normalizeLayout(
          sheet.layout.map((panel) =>
            panel.panelId === panelId ? { ...panel, ...patch } : panel,
          ),
          typeOf,
        ),
      );
    },
    [commit, sheet.layout, typeOf],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, delta } = event;
    const current = sheet.layout.find((panel) => panel.panelId === active.id);
    if (!current) return;

    // O `delta` do dnd-kit vem em PIXELS do ponteiro; convertemos para
    // CÉLULAS antes de aplicar. É a conversão que faz o bloco encaixar na
    // grade em vez de parar num pixel avulso.
    const target = clampPosition(
      current.x + pxDeltaToCells(delta.x, cell.w),
      current.y + pxDeltaToCells(delta.y, cell.h),
      current.w,
    );

    // Durante o arraste o bloco pode passar por cima dos outros — isso dá a
    // sensação de onde ele vai cair. A colisão é resolvida uma vez, ao soltar.
    commit(
      resolveCollisions(
        sheet.layout.map((panel) =>
          panel.panelId === active.id ? { ...panel, ...target } : panel,
        ),
      ),
    );
  }

  /** Teclado: setas movem o bloco em células, Shift dá um passo grande. */
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
    panelId: string,
  ) {
    const step = event.shiftKey
      ? PANEL_KEYBOARD_STEP_LARGE_CELLS
      : PANEL_KEYBOARD_STEP_CELLS;

    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else return;

    event.preventDefault();

    const current = sheet.layout.find((panel) => panel.panelId === panelId);
    if (!current) return;

    const target = clampPosition(current.x + dx, current.y + dy);
    commit(
      resolveCollisions(
        sheet.layout.map((panel) =>
          panel.panelId === panelId ? { ...panel, ...target } : panel,
        ),
      ),
    );
  }

  const rows = computeContainerHeight(visible);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        //
        // SEM `restrictToParentElement`: ele restringe o arraste ao pai
        // IMEDIATO do nó arrastável — que aqui é o próprio wrapper do painel,
        // do MESMO tamanho dele. O resultado era `x` e `y` travados em zero: o
        // painel não andava.
        //
        // Os limites são garantidos pelos LIMITES DO GRID, aplicados pela função
        // pura `clampPosition` no `onDragEnd` — que é onde o dado é gravado.
        modifiers={[createCellSnapModifier(cell.w + GRID_GAP_PX)]}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={containerRef}
          data-grid-container=""
          className="relative"
          style={
            isNarrow
              ? undefined
              : {
                  height: cellsToPx(rows, cell.h),
                  margin: PANEL_GRID_PADDING_PX,
                }
          }
          onKeyDown={(event) => {
            // O teclado de arraste é o do `dnd-kit` (ele anuncia "movido para
            // a posição N"). Este handler cobre o caso em que o foco está no
            // bloco e não no handle, que é o que acontece depois de clicar em
            // um campo dentro dele.
            const panelId = (event.target as HTMLElement | null)?.dataset
              ?.panelId;
            if (panelId) handleKeyDown(event, panelId);
          }}
        >
          {editMode && !isNarrow ? (
            <GridGuides cell={cell} columns={GRID_COLUMNS} rows={rows} />
          ) : null}

          {visible.map((panel, index) => {
            const isExtra = isExtraPanelKey(panel.panelId);
            const extra = isExtra
              ? sheet.extraPanels.find(
                  (candidate) => candidate.id === extraIdFromKey(panel.panelId),
                )
              : undefined;

            // Bloco do usuário cujo dado sumiu (import inconsistente): não
            // renderiza moldura vazia, que ocuparia espaço na grade.
            if (isExtra && !extra) return null;

            const type: PanelType = extra?.type ?? (panel.panelId as PanelType);
            const definition = getPanelDefinition(type);
            const Component = definition?.Component;
            const title =
              extra?.title || definition?.label || PANEL_TYPE_LABELS[type];

            const contentProps: PanelProps = { context, extra, layout: panel };

            // Ações do cabeçalho declaradas pelo tipo do bloco (adendo §2.1).
            // A grade não sabe o que elas são — só renderiza o que a
            // definição do tipo mandar.
            const HeaderActions = definition?.HeaderActions;

            return (
              <div
                key={panel.panelId}
                data-panel-id={panel.panelId}
                className={isNarrow ? "mb-3" : undefined}
                style={
                  isNarrow
                    ? undefined
                    : {
                        position: "absolute",
                        ...toPixels(panel),
                      }
                }
              >
                <PanelFrame
                  cell={cell}
                  editMode={editMode}
                  maxRows={rows}
                  headerActions={
                    HeaderActions ? (
                      <HeaderActions context={context} />
                    ) : undefined
                  }
                  index={index}
                  interactive={interactive}
                  layout={panel}
                  panelId={panel.panelId}
                  panelType={type}
                  removable={definition?.removable ?? true}
                  title={title}
                  onMove={(next) => patchPanel(panel.panelId, next)}
                  onRemove={() => onRequestRemove(panel.panelId, title)}
                  onResize={(next) => patchPanel(panel.panelId, next)}
                  hideable={isPanelTypeHideable(type)}
                  onToggleVisible={() => onToggleVisible(panel.panelId, false)}
                >
                  {Component ? (
                    <Component {...contentProps} />
                  ) : (
                    <div className="text-text-muted p-3 text-sm">
                      Bloco desconhecido.
                    </div>
                  )}
                </PanelFrame>
              </div>
            );
          })}
        </div>
      </DndContext>

      <ConfirmDialog
        destructive
        confirmLabel="Remover"
        message={
          <>
            Remover o bloco <strong>{pendingRemoval?.title}</strong>? O conteúdo
            dele será apagado e não há como desfazer.
          </>
        }
        open={pendingRemoval !== null}
        title="Remover bloco"
        onCancel={onCancelRemove}
        onConfirm={() => {
          if (pendingRemoval) onRemovePanel(pendingRemoval.panelId);
          onCancelRemove();
        }}
      />
    </>
  );
}
