"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import {
  ColorPicker,
  colorGlyphFor,
  colorLabelFor,
} from "@/components/ui/ColorPicker";
import { RuneButton } from "@/components/ui/RuneButton";
import { GripHandle } from "@/components/ui/GripHandle";
import { SlotRow } from "@/components/ui/SlotRow";
import {
  DND_ACTIVATION_DISTANCE_PX,
  LIST_ENTRY_MAX_LENGTH,
  LIST_ENTRY_NUMBER_DEFAULT,
  LIST_ENTRY_NUMBER_MAX,
  LIST_ENTRY_NUMBER_MIN,
  MAX_LIST_ENTRIES,
  PANEL_TITLE_MAX_LENGTH,
} from "@/config/constants";
import { generateId } from "@/lib/id";
import type { ExtraPanel, ListEntry } from "@/schemas";

import type { PanelProps } from "../registry";

/**
 * Bloco de lista (seção 9.5, "Bloco de lista").
 *
 * Linhas com **nome e cor**, reordenáveis por drag and drop, com "+", editar e
 * remover. SEM cálculo e SEM integração com outros blocos — é deliberado: a
 * especificação pede que este bloco seja neutro.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DRAG AND DROP (§10) — como isso NÃO conflita com a edição por clique
 *  - O gatilho do mouse exige `DND_ACTIVATION_DISTANCE_PX` de movimento, então
 *    um clique simples no nome ainda abre a edição normalmente.
 *  - O handle de arraste é um botão SEPARADO, só visível no Editar Geral.
 *    Clicar no texto NUNCA inicia arraste.
 *  - `KeyboardSensor` + `sortableKeyboardCoordinates` dão navegação por
 *    teclado, com os anúncios ARIA que o `useSortable` já publica.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function ListPanel({ context, extra }: PanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!extra) return null;

  const entries = extra.entries;
  const atLimit = entries.length >= MAX_LIST_ENTRIES;

  function update(next: ExtraPanel) {
    context.mutate((current) => ({
      ...current,
      extraPanels: current.extraPanels.map((panel) =>
        panel.id === next.id ? next : panel,
      ),
    }));
  }

  function patchEntry(entryId: string, patch: Partial<ListEntry>) {
    if (!extra) return;
    update({
      ...extra,
      entries: extra.entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    });
  }

  function addEntry() {
    if (!extra || atLimit) return;
    const entry: ListEntry = {
      id: generateId(),
      name: "",
      number: LIST_ENTRY_NUMBER_DEFAULT,
      color: null,
    };
    update({ ...extra, entries: [...extra.entries, entry] });
    setEditingId(entry.id);
  }

  function removeEntry(entryId: string) {
    if (!extra) return;
    update({
      ...extra,
      entries: extra.entries.filter((entry) => entry.id !== entryId),
    });
    if (editingId === entryId) setEditingId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!extra) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = entries.findIndex((entry) => entry.id === over.id);
    if (from === -1 || to === -1) return;

    // `arrayMove` do dnd-kit é o caminho canônico — não reescreva à mão.
    update({ ...extra, entries: arrayMove(entries, from, to) });
  }

  function handleTitleChange(value: string) {
    if (!extra) return;
    update({ ...extra, title: value.slice(0, PANEL_TITLE_MAX_LENGTH) });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      <div className="mb-2 flex items-center gap-2">
        {editMode ? (
          <input
            aria-label="Nome do bloco"
            className="border-frame bg-surface-sunken focus:border-accent min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2 py-1 text-sm outline-none"
            maxLength={PANEL_TITLE_MAX_LENGTH}
            value={extra.title}
            onChange={(event) => handleTitleChange(event.target.value)}
          />
        ) : (
          <span className="text-text-muted min-w-0 flex-1 truncate text-xs">
            {entries.length} de {MAX_LIST_ENTRIES} linhas
          </span>
        )}

        <RuneButton
          aria-pressed={editMode}
          label={editMode ? "Concluir edição do bloco" : "Editar bloco"}
          onClick={() => {
            setEditMode((value) => !value);
            setEditingId(null);
          }}
        >
          <PencilIcon />
        </RuneButton>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={entries.map((entry) => entry.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {entries.map((entry) => (
              <ListRow
                key={entry.id}
                editMode={editMode}
                editing={editingId === entry.id}
                entry={entry}
                onEndEdit={() => setEditingId(null)}
                onEdit={() => setEditingId(entry.id)}
                onPatch={(patch) => patchEntry(entry.id, patch)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-text-muted text-xs">
          {atLimit ? "Limite de linhas atingido" : ""}
        </span>
        <RuneButton
          disabled={atLimit}
          label={atLimit ? "Limite de linhas atingido" : "Adicionar linha"}
          tone="primary"
          onClick={addEntry}
        >
          <PlusIcon />
        </RuneButton>
      </div>
    </div>
  );
}

/* ── Linha ────────────────────────────────────────────────────────────────── */

