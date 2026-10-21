import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  // `nextTs` já registra o plugin do typescript-eslint, então as regras
  // `@typescript-eslint/*` abaixo são resolvidas pelo nome.
  ...nextTs,

  // Regras do projeto — o que NÃO é negociável (seção 16 do documento).
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // "Nenhum any" é critério de aceite. `@ts-ignore` só é aceitável com
      // justificativa em comentário, e `@ts-expect-error` só quando o erro
      // realmente existe.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Importações devem seguir a ordem do Prettier/editor.
      "import/order": "off",
    },
  },

  // Testes: tolerância a `any` em mocks é aceitável, mas mantemos o resto.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Augmentação de módulo: `interface X extends Y {}` sem membros é
  // EXATAMENTE o que o TypeScript pede para registrar schemes/chaves extras
  // (ex.: os temas do MUI). A regra acusaria um padrão obrigatório.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // Sobrescreve os ignores padrão do eslint-config-next.
  globalIgnores([
    ".next/**",
    ".next-dev/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    // Ferramentas de linha de comando (fora do bundle do app).
    "scripts/**",
    // Artefatos dos testes E2E.
    "e2e/fixtures/**",
  ]),
]);

export default eslintConfig;
