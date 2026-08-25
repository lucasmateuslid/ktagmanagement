# Monitora 360 Design System

Este documento é a referência de produto e implementação da interface do Monitora 360. O sistema foi extraído dos padrões recorrentes da aplicação e deve orientar telas novas e refatorações.

## Princípios visuais

- **Tático, direto e legível:** títulos compactos, micro-labels em caixa alta e hierarquia forte.
- **Carbono + âmbar:** superfícies neutras em zinc e o âmbar como acento de ação e marca.
- **Geometria de assinatura:** controles com raio de 6 px, seções com 12–16 px e cards de KPI com 32 px.
- **Semântica antes da paleta:** prefira tokens como `--accent`, `--fg-1` e `--bg-surface` a cores cruas.
- **Mobile first:** componentes devem funcionar a partir de 320 px, com ações reorganizadas e navegação inferior quando aplicável.
- **Whitelabel seguro:** a cor de marca pode mudar por tenant; estados de sucesso, alerta e erro não mudam.

## Fontes de verdade

| Camada | Local | Responsabilidade |
| --- | --- | --- |
| Tokens e padrões CSS | `index.css` | Cor, tema, espaço, raio, sombra, tipografia e classes `.m-*` |
| Integração Tailwind | `tailwind.config.js` | Nomes semânticos, fontes, animações e escala de z-index |
| Componentes React | `components/ui/` | Primitivos acessíveis e composições reutilizáveis |
| Tema | `contexts/ThemeContext.tsx` | Alternância light/dark via classe no elemento raiz |
| Whitelabel | `components/WhitelabelStyles.tsx` | Sobrescrita validada da identidade do tenant |

O app publicado vive em `packages/web/`; os arquivos equivalentes na raiz são mantidos como espelho legado. Mudanças de UI devem ser aplicadas aos dois locais enquanto essa duplicação existir.

## Cores

### Acento de marca

A escala primária vai de `--m360-primary-50` a `--m360-primary-950`. O acento padrão é `#f59e0b` (`primary-500`). No produto, use:

| Token | Uso |
| --- | --- |
| `--accent` / `bg-accent` | CTA, seleção e destaque de marca |
| `--accent-hover` / `bg-accent-hover` | Hover de elementos de ação |
| `--accent-soft` | Fundo sutil de destaque |
| `--accent-ring` | Foco e seleção |
| `--fg-on-accent` | Conteúdo sobre o acento |

Não use âmbar para representar atenção quando a mesma tela também o usa como ação de marca sem um segundo indicador textual ou icônico.

### Superfícies e conteúdo

| Token | Uso |
| --- | --- |
| `--bg-app` | Fundo geral da aplicação |
| `--bg-surface` | Cards, painéis e formulários |
| `--bg-surface-2` | Área rebaixada ou agrupamento secundário |
| `--bg-elevated` | Modal, popover e conteúdo elevado |
| `--fg-1` | Título e conteúdo principal |
| `--fg-2` | Texto secundário |
| `--fg-3` | Metadado e conteúdo discreto |
| `--border-1` | Divisor e borda padrão |
| `--border-2` | Separação de baixo contraste |

### Estados

| Estado | Token | Cor base |
| --- | --- | --- |
| Sucesso | `--success` / `text-success` | Emerald 500 |
| Atenção | `--warning` / `text-warning` | Amber 500 |
| Erro | `--danger` / `text-danger` | Red 500 |
| Informação | `--info` / `text-info` | Blue 500 |

Sempre combine cor com texto, ícone ou forma. Cor sozinha não deve carregar significado.

## Tipografia

- **Display:** Manrope 800, usada em títulos e números de destaque.
- **Interface:** Inter, usada em conteúdo, controles e labels.
- **Dados técnicos:** stack monoespaçada do sistema.
- **Eyebrow:** 10 px, peso 900, caixa alta, tracking `0.30em`.

Classes disponíveis: `m-display-xl`, `m-display-lg`, `m-display-md`, `m-h1`, `m-h2`, `m-h3`, `m-eyebrow` e `m-tag`.

Use sentence case em textos corridos. Reserve caixa alta para títulos curtos, navegação, badges e labels de caráter tático.

## Espaçamento, raio e sombra

A escala de espaçamento usa base de 4 px: `--space-1` (4), `--space-2` (8), `--space-3` (12), `--space-4` (16), `--space-5` (20), `--space-6` (24), `--space-8` (32), `--space-10` (40) e `--space-12` (48).

