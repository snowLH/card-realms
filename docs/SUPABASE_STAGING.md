# Runbook — Supabase staging e homologação A/B

Este documento é o roteiro operacional da homologação. Nenhuma etapa deve ser marcada PASS por inspeção de código; PASS exige execução contra um projeto Supabase isolado e duas contas autenticadas em duas sessões independentes.

## Ambiente homologado

Em 27 de setembro de 2026, o projeto antigo chamado `cryohive` permaneceu fora de escopo. A conta de destino é `cryohive11@gmail.com`, Owner da organização Free `cryo` (`vdxeeviukkxoztfvmaoe`). O projeto `Card Realms` (`ywawwhnsvpfeppfcuwzg`) foi homologado como staging.

O staging está em `us-east-1` e conectado ao repositório `snowLH/card-realms`. Ele começou vazio e recebeu somente as seis migrations versionadas desta fundação. A diferença para a região de produção (`sa-east-1`) permanece como limitação de paridade de latência; ela não autoriza reutilizar o projeto `cryohive` nem executar testes em produção.

A branch dedicada `staging` continua separada de `main`. Na homologação, a integração GitHub não aplicou o schema de forma confiável; por isso as migrations foram aplicadas pela CLI oficial, vinculada explicitamente ao project ref de staging, e verificadas pelo histórico remoto. A branch `main` não foi usada para aplicar schema nem promover produção.

O inventário e o procedimento de transferência estão em `docs/SUPABASE_TRANSFER.md`. O Owner da origem ainda não é membro de `cryo`, e o backup lógico restarável da produção continua bloqueado pela ausência da senha do banco. Produção não receberá migrations ou testes enquanto esses pré-requisitos não forem resolvidos.

## Secrets e configuração

