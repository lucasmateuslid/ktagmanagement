# K-TAG Manager — Guia do Design System (Monitora 360)

Fonte de verdade visual: projeto **Monitora 360** no claude.ai/design (`README.md`, `SKILL.md`, `colors_and_type.css`, `ui_kits/manager-console/`). Já está implementado no repo:

| Camada | Local |
|---|---|
| Tokens CSS e classes `.m-*` | `packages/web/index.css` (§ "MONITORA 360 — TOKENS SEMÂNTICOS") |
| Integração Tailwind | `packages/web/tailwind.config.js` |
| Primitivos React | `packages/web/components/ui/` (importe de `components/ui`) |
| Referência detalhada | `DESIGN_SYSTEM.md` |

O app publicado é `packages/web/`. A raiz (`App.tsx`, `pages/`, `components/`) é espelho legado — não edite lá, salvo pedido explícito.
Aplica-se ao tenant (dark default) e ao painel admin (light default).

## Identidade

Console "mission control": carbono (zinc) + **um único acento âmbar** `#f59e0b`, denso, tático, PT-BR. Ícones **somente Lucide**. **Sem emoji** na UI. Fontes: Inter (UI), Manrope (display/KPI), monospace do sistema (placas, IDs, timestamps).

Regra de assinatura: toda tela tem ao menos um **eyebrow** (micro-label 10px / 900 / `0.3em` / UPPERCASE) e títulos de seção com a **barra âmbar 4×16** (`<SectionHeader>`).

## Tokens (use os semânticos, nunca cores cruas)

- **Acento:** `bg-accent`, `bg-accent-hover`, `text-accent`, `text-fg-on-accent` (sólido). Tint/borda com opacidade: `bg-primary-500/10`, `border-primary-500/30`, `ring-primary-500/30` (`accent/10` **não funciona**: `var()` não aceita modificador de opacidade). `primary-*` é interceptado pelo whitelabel (`--theme-primary`). **Nunca** `amber-*`.
- **Superfícies:** `bg-app` (fundo da página), `bg-surface` (cards/painéis/formulários), `bg-surface-2` (rebaixado: inputs, hover, tabela-cabeçalho).
- **Texto:** `text-fg-1` (principal), `text-fg-2` (secundário), `text-fg-3` (dica/placeholder).
- **Bordas:** `border-line` (padrão), `border-line-2` (baixo contraste). Divisores: `divide-line`.
- **Estado:** `text-success|warning|danger|info`, `bg-success|danger…` (sólido). Tints: `bg-emerald-500/10`, `bg-red-500/10`… ou `<Badge tone>`/`.m-pill--*`.
- **Raios:** `rounded-md` 6 (botões/inputs) · `rounded-xl` 12 (nav, icon tile, toast) · `rounded-2xl` 16 (cards secundários, seções de formulário, modais) · `rounded-card` 24 (quick cards) · `rounded-card-lg` 32 (**KPI card**, assinatura) · `rounded-pill`/`rounded-full` (pills).
- **Tipografia:** `text-2xs` (10px micro-label), `text-label-xs` (10/0.3em/900), `text-label-sm`, `text-label`, `text-caption` (12px); display: `font-display font-black tracking-tight`. Classes prontas: `.m-eyebrow`, `.m-display-*`, `.m-h1…h3`, `.m-tag`.
- **Z-index:** `z-dropdown`, `z-sticky`, `z-header`, `z-drawer`, `z-overlay`, `z-modal`, `z-popover`, `z-confirm`, `z-toast`, `z-critical`.
- **Sombra:** `shadow-sm` repouso; `shadow-2xl` flutuantes; `shadow-glow-amber` no CTA de marca.

## Primitivos (usar SEMPRE em vez do HTML cru)