| Raio | Valor | Uso principal |
| --- | ---: | --- |
| `--radius-sm` | 6 px | Botões e inputs |
| `--radius-md` | 12 px | Navegação, tiles e toasts |
| `--radius-lg` | 16 px | Cards secundários e modais |
| `--radius-xl` | 24 px | Cards de acesso rápido |
| `--radius-2xl` | 32 px | KPI cards de assinatura |
| `--radius-pill` | 9999 px | Badges e status |

Sombras vão de `--shadow-sm` a `--shadow-2xl`. Use elevação apenas quando ela comunicar sobreposição; cards comuns usam borda e `--shadow-sm`.

## Componentes

Importe componentes novos pelo ponto único:

```tsx
import { Button, Field, Input, KpiCard, PageContainer } from '@/components/ui';
```

> O alias `@` depende da configuração do consumidor. Sem alias, use o caminho relativo para `components/ui`.

### Fundação

- `Button`: ações default, destructive, outline, secondary, ghost e link; tamanhos sm, default, lg e icon.
- `Input`, `Select`, `Checkbox`, `CurrencyInput` e `Field`: entrada e composição de formulário.
- `Badge`, `ProgressBar`, `UsageBadge`, `Skeleton`: feedback, estado e carregamento.
- `Eyebrow`, `SectionHeader`, `IconTile`, `KpiCard`, `StatusDot`: linguagem visual de assinatura.

### Estrutura e navegação

- `PageContainer`, `PageHeader`, `StatsGrid`: esqueleto responsivo de página.
- `Tabs`, `BottomNav`: navegação local e mobile.
- `Modal`, `ResponsiveModal`, `BottomSheet`, `ConfirmStrongModal`: conteúdo elevado e confirmação.
- `BasicDataTable`, `ResponsiveTable`: dados tabulares com adaptação de viewport.
- `DropdownMenu`: ações contextuais.

## Padrões de composição

### Página interna

```tsx
<PageContainer>
  <PageHeader title="Rastreadores" subtitle="Gestão da frota" actions={<Button>Novo</Button>} />
  <StatsGrid>
    <KpiCard>{/* métrica */}</KpiCard>
  </StatsGrid>
</PageContainer>
```

### Formulário

```tsx
<Field label="Nome" required>
  <Input name="name" autoComplete="name" />
</Field>
```

- Labels ficam associados ao controle.
- Erros aparecem junto ao campo e também são anunciáveis por tecnologia assistiva.
- A ação principal fica à direita em desktop e ocupa largura útil em mobile quando necessário.
- Confirmação forte é reservada a operações irreversíveis ou de alto impacto.

## Tema e whitelabel

Light é o tema inicial quando não há preferência salva; dark é aplicado com `.dark` no elemento `html`. Componentes devem usar tokens semânticos ou pares `light/dark`, nunca assumir fundo preto.

`WhitelabelStyles` define `--theme-primary`, que alimenta `--accent`. Ao adicionar um componente:

1. Use `bg-accent`, `text-accent` ou `var(--accent)` para identidade.
2. Preserve `success`, `warning`, `danger` e `info` para estados funcionais.
3. Garanta contraste do texto sobre a cor configurável.
4. Não injete valores de configuração diretamente em CSS sem validação.

## Acessibilidade e movimento

- Todo controle interativo precisa de nome acessível e foco visível.
- Alvos de toque devem ter aproximadamente 44 × 44 px sempre que possível.
- Texto normal deve buscar contraste WCAG AA (4.5:1); texto grande, 3:1.
- Modais prendem o foco, fecham com Escape quando seguro e devolvem o foco ao gatilho.
- Respeite `prefers-reduced-motion`; animação não pode ser necessária para compreender estado.
- Use a escala semântica de z-index do Tailwind (`dropdown`, `sticky`, `header`, `drawer`, `overlay`, `modal`, `popover`, `confirm`, `toast`, `critical`).

## Checklist de contribuição

- Reutilizei um componente de `components/ui` antes de criar outro?
- Usei tokens semânticos e testei light, dark e cor whitelabel?
- Verifiquei 320 px, tablet e desktop?
- Estados loading, vazio, erro, disabled, hover e focus estão cobertos?
- O fluxo funciona por teclado e não depende apenas de cor?
- Evitei valores arbitrários quando já existe token equivalente?

