# K-TAG Manager — Guia do Design System

Estas regras se aplicam ao tenant (dark default) e ao painel admin (light default).
Quem está construindo UI **deve** seguir essas convenções.

## Tokens

Tudo no `tailwind.config.js`. Resumo:

- **Brand:** `brand-50…900` (whitelabel via CSS vars `--brand-*`). Use `bg-brand-500`, **NUNCA** `bg-amber-500` (ESLint avisa).
- **Surfaces:** `bg-surface` (fundo de página), `bg-surface-raised` (cards), `bg-surface-sunken` (inputs/code), `bg-surface-overlay` (hover).
- **Texto:** `text-content`, `text-content-soft`, `text-content-muted`, `text-content-subtle`, `text-content-inverse`.
- **Bordas:** `border-border`, `border-border-strong`.
- **Estado:** `success`, `warning`, `danger`, `info` — cada um com `text-*`, `bg-*`, `bg-*-soft`, `border-*`.
- **Tipografia:** `text-label-xs` (10/0.2em/800), `text-label-sm` (11/0.16em/800), `text-label` (12/0.12em/700), `text-caption` (12).
- **Radius:** `rounded-card` (24px), `rounded-card-lg` (32px), `rounded-pill`. Os Tailwind defaults (`md/lg/xl/2xl`) seguem válidos.
- **Z-index:** `z-dropdown`, `z-sticky`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`.

## Primitivos (usar SEMPRE em vez do HTML cru)

| Em vez de | Use |
|---|---|
| `<button class="bg-amber-500 ...">` | `<Button variant="primary">` (de `components/ui/button`) |
| `<input class="bg-zinc-800 ...">` | `<Input/>` ou `<Field label>…<Input/></Field>` |
| `<select>` | `<Select>` de `components/ui/select` |
| Modal ad-hoc com `fixed inset-0` | `<Modal open onOpenChange title>` (de `components/ui/modal`) |
| Checkbox próprio | `<Checkbox checked onChange>` (Radix) |
| Badges | `<Badge tone="amber" variant="soft">` |

## Charts (Recharts)

Não use hex no `contentStyle` do Tooltip. Importe:

```ts
import { getChartTheme, getChartPalette, getTooltipStyle, getTooltipItemStyle } from '../lib/chartTheme';
```

E aplique `<Tooltip contentStyle={getTooltipStyle()} itemStyle={getTooltipItemStyle()}/>`. Isso respeita whitelabel.

## Regras proibidas (ESLint avisa)

1. `text-[Npx]` — use a escala (`text-xs`, `text-label-xs`, `text-caption`).
2. `rounded-[Npx]` — use `rounded-card`/`rounded-card-lg`/`rounded-pill` ou Tailwind default.
3. `bg-amber-*`, `text-amber-*`, `border-amber-*` etc — use `brand-*`.
4. `z-[N]` — use os tokens (`z-modal`, etc).
5. Novos `!important` — os existentes em `index.css` são para libs externas (Google Places, autofill Chrome, iOS zoom fix).

## A11y obrigatório

- `focus-visible:` em vez de `focus:` para anel de foco.
- Touch targets ≥ 40px (`h-10`). Evite `h-8` em alvos clicáveis.
- Inputs sem label visível **precisam** de `aria-label` ou `placeholder` + `<Field>`.
- Modais devem usar o componente `<Modal>` (já tem `role=dialog`, `aria-modal`, focus trap, esc).

## Tema admin

O painel admin tem light-default via `useAdminTheme()` ([hooks/useAdminTheme.ts](hooks/useAdminTheme.ts)). Esse hook:

1. Seta `data-theme="light"` em `<html>` — ativa as CSS vars novas (`--surface`, `--content`...) em modo claro.
2. Seta `.admin-light` em `<body>` — ativa overrides legados em `index.css` para classes Tailwind hardcoded ainda presentes nas pages admin (`bg-zinc-900`, `text-white`, etc.). **Esses overrides são dívida técnica em migração.**

Páginas admin **novas** devem usar tokens semânticos (`bg-surface-raised`, `text-content`), não classes legacy. Quando todas migrarem, o bloco `.admin-light` em `index.css` será deletado.

## Scripts

- `npm run dev` — server local
- `npm run build` — build de produção
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (warn-first, não trava CI)
- `npm run lint:fix` — auto-fix
