"use client";

import { Alert, Button, CircularProgress, Snackbar, IconButton,Collapse  } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditModeToolbar } from "@/components/layout/EditModeToolbar";
import { PanelGrid } from "@/components/layout/PanelGrid";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import type { PanelContext } from "@/components/panels/registry";
import { ThemeModeSwitch } from "@/components/ui/ThemeModeSwitch";
import { SHEET_CONTENT_ID, SkipLink } from "@/components/ui/SkipLink";
import { NOTICE_DURATION_MS } from "@/config/constants";
import { PANEL_TYPE_LABELS, type PanelType } from "@/config/panelTypes";
import { getSystem } from "@/config/systems";

import {
  countHiddenPanels,
  defaultSizeFor,
  extraPanelId,
  findFreeSlot,
  nextOrder,
  showPanel,
} from "@/domain/layout";
import { buildDefaultLayout } from "@/domain/sheetFactory";
import { generateId } from "@/lib/id";
import type { PanelLayout } from "@/schemas";
import { flushSheet, useSheetStore } from "@/store/sheetStore";

/**
 * Tela da ficha aberta — grade de painéis (seção 7 e seção 9).
 *
 * HIDRATAÇÃO: idem à tela de listagem. Nada de storage durante o render; a
 * ficha é lida em `useEffect`, depois de montar.
 */
