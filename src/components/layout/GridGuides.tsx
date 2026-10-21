"use client";

import type { CellSize } from "@/config/constants";
import { GRID_GAP_PX } from "@/config/constants";

interface GridGuidesProps {
  cell: CellSize;
  columns: number;
  rows: number;
}

/**
 * As LINHAS DO GRID por baixo dos blocos, durante o Editar Geral.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE DESENHADAS EM VEZ DE SER UM `background` REPETIDO
 *
 * Um `repeating-linear-gradient` daria o mesmo resultado com duas linhas de
 * CSS e sem elemento no DOM. A diferença é a cor: o gradiente usaria uma cor
 * fixa, e aqui as linhas usam `var(--accent)` com opacidade baixa — que é o
 * que as faz desaparecer em outro tema sem precisar de duas regras.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * A GRADE FICA ATRÁS DE TUDO
 *
 * `zIndex: 0` e `pointer-events: none`. É o segundo ponto que não é
 * negotiatevel: uma camada que captura ponteiro sobre a área dos blocos é
 * exatamente o defeito do `.corner-notch` (bug 2), e faria os cliques no
 * Editar Geral morrerem aqui outra vez.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE SÓ VERTICAL
 *
 * Com `GRID_COLUMNS = 48` as linhas verticais seriam 48 traços de 1 px
 * correndo pela tela inteira — ruído visual, não informação. A informação que
 * importa é a altura: com linhas de 10 px, o usuário enxerga onde termina uma
 * linha e começa a outra. As colunas aparecem como marcações discretas a cada
 * 8 colunas, que é a granularidade em que alguém realmente pensa ("metade da
 * largura", "três quartos").
 * ───────────────────────────────────────────────────────────────────────────
 */
export function GridGuides({ cell, columns, rows }: GridGuidesProps) {
  const rowMarkers = Array.from({ length: rows }, (_, index) => index);
  // Uma marca a cada 8 colunas: marcação fina o bastante para não poluir,
  // larga o bastante para servir de referência mental.
  const columnStep = 8;
  const columnMarkers = Array.from(
    { length: Math.floor(columns / columnStep) + 1 },
    (_, index) => index * columnStep,
  ).filter((index) => index <= columns);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Linhas horizontais: uma a cada altura de célula + gap. */}
      {rowMarkers.map((row) => (
        <div
          key={`linha-${row}`}
          className="bg-accent absolute left-0 w-full"
          style={{
            top: row * (cell.h + GRID_GAP_PX),
            height: 1,
            opacity: 0.06,
          }}
        />
      ))}

      {/* Colunas: marcação grossa a cada 8 células. */}
      {columnMarkers.map((column) => (
        <div
          key={`coluna-${column}`}
          className="bg-accent absolute top-0 h-full"
          style={{
            left: column * (cell.w + GRID_GAP_PX),
            width: 1,
            opacity: 0.1,
          }}
        />
      ))}

      {/* Borda da área útil: deixa ver onde termina a última coluna. */}
      <div
        className="bg-accent absolute top-0 right-0 h-full"
        style={{ width: 1, opacity: 0.14 }}
      />
      <div
        className="bg-accent absolute left-0 w-full"
        style={{
          top: rows * (cell.h + GRID_GAP_PX) - GRID_GAP_PX,
          height: 1,
          opacity: 0.14,
        }}
      />
    </div>
  );
}
