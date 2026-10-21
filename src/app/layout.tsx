import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";

import { DEFAULT_THEME_ID, buildThemeVariables } from "@/config/palette";

import "./globals.css";

/**
 * ───────────────────────────────────────────────────────────────────────────
 * TIPOGRAFIA
 *
 * Cinzel  → títulos, cabeçalhos de painel, números de destaque.
 *            Traços angulares, evoke "inscrição em pedra".
 * EB Garamond → corpo, rótulos, campos. Serifa de leitura longa, quasi sem
 *            cansar a vista numa nota de 3000 caracteres.
 *
 * Só DUAS fontes, de propósito. A alternativa seria adicionar uma sans para
 * números e tabelas, e a troca de contexto entre três famílias na mesma tela
 * compete com a hierarquia em vez de reforçá-la. Os números usam
 * `lining-nums tabular-nums` da própria EB Garamond.
 *
 * `display: "swap"` garante que o texto aparece imediatamente com a fallback
 * enquanto a fonte chega — sem "tela branca" e sem layout shift tardio
 * (as métricas são substituídas pelo `adjustFontFallback` do next/font).
 *
 * Ambas são Google Fonts com licença SIL Open Font License — uso livre.
 * Nenhuma fonte proprietária é usada.
 * ───────────────────────────────────────────────────────────────────────────
 */
const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cinzel",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-garamond",
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Gerenciador de Fichas de RPG",
    template: "%s | Gerenciador de Fichas de RPG",
  },
  description:
    "Crie e gerencie fichas de personagem de RPG de mesa: blocos reorganizáveis, inventário, atributos, perícias e rolagens.",
};

export const viewport: Viewport = {
  // Os dois temas são escuros por natureza (grimório e brasa). Declarar isso
  // evita que o navegador "clareie" a barra de endereço ou o formulário em
  // modo escuro automático.
  colorScheme: "dark",
  themeColor: "#14100c",
};

/**
 * Variáveis CSS do tema padrão.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UM SERVER COMPONENT
 * As cores vivem em `config/palette.ts` (TypeScript) e são transformadas em
 * variáveis CSS aqui, no servidor, durante o render. O `<style>` vai para o
 * `<head>` junto com o CSS do Tailwind, então:
 *  - Tailwind e MUI leem exatamente os mesmos valores;
 *  - não existe uma segunda lista de cores para esquecer de atualizar;
 *  - o primeiro paint já sai correto, sem piscar.
 *
 * Quando o usuário troca de tema em tempo de execução, o MUI reescreve o
 * atributo `data-theme` no `<html>` e as REGRAS `[data-theme="…"]` deste
 * bloco passam a valer — sem trocar nada no DOM além do atributo.
 * ───────────────────────────────────────────────────────────────────────────
 */
function ThemeVariables() {
  return (
    <style
      // `dangerouslySetInnerHTML` NÃO é usado: o conteúdo é um texto literal
      // gerado por `buildThemeVariables`, sem entrada do usuário. Ele é
      // passado como `children`, então o React escapa normalmente.
      id="theme-variables"
      suppressHydrationWarning
    >
      {buildThemeVariables(DEFAULT_THEME_ID)}
    </style>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning`: o MUI define `data-theme` no <html> logo
    // após hidratar, e o React compararia esse atributo com o HTML do servidor.
    <html
      className={`${cinzel.variable} ${garamond.variable}`}
      data-theme={DEFAULT_THEME_ID}
      lang="pt-BR"
      suppressHydrationWarning
    >
      <head>
        <ThemeVariables />
      </head>
      <body className="bg-page-to font-body text-text min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
