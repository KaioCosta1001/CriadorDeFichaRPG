/**
 * REAPLICA AS CORREÇÕES DO ADENDO (o inverso de `before.js revert`).
 *
 * Uso:
 *   node after.js    # volta do "antes" para o "depois"
 */
const fs = require("fs");
const path = require("path");

const ARQUIVOS = [
  "src/config/constants.ts",
  "src/components/layout/PanelGrid.tsx",
  "src/components/layout/PanelFrame.tsx",
  "src/components/layout/ResizeHandles.tsx",
  "src/components/ui/SlotRow.tsx",
  "src/components/panels/skills/SkillsPanel.tsx",
  "src/components/panels/skills/SkillCard.tsx",
  "src/components/panels/attributes/AttributesPanel.tsx",
  "src/components/panels/attributes/AttributeCard.tsx",
  "src/components/panels/inventory/InventoryPanel.tsx",
  "src/components/panels/inventory/WeaponRow.tsx",
  "src/components/panels/inventory/ItemRow.tsx",
  "src/components/panels/list/ListPanel.tsx",
];

/** As listas que usam o `SlotRow` compartilhado. */
const COM_SLOTROW = [
  ["skills/SkillCard.tsx", "flex min-w-0 items-center gap-1.5"],
  ["inventory/WeaponRow.tsx", "flex min-w-0 flex-1 items-center gap-2"],
  ["inventory/ItemRow.tsx", "flex min-w-0 flex-1 items-center gap-2"],
  ["list/ListPanel.tsx", "flex min-w-0 flex-1 items-center gap-2"],
];

function aplicar(txt) {
  let c = txt;

  // (A1) CÉLULAS QUADRADAS
  c = c.replace(
    /return \{ w: side, h: GRID_ROW_HEIGHT_PX \};/,
    "return { w: side, h: side };",
  );

  // (A2) A MOLDURA PREENCHE A CÉLULA
  c = c.replace(
    'className="relative flex min-h-0 flex-1 flex-col"',
    'className="relative flex h-full min-h-0 flex-1 flex-col"',
  );

  // (A4) O INDICADOR MEDIDO
  c = c.replace(
    "{layout.w}×{layout.h}\n        </output>",
    `{measured.size
            ? \`\${measured.size.width}px × \${measured.size.height}px (\${layout.w} × \${layout.h})\`
            : \`\${layout.w} × \${layout.h}\`}
        </output>`,
  );

  // (A3) AS ALÇAS DENTRO DO PAINEL
  c = c.replace(
    /const HANDLE_CLASS: Record<ResizeDirection, string> = \{[\s\S]*?\n\};/,
    `const HANDLE_CLASS: Record<ResizeDirection, string> = {
  "top-left": "cursor-nwse-resize left-0 top-0 size-4",
  top: "cursor-ns-resize top-0 left-1/2 h-3 w-10 -translate-x-1/2",
  "top-right": "cursor-nesw-resize right-0 top-0 size-4",
  right: "cursor-ew-resize right-0 top-1/2 h-10 w-3 -translate-y-1/2",
  "bottom-right": "cursor-nwse-resize bottom-0 right-0 size-4",
  bottom: "cursor-ns-resize bottom-0 left-1/2 h-3 w-10 -translate-x-1/2",
  "bottom-left": "cursor-nesw-resize bottom-0 left-0 size-4",
  left: "cursor-ew-resize left-0 top-1/2 h-10 w-3 -translate-y-1/2",
};`,
  );

  // (B) O SNAP COM `Math.round` E SEM `restrictToParentElement`
  c = c.replace(
    'import { createSnapModifier, restrictToParentElement } from "@dnd-kit/modifiers";',
    'import { createCellSnapModifier } from "@/lib/cellSnapModifier";',
  );
  c = c.replace(
    "modifiers={[createSnapModifier(cell.w + GRID_GAP_PX), restrictToParentElement]}",
    "modifiers={[createCellSnapModifier(cell.w + GRID_GAP_PX)]}",
  );

  // (C1) O HANDLE DAS LISTAS VOLTA PARA O LÁPIS DO BLOCO
  c = c.replace(
    /reorderMode=\{context\.editMode\}/g,
    "reorderMode={blockEdit}",
  );

  return c;
}

/** Devolve o nó sortable para o `<li>` (via o `SlotRow`). */
function corrigirLista(c, classeDoSpan) {
  let r = c;

  // Tira o `ref` e o `transform` do `<span>` interno.
  r = r.replace(
    new RegExp(
      `<span\\r?\\n\\s+ref=\\{setNodeRef\\}\\r?\\n\\s+style=\\{\\{ transform: CSS\\.Translate\\.toString\\(transform\\), transition \\}\\}\\r?\\n\\s+className="${classeDoSpan.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\r?\\n\\s+>`,
    ),
    `<span className="${classeDoSpan}">`,
  );

  // Põe o `nodeRef` e o `dragStyle` no `<SlotRow>`.
  r = r.replace(
    /<SlotRow\r?\n(\s+)color=/,
    "<SlotRow\n$1nodeRef={setNodeRef}\n$1dragStyle={{\n$1  transform: CSS.Translate.toString(transform),\n$1  transition,\n$1}}\n$1color=",
  );

  return r;
}

for (const arquivo of ARQUIVOS) {
  let c = aplicar(fs.readFileSync(arquivo, "utf8"));

  const lista = COM_SLOTROW.find(
    ([f]) => f === arquivo.replace(/^src\/components\/panels\//, ""),
  );
  if (lista) c = corrigirLista(c, lista[1]);

  fs.writeFileSync(arquivo, c, "utf8");
}

console.log('"depois" reaplicado');
