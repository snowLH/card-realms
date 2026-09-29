# Estado verificável do projeto

## Entregue na fundação atual

- Cinco elementos compartilhados por regras, catálogo, UI e banco.
- Equipes de exatamente seis criaturas, energia como cartas, turno explícito, troca voluntária e troca forçada.
- Defesa, velocidade, crítico, escudo e seis efeitos de status executados pelo motor autoritativo.
- Progresso remoto para perfil, coleção, equipe, energias, inventário, mundo, posição, tesouros, missões, conquistas, casa e histórico.
- Viagem validada por adjacência, tesouro com ledger idempotente e equipe ativa via RPCs transacionais.
- PVP entre amigos com desafio, aceite, snapshot congelado das equipes, versão otimista, idempotência, Realtime privado e polling de recuperação.
- Estado integral de batalha restrito ao servidor; mão, ordem do baralho, IDs de replay e credenciais não atravessam o DTO do cliente.
- Atlas 2D com 25 áreas jogáveis em cinco regiões, progressão sequencial e transição para mapa regional ampliado.
- Vila Cartógrafa acessível, com compra server-side de pacotes de energia e preço derivado no Postgres.
- Criador de personagem 2D com roupas, cores e armaduras desbloqueadas por baús, persistido por conta.
- Bestiário ampliado de 25 para 50 criaturas; as 25 novas entradas têm sprite próprio, origem, tradição e limites de adaptação.
- Fluxo visual de amizade por nome de viajante, com solicitação, aceite, bloqueio e desafio após login Google.
- Nove migrations versionadas, RLS ativa, grants mínimos, funções privilegiadas fora do schema exposto e 43 asserções pgTAP.
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
- `npm test`: PASS, 36/36.
- `npm run build`: PASS.
- `supabase db lint --linked --schema public,private --level warning --fail-on error`: PASS.
- `supabase/tests/001_online_foundation.test.sql`: PASS, 43/43 no Supabase remoto após a expansão (o marco A/B original permanece documentado como 29/29 no staging).
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

## Expansão visual 2D e schema de produção — 29 de setembro de 2026

- Duas migrations novas foram aplicadas ao projeto `Card Realms` de produção (`lfmbvqixixbhffdpmvhp`): `world_expansion_2d` e `add_world_area_index`.
- O banco confirmou 25 áreas, 25 novas criaturas habilitadas, três RPCs estreitas, RLS ativa no catálogo de áreas e os campos remotos de avatar/posição regional.
- O harness SQL atualizado passou 43/43 em transação remota com rollback, incluindo progressão de área, preço de energia, armadura bloqueada e montagem de equipes legais para o fluxo PVP.
- O Advisor detectou uma chave estrangeira nova sem índice; o índice parcial foi criado na migration seguinte. Os avisos restantes são anteriores a esta expansão ou refletem tabelas PVP intencionalmente sem policies porque as roles de cliente não possuem grants diretos.
- TypeScript, ESLint, Vitest (36/36) e o build de produção passaram.
- Desktop e viewport móvel de 390×844 foram exercitados no navegador: atlas, região ampliada, vila, loja, personagem, bestiário e mesa TCG. O console ficou sem erros ou warnings.
- Esta rodada não repete a homologação A/B completa no domínio público; portanto o marco PVP de produção continua separado do PASS real já obtido no staging.

## Limitações restantes

- Não se declara a homologação PVP autenticada de produção como `PASS` até repetir o fluxo A/B completo no domínio público após esta publicação.
- A região do staging (`us-east-1`) difere da produção (`sa-east-1`), portanto a homologação funcional não mede paridade de latência.
- Matchmaking público, ranking, abandono/timeout, rematch e recompensas PVP balanceadas ainda não existem.
- Missões jogáveis, captura, bestiário de 400 seres, editor de casa e áudio continuam fora desta etapa.
- O combate demonstrativo contra NPC mantém replay em memória; essa limitação não é usada pelo PVP persistente.

O procedimento reproduzível, os secrets e as sondagens estão em `docs/SUPABASE_STAGING.md`.