Crie `.env.local` a partir de `.env.example` e mantenha:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key-server-only>
GAME_ACTION_SECRET=<32-ou-mais-bytes-aleatorios>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_*` pode chegar ao navegador. `SUPABASE_SECRET_KEY` e `GAME_ACTION_SECRET` nunca podem aparecer em bundle, resposta HTTP, log do navegador, commit ou captura de tela. Configure os mesmos nomes no host de staging, com `NEXT_PUBLIC_SITE_URL` apontando para o domínio do deploy.

No painel do Supabase:

1. mantenha RLS habilitado;
2. em Auth, habilite o provedor usado pelas duas contas e cadastre `/auth/callback` para localhost e para o deploy de staging;
3. em Realtime Settings, desabilite **Allow public access**; os canais PVP são privados;
4. não exponha o schema `private` no Data API;
5. use e-mails/contas de teste independentes e nunca compartilhe a mesma sessão/cookie entre A e B.

## Aplicar migrations

Fluxo reproduzível deste staging:

1. autenticar a CLI na conta que controla `cryo`;
2. executar `supabase link --project-ref ywawwhnsvpfeppfcuwzg` e conferir o ref antes de qualquer DDL;
3. revisar `supabase migration list` e aplicar `supabase db push`;
4. confirmar as seis versões no histórico remoto;
5. executar lint, advisors e pgTAP antes de criar as contas A/B.

O PR separado para `main` só deve ser mesclado quando o banco e as variáveis do ambiente público estiverem prontos. Preview usa staging; Production não deve receber URL ou chave do staging.

As migrations devem ser aplicadas, sem saltos, pela ordem lexical em `supabase/migrations/`:

1. `20260926010000_card_realms_foundation.sql`
2. `20260926020000_folklore_visual_direction.sql`
3. `20260926194659_five_element_battle_foundation.sql`
4. `20260927015815_online_player_progress.sql`
5. `20260927031000_authoritative_pvp.sql`
6. `20260927050000_online_security_hardening.sql`

Com a CLI autenticada:

```bash
supabase link --project-ref ywawwhnsvpfeppfcuwzg
supabase migration list
supabase db push
supabase migration list
supabase db lint --linked --schema public,private --level warning --fail-on error
```

Antes do push, confirme que o projeto vinculado é o staging. DDL deve entrar por migration; não copie trechos isolados para “fazer passar”. Depois do push, gere os tipos do projeto e compare-os com os contratos TypeScript.

Para os testes SQL locais, com Docker/Supabase local ativo:

```bash
supabase start
supabase db reset
supabase test db
```

`supabase/tests/001_online_foundation.test.sql` contém 29 asserções para schema, índices, RLS, grants, amizade, equipes, desafios e negação de leitura das tabelas autoritativas. Sem Docker local, a homologação executou o mesmo arquivo por conexão remota dentro de uma transação com rollback; 29/29 passaram.

## Auditoria após migration

Execute os advisors de segurança e performance do Supabase. Resolva erros e revise warnings; não desative RLS. Confirme explicitamente:

- todas as tabelas de jogador e PVP com RLS habilitado;
- `anon` sem escrita em dados do jogador;
- `authenticated` sem `SELECT/INSERT/UPDATE/DELETE` em `battles`, `battle_participants`, `battle_actions` e `battle_events`;
- `authenticated` sem `EXECUTE` em `start_pvp_challenge` e `commit_pvp_action`;
- `service_role` com acesso às duas RPCs autoritativas;
- wrappers de progresso e desafio acessíveis apenas às roles previstas;
- `realtime.messages` com a policy `players receive own pvp broadcasts` e sem policy de publicação do cliente;
- `battle_events` fora de Postgres Changes; o projeto usa Broadcast privado;
- triggers de bootstrap, `updated_at` e Broadcast presentes;
- índices de participantes, amizades, equipes e chaves estrangeiras presentes;
- nenhuma função `SECURITY DEFINER` com `search_path` mutável ou helper privilegiado exposto no schema público sem necessidade.

## Preparar A e B

Use Chrome para A e Edge para B, ou dois perfis de navegador comprovadamente separados. Em cada sessão:

1. faça login com uma conta diferente;
2. confirme que o snapshot remoto mostra perfil, coleção e equipe ativa com seis membros;
3. confirme que mundo, energia, inventário, missões, conquistas, casa e histórico vêm de `source: supabase`;
4. crie/aceite a amizade pelas roles autenticadas ou pré-semeie uma relação `accepted` no staging e registre esse fato na evidência;
5. abra Duelos nas duas sessões e confirme que A vê B como amigo disponível.

Guarde apenas IDs de teste e horários. Não registre access tokens, refresh tokens ou a chave secreta.

## Fluxo obrigatório da batalha

1. A envia o desafio.
2. B recebe por Broadcast; registre também o tempo do polling fallback se o evento for deliberadamente perdido.
3. B aceita; confira em SQL que há dois `battle_participants`, cada `team_snapshot` possui seis itens e a challenge aponta para uma única battle.
4. Confira que `turn_user_id` corresponde ao primeiro turno sorteado no servidor.
5. O jogador do turno anexa energia e ataca; confirme que `die` só aparece na resposta/evento do servidor.
6. B recebe a versão seguinte e age.
7. Faça uma troca voluntária e confirme avanço de turno.
8. Derrote uma criatura, confirme `forced_switch`, escolha manualmente a substituta e confirme que a ação principal permanece.
9. Observe energia gasta mesmo em falha, ao menos uma falha de dado, um crítico e um status aplicado. Repita duelos se a aleatoriedade não produzir todos os casos; não injete o resultado pelo cliente.
10. Termine a partida e confira vencedor/perdedor, duas linhas de `battle_results`, histórico e estatísticas derivadas do histórico.

## Sondagens de trapaça e privacidade

Com os tokens das próprias sessões — nunca com a chave secreta — tente e registre status HTTP/erro para:

- ação fora do turno;
- segundo ataque no mesmo turno;
- mesmo `actionId` com payload idêntico (deve retornar o resultado anterior sem duplicar efeito);
- mesmo `actionId` com payload diferente (deve ser rejeitado);
- terceira energia no turno;
- criatura/índice ilegal;
- campos extras `damage`, `die`, `winnerId` e ação `victory`;
- `expectedVersion` antiga;
- ID de batalha pertencente a outras contas;
- leitura direta de `battles`, `battle_actions`, `battle_participants` e `battle_events` pelo Data API;
- RPCs autoritativas chamadas como `authenticated`;
- assinatura de tópico `pvp:player:<outro-id>` e `pvp:battle:<outra-battle>`;
- inspeção da resposta HTTP, payload Broadcast e estado React procurando mão/baralho adversários, `processedActionIds`, access/refresh tokens ou segredos do servidor.

O adversário pode conhecer equipe, criatura ativa, HP, energia anexada/descartada e eventos públicos. Não pode conhecer a mão, a ordem/conteúdo restante do baralho nem tokens internos.

## Reconexão e persistência

Durante uma batalha:

1. desligue a rede ou feche A;
2. mantenha B conectado e avance uma ação válida;
3. reabra A e confirme que GET da battle retorna a versão atual, sem reiniciar;
4. reenvie a última requisição de A com o mesmo ID e confirme ausência de dano/turno duplicado;
5. faça refresh completo em A e B e continue até o fim.

Depois do término, faça logout nas duas sessões, entre novamente e confirme o histórico. Em outra sessão/dispositivo, valide perfil, coleção, equipe ativa, energias, inventário, região/posição, tesouros, missões, conquistas, casa e histórico.

Para idempotência de progresso, repita a reivindicação do mesmo tesouro, a mesma RPC, refresh após resposta e replay da requisição. Compare contagens antes/depois: cartas, moedas, energia, recompensas, dano e turnos não podem duplicar.

## Evidência e encerramento

Para cada linha da matriz em `docs/STATUS.md`, guarde data/hora, conta/sessão, request/response sanitizados, versão da battle e consulta SQL de confirmação. Execute também:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Somente altere uma linha de FAIL para PASS depois da evidência real correspondente. O PVP só pode ser declarado concluído quando Conta A e Conta B terminarem o fluxo completo em sessões independentes contra o staging real.

## Resultado executado em 27 de setembro de 2026

A matriz completa está em `docs/STATUS.md`. O teste real usou duas contas autenticadas e dois contextos de navegador isolados. Foram concluídas duas batalhas, incluindo troca voluntária, troca forçada, energia gasta, falha no dado, crítico, status, término e persistência após novo login.

Durante a execução foi encontrado um erro real da interface: o `actionId` era enviado como `pass-<uuid>`, embora o contrato estrito aceitasse apenas UUID. A UI passou a usar `crypto.randomUUID()` puro em todas as ações e o fluxo foi repetido com sucesso.

Sondagens reproduzíveis adicionadas ao repositório:

```bash
npm run test:staging:realtime
npm run test:staging:polling
npm run test:staging:idempotency
npm run test:staging:pvp-finish
```

Esses comandos exigem variáveis de staging e contas descartáveis. Credenciais, access tokens, refresh tokens e chaves secretas nunca devem ser gravados no repositório ou copiados para relatórios.

Resultados observados:

- tópico Realtime do participante: `SUBSCRIBED`; tópico de batalha alheia: `CHANNEL_ERROR`;
- polling deliberado: versão 1 avançou para 2 sem depender do evento;
- reconexão: sessão A saiu na versão 8 e voltou na versão 10 sem reinício;
- primeiro duelo: versão final 218, turno 83, oito falhas, quatro críticos, sete status e três trocas forçadas;
- segundo duelo: versão final 227, turno 86, dez falhas, dois críticos, seis status e duas trocas forçadas;
- tesouro repetido sequencial e concorrentemente: uma única recompensa e uma única linha de ledger;
- leitura direta das tabelas autoritativas e chamada de RPC privilegiada por cliente autenticado: negadas;
- replay idêntico: resultado anterior sem novo dano/turno; replay divergente: rejeitado.
