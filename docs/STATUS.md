# Estado verificável do projeto

## Entregue na fundação atual

- Cinco elementos compartilhados por regras, catálogo, UI e banco.
- Equipes de exatamente seis criaturas, energia como cartas, turno explícito, troca voluntária e troca forçada.
- Defesa, velocidade, crítico, escudo e seis efeitos de status executados pelo motor autoritativo.
- Progresso remoto para perfil, coleção, equipe, energias, inventário, mundo, posição, tesouros, missões, conquistas, casa e histórico.
- Viagem validada por adjacência, tesouro com ledger idempotente e equipe ativa via RPCs transacionais.
- PVP entre amigos com desafio, aceite, snapshot congelado das equipes, versão otimista, idempotência, Realtime privado e polling de recuperação.
- Estado integral de batalha restrito ao servidor; mão, ordem do baralho, IDs de replay e credenciais não atravessam o DTO do cliente.
- Seis migrations versionadas, RLS ativa, grants mínimos, funções privilegiadas fora do schema exposto e 29 asserções pgTAP.
- Homologação real concluída em 27 de setembro de 2026 com duas contas autenticadas, duas sessões independentes e o Supabase de staging.

## Homologação de staging — 27 de setembro de 2026

O staging usado foi o projeto `Card Realms` (`ywawwhnsvpfeppfcuwzg`), organização `cryo` (`vdxeeviukkxoztfvmaoe`), conta `cryohive11@gmail.com`, em `us-east-1`. O projeto de produção `lfmbvqixixbhffdpmvhp` e o projeto não relacionado chamado `cryohive` não foram alterados.

As seis migrations foram aplicadas em ordem pela CLI e confirmadas no histórico remoto. O lint remoto dos schemas `public` e `private` passou sem erros; o Security Advisor não encontrou falha bloqueante. As 29 asserções pgTAP passaram em uma transação remota com rollback.

Duas contas reais e dois contextos de navegador isolados concluíram amizade, convite, aceite e duas batalhas persistentes. A execução observou anexação e consumo de energia, rolagem no servidor, falhas, críticos, status, troca voluntária, três trocas forçadas, reconexão, refresh e término. O primeiro duelo terminou na versão 218/turno 83; o segundo, usado também para provar polling sem Realtime, terminou na versão 227/turno 86.

As sondagens negativas confirmaram rejeição de ação fora do turno, payload com dano/dado/vitória, versão antiga, troca ilegal, energia alheia, terceira anexação e reutilização divergente de `actionId`. Replay idêntico retornou o resultado anterior sem duplicar versão ou efeito. Acesso direto às tabelas autoritativas e RPCs privilegiadas foi negado, tópicos Realtime alheios falharam e o DTO manteve mão/baralho adversários e tokens ausentes.

Após logout e novo login, histórico e progresso permaneceram no Supabase. A reivindicação sequencial e concorrente do mesmo tesouro concedeu a recompensa uma única vez.

| Sistema | Resultado | Evidência real |
| --- | --- | --- |
| Migrations staging | PASS | seis versões registradas na ordem esperada; lint remoto sem erros |
| RLS | PASS | pgTAP 29/29, advisors e sondagens HTTP/RPC com roles de cliente |
| Login A/B | PASS | duas contas e cookies isolados em duas sessões de navegador |
| Convite PvP | PASS | A enviou e B recebeu convite real |
| Aceite | PASS | B aceitou e o servidor criou sala com dois snapshots de seis |
| Turnos | PASS | ações alternadas, versão e jogador do turno validados pelo servidor |
| Energia | PASS | anexação, limite e consumo após ataque observados |
| Rolagem server-side | PASS | dado apareceu somente no evento/resultado do servidor |
| Troca voluntária | PASS | troca para Iara consumiu o turno |
| Troca forçada | PASS | três ocorrências observadas no primeiro duelo |
| Realtime | PASS | tópico válido assinou; tópico de batalha alheia recebeu `CHANNEL_ERROR` |
| Polling fallback | PASS | observador sem evento avançou da versão 1 para 2 por GET periódico |
| Reconexão | PASS | A caiu na versão 8 e recuperou a versão 10 sem reinício ou duplicação |
| Anti-replay | PASS | retry idêntico foi idempotente; payload divergente recebeu 409 |
| Dados privados | PASS | Data API/RPC negados; DTO e Broadcast sem mão, baralho, tokens ou IDs internos |
| Resultado persistido | PASS | vencedor, perdedor e dois históricos preservados após logout/login |
| Progresso remoto | PASS | snapshot completo recuperado em nova sessão; tesouro idempotente |

## Verificações automatizadas

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 32/32.
- `npm run build`: PASS.
- `supabase db lint --linked --schema public,private --level warning --fail-on error`: PASS.
- `supabase/tests/001_online_foundation.test.sql`: PASS, 29/29 no staging remoto.
- `npm run test:staging:realtime`: PASS.
- `npm run test:staging:polling`: PASS.
- `npm run test:staging:idempotency`: PASS.

## Publicação Vercel Production — commit `44ef44c`

- `main` recebeu a fundação homologada por merge sem conflitos.
- TypeScript, ESLint, Vitest (32/32) e o build Next.js passaram novamente no commit de release.
- O deploy de produção terminou como `Ready` em 29 segundos e o domínio público carregou a versão nova.
- Mapa, navegação e a tela de Duelos foram exercitados como visitante no endereço público, sem erros ou avisos no console.
- As variáveis de staging permanecem limitadas ao branch `staging`; Production conserva seu conjunto próprio.
- Esta publicação promove a aplicação, não o schema legado: PVP autenticado permanece `PASS` somente em staging até a aplicação e auditoria das migrations no banco de produção.

## Limitações restantes

- A aplicação já está publicada em Vercel Production, mas o banco legado de produção ainda não recebeu as seis migrations homologadas. Não se declara PVP autenticado de produção como `PASS` antes dessa migração, dos redirects e de um novo teste A/B no domínio público.
- A região do staging (`us-east-1`) difere da produção (`sa-east-1`), portanto a homologação funcional não mede paridade de latência.
- Não há fluxo visual completo para criar/aceitar amizade; a relação pode ser preparada por uma sessão autenticada de teste.
- Matchmaking público, ranking, abandono/timeout, rematch e recompensas PVP balanceadas ainda não existem.
- Inventário utilizável, missões jogáveis, captura, bestiário completo, editor de casa e áudio continuam fora desta fundação.
- O combate demonstrativo contra NPC mantém replay em memória; essa limitação não é usada pelo PVP persistente.

O procedimento reproduzível, os secrets e as sondagens estão em `docs/SUPABASE_STAGING.md`.