| Em vez de | Use |
|---|---|
| `<button class="bg-amber-500 …">` | `<Button>` (primary por padrão) · `variant="outline|secondary|ghost|danger|link"` |
| `<input class="bg-zinc-800 …">` | `<Input/>` (aceita `leadingIcon`) ou `<Field label error hint><Input/></Field>` |
| CPF / telefone | `BrazilianDocumentInput` / `BrazilianPhoneInput` com `className={inputClassName}` |
| `<select>` / dropdown caseiro | `<Select>` (curto) · `<Combobox>` (pesquisável, listas grandes) |
| Alternância 2–4 opções | `<SegmentedControl>` |
| Checkbox próprio | `<Checkbox checked onChange>` |
| Badges | `<Badge tone="accent|emerald|red|blue|neutral">` |
| Lista vazia | `<EmptyState icon title description action>` |
| Loading | `<Skeleton>` (nunca "Carregando…" solto) |
| Cabeçalho de página | `<PageContainer>` + `<PageHeader title subtitle icon actions>` |
| KPI | `<KpiCard>` + `.m-eyebrow` |
| Seção / par rótulo-valor | `<SectionHeader>` · `<Detail label value>` |
| Cadastro / edição | `<FormPage eyebrow backLabel>` + `<FormSection>` (2 colunas no xl) + `<StickyFormFooter>`; id inexistente → `<NotFoundState>` |
| Ficha (detalhe) | `<RecordHeader backLabel eyebrow title subtitle badges actions>` + `<InfoCard title icon>` com `<DetailGrid><Detail/></DetailGrid>`; grade `lg:grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)]` |

## Cadastro e edição = páginas dedicadas, não modais

Formulários de cadastro/edição vivem em rota própria (`/clients/new`, `/clients/:id/edit`, `/vehicles/new`, `/vehicles/:id/edit`) com `FormPage`, erros **inline** via `<Field error>` (nunca `return` silencioso), rodapé fixo Cancelar/Salvar, estado `isSaving` anti-duplo-clique e `NotFoundState` para id inválido. Modal só para **confirmação destrutiva** (`ConfirmModal`, `ConfirmStrongModal`) e relatórios somente-leitura; nesses use `<Modal>` (`components/ui/modal`), nunca `fixed inset-0` ad-hoc. Lógica pura de validação fica em `utils/*Form.ts` com teste.

## Charts (Recharts)

Sem hex no `contentStyle` do Tooltip:

```ts
import { getChartTheme, getChartPalette, getTooltipStyle, getTooltipItemStyle } from '../lib/chartTheme';
// <Tooltip contentStyle={getTooltipStyle()} itemStyle={getTooltipItemStyle()}/>
```

## Regras proibidas (ESLint avisa — `.eslintrc.cjs`)

1. `text-[Npx]` — use `text-2xs`, `text-label-*`, `text-caption` ou a escala Tailwind.
2. `rounded-[Npx]` — use `rounded-card`, `rounded-card-lg`, `rounded-pill` ou a escala.
3. `bg|text|border-amber-*` — use `accent` (sólido) ou `primary-*` (tint).
4. `z-[N]` — use os tokens.
5. Hex/`zinc-*` crus para tema (`bg-zinc-900 dark:bg-white…`) — use `bg-surface`, `text-fg-*`, `border-line`. Classes inexistentes (`brand-*`, `surface-raised`, `content-*`) **não geram CSS**: não use.
6. Novos `!important` (os de `index.css` são para libs externas: Google Places, autofill Chrome, iOS zoom).

## A11y obrigatório

- `focus-visible:` em vez de `focus:`; nunca `outline-none` sem anel substituto.
- Alvos clicáveis ≥ 40px (`h-10`/`w-10`); evite `h-8` e `p-1.5` em botões. Botão só com ícone → `aria-label`.
- Todo campo com `<label htmlFor>`/`<Field>`; sem label visível → `aria-label`.
- Linhas de lista clicáveis são `<button>`/`<a>` reais (nada de `onDoubleClick` em `div`).
- Sem `autoFocus`; gerencie foco com ref quando necessário.
- Press state: botões encolhem `scale(.96)` no `:active` (já no `Button`).

## Tema

`ThemeContext` alterna a classe `dark` em `<html>`. O painel admin tem light-default via `useAdminTheme()` ([hooks/useAdminTheme.ts](packages/web/hooks/useAdminTheme.ts)): seta `data-theme="light"` em `<html>` e `.admin-light` em `<body>` (overrides legados em `index.css` para classes hardcoded — dívida técnica em migração). Páginas admin **novas** usam tokens semânticos, nunca classes legacy.

## Scripts (`packages/web`)

- `npm run dev` — server local
- `npm run build` — build de produção
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest
- `npm run lint` / `npm run lint:fix` — ESLint (warn-first, não trava CI)
