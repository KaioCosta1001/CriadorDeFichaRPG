"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Switch,
} from "@mui/material";

import { OrnateDivider } from "@/components/ui/ornaments";
import {
  THEME_DESCRIPTIONS,
  THEME_IDS,
  THEME_LABELS,
  THEMES,
  type ThemeId,
} from "@/config/palette";
import { useSettingsStore } from "@/store/settingsStore";
import {
  ROLL_SPEED_MAX,
  ROLL_SPEED_MIN,
  ROLL_SPEED_STEP,
} from "@/config/constants";
import { useSheetStore } from "@/store/sheetStore";
import { useSheetsStore } from "@/store/sheetsStore";
import { buildExportFileName, sheetRepository } from "@/repositories";
import {
  downloadTextFile,
  readJsonFile,
  FileReadError,
} from "@/lib/fileTransfer";
import { useState } from "react";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DIALOG DE CONFIGURAÇÕES (seção 11)                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMO ADICIONAR UMA CONFIGURAÇÃO NOVA
 * Duas coisas, e só duas:
 *   1. o campo no schema Zod (`SheetSettingsSchema` para o que é por ficha,
 *      `AppSettingsSchema` para o que é global);
 *   2. UM item em `SETTING_ITEMS` (lá embaixo).
 *
 * A lista é uma união discriminada por `kind`, então o TypeScript garante que
 * todo item tenha os campos do seu tipo — não é possível esquecer o `label`
 * de uma configuração nova.
 * ───────────────────────────────────────────────────────────────────────────
 */
