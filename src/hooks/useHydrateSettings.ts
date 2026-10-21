"use client";

import { useEffect } from "react";

import { useSettingsStore } from "@/store/settingsStore";

/**
 * Hidrata as configurações globais uma única vez, depois da montagem.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE CARREGAR SÓ DEPOIS DE MONTAR (seção 5.7)
 *
 * O servidor renderiza um HTML estático. Se um componente lesse o
 * `localStorage` durante o render, o HTML do servidor e o do cliente
 * divergiriam e o React abortaria com "hydration mismatch".
 *
 * A solução é o estado "carregando": servidor e primeiro render do cliente
 * usam o MESMO valor padrão; só depois de montar é que lemos os dados reais,
 * e a interface mostra um estado neutro nesse intervalo.
 *
 * Use este hook UMA VEZ, no provider raiz. A idempotência está dentro do
 * store (`hydrate` ignora chamadas repetidas), então o StrictMode do React
 * — que executa efeitos duas vezes em desenvolvimento — não causa leitura dupla.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useHydrateSettings(): void {
  const hydrate = useSettingsStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