interface ListRowProps {
  entry: ListEntry;
  editMode: boolean;
  editing: boolean;
  onEdit: () => void;
  onEndEdit: () => void;
  onPatch: (patch: Partial<ListEntry>) => void;
  onRemove: () => void;
}

function ListRow({
  entry,
  editMode,
  editing,
  onEdit,
  onEndEdit,
  onPatch,
  onRemove,
}: ListRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: !editMode });

  return (
    <SlotRow
      nodeRef={setNodeRef}
      dragStyle={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      color={entry.color}
      colorName={colorLabelFor(entry.color)}
      dragging={isDragging}
      glyph={colorGlyphFor(entry.color)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <input
            aria-label="Nome da linha"
            autoFocus
            className="border-frame bg-surface focus:border-accent min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-sm outline-none"
            maxLength={LIST_ENTRY_MAX_LENGTH}
            value={entry.name}
            onBlur={onEndEdit}
            onChange={(event) => onPatch({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") onEndEdit();
            }}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 cursor-text truncate text-left text-sm"
            onClick={onEdit}
          >
            {entry.name || <span className="text-text-muted">(sem nome)</span>}
          </button>
        )}

        {/* ── NÚMERO (adendo §8) ──────────────────────────────────────────
         * Cada linha tem um número. Tratado sem `NaN`: o campo é do tipo
         * numérico, e o valor é limitado ao intervalo definido em
         * constantes. Sem cálculos nem integração com outros blocos.
         * ───────────────────────────────────────────────────────────────── */}
        {editMode ? (
          <input
            aria-label="Número da linha"
            className="border-frame bg-surface focus:border-accent w-16 rounded-[var(--radius-sm)] border px-1 py-0.5 text-center text-sm tabular-nums outline-none"
            inputMode="numeric"
            maxLength={5}
            placeholder="0"
            value={entry.number ?? 0}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (raw === "") {
                onPatch({ number: LIST_ENTRY_NUMBER_DEFAULT });
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              if (Number.isNaN(parsed)) return;
              onPatch({
                number: Math.min(
                  LIST_ENTRY_NUMBER_MAX,
                  Math.max(LIST_ENTRY_NUMBER_MIN, parsed),
                ),
              });
            }}
          />
        ) : (
          <span className="text-text-muted shrink-0 font-mono text-xs tabular-nums">
            {entry.number ?? 0}
          </span>
        )}
      </span>

      {editMode ? (
        <>
          <ColorPicker
            customLabel={`Cor personalizada de ${entry.name || "linha"}`}
            label={`Raridade de ${entry.name || "linha"}`}
            value={entry.color}
            onChange={(color) => onPatch({ color })}
          />

          {/* Handle de arraste: só no Editar Geral, para não competir com
                o clique de edição do texto. */}
          <GripHandle
            label={`Reordenar ${entry.name || "linha"}`}
            {...attributes}
            {...listeners}
          />

          <RuneButton
            label={`Remover ${entry.name || "linha"}`}
            tone="danger"
            onClick={onRemove}
          >
            ✕
          </RuneButton>
        </>
      ) : null}
    </SlotRow>
  );
}