export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Um item da lista de configurações. */
type SettingItem =
  | {
      kind: "switch";
      id: string;
      label: string;
      description: string;
      value: boolean;
      onChange: (next: boolean) => void;
    }
  | {
      kind: "theme";
      id: string;
      label: string;
      description: string;
      value: ThemeId;
      onChange: (next: ThemeId) => void;
    }
  | {
      kind: "action";
      id: string;
      label: string;
      description: string;
      actionLabel: string;
      onAction: () => void;
    }
  | {
      /**
       * Ação que abre o seletor de ARQUIVO.
       *
       * Existe separada da `action` de propósito: o botão é um
       * `<label>` com o `<input type="file">` dentro. Usar uma ref para
       * chamar `input.click()` funciona, mas o React Compiler proíbe ler ref
       * durante o render — e o `<label>` resolve sem nenhum estado extra.
       */
      kind: "file";
      id: string;
      label: string;
      description: string;
      actionLabel: string;
      accept: string;
      onFile: (file: File | undefined) => void;
    }
  | {
      /** Item informativo, sem controle — "em breve", créditos, avisos. */
      kind: "info";
      id: string;
      label: string;
      description: string;
      badge?: string;
    }
  | {
      kind: "slider";
      id: string;
      label: string;
      description: string;
      value: number;
      min: number;
      max: number;
      step: number;
      onChange: (next: number) => void;
    };

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const sheet = useSheetStore((state) => state.sheet);
  const mutate = useSheetStore((state) => state.mutate);
  const theme = useSettingsStore((state) => state.settings.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const importFrom = useSheetsStore((state) => state.importFrom);
  const reload = useSheetsStore((state) => state.reload);

  const [localNotice, setLocalNotice] = useState<string | null>(null);
  // O store de listagem é quem reporta falha de importação (a mensagem já
  // vem em pt-BR, de `ImportError`). Sem esta assinatura, o usuário não
  // veria motivo nenhum ao importar um arquivo ruim.
  const storeNotice = useSheetsStore((state) => state.notice);
  const notice = localNotice ?? (storeNotice ? storeNotice.text : null);

  /** Lê o arquivo escolhido e repassa para o store de listagem. */
  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readJsonFile(file);
      const id = await importFrom(text);
      if (!id) return;
      await reload();
      setLocalNotice("Ficha importada. Ela já está na sua lista.");
    } catch (error) {
      setLocalNotice(
        error instanceof FileReadError
          ? error.message
          : "Não foi possível importar o arquivo.",
      );
    }
  }

  /** Itens globais: valem para o app inteiro. */
  const globalItems: SettingItem[] = [
    {
      kind: "theme",
      id: "theme",
      label: "Tema",
      description: "Aparência da interface. Os dois temas são escuros.",
      value: theme,
      onChange: setTheme,
    },
    {
      kind: "slider",
      id: "rollAnimationSpeed",
      label: "Velocidade da animação de rolagem",
      description:
        "Multiplicador de velocidade. 1x = normal, 2x = rápida, 0.5x = lenta.",
      value: useSettingsStore((state) => state.settings.rollAnimationSpeed),
      min: ROLL_SPEED_MIN,
      max: ROLL_SPEED_MAX,
      step: ROLL_SPEED_STEP,
      onChange: useSettingsStore((state) => state.setRollAnimationSpeed),
    },
  ];

  /** Itens por ficha: só fazem sentido com um personagem aberto. */
  const sheetItems: SettingItem[] = sheet
    ? [
        {
          kind: "switch",
          id: "sellEnabled",
          label: "Habilitar venda de itens",
          description:
            "Mostra os botões de venda no inventário. Vale só para esta ficha.",
          value: sheet.settings.sellEnabled,
          onChange: (next) => {
            mutate((current) => ({
              ...current,
              settings: { ...current.settings, sellEnabled: next },
            }));
          },
        },
        {
          kind: "action",
          id: "export",
          label: "Exportar esta ficha",
          description:
            "Baixa um JSON com tudo. Guarde antes de limpar o navegador.",
          actionLabel: "Exportar JSON",
          onAction: () => {
            void (async () => {
              const json = await sheetRepository.exportSheet(sheet.id);
              downloadTextFile(
                buildExportFileName(sheet.title || sheet.name || sheet.id),
                json,
              );
              setLocalNotice("Arquivo exportado.");
            })();
          },
        },
        {
          kind: "file",
          id: "import",
          label: "Importar uma ficha",
          description:
            "Cria uma ficha NOVA a partir de um JSON. A original não é tocada.",
          actionLabel: "Escolher arquivo…",
          accept: "application/json,.json",
          onFile: handleImportFile,
        },
      ]
    : [];

  /**
   * AJUDA DA ROLAGEM.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * POR QUE ESTA AJUDA AQUI, E NÃO SÓ NO TOOLTIP
   *
   * O adendo pede descoberta da rolagem por clique direito, e o tooltip da
   * lista resolve — para quem tem MOUSE. Quem está no celular não tem botão
   * direito, e quem usa teclado só o descobre se já souber que a tecla
   * existe. Um texto num lugar que a pessoa já visita resolve os três.
   *
   * A seção fica visível para TODAS as fichas, mesmo sem um só atributo ou
   * perícia: o usuário precisa saber o que o app faz antes de ter o que
   * rolar.
   */
  const helpItems: SettingItem[] = [
    {
      kind: "info",
      id: "roll-help",
      label: "Como rolar",
      description:
        "Botão direito (ou a tecla Menu / Shift+F10, ou um toque longo) em uma perícia, em um atributo ou em uma arma abre a rolagem. Na perícia você escolhe o atributo no momento; em branco, ela rola só com o valor da perícia.",
    },
    {
      kind: "info",
      id: "roll-detail",
      label: "O que aparece no resultado",
      description:
        "O bloco de resultado mostra a conta inteira — d20, perícia e atributo — e guarda as últimas rolagens. Um d20 natural 20 ou 1 aparece destacado.",
    },
    {
      kind: "info",
      id: "roll-blocked",
      label: "Por que o menu não abre",
      description:
        "Em qualquer modo de edição o botão direito volta a ser o do navegador: lá dentro ele moveria ou apagaria em vez de rolar.",
    },
  ];

  /** O que já está reservado e não pode ser ligado ainda. */
  const futureItems: SettingItem[] = [
    {
      kind: "info",
      id: "sound",
      label: "Efeitos sonoros",
      description:
        "Sons de rolagem, moeda e interface. Nenhum arquivo de áudio está no app ainda.",
      badge: "em breve",
    },
  ];

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      aria-labelledby="settings-title"
      open={open}
      onClose={onClose}
    >
      <DialogTitle id="settings-title" className="font-display">
        Configurações
      </DialogTitle>

      <DialogContent>
        <Section title="Geral" items={globalItems} />
        {sheetItems.length > 0 ? (
          <Section title="Ficha" items={sheetItems} />
        ) : null}
        <Section title="Ajuda" items={helpItems} />
        <Section title="Em breve" items={futureItems} />
        {notice ? (
          <p className="text-accent mt-3 text-sm" role="status">
            {notice}
          </p>
        ) : null}{" "}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Seção ────────────────────────────────────────────────────────────────── */

