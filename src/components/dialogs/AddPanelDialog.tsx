"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
} from "@mui/material";

import { CrossIcon, PlusIcon } from "@/components/ui/icons";
import {
  getAllPanelDefinitions,
  type PanelDefinition,
} from "@/components/panels/registry";
import { MAX_EXTRA_PANELS } from "@/config/constants";

interface AddPanelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: PanelDefinition["type"]) => void;
  currentCount: number;
}

/**
 * Escolha do bloco a adicionar (seção 9.5).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * "EM PROCESSO" APARECE BLOQUEADO (§9.5)
 * O tipo existe e é listado, mas vem desabilitado e marcado com um "x".
 * Mostrar a opção explica que o espaço foi reservado; escondê-la deixaria o
 * usuário sem resposta quando procurasse por ela.
 *
 * Para LIBERAR o tipo, basta `isPanelTypeAvailable("placeholder")` voltar a
 * `true` em `config/panelTypes.ts` — nenhuma alteração aqui.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function AddPanelDialog({
  open,
  onClose,
  onAdd,
  currentCount,
}: AddPanelDialogProps) {
  const definitions = getAllPanelDefinitions().filter(
    (definition) => definition.userAddable || definition.type === "placeholder",
  );
  const atLimit = currentCount >= MAX_EXTRA_PANELS;

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      aria-labelledby="add-panel-title"
      open={open}
      onClose={onClose}
    >
      <DialogTitle id="add-panel-title">Adicionar bloco</DialogTitle>

      <DialogContent>
        <p className="text-text-muted mb-3 text-sm">
          Você tem {currentCount} de {MAX_EXTRA_PANELS} blocos.
        </p>

        <ul className="flex flex-col gap-2">
          {definitions.map((definition) => {
            const blocked = !definition.userAddable || atLimit;

            return (
              <li key={definition.type}>
                <Tooltip
                  title={
                    !definition.userAddable
                      ? "Reservado para uma ideia futura"
                      : atLimit
                        ? `Limite de ${MAX_EXTRA_PANELS} blocos atingido`
                        : definition.description
                  }
                >
                  <span className="block">
                    <button
                      type="button"
                      disabled={blocked}
                      aria-label={`Adicionar bloco ${definition.label}${
                        !definition.userAddable ? " (indisponível)" : ""
                      }`}
                      className="border-border hover:bg-surface-sunken flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onAdd(definition.type)}
                    >
                      <PlusIcon className="text-primary shrink-0 text-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {definition.label}
                        </span>
                        <span className="text-text-muted block text-xs">
                          {definition.description}
                        </span>
                      </span>
                      {!definition.userAddable ? (
                        <CrossIcon className="text-text-muted shrink-0 text-lg" />
                      ) : null}
                    </button>
                  </span>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
