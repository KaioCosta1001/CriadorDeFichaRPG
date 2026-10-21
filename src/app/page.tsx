import type { Metadata } from "next";

import { SheetsScreen } from "@/components/sheets/SheetsScreen";

export const metadata: Metadata = {
  title: "Minhas fichas",
};

/**
 * Tela inicial.
 *
 * É um Server Component leve: só renderiza o componente cliente que faz a
 * hidratação segura. Nenhum acesso a storage acontece no servidor.
 */
export default function HomePage() {
  return <SheetsScreen />;
}