export function SheetScreen({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const { status, sheet, error, dirty, open, mutate } = useSheetStore();

  const [itsopen, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    panelId: string;
    title: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void open(sheetId);
  }, [open, sheetId]);

  // Grava o que estiver pendente ao sair da aba. Sem isso, o debounce perderia
  // a última tecla digitada se o usuário fechasse a página logo em seguida.
  useEffect(() => {
    const onHidden = (): void => {
      if (document.visibilityState === "hidden") flushSheet();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  const system = useMemo(
    () => (sheet ? getSystem(sheet.system) : null),
    [sheet],
  );

  const context = useMemo<PanelContext | null>(
    () =>
      sheet
        ? {
            sheet,
            editMode,
            system,
            mutate,
            openSettings: () => setSettingsOpen(true),
          }
        : null,
    [sheet, editMode, system, mutate],
  );

  /** Grava um novo layout na ficha (passa pelo schema e pelo autosave). */
  const handleLayoutChange = useCallback(
    (layout: PanelLayout[]) => {
      mutate((current) => ({ ...current, layout }));
    },
    [mutate],
  );

  /**
   * Cria um bloco do usuário.
   *
   * São duas escritas no mesmo `mutate`: o dado em `extraPanels` e a entrada
   * em `layout`. Fazer em uma só garante que o layout nunca参照 um bloco que
   * ainda não existe.
   */
  const handleAddPanel = useCallback(
    (type: PanelType) => {
      const definition = PANEL_TYPE_LABELS[type];
      const extraId = generateId();
      const size = defaultSizeFor(type);

      mutate((current) => {
        const position = findFreeSlot(current.layout, size);
        return {
          ...current,
          extraPanels: [
            ...current.extraPanels,
            {
              id: extraId,
              title: definition,
              type,
              content: "",
              entries: [],
            },
          ],
          layout: [
            ...current.layout,
            {
              panelId: extraPanelId(extraId),
              x: position.x,
              y: position.y,
              w: size.w,
              h: size.h,
              visible: true,
              order: nextOrder(current.layout),
            },
          ],
        };
      });
    },
    [mutate],
  );

  /** Remove o layout E o conteúdo de um bloco do usuário. */
  const handleRemovePanel = useCallback(
    (panelId: string) => {
      mutate((current) => ({
        ...current,
        layout: current.layout.filter((panel) => panel.panelId !== panelId),
        extraPanels: current.extraPanels.filter(
          (panel) => extraPanelId(panel.id) !== panelId,
        ),
      }));
      setNotice("Bloco removido.");
    },
    [mutate],
  );

  /** Devolve tamanho, posição, ordem e visibilidade ao padrão. */
  const handleResetLayout = useCallback(() => {
    mutate((current) => {
      const defaults = buildDefaultLayout(null);
      const merged = current.layout.map((panel) => {
        const base = defaults.find((entry) => entry.panelId === panel.panelId);
        // Blocos do usuário mantêm tamanho e posição; só voltam a aparecer.
        if (!base)
          return { ...panel, visible: true, order: nextOrder(defaults) };
        return { ...panel, ...base, visible: true };
      });

      return {
        ...current,
        layout: [
          ...merged,
          ...defaults.filter(
            (entry) =>
              !current.layout.some((panel) => panel.panelId === entry.panelId),
          ),
        ],
      };
    });
    setNotice("Layout resetado.");
  }, [mutate]);

  /**
   * Liga/desliga a visibilidade de um bloco, pela bandeja.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * AO MOSTRAR, AS COLISÕES SÃO RESOLVIDAS DE NOVO
   *
   * Esconder GUARDA `x`, `y`, `w`, `h` e `order` — o bloco volta exatamente
   * onde estava. Mas o espaço vira terra de ninguém: o jogador pode ter
   * arrastado outro bloco para lá no meio tempo. Reexibir sem resolver a
   * sobreposição colocaria dois blocos em cima um do outro, e o de baixo
   * ficaria intocável.
   *
   * Por isso mostrar passa por `resolveCollisions`, que empurra o bloco
   * conflante para a primeira posição livre. Mostrar é a ÚNICA operação que
   * pode criar colisão — esconder nunca cria, só libera.
   */
  const handleToggleVisible = useCallback(
    (panelId: string, nextVisible: boolean) => {
      mutate((current) => ({
        ...current,
        layout: nextVisible
          ? showPanel(current.layout, panelId)
          : current.layout.map((panel) =>
              panel.panelId === panelId ? { ...panel, visible: false } : panel,
            ),
      }));
    },
    [mutate],
  );
  const hiddenCount = sheet ? countHiddenPanels(sheet) : 0;

  /**
   * Atalho do chip "N blocos ocultos": abre a bandeja JÁ com o Editar Geral
   * ligado.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE LIGAR O EDITAR GERAL AQUI
   * A bandeja já é acessível fora do modo; ligar o Editar Geral junto tem duas
   * utilidades: o jogador vê o contorno tracejado e as alças dos blocos que
   * acabou de recuperar (o bloco volta ao lugar, e ele quer conferir), e o
   * gesto continua reversível — um segundo clique desliga.
   */
  const handleShowHidden = useCallback(() => {
    setEditMode(true);
  }, []);
  return (
    <>
      <SkipLink targetId={SHEET_CONTENT_ID} label="Pular para os blocos" />
      <main className="mx-auto flex max-w-[1600px] flex-col gap-2 p-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/")} variant="text">
              ← Fichas
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {sheet?.title || sheet?.name || "Carregando…"}
              </h1>
              {sheet ? (
                <p className="text-text-muted text-xs">
                  {system?.label ?? "Sistema desconhecido"}
                  {dirty ? " · alterações não salvas…" : " · salvo"}
                </p>
              ) : null}
            </div>
          </div>
          <ThemeModeSwitch />
        </header>

        {/*
         * O alvo do "pular para o conteúdo".
         *
         * `tabIndex={-1}` é obrigatório: sem ele o navegador tentaria focar um
         * `div`, não consegue, e joga o foco no `body` — o usuário volta ao
         * topo e julga que o link não fez nada. Com `-1` o elemento é focável
         * por programa sem entrar na ordem do Tab.
         *
         * Este wrapper existe em TODOS os estados, inclusive carregando e com
         * erro. Um alvo que só aparece quando os blocos já carregaram faz o
         * pulador levar a lugar nenhum justamente na hora em que ele mais
         * importa.
         */}
        <div
          id={SHEET_CONTENT_ID}
          tabIndex={-1}
          className="flex flex-col gap-2 outline-none"
        >
          {status === "loading" ? (
            <div className="flex justify-center py-16">
              <CircularProgress aria-label="Abrindo ficha" />
            </div>
          ) : null}

          {status === "error" ? (
            <Alert
              severity="error"
              action={<Button onClick={() => router.push("/")}>Voltar</Button>}
            >
              {error ?? "Não foi possível abrir a ficha."}
            </Alert>
          ) : null}

          {sheet && context ? (
            <>
              <EditModeToolbar
                editMode={editMode}
                extraPanelCount={sheet.extraPanels.length}
                onAddPanel={handleAddPanel}
                hiddenCount={hiddenCount}
                onResetLayout={handleResetLayout}
                onShowHidden={handleShowHidden}
                onToggleVisible={handleToggleVisible}
                sheet={sheet}
                onToggle={() => setEditMode((value) => !value)}
              />

              {editMode ? (
                <Collapse in={itsopen}>
                  <Alert severity="info" action={
                    <IconButton
                      aria-label="close"
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setOpen(false);
                      }}
                      >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
                }
                sx={{ mb: 2 }}
              >
              Arraste pelo alça, puxe as bordas para redimensionar e use o olho para esconder.
                  </Alert>
                </Collapse>
              ) : null}

              <PanelGrid
                context={context}
                editMode={editMode}
                onCancelRemove={() => setPendingRemoval(null)}
                onLayoutChange={handleLayoutChange}
                onRemovePanel={handleRemovePanel}
                onRequestRemove={(panelId, title) =>
                  setPendingRemoval({ panelId, title })
                }
                onToggleVisible={handleToggleVisible}
                pendingRemoval={pendingRemoval}
                sheet={sheet}
              />
            </>
          ) : null}
        </div>

        <Snackbar
          autoHideDuration={NOTICE_DURATION_MS}
          message={notice ?? ""}
          open={notice !== null}
          onClose={() => setNotice(null)}
        />

        {/* O Dialog é montado aqui, mas ABERTO pelo botão do bloco de Perfil
          (§8.1). Fica no fim da árvore para não disputar posição visual. */}
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </main>
    </>
  );
}
