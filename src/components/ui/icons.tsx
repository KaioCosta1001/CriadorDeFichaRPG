import type { SVGProps } from "react";

/**
 * Ícones do aplicativo em SVG inline.
 *
 * POR QUE SVG PRÓPRIO E NÃO `@mui/icons-material`:
 *  - O projeto pede explicitamente "ícone de lápis em SVG".
 *  - Evitamos uma dependência de ~2 MB (tree-shaking não resolve bem o
 *    padrão `import X from "@mui/icons-material/X"` em todos os builds).
 *  - Ícones herdam `currentColor` e `stroke-width`, então seguem o tema e as
 *    classes do Tailwind sem trabalho extra.
 *
 * Todos usam a mesma viewBox (24x24) e traço, para ficarem visualmente
 * consistentes quando lado a lado.
 */
type AppIconProps = SVGProps<SVGSVGElement>;

/** Base comum: tamanho herdável via className, cor via `currentColor`. */
function BaseIcon({ children, ...props }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Sol — ativar tema claro. */
export function SunIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </BaseIcon>
  );
}

/** Lua — ativar tema escuro. */
export function MoonIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </BaseIcon>
  );
}

/** Lápis — entra/sai do modo Editar de um bloco. */
export function PencilIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </BaseIcon>
  );
}

/** Engrenagem — abre as configurações gerais. */
export function GearIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </BaseIcon>
  );
}

/** Mais — adicionar item (arma, item, atributo, perícia, painel). */
export function PlusIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </BaseIcon>
  );
}

/** Lixeira — remover. */
export function TrashIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </BaseIcon>
  );
}

/** Alça de arraste — seis pontos. É o handle de DnD das listas. */
export function DragHandleIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </BaseIcon>
  );
}

/** X — bloque indisponível (usado no tipo "Em processo"). */
export function CrossIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </BaseIcon>
  );
}

/** Olho — mostrar bloco escondido. */
export function EyeIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </BaseIcon>
  );
}

/** Olho cortado — esconder bloco. */
export function EyeOffIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.3-.9" />
      <path d="M3 3l18 18" />
    </BaseIcon>
  );
}

/** Redimensionar — cantos e bordas dos painéis no Editar Geral. */
export function ResizeIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </BaseIcon>
  );
}

/** Estrela — item favorito, protegido de venda em massa (§8.2). */
export function StarIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props} fill="currentColor" strokeWidth={1}>
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5Z" />
    </BaseIcon>
  );
}

/** Moeda — dinheiro da ficha. */
export function CoinIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M14.5 9.5c0-1-1.1-1.5-2.5-1.5s-2.5.5-2.5 1.5c0 2.5 5 1.5 5 4 0 1-1.1 1.5-2.5 1.5s-2.5-.5-2.5-1.5" />
    </BaseIcon>
  );
}

/** Balança — peso total contra a capacidade de carga. */
export function ScaleIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3v18M7 21h10M3 8l4-3 4 3M3 8a4 4 0 0 0 8 0M13 8l4-3 4 3M13 8a4 4 0 0 0 8 0" />
    </BaseIcon>
  );
}

/** Corrente — arma equipada a partir de um item. */
export function LinkIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
    </BaseIcon>
  );
}

/** Corrente partida — desequipar. */
export function UnlinkIcon(props: AppIconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 13a5 5 0 0 0 4.6 3M18.9 9.1A5 5 0 0 0 11.8 2l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-4.6-3M5.1 14.9A5 5 0 0 0 12.2 22l1.1-1.1" />
      <path d="M3 3l18 18" />
    </BaseIcon>
  );
}
