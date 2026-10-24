# Landing comercial Monitora 360

A página pública usa o design system existente (Manrope/Inter, carbono, âmbar, tokens e componentes de formulário) e é exibida no domínio raiz. Para desenvolvimento, abra `/landing` no Vite: `http://127.0.0.1:3005/landing`.

## Conteúdo

A proposta central é ajudar empresas de rastreamento e proteção veicular a proteger mais, reduzir desperdícios e expandir. A visualização interativa demonstra localização, estoque, chips e ocorrências com dados explicitamente ilustrativos. Há dois modos comerciais: integração com sistemas existentes e Monitora 360 como central de rastreamento.

Por orientação do usuário, a seção de referências apresenta Mercosul Proteção Veicular, Lock Proteção Veicular, Alô Rastreamento, Previna Associação de Benefícios e Inovar Associação de Benefícios, com nomes tipográficos (sem inventar logotipos, depoimentos ou resultados). A seção de integrações destaca SGA Hinova, Ileva e Siprov, além de Traccar e K-TAG. O escopo de conexão é validado comercialmente; esta alteração não implementa novos conectores no backend.

## Preços e cálculo

A referência comercial foi extraída de `git@github.com:lucasmateuslid/yourtagsstory.git`, em `src/components/Pricing.tsx`. Os preços base foram mantidos por orientação do usuário, e o antigo Vitalício foi substituído por Enterprise sob consulta.

| Plano      | Base mensal  | Base equivalente no anual | Total anual da base | Incluídos      |
| ---------- | ------------ | ------------------------- | ------------------- | -------------- |
| Básico     | R$ 389,90    | R$ 299,90/mês             | R$ 3.598,80         | 1.500 veículos |
| Pro        | R$ 539,90    | R$ 429,90/mês             | R$ 5.158,80         | 1.500 veículos |
| Enterprise | Sob consulta | Sob consulta              | Sob consulta        | Negociados     |

O usuário confirmou mensalidade + tarifa apenas para o excedente, calculado progressivamente:

| Posição do veículo na frota | Adicional mensal por veículo naquela faixa |
| --------------------------- | ------------------------------------------ |
| 1.501 a 3.000               | R$ 3,00                                    |
| 3.001 a 5.000               | R$ 2,40                                    |
| 5.001 a 10.000              | R$ 1,80                                    |
| A partir de 10.001          | R$ 1,20                                    |

Exemplo: Pro mensal com 3.500 veículos = R$ 539,90 de base + 1.500 × R$ 3,00 + 500 × R$ 2,40 = **R$ 6.239,90/mês**. Nenhuma tarifa é aplicada retroativamente às faixas anteriores. Chips e equipamentos vinculados não são contados como veículos adicionais.

`pricing.ts` centraliza valores em centavos, faixas e recursos. O ciclo anual dá desconto somente na mensalidade base; mantém as tarifas dos excedentes. A projeção anual multiplica a mensalidade equivalente total por 12 e explicita que considera a mesma frota. O custo médio por veículo divide o total pelo volume, sem confundi-lo com a tarifa marginal.

A necessidade de recursos avançados recomenda Pro; múltiplas empresas recomendam Enterprise. O volume sozinho não impõe troca de plano ou teto: Básico e Pro usam as mesmas faixas progressivas. Enterprise permanece sob consulta.

Este catálogo é comercial e não altera a configuração privada de planos, módulos ou o faturamento dos tenants existentes. Implantação, conectividade e terceiros são cotados separadamente.

## Conversão

Os seletores mensal/anual são sincronizados. A proposta selecionada acompanha o lead no WhatsApp configurado em `brand.ts`, com modo de uso, volume quando informado, plano, ciclo, composição do excedente e total. O formulário valida os dados antes de abrir a conversa; não envia mensagens automaticamente nem cria assinatura. O contato existente do projeto foi preservado.

## Verificação

- `npm run test --workspace=@ktag/web -- pages/Landing`
- `npm run typecheck --workspace=@ktag/web`
- `npm run build`

Os testes cobrem limites das faixas, adicionais progressivos, cálculo anual, proposta comercial, dados inválidos, sincronização da interface e o formulário com abertura de WhatsApp simulada. A implementação está espelhada em `pages/Landing`, conforme `DESIGN_SYSTEM.md`. Ao alterar componentes ou preços, sincronize os dois locais.
