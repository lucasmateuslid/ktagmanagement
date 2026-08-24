# Vistoria de segurança — 2026-08-24

## Escopo

Revisão estática do frontend, backend Express, Cloud Functions, regras do
Firestore, arquivos de deploy e dependências npm. A vistoria não incluiu
pentest contra produção nem uso de credenciais reais.

## Resultado

- `npm audit --omit=dev` (workspace): 0 vulnerabilidades conhecidas.
- `npm audit --omit=dev` (`functions/`): 0 vulnerabilidades conhecidas.
- Nenhuma chave privada ou token com padrão conhecido foi encontrado nos
  arquivos versionados; `.env.local` permanece ignorado.
- TypeScript, testes do backend e build de produção passaram.

## Correções desta vistoria

1. **Alta — falsificação de audit logs:** membros internos podiam criar eventos
   arbitrários pelo SDK web. As regras agora reservam toda escrita ao backend
   (Admin SDK).
2. **Alta — leitura pública de ocorrências por ID:** qualquer documento de
   roubo que contivesse `trackingToken` podia ser lido anonimamente se o ID fosse
   conhecido. A leitura direta agora exige membership; um futuro fluxo público
   deve usar endpoint server-side com validação de token, expiração e resposta
   mínima.
3. **Média — token público curto:** novos links usavam apenas 32 bits de um UUID.
   A geração agora preserva os 128 bits.

Foram adicionadas regressões às Rules para negar leitura anônima por ID e negar
criação de audit log pelo cliente.

## Limitações de validação local

- Os testes comportamentais das Firestore Rules não iniciaram porque Java não
  está instalado no ambiente. O arquivo de testes foi atualizado e deve ser
  executado em CI/ambiente com Java por `npm run test:rules`.
- O lint completo já possuía 107 erros e 2.108 avisos anteriores e fora do
  escopo destas alterações. Nenhum deles foi introduzido nos arquivos alterados.
- `test-security.sh` é legado e verifica uma arquitetura antiga (JWT próprio,
  `security.js` e PBKDF2); seus resultados não representam os controles atuais
  baseados em Firebase Auth.

