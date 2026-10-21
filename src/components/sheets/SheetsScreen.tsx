"use client";

import {
  Alert,
  Button,
  CircularProgress,
  Snackbar,
  TextField,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { NewSheetDialog } from "@/components/dialogs/NewSheetDialog";
import { SheetCard } from "@/components/sheets/SheetCard";
import { ThemeModeSwitch } from "@/components/ui/ThemeModeSwitch";
import { LIST_CONTENT_ID, SkipLink } from "@/components/ui/SkipLink";
import { SHEET_TITLE_MAX_LENGTH, NOTICE_DURATION_MS } from "@/config/constants";
import {
  FileReadError,
  downloadTextFile,
  readJsonFile,
} from "@/lib/fileTransfer";
import { buildExportFileName, sheetRepository } from "@/repositories";
import { useSheetStore } from "@/store/sheetStore";
import { useSheetsStore } from "@/store/sheetsStore";
import type { CreateSheetInput, SheetSummary } from "@/schemas";

/**
 * Tela inicial: lista de fichas (seção 12).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HIDRATAÇÃO
 * Nada é lido do storage durante o render. O servidor e o primeiro render do
 * cliente mostram o mesmo estado "carregando"; a lista real chega depois,
 * em `useEffect` (seção 5.7).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function SheetsScreen() {
  const router = useRouter();

  const {
    status,
    sheets,
    quarantine,
    error,
    notice,
    reload,
    create,
    duplicate,
    remove,
    importFrom,
    exportAs,
    setNotice,
    discardAllQuarantine,
    exportQuarantinedRaw,
  } = useSheetsStore();

  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  /** Ficha aguardando confirmação de exclusão. */
  const [pendingDelete, setPendingDelete] = useState<SheetSummary | null>(null);
  /** Ficha sendo renomeada. */
  const [renaming, setRenaming] = useState<SheetSummary | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Gravação pendente da ficha aberta não pode se perder ao voltar para a
  // listagem.
  const flushSheet = useSheetStore((state) => state.save);

  const handleOpen = useCallback(
    (id: string) => {
      void flushSheet();
      router.push(`/fichas/${id}`);
    },
    [flushSheet, router],
  );

  const handleCreate = useCallback(
    async (input: CreateSheetInput) => {
      setCreating(true);
      const id = await create(input);
      setCreating(false);

      if (!id) return;

      setNewOpen(false);
      router.push(`/fichas/${id}`);
    },
    [create, router],
  );

  const handleExport = useCallback(
    async (id: string) => {
      const json = await exportAs(id);
      if (!json) return;

      const sheet = sheets.find((candidate) => candidate.id === id);
      downloadTextFile(
        buildExportFileName(sheet?.title ?? sheet?.name ?? id),
        json,
      );
    },
    [exportAs, sheets],
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const text = await readJsonFile(file);
        const id = await importFrom(text);
        if (id) router.push(`/fichas/${id}`);
      } catch (readError) {
        setNotice({
          kind: "error",
          text:
            readError instanceof FileReadError
              ? readError.message
              : "Não foi possível ler o arquivo.",
        });
      }
    },
    [importFrom, router, setNotice],
  );

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await remove(id);
  }

  async function handleConfirmRename() {
    if (!renaming) return;
    const id = renaming.id;
    const title = renameValue.trim();
    setRenaming(null);

    if (!title || title === renaming.title) return;

    const sheet = await sheetRepository.getSheet(id);
    if (!sheet) {
      setNotice({ kind: "error", text: "Ficha não encontrada." });
      return;
    }

    try {
      // Renomear só mexe no TÍTULO da listagem. O NOME do personagem é
      // informação sensível e só muda no Editar Geral (seção 8.1).
      await sheetRepository.updateSheet(id, { ...sheet, title });
      await reload();
      setNotice({ kind: "success", text: "Ficha renomeada." });
    } catch (updateError) {
      setNotice({
        kind: "error",
        text:
          updateError instanceof Error
            ? updateError.message
            : "Não foi possível renomear.",
      });
    }
  }

  return (
    <>
      <SkipLink targetId={LIST_CONTENT_ID} label="Pular para as fichas" />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Minhas fichas</h1>
            <p className="text-text-muted text-sm">
              {status === "ready"
                ? `${sheets.length} ficha${sheets.length === 1 ? "" : "s"}`
                : "Carregando…"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ThemeModeSwitch />
            <Button
              component="label"
              variant="outlined"
              className="cursor-pointer"
            >
              Importar
              <input
                ref={fileInputRef}
                accept="application/json,.json"
                className="hidden"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // `value = ""` permite escolher o MESMO arquivo de novo,
                  // senão o evento `change` não dispara na segunda vez.
                  event.target.value = "";
                  if (file) void handleImportFile(file);
                }}
              />
            </Button>
            <Button variant="contained" onClick={() => setNewOpen(true)}>
              Nova ficha
            </Button>
          </div>
        </header>

        {/* Alvo do pulador. Existe em todos os estados — inclusive carregando —
          porque um alvo que só aparece quando a lista já chegou faz o pulador
          não levar a lugar nenhum justamente na hora em que ele mais importa. */}
        <div
          id={LIST_CONTENT_ID}
          tabIndex={-1}
          className="flex flex-col gap-6 outline-none"
        >
          {error ? <Alert severity="error">{error}</Alert> : null}

          {/* ── Quarentena: documento corrompido isolado (seção 5.9) ─────────── */}
          {quarantine.length > 0 ? (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void discardAllQuarantine()}
                >
                  Descartar todos
                </Button>
              }
            >
              <p className="font-semibold">
                {quarantine.length} ficha(s) não puderam ser lidas e foram
                isoladas.
              </p>
              <p className="mt-1 text-sm">
                Elas foram excluídas da lista, mas o conteúdo original está
                preservado. Você pode exportar o arquivo bruto para tentar
                recuperar.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {quarantine.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-mono">
                      {entry.title ?? entry.sourceKey}
                    </span>
                    <span className="opacity-70">— {entry.reason}</span>
                    <Button
                      size="small"
                      onClick={async () => {
                        const raw = await exportQuarantinedRaw(entry.id);
                        if (raw === null) {
                          setNotice({
                            kind: "error",
                            text: "Conteúdo bruto indisponível.",
                          });
                          return;
                        }
                        downloadTextFile(
                          `ficha-recuperada-${entry.id.slice(0, 8)}.json`,
                          raw,
                        );
                      }}
                    >
                      Exportar bruto
                    </Button>
                  </li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {/* ── Lista ───────────────────────────────────────────────────────── */}
          {status === "loading" ? (
            <div className="flex justify-center py-12">
              <CircularProgress aria-label="Carregando fichas" />
            </div>
          ) : sheets.length === 0 ? (
            <div className="border-border-strong rounded-xl border border-dashed p-12 text-center">
              <h2 className="text-lg font-semibold">Nenhuma ficha ainda</h2>
              <p className="text-text-muted mx-auto mt-2 max-w-md text-sm">
                Crie a primeira ficha escolhendo um sistema e um modelo, ou
                importe um arquivo JSON que você já tenha.
              </p>
              <Button
                className="mt-4"
                variant="contained"
                onClick={() => setNewOpen(true)}
              >
                Criar primeira ficha
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sheets.map((sheet) => (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  onOpen={handleOpen}
                  onRename={(id) => {
                    const target = sheets.find(
                      (candidate) => candidate.id === id,
                    );
                    if (!target) return;
                    setRenaming(target);
                    setRenameValue(target.title || target.name);
                  }}
                  onDuplicate={(id) => void duplicate(id)}
                  onExport={(id) => void handleExport(id)}
                  onDelete={(id) => {
                    const target = sheets.find(
                      (candidate) => candidate.id === id,
                    );
                    if (target) setPendingDelete(target);
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        <NewSheetDialog
          creating={creating}
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreate={handleCreate}
        />

        <ConfirmDialog
          destructive
          confirmLabel="Excluir"
          message={
            <>
              A ficha <strong>{pendingDelete?.title}</strong> será apagada
              definitivamente deste navegador. Não há como desfazer — se quiser
              guardá-la, exporte antes.
            </>
          }
          open={pendingDelete !== null}
          title="Excluir ficha?"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />

        <ConfirmDialog
          confirmLabel="Renomear"
          message="Isso muda apenas o nome da ficha na lista. O nome do personagem continua editável só no Editar Geral."
          open={renaming !== null}
          title="Renomear ficha"
          onCancel={() => setRenaming(null)}
          onConfirm={() => void handleConfirmRename()}
        >
          <TextField
            autoFocus
            fullWidth
            label="Nome da ficha"
            value={renameValue}
            slotProps={{ htmlInput: { maxLength: SHEET_TITLE_MAX_LENGTH } }}
            onChange={(event) => setRenameValue(event.target.value)}
          />
        </ConfirmDialog>

        <Snackbar
          open={notice !== null}
          autoHideDuration={NOTICE_DURATION_MS}
          onClose={() => setNotice(null)}
        >
          <Alert
            severity={
              notice?.kind === "error"
                ? "error"
                : notice?.kind === "success"
                  ? "success"
                  : "info"
            }
            onClose={() => setNotice(null)}
          >
            {notice?.text ?? ""}
          </Alert>
        </Snackbar>
      </main>
    </>
  );
}
