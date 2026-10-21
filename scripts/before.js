/**
 * REVERTE TEMPORARIAMENTE AS CORREÇÕES DO ADENDO, PARA CAPTURAR O "ANTES".
 *
 * Uso:
 *   node before.js revert    # aplica o "antes"
 *   node before.js restore   # volta ao "depois"
 */
const fs = require("fs");
const path = require("path");

const BACKUP = path.join(process.cwd(), ".before-backup");

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

  // ───────────────────────────────────────────────────────────────────────
  // (A1) CÉLULAS RETANGULARES — a largura era fluida, a altura fixa.
  // ───────────────────────────────────────────────────────────────────────
  c = c.replace(
    /return \{ w: side, h: side \};/,
    "return { w: side, h: GRID_ROW_HEIGHT_PX };",
  );

  // ───────────────────────────────────────────────────────────────────────
  // (A2) A MOLDURA SEM `h-full` — a altura vinha do CONTEÚDO, e o painel
  // pintava fora da célula (a hitbox ficava maior que o visual).
  // ───────────────────────────────────────────────────────────────────────
  c = c.replace(
    'className="relative flex h-full min-h-0 flex-1 flex-col"',
    'className="relative flex min-h-0 flex-1 flex-col"',
  );

  // ───────────────────────────────────────────────────────────────────────
  // (A3) AS ALÇAS FORA DA BORDA — 4px para fora, mais 8px do pseudo-elemento.
  // ───────────────────────────────────────────────────────────────────────
  c = c.replace(
    /const HANDLE_CLASS: Record<ResizeDirection, string> = \{[\s\S]*?\n\};/,
    `const HANDLE_CLASS: Record<ResizeDirection, string> = {
  "top-left":
    "before:absolute before:-inset-2 cursor-nwse-resize -left-1 -top-1 size-4",
  top: "before:absolute before:-inset-2 cursor-ns-resize -top-1 left-1/2 h-2 w-10 -translate-x-1/2",
  "top-right":
    "before:absolute before:-inset-2 cursor-nesw-resize -right-1 -top-1 size-4",
  right:
    "before:absolute before:-inset-2 cursor-ew-resize -right-1 top-1/2 h-10 w-2 -translate-y-1/2",
  "bottom-right":
    "before:absolute before:-inset-2 cursor-nwse-resize -bottom-1 -right-1 size-4",
  bottom:
    "before:absolute before:-inset-2 cursor-ns-resize -bottom-1 left-1/2 h-2 w-10 -translate-x-1/2",
  "bottom-left":
    "before:absolute before:-inset-2 cursor-nesw-resize -bottom-1 -left-1 size-4",
  left: "before:absolute before:-inset-2 cursor-ew-resize -left-1 top-1/2 h-10 w-2 -translate-y-1/2",
};`,
  );

  // ───────────────────────────────────────────────────────────────────────
  // (B) O SNAP QUE ARREDONDA PARA CIMA E O RESTRICT QUE PRENDE O PAINEL.
  // ───────────────────────────────────────────────────────────────────────
  c = c.replace(
    'import { createCellSnapModifier } from "@/lib/cellSnapModifier";',
    'import { createSnapModifier, restrictToParentElement } from "@dnd-kit/modifiers";',
  );
  c = c.replace(
    "modifiers={[createCellSnapModifier(cell.w + GRID_GAP_PX)]}",
    "modifiers={[createSnapModifier(cell.w + GRID_GAP_PX), restrictToParentElement]}",
  );

  // ───────────────────────────────────────────────────────────────────────
  // (C1) O HANDLE DAS LISTAS VOLTA PARA O EDITAR GERAL.
  // ───────────────────────────────────────────────────────────────────────
  c = c.replace(/reorderMode=\{blockEdit\}/g, "reorderMode={context.editMode}");

  return c;
}

/** Devolve o nó sortable para DENTRO da linha (o bug do `restrictToParent`). */
function reverterLista(c, classeDoSpan) {
  let r = c;

  // Tira o `nodeRef` e o `dragStyle` do `<SlotRow>`.
  r = r.replace(
    /\n(\s+)nodeRef=\{setNodeRef\}\n(\s+)dragStyle=\{\{\n\s+transform: CSS\.Translate\.toString\(transform\),\n\s+transition,\n\s+\}\}/,
    "",
  );

  // Põe o `ref` e o `transform` no `<span>` interno.
  const spanAntigo = `<span className="${classeDoSpan}">`;
  const spanNovo =
    `<span\n` +
    `        ref={setNodeRef}\n` +
    `        style={{ transform: CSS.Translate.toString(transform), transition }}\n` +
    `        className="${classeDoSpan}"\n` +
    `      >`;

  if (!r.includes(spanAntigo)) {
    console.log("AVISO: span nao encontrado:", classeDoSpan);
    return r;
  }

  return r.replace(spanAntigo, spanNovo);
}

const modo = process.argv[2];

if (modo === "revert") {
  fs.mkdirSync(BACKUP, { recursive: true });

  for (const arquivo of ARQUIVOS) {
    const destino = path.join(BACKUP, arquivo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(arquivo, destino);
  }

  for (const arquivo of ARQUIVOS) {
    let c = aplicar(fs.readFileSync(arquivo, "utf8"));

    const lista = COM_SLOTROW.find(
      ([f]) => f === arquivo.replace(/^src\/components\/panels\//, ""),
    );
    if (lista) c = reverterLista(c, lista[1]);

    fs.writeFileSync(arquivo, c, "utf8");
  }

  console.log(`"antes" aplicado em ${ARQUIVOS.length} arquivos`);
} else if (modo === "restore") {
  for (const arquivo of ARQUIVOS) {
    const origem = path.join(BACKUP, arquivo);
    if (fs.existsSync(origem)) fs.copyFileSync(origem, arquivo);
  }
  fs.rmSync(BACKUP, { recursive: true, force: true });
  console.log('"depois" restaurado');
} else {
  console.log("uso: node before.js revert | restore");
}
