"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Descrição do que vai acontecer. */
  message: ReactNode;
  /**
   * Conteúdo extra entre a mensagem e os botões (ex.: um campo de texto).
   * Mantém o diálogo genérico e evita duplicar um Dialog só para um input.
   */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `true` deixa a ação em destaque (excluir). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmação para ações destrutivas (seção 6).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Por que um componente e não um `window.confirm`
 *  - `window.confirm` é bloqueado em alguns navegadores e no modo silencioso;
 *  - não é estilizável, quebrando a consistência visual;
 *  - não deixa aplicar foco nem trap de teclado;
 *  - em testes é awkward de verificar.
 * O Dialog do MUI já resolve foco, `aria-modal`, `Esc` e botão inicial.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      aria-describedby="confirm-dialog-message"
      aria-labelledby="confirm-dialog-title"
      open={open}
      onClose={onCancel}
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <div id="confirm-dialog-message" className="text-text-muted text-sm">
          {message}
        </div>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button
          autoFocus={children === undefined}
          color={destructive ? "error" : "primary"}
          variant="contained"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
