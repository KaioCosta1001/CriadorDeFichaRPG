"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useMemo, useState } from "react";

import { SYSTEM_LIST, type RpgSystem } from "@/config/systems";
import { SHEET_NAME_MAX_LENGTH } from "@/config/constants";
import { CreateSheetInputSchema, type CreateSheetInput } from "@/schemas";

interface NewSheetDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateSheetInput) => Promise<void>;
  creating: boolean;
}

/**
 * Escolha de SISTEMA e MODELO (template) ao criar uma ficha.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMO ADICIONAR UM SISTEMA OU MODELO
 * NADA aqui. A tela lê `SYSTEM_LIST` de `config/systems/`, e os modelos vêm
 * de `system.templates`. Um sistema novo aparece automaticamente — desde que
 * a estratégia de cálculo esteja registrada em `domain/modifiers.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function NewSheetDialog({
  open,
  onClose,
  onCreate,
  creating,
}: NewSheetDialogProps) {
  const [systemId, setSystemId] = useState<string>(SYSTEM_LIST[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<string>(
    SYSTEM_LIST[0]?.templates[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const system: RpgSystem | undefined = useMemo(
    () => SYSTEM_LIST.find((candidate) => candidate.id === systemId),
    [systemId],
  );

  function handleSystemChange(nextId: string) {
    const next = SYSTEM_LIST.find((candidate) => candidate.id === nextId);
    setSystemId(nextId);
    // Ao trocar de sistema, o modelo anterior deixa de existir: volta
    // para o primeiro do novo sistema.
    setTemplateId(next?.templates[0]?.id ?? "");
    setError(null);
  }

  async function handleSubmit() {
    const parsed = CreateSheetInputSchema.safeParse({
      system: systemId,
      templateId,
      name,
      title: name,
    });

    if (!parsed.success) {
      setError("Preencha o nome do personagem antes de criar a ficha.");
      return;
    }

    setError(null);
    await onCreate(parsed.data);
    // Só limpa se a criação deu certo (o pai fecha o diálogo).
    setName("");
  }

  const selectedTemplate = system?.templates.find(
    (template) => template.id === templateId,
  );

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      aria-labelledby="new-sheet-title"
      open={open}
      onClose={onClose}
    >
      <DialogTitle id="new-sheet-title">Criar nova ficha</DialogTitle>

      <DialogContent className="flex flex-col gap-4 pt-2">
        <TextField
          autoFocus
          fullWidth
          label="Nome do personagem"
          placeholder="Ex.: Gandalf"
          value={name}
          slotProps={{ htmlInput: { maxLength: SHEET_NAME_MAX_LENGTH } }}
          helperText="O nome só poderá ser alterado depois, no modo Editar Geral."
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />

        <FormControl fullWidth>
          <InputLabel id="new-sheet-system-label">Sistema</InputLabel>
          <Select
            labelId="new-sheet-system-label"
            label="Sistema"
            value={systemId}
            onChange={(event) => handleSystemChange(String(event.target.value))}
          >
            {SYSTEM_LIST.map((candidate) => (
              <MenuItem key={candidate.id} value={candidate.id}>
                {candidate.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {system ? (
          <p className="text-text-muted text-sm">{system.description}</p>
        ) : null}

        {system ? (
          <FormControl fullWidth>
            <InputLabel id="new-sheet-template-label">Modelo</InputLabel>
            <Select
              labelId="new-sheet-template-label"
              label="Modelo"
              value={templateId}
              onChange={(event) => setTemplateId(String(event.target.value))}
            >
              {system.templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {selectedTemplate ? (
          <div className="bg-surface-sunken rounded-lg p-3 text-sm">
            <p>{selectedTemplate.description}</p>
            {selectedTemplate.blank ? (
              <p className="text-text-muted mt-2">
                Nenhum atributo nem perícia será criado — você adiciona os seus
                no modo Editar Geral.
              </p>
            ) : (
              <p className="text-text-muted mt-2">
                {selectedTemplate.attributes.length} atributo(s) e{" "}
                {selectedTemplate.skills.length} perícia(s).
              </p>
            )}
          </div>
        ) : null}

        {system ? (
          <Alert severity="info" variant="outlined">
            <strong>Regra de soma do atributo:</strong>{" "}
            {system.attributeRuleDescription}
          </Alert>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}
      </DialogContent>

      <DialogActions>
        <Button disabled={creating} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={creating || !templateId}
          variant="contained"
          onClick={() => void handleSubmit()}
        >
          {creating ? "Criando…" : "Criar ficha"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
