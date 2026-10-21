# Gerenciador de Fichas de RPG — Versão 3

Sistema web onde jogadores criam e gerenciam **fichas de personagem** de RPG
de mesa, com blocos totalmente reorganizáveis, inventário, atributos,
perícias e rolagens.

Interface e textos em **português do Brasil**. Nomes de arquivos, funções e
variáveis em **inglês**.

---

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script                 | O que faz                               |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento (Turbopack) |
| `npm run build`        | Build de produção                       |
| `npm start`            | Sobe o build de produção                |
| `npm run typecheck`    | `tsc --noEmit`                          |
| `npm run lint`         | ESLint (flat config)                    |
| `npm run lint:fix`     | ESLint com autofix                      |
| `npm run format`       | Prettier (escreve)                      |
| `npm run format:check` | Prettier (verifica)                     |
| `npm test`             | Vitest (uma passada)                    |
| `npm run test:watch`   | Vitest (modo watch)                     |
| `npm run check`        | typecheck + lint + format:check + test  |

> **Nota sobre npm no Windows:** se o PowerShell bloquear `npm` ("a execução de
> scripts foi desabilitada"), use `npm.cmd` no lugar de `npm`.

---

## Pilha e justificativa das escolhas

### Obrigatórias

| Tecnologia   | Versão | Papel                                              |
| ------------ | ------ | -------------------------------------------------- |
| Next.js      | 16.4   | App Router, Turbopack, `next build`                |
| React        | 19.3   | UI                                                 |
| TypeScript   | 5.9    | Tipagem estrita (ver abaixo)                       |
| Tailwind CSS | 4.3    | Layout e utilitários                               |
| Material UI  | 9.5    | Dialog, Select, Tabs, Checkbox, Tooltip, Snackbar… |
| Zod          | 4.6    | Validação em **toda** fronteira de dados           |
| @dnd-kit     | 6/10/9 | Drag and drop                                      |
| motion       | 14.2   | Animações                                          |

### Opcionais — escolhidas e justificadas

| Biblioteca                           | Alternativas descartadas                                                                                                     | Por quê                                                                                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@dnd-kit**                         | `react-beautiful-dnd` (morta, quebra no React 19), `react-dnd` (sem container sortável), SortableJS cru (sem acessibilidade) | Headless, mantido, **sensor de teclado + anúncios ARIA** prontos (exigência da seção 10), funciona com toque via `TouchSensor`                                                         |
| **Grid/resize próprio**              | `react-grid-layout`                                                                                                          | O requisito é snap de **5px**; o RGL só faz snap por **célula/coluna**. Além disso ele exige `WidthProvider` (quebra SSR) e CSS próprio competindo com o Tailwind                      |
| **Zustand 5**                        | Context + `useReducer`                                                                                                       | Um Context único re-renderiza a árvore inteira de painéis a cada tecla; selectors do Zustand isolam cada célula. Store puro + autosave pelo repositório                                |
| **react-hook-form + resolvers/zod**  | Controlled inputs manual                                                                                                     | Usado **só** nos diálogos (Configurações, criar ficha). Células inline do inventário usam estado local + Zod no commit: um controller por célula briga com DnD, `Space` e duplo-clique |
| **Vitest + Testing Library**         | Jest                                                                                                                         | Compatível nativamente com Vite/ESM, mais rápido, sem config extra                                                                                                                     |
| **`crypto.randomUUID`** (sem nanoid) | `nanoid`                                                                                                                     | Mesma CSPRNG, zero dependência. Fica isolado em `src/lib/id.ts` — trocar por nanoid é uma função                                                                                       |

**Não usados, de propósito:** `react-grid-layout` (ver acima), `@mui/icons-material`
(ícones SVG próprios em `src/components/ui/icons.tsx`), DOMPurify (o projeto
**não** renderiza HTML — todo texto livre é texto puro).

---

## Decisões de arquitetura da Fase 1

### 1. Como o Tailwind vence o MUI (a parte mais delicada)

Medimos o problema: com `StyledEngineProvider injectFirst`, os `<style>` do MUI
saíam no HTML do servidor **depois** do `<link>` do Tailwind — então o MUI
vencecia por ordem de origem.

A solução em duas peças:

1. `AppRouterCacheProvider options={{ enableCssLayer: true }}` coloca todas as
   regras do MUI em `@layer mui`. Camadas CSS vencem ordem de origem.
2. `src/app/globals.css` **declara a ordem** das camadas logo na primeira
   linha:
   ```css
   @layer mui, theme, base, components, utilities;
   ```

Ordem resultante (medida no bundle compilado):

```
properties < mui < theme < base < components < utilities
```

Ou seja: **qualquer utilitário do Tailwind vence o MUI**, sem `!important` e
sem prefixo.

> ⚠️ O `StyledEngineProvider` **não** é usado: ele cria um `CacheProvider`
> próprio e sombreia o cache do App Router, desfazendo o passo 1. O motivo
> está comentado em `src/components/providers/AppProviders.tsx`.

### 2. Tema claro/escuro com um único atributo

`colorSchemeSelector: "data-theme"` faz o MUI gravar `data-theme="light|dark"`
no `<html>`. O Tailwind usa o mesmo seletor (`@custom-variant dark`). Um
atributo, um dono (o MUI), duas bibliotecas sempre em sincronia — sem script
nosso mantendo os dois lados em acordo.

### 3. Tema e persistência

Na Fase 1 a preferência de tema era gravada pelo MUI direto no `localStorage`.
Na Fase 2 isso mudou: `src/lib/muiStorageManager.ts` virou um adaptador leve
sobre o `settingsStore`, e quem persiste é o `sheetRepository`. Eliminou-se o
segundo caminho de escrita de dados — a primeira forma de duplicação que vira
bug. Trocar o banco continua significando tocar só em `repositories/`.

- `AppSettings` (global, via repositório): `theme` (`grimoire` | `santuario`).
  Valores antigos (`light`/`dark`/`system`) são **normalizados**, não
  descartados — quem testou o app nas Fases 1–4 não perde a preferência.
- `Sheet.settings` (por ficha): `sellEnabled` — só faz sentido com um
  personagem aberto, já que o botão "Vender" vive no inventário.

> **Nota sobre a API do MUI v9:** `mode` (brilho) e `colorScheme` (tema
> nomeado) são coisas separadas. Nossos dois temas são escuros, então `mode` é
> fixo `"dark"` e quem muda é `setColorScheme` — usar `setMode` ali não faria
> nada. Coberto em `src/store/themeSwitch.test.tsx`.

### 4. `cacheComponents` desligado

O app é 100% client-side (dados no `localStorage`, sem fetch no servidor).
Cache de renderização do servidor não agrega nada e só introduz erros de build
do tipo "dados não cacheados fora de `<Suspense>`".

### 5. TypeScript

`strict: true` mais `noUncheckedIndexedAccess`, `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`,
`useUnknownInCatchVariables` e `verbatimModuleSyntax`.

`exactOptionalPropertyTypes` foi **deixado de fora de propósito**: conflita com
as declarações de MUI/react-hook-form/Zod (`prop?: T` vs `prop?: T | undefined`)
e geraria ruído sem melhorar o nosso código.

### 6. Mobile

Abaixo de `MOBILE_BREAKPOINT_PX` (768px) os painéis empilham verticalmente e o
redimensionamento/arraste de painéis fica **indisponível**. O DnD das listas
internas (armas, itens, atributos, perícias) continua funcionando por toque.

---

## Estrutura de pastas

```
src/
  app/                      rotas do App Router
    globals.css             @layer + tokens do tema (Tailwind v4, CSS-first)
    layout.tsx              <html lang="pt-BR"> + AppProviders
    page.tsx                listagem de fichas
    fichas/[id]/page.tsx    ficha aberta
  components/
    providers/              AppProviders + ThemeSync (ponte tema ↔ store)
    sheets/                 listagem, cartão, tela da ficha
    ui/                     componentes genéricos, ícones SVG e ornamentos
      Panel.tsx  RuneButton.tsx  SlotRow.tsx  ornaments.tsx
    dialogs/                nova ficha, confirmação, adicionar bloco
    layout/                 barra do Editar Geral, grade, moldura, alças
    panels/                 registro + um diretório por tipo de painel
      registry.tsx          ⚙️ ADICIONAR TIPO DE PAINEL = 1 ENTRADA AQUI
      ComingSoonPanel.tsx   marcador dos blocos das Fases 7–8
      profile/              ✅ Fase 5
      attributes/  skills/  ✅ Fase 6
      list/  notes/  placeholder/              (funcionais)
      inventory/  roll-result/                [Fases 7–8]
  config/
    constants.ts            TODAS as constantes configuráveis (fonte única)
    palette.ts              ⚙️ TOKENS DOS TEMAS — gera CSS e tema do MUI
    theme.ts                tema do MUI (a partir de palette.ts)
    panelTypes.ts           tipos de painel e rótulos pt-BR
    profileSlots.ts         slots de posição fixa do Perfil
    systems/                sistemas e modelos (dados, um arquivo cada)
  domain/                   regras puras de negócio, sem React
    skills.ts  stats.ts                                ✅ Fase 6
    layout.ts  modifiers.ts  migrations.ts  sheetFactory.ts
    dice.ts  inventory.ts                              [Fases 7–8]
  schemas/                  schemas Zod + tipos inferidos
    common.ts  sheet.ts  quarantine.ts  index.ts
  repositories/             camada de persistência
    types.ts                contrato SheetRepository (assíncrono)
    localStorageSheetRepository.ts
    index.ts                ⚙️ PONTO ÚNICO DE TROCA DE BANCO
  store/                    estado global (Zustand)
    sheetStore.ts           ficha aberta + autosave agrupado
    sheetsStore.ts          listagem + quarentena
    settingsStore.ts        configurações globais
  hooks/                    hooks reutilizáveis
    useInlineEdit.ts        edição por clique duplo (reusada nas Fases 6–7)
    useDraftValue.ts        rascunho local com gravação por confirmação
  lib/                      utilitários puros (safeStorage, id, debounce,
                            image, fileTransfer, sfx)
  test/                     setup do Vitest
```

---

## Onde mexer para ajustar o app

| Quero…                                    | Arquivo                                       |
| ----------------------------------------- | --------------------------------------------- |
| Mudar limite de itens, tamanho de painel… | `src/config/constants.ts`                     |
| Adicionar uma aba ao inventário           | `INVENTORY_TABS` em `src/config/constants.ts` |
| Trocar as cores                           | `src/config/palette.ts` **e** `globals.css`   |
| Trocar o snap do redimensionamento        | `RESIZE_SNAP_PX` em `constants.ts`            |
| Trocar como o atributo entra na rolagem   | `config/systems/<id>.ts` (só a estratégia)    |
| Trocar os presets de raridade             | `RARITY_PRESETS` em `constants.ts`            |
| Trocar localStorage por MongoDB           | `src/repositories/` (ver abaixo)              |

---

## Migração para MongoDB (planejada, **não** implementada)

O contrato já está definido; falta só implementá-lo.

1. Criar `MongoSheetRepository implements SheetRepository` em
   `src/repositories/`.
2. Expor Route Handlers em `src/app/api/sheets/route.ts`.
3. Trocar **uma linha** em `src/repositories/index.ts`.

Componentes e regras de negócio não são tocados — todos já falam com a
interface assíncrona `SheetRepository`.

---

## CSP estrita (implementada na Fase 9)

**Antes:** `next.config.ts` mandava uma CSP estática com `script-src 'self'
'unsafe-inline'`. O `'unsafe-inline'` é exatamente o que enfraquece a proteção
contra XSS: com ele, um `<script>` injetado por qualquer falha de escaping
passa a executar.

**Agora:** a CSP mora em `src/proxy.ts` (no Next 16, `middleware` foi
renomeado para `proxy`) e ganha um `nonce` novo a cada requisição.

```
script-src 'self' 'nonce-<valor>' 'strict-dynamic'
style-src  'self' 'unsafe-inline'          <-- dívida declarada, abaixo
```

### Por que o nonce fecha a lista

Um nonce é aleatório e muda a cada resposta. Só os scripts que o carregam
executam; o que o atacante roubar de uma requisição não serve na seguinte.
`'strict-dynamic'` vai junto porque é o que permite **encerrar** a lista:
navegadores modernos passam a confiar apenas no que o script do nonce carregou,
e `'self'` fica só para navegadores antigos que não conhecem a diretiva.

Duas requisições seguidas ao servidor de produção devolveram nonces distintos —
é o que garante que o nonce não virou constante (uma constante daria a mesma
proteção de nenhuma).

### A dívida: por que `style-src` ainda tem `'unsafe-inline'`

O **Emotion** injeta tags `<style>` em tempo de execução, sem passar pelo
servidor, e o projeto **não** usa `AppRouterCacheProvider` (a Fase 1 o removeu
de propósito). Sem um cache com nonce não há como injetar o valor nessas tags.

`'unsafe-inline'` em `style-src` é bem menos perigoso que em `script-src`: folha
de estilo não executa JavaScript, e com `object-src 'none'` + `base-uri 'self'`
os vetores perigosos continuam bloqueados. Se o MUI entrar com cache por nonce,
esta linha fecha também — está anotado em `src/proxy.ts` para não virar mito.

### O que foi verificado no servidor de produção

- cabeçalho presente em `/` e em `/fichas/[id]`;
- **todos** os `<script>` do HTML têm `nonce` — nenhum ficou de fora;
- `next build` reporta `ƒ Proxy (Middleware)`;
- `src/proxy.test.ts` trava os dois pontos que importam: `script-src` **não**
  contém `'unsafe-inline'`, e dois nonces seguidos geram CSPs diferentes.

### O custo aceito

Um nonce por requisição **exige renderização dinâmica** — o resultado não é
cacheável entre requisições. Para um app client-side como este o custo (uma
compilação, um render por visita) compensa pela proteção.

---

## Camada de dados (Fase 2)

### Como os dados estão guardados

Uma chave por ficha, mais um índice de resumos:

```
rpgv3:sheets            → SheetSummary[]        (índice da listagem)
rpgv3:sheet:<id>        → Sheet                 (documento completo)
rpgv3:settings          → AppSettings           (configurações globais)
rpgv3:quarantine        → QuarantineSummary[]   (documentos isolados)
rpgv3:quarantine:<id>   → QuarantinedDocument   (com o TEXTO CRU do original)
```

Uma chave por ficha (e não um array único) é deliberado:

- um documento corrompido afeta **só a si mesmo**;
- a quarentena guarda o texto bruto intacto, então "exportar o bruto"
  funciona de verdade;
- salvar uma ficha não reescreve as outras — importa quando a cota é ~5 MB.

### Camadas

```
componentes  →  store (Zustand)  →  SheetRepository  →  localStorage
                                  ↕
                            domain/ (regras puras)

schemas/ (Zod) valida em TODA a fronteira
```

### Hidratação segura (sem hydration mismatch)

Nada é lido do storage durante o render. Servidor e primeiro render do cliente
usam o **mesmo** valor padrão (`DEFAULT_APP_SETTINGS`); a leitura real
acontece em `useEffect`, depois da montagem, e a interface mostra um estado
neutro até lá. Mesmo princípio no `sheetStore` (`status: "loading"`).

### Gravação agrupada (debounce)

Digitar o nome de um personagem geraria uma escrita do documento inteiro por
tecla — com foto e inventário dentro. `createDebouncedTask` agrupa em
`SAVE_DEBOUNCE_MS`; `flushSheet()` / `flushSettings()` gravam na hora (trocar
de ficha, exportar, sair da aba).

### Documento corrompido

`getSheet` faz: ler → `migrateDocument` → `SheetSchema.safeParse`.

Se falhar, **não quebra o app**: o documento vai para a quarentena com o texto
bruto, o motivo e o caminho do campo inválido, e o original é removido do
lugar para não ser lido de novo. A interface pode listar, exportar o bruto,
descartar um ou descartar todos.

Documento com `schemaVersion` **maior** que a do app também é isolado — é mais
seguro do que tentar adivinhar um formato desconhecido.

### Migrações

`src/domain/migrations.ts` aplica `MIGRATIONS[v]`, `MIGRATIONS[v + 1]`… até
`SCHEMA_VERSION`. Hoje o registro tem **uma** entrada, `1: migrateV1toV2`
(ver "Rolagem por clique direito"). O passo a passo para adicionar uma está no
topo do arquivo. Documento sem `schemaVersion` é tratado como v1.

---

## Sistemas de RPG (Fase 3)

Cada sistema é um arquivo em `src/config/systems/` — **dado, não código**:

```
config/systems/
  types.ts      formato comum (RpgSystem, SystemTemplate, seeds)
  dnd5e.ts      Old Dragon → olddragon.ts → coc.ts
  index.ts      registro + funções de busca
```

| Sistema         | Atributos | Perícias modelo clássico | Dado de perícia | Regra do atributo              |
| --------------- | --------- | ------------------------ | --------------- | ------------------------------ |
| D&D 5e          | 6         | 18                       | d20             | modificador `(valor − 10) ÷ 2` |
| Old Dragon      | 10        | 21                       | d20             | idem D&D (provisório)          |
| Call of Cthulhu | 10        | 39                       | **d100**        | soma o valor direto            |

Cada sistema traz 3 modelos: clássico, simplificado e **em branco**. O modelo
define atributos iniciais, perícias iniciais, slots do perfil, ajustes de
layout e o `templateId` gravado na ficha.

**Call of Cthulhu** já vem com o slot inferior esquerdo ligado como
**Sanidade** (requisito da seção 12).

### Ponto em aberto 14.1 — regra por sistema

Isolada em `src/domain/modifiers.ts`. Padrão Strategy: cada sistema declara a
própria função, então trocar a regra do D&D **não** arrasta o CoC junto.

```ts
calculateAttributeContribution(systemId, attributeValue, "weapon" | "skill");
```

Quando a regra definitiva sair, edite **um arquivo** e ajuste os testes de
`modifiers.test.ts`.

### Ponto em aberto 14.2 — vínculo perícia ↔ atributo

Padrão implementado: cada perícia tem um `attributeId` opcional, resolvido a
partir da chave do atributo no modelo. Sem vínculo, a rolagem é só
`dado + valor da perícia`.

### Ponto em aberto 14.4 — vários atributos por arma

A estrutura já aceita `attributeIds: string[]` e soma a contribuição de cada
um. A interface (Select múltiplo) é da Fase 7.

### d100

`WEAPON_DIE_TYPES` (o que o seletor de arma mostra) continua sendo d4…d20,
exatamente como pede a seção 8.2.1. `RESERVED_DIE_TYPES` guarda o `d100` para
sistemas que o usam, e o schema aceita ambos. São dois conjuntos separados de
propósito — se o seletor passar a oferecer d100, muda uma constante só.

---

## Grade de painéis e Editar Geral (Fase 4)

### Por que um grid próprio

O requisito é snap de **5 px** (`RESIZE_SNAP_PX`). `react-grid-layout` faz
snap por **célula/coluna** — não atende. Além disso, exigiria o HOC
`WidthProvider` (quebra o SSR) e CSS próprio competindo com o Tailwind.

Tudo em `src/domain/layout.ts`, **função pura, sem React nem DOM**:

| Função                        | Para quê                                               |
| ----------------------------- | ------------------------------------------------------ |
| `clampSize` / `clampPosition` | Snap de 5 px + limites de painel                       |
| `resolveCollisions`           | Empurra blocos sobrepostos para baixo (determinístico) |
| `findFreeSlot`                | Primeira posição livre para um bloco novo              |
| `computeContainerHeight`      | Altura do container                                    |
| `fitWithinContainer`          | Puxa o bloco para dentro quando a janela estreita      |
| `extraPanelId`                | Chave estável de bloco do usuário (`extra:<id>`)       |

A sobreposição é resolvida **uma vez, ao soltar** — durante o arraste o bloco
passa por cima dos outros, o que dá a sensação de onde ele vai cair.

### Arrastar e redimensionar

- **Arrastar** — `@dnd-kit`. Ganho principal: sensor de **teclado** com anúncios
  ARIA ("item movido para a posição 2 de 5"), que é requisito da §10.
- **Redimensionar** — 8 alças com `pointer capture` próprio, porque o
  redimensionamento livre em pixel não conversa bem com o `DndContext`.
- O snap de 5 px é aplicado a cada movimento, dentro do gesto. Sem isso o
  painel "gruda" atrás do cursor e a alça parece quebrada.
- Cada alça é um `<button>` focalizável: com o foco nela, as setas redimensionam
  em um passo de snap. Redimensionar só com mouse não é acessível.

### Móvel

Abaixo de `MOBILE_BREAKPOINT_PX` o layout salvo é ignorado: os blocos empilham
na ordem salva e arraste/redimensionamento ficam indisponíveis. Motivo: numa
tela de 360 px um bloco de 320 px ocupa quase tudo, e acertar uma alça de 12 px
com o dedo erra o alvo a cada tentativa.

### Blocos

`src/components/panels/registry.tsx` mapeia `type → { componente, rótulo,
removível, criável }`. **Adicionar um tipo novo é uma entrada no registro** —
a moldura, o arraste, o resize, esconder e a persistência vêm de graça.

| Bloco padrão (Fases 5–8)                           | Removível | Escondível                |
| -------------------------------------------------- | --------- | ------------------------- |
| Perfil, Inventário, Resultado, Atributos, Perícias | ❌        | ✅                        |
| Texto, Lista                                       | ✅        | ✅                        |
| "Em processo"                                      | ✅        | ❌ bloqueado para criação |

Os blocos padrão ainda renderizam um marcador "chega na Fase N" — trocar no
registro é a única alteração necessária quando cada um for construído.

### Bug corrigido na Fase 4: o `trim()` comia os espaços

O `SheetSchema` aplica `.trim()` em todo texto — correto para dado salvo. Mas
o `sheetStore.mutate` valida a ficha inteira **a cada tecla**. O resultado era:

```
digita "lembrete" → grava "lembrete"
digita " "        → grava "lembrete"   ← espaço aparado na hora
digita "i"       → grava "lembreti"   ← o espaço sumiu de vez
```

**Digitar duas palavras virava uma.** O corte é invisível num campo curto e
muito desconcertante numa nota longa.

A correção é `src/hooks/useDraftValue.ts`: o campo guarda um **rascunho local**
e grava só na confirmação (blur, Enter, fechar o bloco). O `trim()` do schema
continua valendo — no momento certo. Esse é o padrão a usar em todos os campos
de texto das próximas fases.

---

## Direção visual (adendo aplicado na Fase 4)

Inspiração, **nunca cópia**: a atmosfera de dois jogos de fantasia sombria — o
calor dourado de um grimório encadernado e o peso de carvão e brasa. Nenhum
logo, nome de marca, ícone, textura, arte ou fonte proprietária foi usado.
Todos os ornamentos são SVG/CSS originais.

### Uma fonte de verdade

`src/config/palette.ts` (TypeScript) gera **tanto** as variáveis CSS
**quanto** os temas do MUI. Um componente servidor (`<ThemeVariables />`,
em `layout.tsx`) emite o `<style>` no `<head>`; o Tailwind consome via
`@theme inline`.

Isso **elimina** a duplicação que a Fase 1 documentou como risco ("estas duas
listas devem evoluir juntas"). Agora não existe segunda lista.

### Os dois temas

|            | Grimório                          | Santuário                          |
| ---------- | --------------------------------- | ---------------------------------- |
| Fundo      | `#1b1510 → #14100c` radial        | `#141418 → #0b0b0d` + vinheta 0.55 |
| Superfície | `#241b13` / `#1a130d` / `#2d2218` | `#1a1a1f` / `#121216` / `#222228`  |
| Texto      | `#e8dcc0` / `#b8a98a`             | `#d6d2cc` / `#9b9893`              |
| Primário   | ouro `#c9a24a` (hover `#e2bd62`)  | brasa `#e0564a` (hover `#f0705f`)  |
| Moldura    | `#6b5326`                         | `#4e4e5c`                          |
| Brilho     | `#e2bd62`                         | `#ff5a36`                          |
| Ruído      | 3.5%                              | 2%                                 |

**Ajuste documentado:** o adendo sugeria `#b3201f` como vermelho de brasa.
Medido, ele dá **2.59:1** sobre a superfície `#1a1a1f` — reprova o AA (4.5:1)
com folga. Subimos para `#e0564a` (4.62:1) e passamos a usar texto **escuro**
sobre o botão, o que combina mais com brasa acesa do que texto branco. O tom
profundo original vive no `--glow` (`#ff5a36`), usado só em brilho.

Todos os pares passam `src/config/palette.test.ts` (31 testes de contraste
com a fórmula da WCAG). Não é documentação: é gate de build.

### Tipografia

`Cinzel` (títulos, cabeçalhos, números) + `EB Garamond` (corpo, labels,
inputs), via `next/font/google`, ambas variáveis e com `display: swap`.
Só **duas** fontes: números usam `lining-nums tabular-nums` da própria EB
Garamond. Ambas sob SIL Open Font License.

### Ornamentos

| Peça                                     | Técnica                                                | Custo    |
| ---------------------------------------- | ------------------------------------------------------ | -------- |
| Borda dupla (metal + linha interna fina) | `.frame-double` — borda + `box-shadow`                 | zero DOM |
| Chanfro de canto em L                    | `.corner-notch` — 2 pseudo-elementos                   | zero DOM |
| Textura de grão                          | `.noise-surface` — `feTurbulence` em data-URI a 2–3,5% | zero DOM |
| Vinheta da página                        | `body::after` fixo                                     | zero DOM |
| Divisor ornamental                       | `<OrnateDivider />` — gradiente + lozango              | 1 SVG    |
| Cantos do retrato / mesa                 | `<CornerOrnaments />`                                  | 1 SVG    |
| Alça de redimensionamento                | `clip-path` losango + aro dourado                      | zero DOM |

### Componentes

`<Panel>`, `<PanelHeader>`, `<RuneButton>`, `<SlotRow>`, `<OrnateDivider>`,
`<CornerOrnaments>`, `<PortraitFrame>`, `<EmberHalo>` — todos em
`src/components/ui/`, todos consumindo tokens.

### Modo Editar Geral

Contorno tracejado dourado com pulsação lenta (`animate-ember-pulse`,
desligada em reduced-motion), alças em losango, handle de arraste no
cabeçalho, barra em faixa de couro e **selo "Modo edição"** — para o usuário
nunca ficar em dúvida de que está editando, porque errar isso custa dados
perdidos.

### Raridade

`RARITY_PRESETS` em `constants.ts`: Comum, Mágico, Raro, Lendário, Único,
Sagrado. A cor vira a faixa da linha (`<SlotRow>`), e **cada preset tem glifo
e `aria-label`** — raridade nunca é comunicada só por cor.

### Áudio

`src/lib/sfx.ts` é só o **ponto de extensão**: assinatura pronta, catálogo
vazio, nada instanciado. A opção "Efeitos sonoros" aparece como "em breve" —
não como um interruptor que não faz nada.

### `prefers-reduced-motion`

`motion/react` cuida do JS (`useReducedMotion`), e o CSS puro é zerado por
uma regra global. Cascata de entrada, pulso do modo editar e brilho somem.

---

## Bloco de Perfil (Fase 5)

### A regra do nome (§8.1) — a mais fácil de burlar

O **nome do personagem só é editável no Editar Geral**. Fora dele, o duplo
clique não abre nada: mostra o aviso

> Poderá ser editado em 'Editar' no painel principal

que some sozinho após `NOTICE_DURATION_MS`, com fade de
`PROFILE_POPUP_FADE_MS`. O texto é uma **constante** e há um teste que
verifica a string exata — copy não se degrada em edições.

Com `prefers-reduced-motion`, o aviso **continua aparecendo e sumindo**; só
deixa de animar. Esconder a informação é diferente de remover a animação.

### Slots

Posição fixa (superior esq./dir., inferior esq./dir.), cada um ligado ou
desligado, com rótulo e valor editáveis por **clique duplo**.
`Enter` grava, `Escape` cancela.

O campo **Máx.** só aparece no Editar Geral e é **exclusivamente visual**:
preenche o orbe em proporção. Nenhuma regra de jogo usa esse número.

### A cor do orbe vem do PAPEL, não do rótulo

`detectOrbRole("PV") → life`, `detectOrbRole("Sanidade") → mind`,
`detectOrbRole("CA") → armor`. Se a cor estivesse presa ao rótulo, renomear
"PV" para "Vida" trocaria o orbe sem querer.

A busca respeita **limites de palavra**: `"cascos".includes("ca")` é
verdadeiro, e "Cascos" **não** é classe de armadura. O teste cobre isso.

### Foto de perfil

Validada por tipo e tamanho **antes** de ser decodificada, redimensionada no
cliente (512 px, JPEG comprimido) e revogada com `revokeObjectURL` — sem isso,
abrir 10 fotos seguidas vaza memória. Motivo: a cota do `localStorage` é
~5 MB e compartilhada por toda a origem; guardar a foto original tiraria a
cota de várias fichas.

### Dialog de Configurações (§11)

Três seções — **Geral**, **Ficha**, **Em breve** — alimentadas por uma lista
de união discriminada por `kind`. Adicionar uma configuração = o campo no
schema Zod + **um item** na lista.

- **Tema** — seletor com DOIS cartões mostrando a paleta real de cada tema.
  "Grimório" e "Santuário" são nomes de atmosfera: um `<Select>` mostraria
  `grimoire`/`santuario` e o usuário teria que adivinhar qual é qual.
- **Habilitar venda de itens** — grava em `Sheet.settings`, **não** nas
  configurações globais (tem teste garantindo isso).
- **Exportar / Importar** — o botão de arquivo é um `<label>` com o
  `<input>` dentro, sem ref. A regra `react-hooks/refs` proíbe ler ref durante
  o render, e o `<label>` resolve sem estado extra.
- **Efeitos sonoros** — aparece como "em breve", **não** como interruptor que
  não faz nada.

---

## Blocos de Atributos e Perícias (Fase 6)

### As DUAS portas de edição — e por que a §8.4 parece contraditória

A §8.4 pede duas coisas que, lidas como uma regra só, se atropelam:

- _"Botão Editar (cabeçalho do bloco): libera mudança de cor de cada atributo
  e botão de exclusão"_;
- _"A quantidade de atributos é sensível: só no Editar Geral"_.

A leitura que satisfaz as duas:

| Ação            | Onde         | Por quê                                    |
| --------------- | ------------ | ------------------------------------------ |
| **Criar** (`+`) | Editar Geral | é o que muda a **quantidade**              |
| **Reordenar**   | Editar Geral | a ordem dos atributos é estrutura da ficha |
| **Cor**         | Lápis bloco  | pede a §8.4 literalmente                   |
| **Excluir**     | Lápis bloco  | idem                                       |

O inverso incomodaria: com o `+` só no lápis do bloco, bastaria um clique
para inflar a ficha; com a exclusão só no Editar Geral, apagar um atributo
errado seria longo demais para um engano comum — e o Editar Geral é justamente
onde se mexe em tudo ao mesmo tempo, o pior momento para um clique acidental.

### Remover um atributo DESFAZ os vínculos das perícias

A §8.5 manda que toda perícia tenha um atributo vinculado. Apagar "Força"
deixaria as perícias de Força anunciando um `Modificador +3` que não existe —
a rolagem quebraria em silêncio.

A correção é **desvincular, não recusar**. `Skill.attributeId` aceita `null`,
que é um estado **válido** ("perícia sem atributo"): a linha continua
rolável, só perde o modificador. Recusar a remoção obrigaria o usuário a
apagar antes as N perícias — o caminho mais fácil de errar. Desvincular e
avisar quantas foram é reversível: basta revincular no modo editar.

`domain/skills.ts` deteita o quanto será afetado **antes** de remover, e o
painel mostra: _"4 perícias ficaram sem vínculo — revincule no bloco de
Perícias."_

### A regra de conversão vem do SISTEMA, nunca do componente

`d20 + perícia + bônus do atributo` é montado em `describeSkillRoll`, que
recebe **só** `skill`, `attributes` e `RpgSystem`. É isso que a §8.5 chama de
_"comunicação apenas com Atributos"_: a perícia não conhece arma, item,
dinheiro nem bloco de resultado. Trocar a regra do D&D não toca nenhum
componente — só `RpgSystem.attributeContribution`.

`d20 +5 +3 · Força` fica **sempre visível**, não no hover: é a resposta que o
jogador procura ao olhar a lista, e o bloco existe justamente para eliminar o
trabalho de refazer a conta de cabeça.

Cada parcela **zero é omitida**: um `+0` sugere um bônus que existe e é nulo.
E o atributo aparece pelo nome — com `+3` e sem nome, o jogador não sabe de
onde saiu o número.

### Texto não numérico NUNCA vira 0

`parseStatValue` (`domain/stats.ts`) recusa `"abc"` e devolve o **valor
anterior**, não `0`. Um `0` inventado é pior que a recusa: o jogador lê 0,
acredita que a perícia vale zero e joga com a ficha errada.

Fora da faixa, o valor é **limitado** (99999 → 999) em vez de recusado. O
`boundedInt` do schema _rejeita_, então o `mutate` devolveria `false` sem
aplicar nada: o usuário digita e o app parece travado. Limitado, ele vê `999`
no campo — o limite fica visível.

### Vínculo órfão é estado legível, não estado quebrado

Uma ficha importada de outra versão pode trazer `attributeId` apontando para
um atributo inexistente. O painel detecta (`findOrphanedSkills`), mostra um
aviso e a linha continua exibindo `sem atributo`. Nunca um erro, nunca `NaN`.

### O botão de rolar NÃO existe ainda — e é proposital

A §8.5 manda que rolar a perícia envie o resultado ao bloco de Resultado, e
esse bloco é a **Fase 8**, junto com o motor de dados e a animação. Um botão
"Rolar" agora mostraria um número em algum lugar e sumiria — pior do que não
existir. A Fase 6 entrega a **parte** dela: o vínculo, a regra do sistema e o
detalhamento do cálculo. O clique de verdade chega junto com o destino dele.

### Reuso

O seletor de raridade saiu do `ListPanel` para `components/ui/ColorPicker.tsx`
(`ColorPicker`, `colorLabelFor`, `colorGlyphFor`). Atributos, Perícias e — na
Fase 7 — Armas e Itens usam o mesmo componente, com os mesmos presets e a
mesma acessibilidade: raridade **nunca** é comunicada só pela cor, cada preset
tem `aria-label` com o nome, `title` e `aria-pressed`.

---

## Rolagem por clique direito (adendo)

O adendo substitui as regras de rolagem de perícias (§8.4/§8.5) e o vínculo
fixo perícia ↔ atributo (ponto em aberto nº 2). O resto do prompt e o adendo
visual continuam valendo.

### O vínculo fixo foi REMOVIDO do modelo

`Skill.attributeId` não existe mais. O atributo é escolhido **no momento da
rolagem**, no menu de clique direito, e "rolar seca" é uma opção de primeira
classe.

Dois lugares para escolher a mesma coisa divergem, e o jogador não saberia qual
manda. Um vínculo fixo também prende a perícia a um único atributo — não serve
para quem joga com "qualquer atributo serve aqui".

**Migração v1 → v2** (`migrations.ts`) remove o campo e **remodela** o
histórico: as contribuições de atributo e os bônus viram parcelas da lista
única, na ordem em que eram lidos. O histórico antigo **não é descartado** — o
detalhamento de cada rolagem continua correto depois da migração, e há teste
afirmando que a ficha migrada passa no schema atual (a prova de que a migração
está completa: um campo faltando seria quarentena, e a ficha sumiria).

`SystemTemplate.skills[].attributeKey` continua nos modelos: é a _sugestão_ de
qual atributo combina, e nada é gravado a partir dele.

### As três rolagens, uma estrutura

| Rolagem            | Cálculo                                 | Rótulo guardado            |
| ------------------ | --------------------------------------- | -------------------------- |
| perícia seca       | `d20 + valor da perícia`                | `"Furtividade (seca)"`     |
| perícia + atributo | `d20 + perícia + conversão do atributo` | `"Furtividade + Destreza"` |
| atributo           | `d20 + conversão do atributo`           | `"Destreza"`               |

O `"(seca)"` viaja **no dado**, para que o resultado e o histórico não
precisem saber quando aplicá-lo — e para a frase não mudar entre os dois.

O `RollRecord` foi remodelado (`kind`, `label`, `components: {label, value}[]`,
`dice`, `total`, `sourceId`) para que **arma, perícia e atributo usem a mesma
estrutura**. É isso que faz o tooltip e o histórico funcionarem para os três
sem uma linha de código por tipo.

O detalhamento sai de `describeRoll`, e bate com os exemplos do adendo:

```
Furtividade (seca): d20 [14] + perícia (+3) = 17
Furtividade + Destreza: d20 [14] + perícia (+3) + Destreza (+2) = 19
Destreza: d20 [14] + atributo (+2) = 16
```

Parcela zerada é **omitida**: `+ perícia (+0)` fingiria um bônus que existe e é
nulo. E o dado vai entre colchetes (`d20 [14]`) — é a diferença entre "saiu 14"
e "somei 14", que num resultado 17 muda tudo.

### O gerador de dados é INJETADO

`domain/dice.ts` recebe `rng: () => number` como parâmetro. Nenhum teste deste
projeto sorteia de verdade: é o que permite escrever "d20 deu 14" e verificar
a frase exata. A distribuição tem teste — `Math.floor(rng() * faces) + 1`, nunca
`Math.round`, que enviesaria a curva.

### Três entradas, um menu

| Entrada | Gatilho                                      |
| ------- | -------------------------------------------- |
| Mouse   | `contextmenu` (botão direito)                |
| Teclado | `Menu` ou `Shift+F10` com o bloco em foco    |
| Toque   | toque longo de `LONG_PRESS_MS` sem movimento |

Tudo em `useContextMenuTrigger`, o ponto único onde os três convergem —
Perícias e Atributos não reimplementam a mesma aritmética de eventos.

### O toque longo NÃO conflita com o arraste

O `PointerSensor` do dnd-kit usa ativação por **distância**
(`DND_ACTIVATION_DISTANCE_PX`): ele só assume o ponteiro depois de alguns
pixels. Toque longo parado nunca chega lá, então o timer do menu vence.

E o cancelamento usa **a mesma constante**. Se as duas usassem limiares
diferentes, haveria uma faixa de movimento em que o menu abre _e_ o arraste
começa, e o usuário veria os dois ao mesmo tempo. Uma constante, dois
comportamentos, sem faixa morta.

### Por que o botão de teclado é `sr-only`

O gatilho do clique direito é um `<span>` sem papel de widget. Colocar
`role="button"` nele deixaria botões dentro de um botão — HTML inválido, e
leitores de tela ignoram o conteúdo. Então o teclado tem o seu próprio caminho:
um `<button>` real, invisível até receber foco (aí vira visível, para o usuário
saber onde está), com `aria-haspopup="menu"` e nome próprio.

### Por que o gatilho fica no `<li>`, não num filho

`contextmenu` sobe pela árvore. Se o gatilho fosse um filho, um clique direito
na borda direita da linha — fora do conteúdo — miraria o `<li>` e o menu nunca
abriria. Por isso `SlotRow` ganhou `contextMenuProps`.

O menu é **desligado** (e o `preventDefault` **não** é chamado, deixando o menu
nativo do navegador aparecer) quando:

- o lápis do bloco está ligado;
- o Editar Geral está ligado;
- o cartão está sendo arrastado.

### Descoberta

O clique direito não é óbvio. A dica é um tooltip no hover: _"Botão direito (ou
Menu / Shift+F10, ou toque de 0.45s) para rolar"_ — o texto cita os três
caminhos, porque quem está no celular não tem botão direito e ver só
"botão direito" o levaria a concluir que a rolagem não existe no celular.

Um aviso permanente sob cada perícia poluiria a leitura da lista; o tooltip
aparece só quando o usuário está olhando.
---

---

## Bloco de Inventario (Fase 7, secao 8.2)

### Duas abas, uma barra

**Armas** e **Itens**, com a barra de peso e dinheiro **sempre visivel** no
rodape. Ela mostra `total / capacidade` e satura em vermelho quando estoura.

A barra e sempre visivel de proposito: se so aparecesse quando o peso estourasse,
o jogador so a conheceria no pior momento. Sempre a vista, ela ensina a
capacidade antes de ser preciso consulta-la.

### PESO ACIMA DA CAPACIDADE NAO BLOQUEIA (§8.2)

A regra mais importante do bloco: o excesso fica **vermelho** e **nada e
impedido**. Dois motivos:

- o peso muda o tempo todo (o jogador joga, anota, esquece). Bloquear a edicao
  porque a mochila "esta cheia" transformaria o inventario num formulario que
  so aceita um estado — e o usuario passaria a anotar fora do app;
- a capacidade e um numero que o jogador ajusta conforme a ficha. Nao e uma
  verdade do mundo que o app possa arbitrar.

A unica recusa real no bloco inteiro e a venda em massa de favorito — e essa
existe para proteger trabalho do usuario, nao para arbitrar o jogo.

### O PESO VIVE NOS ITENS, E SO NOS ITENS

`Weapon.isItem` significa "esta arma tambem aparece como item" — e a **mesma**
coisa vista de dois angulos. Contar as duas faria o peso dobrar a cada compra
de espada.

Consequencia aceita: apagar o item zera a contribuicao da arma. E o
comportamento certo do ponto de vista da fonte unica da verdade — o peso e o
do objeto que o jogador carrega.

### FAVORITOS: PROTEGIDOS EM MASSA, VENDAVEIS NO INDIVIDUAL

A §8.2 protege o favorito de acoes em massa. Isso **nao** impede a venda de um
favorito especifico: pode ser intencional ("ja usei a Joia"), e o clique no
botao da propria linha e intencao explicita. O que a protecao faz e exigir
**confirmacao extra** nesse caso.

`sellItems` (massa) e `sellSingleItem` (individual) sao funcoes **separadas**,
e nao uma com um `force?: boolean`: os dois tratam o favorito de formas
opostas, e um parametro booleano esconderia essa diferenca do maior ponto de
chamada.

A acao em massa **devolve** a lista do que ficou de fora, para o painel poder
avisar _"Favoritos preservados: Joia"_. Sumir com o favorito em silencio e o
pior modo de "nao vendi o favorito".

### `2d8` E DOIS SORTEIOS, NUNCA O DOBRO

A §8.2.1 proibe que `diceCount` multiplique o valor do dado. A forma mais
honesta de garantir isso e **deixar a conta a mostra**: a linha mostra a
dadica `2d8` e o detalhamento sai `2d8 [5] [3] + Ataque (+3) = 11`. Se o app
escondesse o dado atras de "quantidade: 2", o mesmo numero viraria ambiguo.

O teste que cobre isso verifica os **dois valores sorteados** no registro, e
que o total bate com a soma — nao que "2 dados" renderizam algo.

### ARMA E ITEM SAO COISAS DIFERENTES

Remover a arma da aba Armas **nao** remove o item da aba Itens. O jogador pode
ter guardado a espada como item de colecao, ou ter comprado uma arma e
decidido que nao e arma. Ligar as duas coisas faria uma operacao comum apagar
trabalho sem relacao.

### LIMITAACAO CONHECIDA, NAO ESCONDIDA

`equipWeapon` liga a arma ao item, mas `Item.weaponData` guarda uma **COPIA**,
nao uma referencia viva. Editar a arma depois de equipar e desequipar+equipar
de novo volta ao valor antigo.

A correcao e um `merge` quando o item tem `weaponData` e a arma e mais recente
— o que exige um carimbo de tempo por arma, que o schema atual nao tem. Fica
para a Fase 9 padronizar o modelo; esta registrado aqui e no codigo.

---

---

## Adendo de correcoes (Bugs 2 e 3 + "+" no Editar do bloco)

### Bug 2 — "nao consigo clicar em nada no Editar Geral"

**Causa encontrada: o chanfro decorativo era uma camada de captura de ponteiro.**

`Panel` renderiza, no modo Editar Geral, este elemento:

```tsx
<span aria-hidden="true" className="corner-notch absolute inset-0 z-20" />
```

O conteudo do painel vive num wrapper `z-10`. Com o chanfro em `z-20`, ele
fica **ACIMA do conteudo** — e `.corner-notch` so declarava
`pointer-events: none` nos PSEUDO-elementos (`::before`/`::after`), **nao no
elemento**. Resultado: uma camada do tamanho do painel, com eventos ativos,
por cima de tudo. Todo clique da ficha — botoes, campos, abas, atalhos e ate
o handle de arraste e as alcas de resize — batia no chanfro e morria ali.

As outras quatro causas suspicions do adendo foram verificadas e **nao eram a
causa**:

| Causa suspicions                       | Verificacao                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Listeners do dnd-kit no painel inteiro | Ja era so no handle (`PanelFrame`, cabecalho). O teste `os listeners estao NO HANDLE` fixa isso. |
| Sensores sem constraint                | Ja havia `activationConstraint: { distance: 6 }`.                                                |
| `pointer-events: none` no conteudo     | Nao existe em lugar nenhum.                                                                      |
| Alcas cobrindo o conteudo              | Ficam nas margens (`-left-1`, `-top-1`, etc.), 8 elementos pequenos.                             |

**Correcao:** `pointer-events: none` no proprio `.corner-notch`, e **tambem em
inline** no `<span>`. A duplicacao e deliberada: a invariante deixa de depender
de a folha continuar com aquele nome de classe, e um teste passa a verifica-la
sem carregar o CSS — o jsdom nao faz hit-testing, entao o sintoma so aparecia
no navegador.

### Bug 3 — esconder um bloco e nao ter como trazê-lo de volta

**Causa encontrada: nada lia `visible: false`.** O olho gravava a flag,
`PanelGrid` filtrava os ocultos da renderizacao, e o unico caminho de volta era
"Resetar layout" — que mexe em posicao, tamanho e ordem de **todos** os
blocos. Recuperar um bloco custava o arranjo inteiro da ficha.

**Correcao:** a **bandeja "Painéis"**, na barra do Editar Geral.

- Lista **todos** os blocos, visiveis e ocultos, com o rotulo da **acao**
  ("Esconder bloco Atributos" / "Mostrar bloco Atributos").
- Selo com a quantidade de ocultos no botao. Um olho sem numero nao diz se ha
  algo a recuperar.
- Item oculto sai **esmaecido**, e o icone vira olho riscado.
- Fecha depois do toggle — o bloco acabou de aparecer, e a lista aberta por
  cima esconderia o resultado da acao.
- **Chip fora do modo Editar**: "N blocos ocultos — Mostrar", que liga o modo
  e joga o jogador no lugar certo. So aparece quando ha algo a recuperar.

O bloco volta **exatamente** onde estava: esconder guarda `x`, `y`, `w`, `h` e
`order`. Mas o espaco vira terra de ninguem — o jogador pode ter arrastado
outro bloco para la — entao **mostrar** passa por `resolveCollisions`. Mostrar
e a unica operacao que pode criar colisao; esconder nunca cria, so libera.

**Perfil e Inventário nao podem ser ocultados** (`UNHIDEABLE_PANEL_TYPES`).
Esconder os dois deixaria a ficha sem nome e sem bagagem — e a bandeja e
justamente a funcao que FAZ o usuario esconder coisas. A regra vale em tres
lugares: no botao do olho, no item da bandeja e no filtro de renderizacao.
Um `visible: false` antigo que sobreva de outra versao continua recuperavel
pela bandeja, mas nao aparece no contador.

### Mudanca — os "+" foram para o lapis de cada bloco

Criar atributo, pericia, arma ou item e uma decisao sobre o **conteudo** da
ficha, nao sobre a disposicao na tela. Editar Geral reorganiza; o lapis cria.

| Acao                                               | Onde esta agora |
| -------------------------------------------------- | --------------- |
| Criar (+), cor, excluir                            | Lapis do bloco  |
| Mover, redimensionar                               | Editar Geral    |
| Nome do personagem, capacidade de peso             | Editar Geral    |
| Esconder/mostrar, adicionar blocos, resetar layout | Editar Geral    |

No inventario, o "+" **acompanha a aba visivel**: na aba Armas ele cria arma,
na aba Itens cria item. Um "+" unico que agisse nas duas seria adivinhacao.

### Nota sobre um teste que foi movido de lugar

O teste "preset ja selecionado desliga a cor" falhava na suite completa e
passava isolado — era o 36o teste do arquivo, depois de meia duzia montando o
inventario inteiro com dezenas de botoes e tooltips do MUI. A mecanica foi
verificada 4x isolada e estava correta, entao o teste desceu para
`ColorPicker.test.tsx`, onde o componente e renderizado sozinho. **Mesmo
comportamento, sem a fila** — e e ai que a logica realmente mora.

---

## Fase 9 — Acabamento

Quatro itens, todos eles **prometidos em algum momento anterior** (por isso a
fase não acceptou feature nova): o CSP que o README dizia "antes do deploy", a
limitação do `weaponData` que estava registrada como dívida, a ajuda da
rolagem que o adendo §5 pedia, e a auditoria de acessibilidade.

### 1. CSP estrita com nonce

Ver a seção "CSP estrita" acima. Resumo: `script-src` deixou de ter
`'unsafe-inline'`.

### 2. `equipWeapon` agora RESTAURA de verdade (§8.2)

A §8.2 diz que equipar "restaura dado, quantidade, bônus e atributos". Isso
fixa a direção do fluxo, e ela estava errada na implementação:

> **O `Item.weaponData` é o ARQUIVO; a arma é a CÓPIA DE TRABALHO.**

Guardar uma cópia que ninguém lê não serve para nada, e o gesto que a
especificação descreve — equipar uma espada antiga e ela voltar como estava —
simplesmente não acontecia. `equipWeapon` só ligava o `itemId`.

Agora equipar devolve `die`, `diceCount`, `attackBonus`, `attributeIds`,
`color` e `isItem` do item para a arma.

**Por que sem carimbo de tempo por arma** (a alternativa que foi descartada):
a outra solução seria "a arma sempre vence", e aí o arquivo nunca voltaria —
que é o mesmo defeito com outro nome. Equipar é o pedido explícito de voltar
ao arquivo; a arma continua editável enquanto está equipada, e desequipar +
equipar de novo assume o controle. É assim que o gesto é lido.

Um item **sem** arquivo (comprado na loja, não veio de arma) apenas liga o
vínculo: não sobrescreve a arma que o jogador afiou.

Cinco testes novos em `inventory.test.ts`, incluindo o vetor de
`attributeIds` copiado **por valor** — se compartilhasse a referência, editar a
arma numa aba mexeria no arquivo do item.

### 3. Ajuda da rolagem no Dialog de Configurações

O adendo §5 pedia descoberta da rolagem por clique direito. O tooltip da lista
resolve — **para quem tem mouse**. Quem está no celular não tem botão direito,
e quem usa teclado só descobre se já souber que a tecla existe.

A seção "Ajuda" do Dialog agora cita os três caminhos de entrada (botão
direito, `Menu`/`Shift+F10`, toque longo), o que aparece no resultado, e
**por que o menu não abre em modo Editar**. Ela aparece mesmo sem ficha aberta:
o usuário precisa saber o que o app faz antes de ter o que rolar.

### 4. Auditoria de acessibilidade — dois defeitos reais

O projeto já atendia bem a maior parte: `prefers-reduced-motion` em JS
(`useReducedMotion`) e em CSS, foco visível global, `aria-label` em todos os
controles, `role="status"` nas confirmações. A auditoria encontrou duas
coisas de verdade.

#### 4a. O anúncio do resultado NUNCA era lido

As rolagens tinham um `aria-live="polite"` — **dentro do menu de contexto**. E
o menu é desmontado no mesmo instante da rolagem.

> Uma região `aria-live` só anuncia quando o TEXTO MUDA dentro dela. Um nó que
> sai da árvore junto com o conteúdo não gera anúncio.

O componente estava certo, a região estava errada. Quem usava leitor de tela
ficava em silêncio depois de cada rolagem.

A região foi para o **bloco de resultado**, que permanece: ela já está na
árvore antes da rolagem, e o texto muda depois. Os dois anúncios mortos (nos
menus de atributo e de perícia) foram removidos — mantê-los causaria anúncio
duplo durante a transição de saída do MUI.

**A `key` do filho é o id da rolagem.** Sem ela, rolar 17 duas vezes seguidas
não geraria anúncio nenhum (texto idêntico, DOM inalterado) — e o segundo
resultado silencioso é o pior tipo de falha: a pessoa conclui que o clique não
funcionou. Remontar o filho dentro da região viva é o contorno usado para isso.

**A frase falada não é a frase da tela.** `describeRoll` é notação de RPG
(`d20 [14] + perícia (+3) = 17`) e, lida letra a letra, não diz qual dos
números é o resultado. `announceRoll` inverte a ordem:

```
Furtividade: resultado 17. Cálculo: 14 mais perícia +3.
```

`formatSigned` é reaproveitado, para que a frase falada e a visível não
divirjam em um único caso — o menos. E a conjunção entra sozinha: "20, 4 e 11"
é uma unidade audível; "20, 4, 11" obriga a guardar as três para depois somar.

Três regras que viviam **dentro do componente** subiram para `domain/rolls.ts`
como funções puras: `isCritRoll`, `isFumbleRoll` e `announceRoll`. Duas cópias
da regra divergem na primeira correção feita num lado só.

#### 4b. Faltava o pulador de teclado (WCAG 2.4.1)

A ficha abre com um cabeçalho inteiro antes dos blocos: voltar, título, tema. Quem
navega por teclado precisa atravessar tudo isso a cada visita — e o pior caso é
o oposto: a pessoa desiste depois do quinto `Tab` sem entender que a ficha
inteira está logo abaixo.

`SkipLink` + `.skip-link` resolvem, nas duas telas.

- O alvo tem `tabIndex={-1}`: focável **por programa** (é o que faz o pulador
  funcionar) e **fora** da ordem do `Tab` (senão viraria mais uma parada).
- O alvo existe em **todos** os estados, inclusive carregando e com erro. Um
  alvo que só aparece quando os blocos já carregaram faz o pulador não levar a
  lugar nenhum justamente na hora em que ele mais importa.
- O alvo **não** é o `<main>`: o cabeçalho está dentro dele, então pular para
  ele não pularia nada.

**Os dois `id` moram em `SkipLink.tsx`, não nas telas.** Um pulador quebrado é
o pior tipo de defeito acessível: o link existe, tem o visual certo, e no
clique não acontece nada — sem erro no console e sem nada vermelho na tela. A
causa quase sempre é um caractere que mudou de lado (`lista-conteudo` vs
`lista-conteudo-2`). Declarar os dois nomes no mesmo arquivo e exportá-los tira
essa classe de bug da equação.

O estilo usa `position: fixed` acima da viewport em vez de `left: -9999px`,
porque o navegador **não cria barra de rolagem** para elemento fixo fora da
tela — a técnica do `-9999px` produzia uma barra fantasma.

**O que foi verificado:** os testes do jsdom cobrem o par link↔alvo (o `href`
aponta para um `id` que existe, com `tabIndex="-1"`, dentro do `<main>` e não
igual a ele, presente já no primeiro quadro em estado de carregamento). O
_efeito_ — o foco realmente pulando e o link aparecendo ao receber foco — é CSS
e hit-testing, que o jsdom não faz; ficou para verificação no navegador.

---

## Estado da entrega

| Fase                          | Status       |
| ----------------------------- | ------------ |
| 1. Fundação                   | ✅ concluída |
| 2. Dados e persistência       | ✅ concluída |
| 3. Fichas e sistemas          | ✅ concluída |
| 4. Layout e Editar Geral      | ✅ concluída |
| 5. Perfil + Configurações     | ✅ concluída |
| 6. Atributos e Perícias       | ✅ concluída |
| 7. Inventário                 | ✅ concluída |
| 8. Rolagem (dado + resultado) | ✅ concluída |
| 9. Acabamento                 | ✅ concluída |

**802 testes unitários em 39 arquivos** + **44 testes E2E (Playwright)**.
`npm run check` = typecheck + lint + format + test; `next build` e o servidor de
produção também verificados.

> O número desta seção é da Fase 9. O adendo de auditoria de DnD (aba abaixo)
> adicionou os testes E2E e mais dois unitários — o total atual é **802 em 39
> arquivos**, mais **44 E2E**.

### Dívidas que restam (deixadas de propósito, não esquecidas)

| Dívida                                 | Onde                             | Por quê                                                                                                                                                            |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `style-src` com `'unsafe-inline'`      | `src/proxy.ts`                   | O Emotion injeta `<style>` em runtime e não há cache com nonce. Fecha se o MUI entrar com `AppRouterCacheProvider`.                                                |
| `equipWeapon` sem carimbo de tempo     | `src/domain/inventory.ts`        | Equipar sempre assume o arquivo do item. A alternativa ("a arma sempre vence") nunca devolveria o arquivo — mesmo defeito com outro nome.                          |
| Efeito do pulador não testado no jsdom | `src/components/ui/SkipLink.tsx` | O jsdom não faz hit-testing nem foco real. Os testes cobrem o par link↔alvo; o efeito é CSS.                                                                       |
| `ROLL_HISTORY_LIMIT = 3`               | `src/config/constants.ts`        | Valor da Fase 1. O histórico vive dentro da ficha, que é serializada no `localStorage` — um histórico ilimitado vira `QuotaExceededError` e perde a ficha inteira. |

---

## Adendo de auditoria de DnD, células quadradas, hitbox e movimento livre

> Este adendo trata de três problemas: **(A)** o tamanho mostrado não era o
> tamanho real e a hitbox era maior que o visual; **(B)** o "⠿" dos painéis
> só movia para cima e para baixo, de forma limitada; **(C)** o "⠿" das
> listas (Perícias etc.) não funcionava — sinal de causa comum no projeto
> inteiro.
>
> **Playwright foi instalado e configurado** (`@playwright/test` 1.64.1 +
> Chromium). Todos os bugs abaixo foram **reproduzidos em E2E que falhavam**
> antes da correção. Ver "Testes E2E" adiante.

### 1. Decisão: dnd-kit + `createSnapModifier` (ou não)

**O que a auditoria encontrou no repositório:**

| Pergunta do adendo                            | Resposta                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Os painéis usam `react-grid-layout`, dnd-kit? | **Só dnd-kit.** Zero ocorrências de `react-grid-layout` (nem no `package.json`). |
| `createSnapModifier` está em uso?             | **Sim** — em `PanelGrid.tsx`, com `gridSize = cell.w + GRID_GAP_PX`.             |
| Em qual `DndContext`?                         | O dos painéis (`src/components/layout/PanelGrid.tsx`).                           |
| `useSortable` nos painéis?                    | Não. Os painéis usam `useDraggable` (movimento livre).                           |
| `useDraggable` nas listas?                    | Não. As listas usam `useSortable`.                                               |

**A decisão: manter dnd-kit, e NÃO usar o `createSnapModifier` dele.**

O `createSnapModifier` do `@dnd-kit/modifiers` arredonda com **`Math.ceil`**:

```js
x: Math.ceil(transform.x / gridSize) * gridSize;
```

Isso quebra o arraste em dois sentidos:

1. **Arrastar para a esquerda nunca sai da célula.** `ceil(-1/32)` é `0`, e
   `0 * 32` é `0` — o bloco volta para a borda da célula e fica lá. É
   exatamente o sintoma de "mover só para um lado".
2. **Um pixel de movimento vira um salto de célula.** `ceil(1/32)` é `1`, e
   `1 * 32` são 32 px — o bloco pula a célula inteira com o primeiro pixel.

O adendo §1 exige `Math.round`, e é exatamente isso que o modifier do dnd-kit
**não** faz. Por isso existe `src/lib/cellSnapModifier.ts`, com
`createCellSnapModifier()` — `Math.round`, e um piso de 1 px para não
produzir `NaN`.

**Por que dnd-kit e não `react-grid-layout`:**

- a grade é fluida (48 colunas que se ajustam à largura) e Tailwind-first —
  o `react-grid-layout` trazeria um segundo motor de layout competindo;
- o dnd-kit já entrega sensor de **teclado** (com anúncios ARIA), sensor de
  **toque** e overlay de arraste, sem portal e sem `DragOverlay` próprio;
- `react-grid-layout` aceita min/max **por item**, e o projeto precisa de
  limites **por tipo de bloco** (`PANEL_SIZE_LIMITS`).

**Limite aceito e documentado:** o `createSnapModifier` só cuida do
**movimento visual**. Colisão, compactação, bounds e resize continuam sendo
funções puras em `src/domain/layout.ts` — que é onde o dado é gravado.

### 2. Auditoria completa de DnD (obrigatória)

Todos os usos de DnD do repositório, um por um:

| #   | Arquivo                                 | Contexto                 | Tipo   | Modifiers                             | Sensores                       | Estratégia                    | Handle                    | Status  | Correção                                                                                   |
| --- | --------------------------------------- | ------------------------ | ------ | ------------------------------------- | ------------------------------ | ----------------------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| 1   | `layout/PanelGrid.tsx`                  | Painéis (grade)          | Painel | `createCellSnapModifier` (Math.round) | Pointer (dist. 6px) + Keyboard | `rectIntersection`            | `PanelDragHandle` (28×28) | **BUG** | `restrictToParentElement` removido; `createSnapModifier` (ceil) trocado pelo nosso (round) |
| 2   | `layout/PanelFrame.tsx`                 | `useDraggable` do painel | Painel | (herda do #1)                         | (herda)                        | (herda)                       | `PanelDragHandle`         | **BUG** | o nó não era o alvo do `restrictToParentElement`; snapping corrigido no #1                 |
| 3   | `panels/skills/SkillsPanel.tsx`         | Lista de Perícias        | Lista  | `restrictToParentElement`             | Pointer + Keyboard             | `rectSortingStrategy`         | `GripHandle` (32×32)      | **BUG** | handle tied to Editar Geral; nó sortable era um `<span>` interno (prendia o item)          |
| 4   | `panels/skills/SkillCard.tsx`           | Item de Perícia          | Lista  | (herda do #3)                         | (herda)                        | (herda)                       | `GripHandle`              | **BUG** | `setNodeRef` movido para o `<li>` (via `SlotRow`); handle virou `GripHandle`               |
| 5   | `panels/attributes/AttributesPanel.tsx` | Lista de Atributos       | Lista  | `restrictToParentElement`             | Pointer + Keyboard             | `rectSortingStrategy`         | `GripHandle` (32×32)      | **BUG** | handle tied to Editar Geral (não ao lápis do bloco)                                        |
| 6   | `panels/attributes/AttributeCard.tsx`   | Item de Atributo         | Lista  | (herda do #5)                         | (herda)                        | (herda)                       | `GripHandle`              | OK      | —                                                                                          |
| 7   | `panels/inventory/InventoryPanel.tsx`   | Lista de Armas/Itens     | Lista  | `restrictToParentElement`             | Pointer + Keyboard             | `verticalListSortingStrategy` | `GripHandle` (32×32)      | **BUG** | handle tied to Editar Geral; nó sortable interno                                           |
| 8   | `panels/inventory/WeaponRow.tsx`        | Item de Arma             | Lista  | (herda do #7)                         | (herda)                        | (herda)                       | `GripHandle`              | **BUG** | `setNodeRef` movido para o `<li>`                                                          |
| 9   | `panels/inventory/ItemRow.tsx`          | Item de Item             | Lista  | (herda do #7)                         | (herda)                        | (herda)                       | `GripHandle`              | **BUG** | `setNodeRef` movido para o `<li>`                                                          |
| 10  | `panels/list/ListPanel.tsx`             | Bloco de lista           | Lista  | `restrictToParentElement`             | Pointer + Keyboard             | `verticalListSortingStrategy` | `GripHandle` (32×32)      | **BUG** | o nó era um `<span className="contents">` — `getBoundingClientRect()` dava 0×0             |
| 11  | `ui/SlotRow.tsx`                        | Linha compartilhada      | Lista  | —                                     | —                              | —                             | `nodeRef` + `dragStyle`   | **BUG** | **Correção na raiz**: o componente passou a receber o nó sortable                          |

**Totais:** 5 contextos de DnD (1 de painéis + 4 de listas), 0 `useDroppable`,
0 `DragOverlay`, 0 `react-grid-layout`, 0 glifo Braille `U+283F` no código
(o ícone já era SVG), 0 `restrictToVerticalAxis`, 0 `preventCollision`.

### 3. A causa raiz comum

**O "⠿" não funcionava em lugar nenhum porque o NÓ ARRASTÁVEL não era o item
da lista.**

Em quatro das cinco listas, o `setNodeRef` do `useSortable` ficava num
`<span>` **interno** à linha. O `restrictToParentElement` — o modifier das
listas — restringe o arraste ao pai **imediato** do nó arrastável. Com o nó
dentro da linha, esse pai era a própria LINHA: o item estava preso dentro de si
mesmo, e não havia para onde ir.

No bloco de lista era pior: o wrapper era um `<span className="contents">`, e
`display: contents` faz o `getBoundingClientRect()` devolver **0×0** — o
dnd-kit media um item de tamanho zero para calcular o destino.

**A correção foi no componente compartilhado** (`SlotRow`), e não em cinco
telas: o `<li>` — que é o filho direto do container da lista — passou a ser
o nó do dnd-kit. Com isso, o `restrictToParentElement` restringe ao
CONTAINER DA LISTA (que é o limite correto) e a medição passa a ser a da
linha real.

### 4. Células quadradas e a estratégia de layout

**O grid é quadrado porque `cell.h = cell.w`.**

```ts
const usable = containerWidth - gap * (columns - 1);
const side = Math.max(1, usable / columns);
return { w: side, h: side };
```

A escolha foi "largura da coluna calculada, altura da linha **igual** à
largura" — e não `GRID_CELL_PX` fixo com colunas variáveis. O motivo: com
`GRID_CELL_PX` fixo, o número de colunas varia com a janela, e o layout
salvo (em células) deixaria de caber.

**Como o layout salvo fica estável quando a janela muda:**

- a fonte da verdade são **CÉLULAS**, não pixels — `x`, `y`, `w`, `h`
  são inteiros;
- a conversão px ↔ células acontece só na fronteira (render e eventos);
- a conversão de px para célula é `Math.max(0, Math.round(px / pitch))`, com
  `pitch = cell + GAP`;
- `normalizeLayout` roda **na carga** da ficha: inteiro, dentro dos limites
  do tipo, e sem sobreposição. É a barreira que garante que nenhum bloco
  fique sobreposto nem fora da área depois de importar, migrar ou estreitar
  a janela.

**Conversão célula → px:** `w * CELL + (w - 1) * GAP` — o gap entra **entre**
as células, nunca depois de cada uma.

### 5. Hitbox igual ao visual

Quatro correções, todas no mesmo lugar:

| Sintoma                                 | Causa                                                                                                        | Correção                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| O bloco pintava fora da grade           | a raiz da moldura era `flex-1` dentro de um pai que **não é flex** — então a altura era a do **conteúdo**    | `h-full` na raiz; o `Panel` (`section`) tem `flex-1 min-h-0 overflow-hidden` e corta o conteúdo |
| A área clicável era maior que o desenho | as alças eram posicionadas 4px **fora** da borda (`-right-1`) e o `before:-inset-2` estendia o alvo mais 8px | alças com `inset 0` (12px na borda, 16px no canto) e **sem** pseudo-elemento                    |
| O indicador mentia                      | era calculado a partir do **estado** (células), não do elemento real                                         | `useMeasuredSize` mede o `getBoundingClientRect()` do nó real                                   |
| "12×12" retangular                      | células com largura ≠ altura                                                                                 | `cell.h = cell.w`                                                                               |

**O indicador de tamanho** agora mostra `192px × 192px (12 × 12)`: os pixels
vêm da **medição** (e batem com o bounding box dentro de 1px), e as células
dizem onde o bloco está na grade.

### 6. Movimento livre nos dois eixos

**Duas causas, ambas no `DndContext` dos painéis:**

1. `restrictToParentElement` — restringia o arraste ao pai imediato do nó
   arrastável, que é o **próprio wrapper do painel**, do mesmo tamanho dele.
   O resultado: `x` e `y` travados em zero.
2. `createSnapModifier` (do dnd-kit) — arredonda com `Math.ceil`, então
   arrastar para a esquerda nunca saía da célula.

**A correção:** o `restrictToParentElement` saiu; o snap é o nosso
(`Math.round`); e os limites são garantidos pelos **LIMITES DO GRID**,
aplicados pela função pura `clampPosition` no `onDragEnd` — que é onde o
dado é gravado.

**Duas correções a mais no motor de layout** (`src/domain/layout.ts`):

- `resolveCollisions` usava o gap em **pixels** (12) onde cabia **1 célula**:
  o bloco empurrado saltava 12 linhas para baixo, sumindo da vista;
- `resolveCollisions` devolvia o array **ordenado** por `(y, x, order)`,
  embaralhando a ordem de leitura gravada. Agora a resolução é feita sobre
  uma cópia ordenada, e o resultado sai na **ordem original**.

### 7. Componentes reutilizáveis

| Componente               | Onde vive            | Papel                                                                          |
| ------------------------ | -------------------- | ------------------------------------------------------------------------------ |
| `PanelDragHandle`        | `components/layout/` | Handle de arraste do PAINEL (28×28, `touch-action: none`, `user-select: none`) |
| `GripHandle`             | `components/ui/`     | Handle de arraste de LISTA (32×32, SVG de 6 pontos, `touch-action: none`)      |
| `SlotRow`                | `components/ui/`     | Linha compartilhada — agora carrega o nó sortable (`nodeRef` + `dragStyle`)    |
| `createCellSnapModifier` | `lib/`               | Modifier de snap em células, com `Math.round`                                  |
| `useMeasuredSize`        | `hooks/`             | Medição real do elemento (`getBoundingClientRect` + `ResizeObserver`)          |

### 8. As duas portas de edição (a "causa comum" do handle)

| Porta              | Move o quê             | Handle aparece?   |
| ------------------ | ---------------------- | ----------------- |
| **Editar Geral**   | o **PAINEL** (a grade) | `PanelDragHandle` |
| **Lápis do bloco** | a **LISTA** do bloco   | `GripHandle`      |

Antes, o handle de lista usava `context.editMode` (Editar Geral) — a mesma
flag que controla o arraste do painel. Agora cada lista usa o **lápis do
próprio bloco**, e o Editar Geral não reordena nada dentro das listas.

### 9. Testes E2E (Playwright)

**Por que E2E e não só jsdom:** três dos bugs são **invisíveis** no jsdom —
ele não calcula layout (`getBoundingClientRect()` devolve zeros), não
responde `elementFromPoint` e não dá destino de arraste.

```bash
npm run e2e          # roda a suíte
npm run e2e:ui       # modo interativo
npm run e2e:report   # abre o relatório HTML
```

**O fixture vem do código real.** `src/test-e2e/fixture.spec.ts` gera
`e2e/fixtures/sheet.json` com o `createSheet` do app — se o formato mudar, o
fixture é regenerado. Um JSON copiado no repositório envelheceria em silêncio.

**Arquivos:**

| Arquivo              | O que cobre                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `e2e/layout.spec.ts` | medidas, hitbox, arraste diagonal, bounds, deriva, ordem do arquivo |
| `e2e/lists.spec.ts`  | as cinco listas reordenando, persistência, e o resize por alça      |
| `e2e/helpers.ts`     | semeadura do `localStorage`, medição, arraste com passos            |

**As capturas de tela do "antes" e do "depois":**

| Arquivo                                             | O que mostra                                                                                                                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `e2e/screenshots-antes/A-grade-editar-geral.png`    | **ANTES.** Perfil `375px × 409px (12 × 12)` (não quadrado), Inventário `762px × 282px (24 × 24)` (células retangulares), alças penduradas **fora** da borda, handle de lista na **porta errada** |
| `e2e/screenshots/A-grade-editar-geral.png`          | **DEPOIS.** Perfil `375px × 375px (12 × 12)` — quadrado; alças **dentro**                                                                                                                        |
| `e2e/screenshots-antes/C1-*.png` / `C2-*.png`       | handle de lista no Editar Geral (errado) e no lápis do bloco (certo)                                                                                                                             |
| `e2e/screenshots/A-perfil-indicador-de-tamanho.png` | o Perfil no Editar Geral, com o indicador medido                                                                                                                                                 |
| `e2e/screenshots/B-bloco-movido-na-diagonal.png`    | o bloco depois do arraste diagonal                                                                                                                                                               |

O `trace` do Playwright (cada evento de mouse, o DOM em cada passo e o
screenshot do momento exato) fica em `test-results/`, e é o que reproduz um
gesto de arraste passo a passo.

**Como reproduzir o "antes":** `scripts/before.js` reverte as correções deste
adendo (células retangulares, snap com `Math.ceil`, `restrictToParentElement`,
handle na porta errada, nó sortable interno), e `scripts/after.js` as
reaplica. As capturas de antes e depois saem do mesmo código de teste.

```bash
node scripts/before.js revert                     # volta ao estado COM os bugs
E2E_SHOT_DIR=e2e/screenshots-antes npx playwright test e2e/screenshots.spec.ts
node scripts/after.js                             # volta ao estado corrigido
```

**Armadilhas que os helpers resolvem** (todas custaram um teste até serem
descobertas):

- o `devices["Desktop Chrome"]` do projeto **sobrescreve** o viewport do
  topo — o bloco testado ficava fora da janela, e o `elementFromPoint`
  devolvia `null`;
- a gravação é **debounced** (400ms): ler o `localStorage` logo depois do
  arraste lê o estado **anterior**. O helper espera por **condição**, não por
  tempo fixo;
- o `addInitScript` roda em **toda** navegação — um `reload()` ressemeava o
  fixture e apagava a ordem salva. A semente só entra se a chave não existir;
- o `device` do projeto precisa de `scrollIntoViewIfNeeded()` antes do
  arraste.

### 10. Bug extra encontrado: encoding corrompido

O `src/components/panels/list/ListPanel.tsx` estava com **UTF-8 lido como
Windows-1252**: o botão dizia, na tela, `Concluir ediÃ§Ã£o do bloco`. Nada
no jsdom denuncia isso — o `aria-label` é uma string qualquer para o DOM.
Só o E2E, procurando o botão pelo nome acessível, denunciou.

Corrigido, e **rede de segurança** adicionada:
`src/test-e2e/encoding.spec.ts` varre os arquivos do projeto e falha se
qualquer texto estiver corrompido.

### 11. O que este adendo mudou nos testes

- `AttributesPanel.test.tsx`: dois testes que fixavam o handle no **Editar
  Geral** passaram a fixá-lo no **lápis do bloco** (o comportamento pedido);
- `ResizeHandles.test.tsx`: o teste que exigia `before:-inset-2` foi
  invertido — agora trava que a alça **não** ultrapassa a borda;
- `layout.test.ts`: `resolveCollisions` deixou de reordenar o array, e
  ganhou um teste que exige o empurrão em **células** (e não em pixels);
- `src/test-e2e/encoding.spec.ts` e `src/test-e2e/fixture.spec.ts`: novos.