function Section({ title, items }: { title: string; items: SettingItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-4">
      <h3 className="label-caps mb-1">{title}</h3>
      <OrnateDivider className="mb-3 h-2 w-full" glyph="" />
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {item.label}
                {item.kind === "info" && item.badge ? (
                  <span className="border-frame text-text-muted rounded-full border px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase">
                    {item.badge}
                  </span>
                ) : null}
              </p>
              <p className="text-text-muted text-xs">{item.description}</p>
            </div>
            <SettingControl item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Renderiza o controle certo para cada `kind`. */
function SettingControl({ item }: { item: SettingItem }) {
  switch (item.kind) {
    case "switch":
      return (
        <Switch
          checked={item.value}
          color="primary"
          // O `aria-label` vai no INPUT, não no Switch: em cima ele cai no
          // `<span>` raiz e o controle fica SEM NOME para o leitor de tela.
          slotProps={{
            input: { "aria-label": item.label },
          }}
          onChange={(event) => item.onChange(event.target.checked)}
        />
      );

    case "theme":
      return <ThemePicker value={item.value} onChange={item.onChange} />;

    case "action":
      return (
        <Button onClick={item.onAction} size="small" variant="outlined">
          {item.actionLabel}
        </Button>
      );

    case "file":
      return (
        <Button component="label" size="small" variant="outlined">
          {item.actionLabel}
          <input
            accept={item.accept}
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Zerar o valor permite escolher o MESMO arquivo de novo: sem
              // isso o `change` não dispara na segunda tentativa.
              event.target.value = "";
              item.onFile(file);
            }}
          />
        </Button>
      );

    case "info":
      return null;

    case "slider":
      return (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={item.min}
            max={item.max}
            step={item.step}
            value={item.value}
            onChange={(event) => item.onChange(Number(event.target.value))}
            className="w-24"
          />
          <span className="text-text-muted text-xs tabular-nums">
            {item.value.toFixed(2)}x
          </span>
        </div>
      );
  }
}

/**
 * Seletor de tema: dois cartões com a paleta real de cada um.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM CARTÃO E NÃO UM `<Select>`
 * "Grimório" e "Santuário" são nomes de atmosfera, não nomes de cor. Um
 * desplegável mostraria "grimoire / santuario" e o usuário teria que adivinhar
 * qual é qual. O cartão mostra os três tons que definem o tema — o usuário
 * escolhe pelo que VÊ, não pelo que lê.
 * ───────────────────────────────────────────────────────────────────────────
 */
function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (next: ThemeId) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2" role="radiogroup" aria-label="Tema">
      {THEME_IDS.map((id) => {
        const tokens = THEMES[id];
        const selected = value === id;

        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={THEME_DESCRIPTIONS[id]}
            className={`flex w-20 flex-col gap-1 rounded-[var(--radius-sm)] border p-1.5 transition-[box-shadow,border-color] ${
              selected
                ? "border-accent shadow-[0_0_14px_-6px_var(--glow)]"
                : "border-frame hover:border-accent/60"
            }`}
            onClick={() => onChange(id)}
          >
            <span
              aria-hidden="true"
              className="flex h-6 overflow-hidden rounded"
              style={{ background: tokens.pageTo }}
            >
              <span className="flex-1" style={{ background: tokens.surface }} />
              <span className="flex-1" style={{ background: tokens.primary }} />
              <span className="flex-1" style={{ background: tokens.accent }} />
            </span>
            <span className="text-text-muted text-[10px] tracking-[0.12em] uppercase">
              {THEME_LABELS[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Mantido exportado para o teste garantir que a lista não fica vazia. */
export const SETTINGS_ITEM_KINDS = [
  "switch",
  "theme",
  "action",
  "file",
  "info",
] as const;
