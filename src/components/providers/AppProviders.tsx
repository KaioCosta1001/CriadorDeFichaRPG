"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

import { STORAGE_KEYS } from "@/config/constants";
import { appTheme } from "@/config/theme";
import { useHydrateSettings } from "@/hooks/useHydrateSettings";
import { muiStorageManager } from "@/lib/muiStorageManager";

import { ThemeSync } from "./ThemeSync";

/**
 * Raiz de provedores do aplicativo.
 *
 * ORDEM IMPORTANTE — de fora para dentro:
 *
 * 1. `AppRouterCacheProvider options={{ enableCssLayer: true }}`
 *    - Coleta os estilos do Emotion durante o SSR do App Router e os insere
 *      via `useServerInsertedHTML`, evitando gerar uma tag `<style>` por
 *      componente (e evitando estilo ausente no primeiro paint).
 *    - `enableCssLayer` envolve cada regra do MUI em `@layer mui`.
 *
 *    ⚠️ NÃO usamos `StyledEngineProvider`, apesar de a especificação do
 *    projeto citá-lo. Motivo medido nesta base: ele cria um `CacheProvider`
 *    PRÓPRIO e, sendo mais interno que o `AppRouterCacheProvider`, sombreia
 *    o cache do App Router. Com ele presente, medimos os `<style>` do MUI
 *    saindo no HTML DEPOIS do `<link>` do Tailwind (índices 1519 vs 132) — ou
 *    seja, o MUI vencia por ordem de origem e as classes do Tailwind perdiam.
 *    `injectFirst` sozinho não corrige isso no SSR.
 *
 *    Com `@layer mui`, a prioridade passa a ser dada pela ORDEM DAS CAMADAS
 *    CSS, e não pela ordem de origem. É a garantia que precisamos.
 *
 * 2. `ThemeProvider`
 *    Aplica o tema com CSS variables e controla o esquema de cor
 *    (`data-theme="light|dark"` no `<html>`, lido também pelo Tailwind).
 *
 * RESULTADO (o que a seção 2 do projeto exige):
 * utilitários do Tailwind SEMPRE vencem o MUI, sem `!important` e sem
 * prefixo, porque `globals.css` declara `@layer mui` como a camada de
 * PRIORIDADE MAIS BAIXA (ver as duas primeiras linhas do arquivo).
 *
 * NOTA DE CSP: o `AppRouterCacheProvider` aceita `options.nonce` para passar
 * um nonce por requisição. Isso será usado quando adotarmos CSP com nonce
 * via `proxy.ts` no deploy (Fase 9).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Carrega as configurações globais do repositório DEPOIS da montagem
  // (evita hydration mismatch — seção 5.7).
  useHydrateSettings();

  return (
    <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
      <ThemeProvider
        theme={appTheme}
        // Os DOIS temas são escuros por natureza (grimório e brasa), então o
        // brilho é fixo; quem muda é o esquema nomeado (`colorScheme`).
        defaultMode="dark"
        modeStorageKey={STORAGE_KEYS.colorMode}
        colorSchemeStorageKey={STORAGE_KEYS.colorScheme}
        // O "storage" do MUI é, na verdade, uma ponte para o settingsStore,
        // que persiste pelo repositório. Ver `lib/muiStorageManager.ts`.
        storageManager={muiStorageManager}
        // Evita transição de cor ao trocar de tema (evita "flash" de cor).
        disableTransitionOnChange
      >
        <ThemeSync />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
