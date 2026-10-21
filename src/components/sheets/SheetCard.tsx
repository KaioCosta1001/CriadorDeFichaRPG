"use client";

import { Tooltip } from "@mui/material";

import { CornerOrnaments } from "@/components/ui/ornaments";
import { getSystem, getTemplate } from "@/config/systems";
import { formatDateTime } from "@/lib/fileTransfer";
import type { SheetSummary } from "@/schemas";

interface SheetCardProps {
  sheet: SheetSummary;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Um cartão da listagem de fichas.
 *
 * Ações destrutivas ficam escondidas até o hover/foco para a tela não ficar
 * poluída — mas `aria-label` e Tooltip descrevem TODAS elas, para navegação
 * por teclado e leitor de tela. Esconder no hover sem manter no foco seria
 * justamente esconder do teclado.
 */
export function SheetCard({
  sheet,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: SheetCardProps) {
  const system = getSystem(sheet.system);
  const template = getTemplate(sheet.system, sheet.templateId);
  const title = sheet.title || sheet.name || "Sem nome";

  return (
    <li className="group noise-surface border-frame bg-surface relative overflow-hidden rounded-[var(--radius)] border shadow-[inset_0_0_0_1px_var(--frame-inner)]">
      <CornerOrnaments className="opacity-40" />

      <div className="relative z-10 flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer text-left"
            onClick={() => onOpen(sheet.id)}
          >
            <h3 className="font-display text-accent truncate text-lg font-semibold tracking-wide">
              {title}
            </h3>
            <p className="text-text-muted truncate text-sm">
              {sheet.name || "Sem nome de personagem"}
            </p>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <Tooltip title="Renomear ficha">
              <button
                type="button"
                aria-label={`Renomear ${title}`}
                className="text-accent hover:text-text grid size-8 place-items-center rounded-[var(--radius-sm)] text-base transition-[box-shadow,color] hover:shadow-[0_0_14px_-6px_var(--glow)]"
                onClick={() => onRename(sheet.id)}
              >
                ✎
              </button>
            </Tooltip>
            <Tooltip title="Excluir ficha">
              <button
                type="button"
                aria-label={`Excluir ${title}`}
                className="text-danger grid size-8 place-items-center rounded-[var(--radius-sm)] text-base transition-[box-shadow,color] hover:shadow-[0_0_14px_-6px_var(--glow)]"
                onClick={() => onDelete(sheet.id)}
              >
                ✕
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="border-frame text-text-muted rounded-full border px-2 py-0.5">
            {system?.label ?? "Sistema desconhecido"}
          </span>
          <span className="border-frame text-text-muted rounded-full border px-2 py-0.5">
            {template?.label ?? sheet.templateId}
          </span>
        </div>

        {/* Ficha criada numa versão do app com um modelo que não existe mais,
            ou importada de fora: avisar em vez de fingir que está tudo certo. */}
        {!template ? (
          <p className="border-warning/50 bg-warning/10 text-warning rounded-[var(--radius-sm)] border px-2 py-1 text-xs">
            Modelo <strong>{sheet.templateId}</strong> não encontrado neste
            sistema. A ficha abre normalmente, mas o modelo não pôde ser
            aplicado.
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span className="text-text-muted text-xs">
            {formatDateTime(sheet.updatedAt)}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="border-frame text-text-muted hover:border-accent hover:text-text rounded-[var(--radius-sm)] border px-2 py-1 text-sm transition-colors"
              onClick={() => onDuplicate(sheet.id)}
            >
              Duplicar
            </button>
            <button
              type="button"
              className="border-frame text-text-muted hover:border-accent hover:text-text rounded-[var(--radius-sm)] border px-2 py-1 text-sm transition-colors"
              onClick={() => onExport(sheet.id)}
            >
              Exportar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
