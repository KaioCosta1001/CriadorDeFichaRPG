import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Configuração do Vitest.
 *
 * Decisões:
 *  - `environment: "jsdom"`: os testes precisam de DOM (localStorage,
 *    React Testing Library). Regras de negócio puras (`src/domain`) também
 *    rodam em jsdom — sem custo relevante.
 *  - `vite-tsconfig-paths`: resolve o alias `@/*` igual ao Next.js, para que
 *    os testes importem exatamente o mesmo caminho do app.
 *  - `@vitejs/plugin-react`: necessário para o JSX/React Refresh em testes de
 *    componente.
 *  - `setupFiles`: registra os matchers do `@testing-library/jest-dom`.
 *
 * `testTimeout` é maior que o padrão porque vários testes de componente
 * abrem menus do MUI (com transição), digitam com `userEvent` e esperam
 * re-renders. Em máquina sob carga, o padrão de 5 s não dá conta — e teste
 * intermitente é pior que teste lento: o time para de confiar na suíte.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // `src/test/setup.ts` não é um teste.
    exclude: ["node_modules/**", ".next/**", "src/test/**"],
    restoreMocks: true,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
