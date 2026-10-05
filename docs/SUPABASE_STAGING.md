# Runbook — Supabase staging e homologação A/B
> **Atualização vigente em 4 de outubro de 2026:** o usuário autorizou atualizar este projeto diretamente na branch main, sem branches de staging. O projeto Card Realms acessível na conta cryohive11 é ywawwhnsvpfeppfcuwzg; as 38 migrations já foram aplicadas e conferidas. As instruções de staging e os bloqueios descritos nos registros abaixo são históricos e não descrevem o estado atual. Veja “Execução autorizada na main” ao final.


Este documento é o roteiro operacional da homologação. Nenhuma etapa deve ser marcada PASS por inspeção de código; PASS exige execução contra um projeto Supabase isolado e duas contas autenticadas em duas sessões independentes.

## Ambiente homologado

Em 27 de setembro de 2026, o projeto antigo chamado `cryohive` permaneceu fora de escopo. A conta de destino é `cryohive11@gmail.com`, Owner da organização Free `cryo` (`vdxeeviukkxoztfvmaoe`). O projeto `Card Realms` (`ywawwhnsvpfeppfcuwzg`) foi homologado como staging.

O staging está em `us-east-1` e conectado ao repositório `snowLH/card-realms`. O registro de 27 de setembro diz que ele começou vazio e recebeu as seis migrations versionadas naquela data. Esse registro não confirma o histórico remoto atual nem cobre as migrations adicionadas desde então. A diferença para a região de produção (`sa-east-1`) permanece como limitação de paridade de latência; ela não autoriza reutilizar o projeto `cryohive` nem executar testes em produção.

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
4. comparar o histórico remoto com todas as versões locais listadas abaixo; investigar qualquer divergência antes de aplicar DDL;
5. executar lint, advisors e pgTAP antes de criar as contas A/B.

O PR separado para `main` só deve ser mesclado quando o banco e as variáveis do ambiente público estiverem prontos. Preview usa staging; Production não deve receber URL ou chave do staging.

As 38 migrations atualmente presentes no repositório devem ser aplicadas, sem saltos, pela ordem lexical em `supabase/migrations/`. Esta lista é o inventário local; não afirma que essas versões estejam aplicadas no staging:

1. `20260926010000_card_realms_foundation.sql`
2. `20260926020000_folklore_visual_direction.sql`
3. `20260926194659_five_element_battle_foundation.sql`
4. `20260927015815_online_player_progress.sql`
5. `20260927031000_authoritative_pvp.sql`
6. `20260927050000_online_security_hardening.sql`
7. `20260928171334_card_first_journey.sql`
8. `20260929135232_world_expansion_2d.sql`
9. `20260929135836_add_world_area_index.sql`
10. `20260929192843_local_world_positions.sql`
11. `20260930024500_owned_energy_progression.sql`
12. `20261001000500_sync_pvp_action_catalog.sql`
13. `20261001010000_mythic_saturday_raids.sql`
14. `20261001133500_raid_performance_hardening.sql`
15. `20261001134000_fix_raid_start_event_alias.sql`
16. `20261001152000_team_evolution_missions.sql`
17. `20261001153000_map_party_sessions.sql`
18. `20261001154000_evolution_team_snapshots.sql`
19. `20261001155500_map_session_host_index.sql`
20. `20261001202504_arpg_mvp_run_extraction.sql`
21. `20261001211211_arpg_player_loadout.sql`
22. `20261001225950_arpg_multi_expedition_rewards.sql`
23. `20261002005100_arpg_ability_card_inventory.sql`
24. `20261002005203_arpg_boss_and_raid_ability_rewards.sql`
25. `20261002010402_arpg_support_inventory.sql`
26. `20261002102430_arpg_signed_run_loot.sql`
27. `20261002132323_arpg_relic_loadout.sql`
28. `20261002170244_arpg_relic_first_clear_rewards.sql`
29. `20261002183001_arpg_raid_runtime_transition.sql`
30. `20261002230922_arpg_raid_mode_bridge.sql`
31. `20261003020812_arpg_runic_expedition_rewards.sql`
32. `20261003133418_arpg_persistent_runs.sql`
33. `20261003141927_fix_mission_events_ambiguity.sql`
34. `20261004161800_arpg_merchant_catalog.sql`
35. `20261004181841_arpg_character_power_shop.sql`
36. `20261004195201_arpg_power_loadout_and_reward_authority.sql`
37. `20261004210000_avatar_two_power_classic_pvp.sql`
38. `20261004221500_avatar_power_raid_authority.sql`

Com a CLI autenticada:

```bash
supabase link --project-ref ywawwhnsvpfeppfcuwzg
supabase migration list
supabase db push
supabase migration list
supabase db lint --linked --schema public,private --level warning --fail-on error
```

Antes do push, confirme que o projeto vinculado é o staging. DDL deve entrar por migration; não copie trechos isolados para “fazer passar”. Depois do push, gere os tipos do projeto e compare-os com os contratos TypeScript.

Para os testes SQL locais, com Docker/Supabase local ativo e um banco descartável:

```bash
supabase start
supabase db reset
supabase test db
```

`supabase/tests/001_online_foundation.test.sql` verifica a fundação online; `supabase/tests/002_arpg_durable_runs.test.sql` verifica a tabela privada de runs, RLS, grants e privilégios das RPCs públicas e privadas. Os planos atuais são 50 e 22 asserções, respectivamente. As migrations recentes são cobertas por `016_arpg_merchant_catalog` (10), `017_arpg_character_power_shop` (38), `018_pvp_avatar_power_contract` (26) e `019_avatar_power_raid_authority` (52). As contagens conferem estaticamente, mas os testes atuais não foram executados contra banco remoto ou local. O teste 019 cobre o clamp na concessão e negação de `anon` às RPCs, mas, por rodar depois da migration, não simula a atualização de linhas legadas: classificação de salas antigas, criação dos snapshots válidos, arquivamento de lobbies sem snapshot válido e backfill de recompensas existentes ainda precisam ser validados em banco descartável/staging. A revisão histórica de 29 de setembro registrou 43/43 asserções da versão então existente de `001`; isso não valida migrations ou código adicionados depois.

Em 3 de outubro de 2026, a CLI e o acesso autenticado ao banco não estavam disponíveis neste ambiente. Portanto, a lista remota de migrations, o lint SQL e os testes pgTAP atuais continuam sem confirmação. Não execute `db push` até `supabase migration list --linked` funcionar e o projeto/ref e o histórico serem revisados.

### Rechecagem de acesso em 4 de outubro de 2026

A ferramenta Supabase conectada lista somente `cryohive` (ativo, mas explicitamente fora de escopo) e `SnowLH's Project` (inativo); o projeto `Card Realms` com ref `ywawwhnsvpfeppfcuwzg` não aparece entre os projetos acessíveis. CLI, Docker, `psql`, `SUPABASE_DB_PASSWORD` e `SUPABASE_ACCESS_TOKEN` também não estão disponíveis no processo local. Nenhuma consulta de schema, aplicação de migration ou outra gravação remota foi feita nesta rechecagem. Não use o projeto `cryohive` como substituto.

### Rechecagem somente leitura pelo navegador conectado — 4 de outubro de 2026

O painel autenticado mostra o projeto de produção `Card Realms` (`lfmbvqixixbhffdpmvhp`), cujo histórico visível contém 19 migrations e nenhuma entrada com nome ARPG. Na outra organização visível aparecem apenas `cryohive` e `SnowLH's Project` pausado; o staging `Card Realms` (`ywawwhnsvpfeppfcuwzg`) não aparece na conta conectada. Isso descreve o inventário visível na sessão, não prova ausência de tabelas ou funções ARPG: schema manual ou migrations com outros nomes não são descartados por essa observação. Nenhum SQL foi executado e nenhum projeto foi alterado. O staging segue sem acesso verificável; não faça `db push` ou testes remotos até obter acesso ao ref autorizado e confirmar seu histórico.

## Homologação atual do avatar, poderes e Raid

Este fluxo substitui a matriz antiga de batalha por equipe de seis para qualquer execução nova. O relato de 27 de setembro abaixo permanece apenas como histórico e não valida o contrato atual.

Após confirmar o ref `ywawwhnsvpfeppfcuwzg` e revisar todas as migrations locais, execute lint e `supabase test db` em uma instância descartável/staging. Os testes atuais incluem `016_arpg_merchant_catalog`, `017_arpg_character_power_shop`, `018_pvp_avatar_power_contract` e `019_avatar_power_raid_authority`; preserve seus resultados TAP integrais e não marque PASS apenas pela existência dos arquivos.

Confirme explicitamente:

- RLS continua ativo, `anon` não escreve progresso, e somente `service_role` pode executar as RPCs autoritativas de combate/Raid;
- funções `SECURITY DEFINER` fixam `search_path`, e payloads de cliente não definem dano, resultado, lado ou vencedor;
- avatar próprio é validado com exatamente dois poderes distintos e possuídos; cartas novas são compradas/equipadas na Guilda;
- combate clássico e PvP aceitam avatar + dois poderes sem exigir equipamento de dungeon; não há captura, troca de criatura ou equipes de seis em uma nova batalha;
- início de Raid congela o modo. Raid legado não inicia combate antigo; novas salas usam avatar + dois poderes. ARPG Raid permanece modo distinto e não recebe efeitos de apoiadores;
- repetição com mesmo `actionId` e payload retorna o resultado anterior sem duplicar efeitos; mesmo ID com payload divergente é rejeitado;
- recompensas persistentes da Raid seguem a allowlist (moedas/XP), sem conceder criaturas/cartas de poderes como drops;
- eventos e snapshots não revelam mãos/baralhos privados, tokens ou segredos do servidor.

Use duas contas autenticadas em perfis de navegador separados. Crie/aceite a amizade, compre/equipe uma carta elegível e percorra desafio, aceite, ações dos dois jogadores, reconexão, replay idêntico e divergente, conclusão e histórico. Para Raid, cubra lobby, readiness, start, dois slots de poderes, ações autoritativas, recompensa única e uma sala histórica. Armazene IDs de teste e horários; nunca grave access/refresh tokens, chaves ou dados pessoais.

Somente altere FAIL para PASS após guardar request/response sanitizados, revisões/IDs autoritativos, consulta SQL e TAP da execução. Validação local não substitui staging autenticado. Depois, execute `npm run verify:deploy`; qualquer promoção depende ainda do gate de deploy e da revisão humana.

## Auditoria de segurança comum

Execute advisors de segurança e performance do Supabase. Resolva erros e revise warnings; não desative RLS. Confirme policies, grants, índices, Broadcast privado, ausência de helpers privilegiados no schema público e ausência de `search_path` mutável em funções `SECURITY DEFINER`. Teste leitura/escrita direta negada em tabelas autoritativas e chamadas privilegiadas negadas a `authenticated`.

## Resultado executado em 27 de setembro de 2026 (registro histórico)

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

Resultados observados naquela execução histórica:

- tópico Realtime do participante: `SUBSCRIBED`; tópico de batalha alheia: `CHANNEL_ERROR`;
- polling deliberado: versão 1 avançou para 2 sem depender do evento;
- reconexão: sessão A saiu na versão 8 e voltou na versão 10 sem reinício;
- primeiro duelo: versão final 218, turno 83, oito falhas, quatro críticos, sete status e três trocas forçadas;
- segundo duelo: versão final 227, turno 86, dez falhas, dois críticos, seis status e duas trocas forçadas;
- tesouro repetido sequencial e concorrentemente: uma única recompensa e uma única linha de ledger;
- leitura direta das tabelas autoritativas e chamada de RPC privilegiada por cliente autenticado: negadas;
- replay idêntico: resultado anterior sem novo dano/turno; replay divergente: rejeitado.

## Rechecagem do conector Supabase — 4 de outubro de 2026

A listagem somente de metadados pelo conector autenticado retornou uma organização `Card Realms`, um projeto ativo de produção (`lfmbvqixixbhffdpmvhp`) e apenas a branch padrão `main`. O ref de staging registrado (`ywawwhnsvpfeppfcuwzg`) não aparece na conta; nenhuma tabela, dado de jogador ou schema de produção foi consultado nesta verificação. Não execute migrations, SQL, pgTAP ou advisors em produção como substituto do staging. A CLI Supabase, Docker, Podman e `psql` também não estão instalados neste ambiente, portanto a validação Postgres local permanece indisponível.

A consulta direta somente de metadados ao ref de staging retornou `You do not have permission to perform this action`; não tentei repetir com outra organização ou outro projeto.

### Rechecagem na conta principal Card Realms pelo navegador — 4 de outubro de 2026

O navegador autenticado como `cryohive11@gmail.com` mostra a organização `cryo` (`vdxeeviukkxoztfvmaoe`) no plano Free. A organização contém apenas o projeto `Card Realms` (`ywawwhnsvpfeppfcuwzg`), com status Healthy. O histórico visível do Dashboard contém as versões locais 1–19, até `20261001155500_map_session_host_index`; as versões locais 20–38 continuam pendentes. Isso confirma que o banco está desatualizado em relação ao código atual.

A página Branching mostra somente `main`, marcada como branch de produção do banco; não há uma branch de desenvolvimento `staging`. A tela de criação informa que branching exige upgrade para Pro, que compute de branch custa US$ 0,01344 por hora enquanto existir e que merge para `main` publica migrations no banco de produção. Nenhum upgrade ou branch foi criado. Essa tela identifica o papel da branch no Supabase; isoladamente, não confirma para qual ambiente do aplicativo cada URL está configurada.

O estado atual não corresponde ao runbook histórico que descreve uma branch dedicada `staging` separada de `main`. Trate essa descrição como não verificada até a existência de uma branch ou de outro projeto isolado ser confirmada no Dashboard. O projeto `ywawwhnsvpfeppfcuwzg` não pode ser usado para ensaio de backfill enquanto continuar sendo a única branch observada.

No ambiente local, `supabase` CLI e Docker não estão disponíveis, então não foi possível iniciar um PostgreSQL descartável para validar as migrations. Nesta rechecagem foram consultados somente o cadastro de projetos, o painel de branches e o histórico de migrations; não houve consultas a tabelas ou dados de jogadores, nem execução de SQL, migrations, pgTAP, advisors, backup ou deploy. O Dashboard informa que não há backup disponível para este projeto.

Em 4 de outubro de 2026, o usuário determinou que a atualização deste projeto seja feita diretamente na branch `main`, sem criar ou usar branches, e autorizou a atualização integral. Essa decisão substitui o fluxo histórico de staging para esta tarefa. O conector Supabase atualmente disponível, porém, ainda não tem acesso ao ref `ywawwhnsvpfeppfcuwzg`: a consulta somente de leitura ao histórico retorna `You do not have permission to perform this action`. O Dashboard oferece uma conexão MCP oficial do Codex, restrita a esse ref; ela precisa ser adicionada e autenticada antes de executar as migrations. Até esta rechecagem, nenhuma das migrations 20–38 foi aplicada e nenhum deploy foi feito.

## Execução autorizada na main — 4 de outubro de 2026

A instrução do usuário substituiu o fluxo histórico de homologação em branch separada: atualizar diretamente o projeto Supabase Card Realms (ywawwhnsvpfeppfcuwzg) na branch main, sem criar branches. A CLI Supabase 2.119.0 foi vinculada a esse ref e o db push --dry-run --skip-vault foi revisado antes da gravação.

- As migrations locais 1–38 constam no histórico remoto. A migration 20261004210000_avatar_two_power_classic_pvp falhou uma vez por erro de sintaxe; o próprio push a reverteu. Depois de corrigir a migration local, o push aplicado concluiu as versões 37 e 38 com sucesso.
- A consulta de verificação encontrou 2 perfis, 2 linhas de loadout, zero loadouts inválidos, nenhuma sala de Raid, 1 evento, zero recompensas com chaves legadas e zero eventos sem recompensa de moeda. A RLS de runs privadas está ativa; anon não pode lê-las nem executar a RPC autoritativa de PvP.
- Não havia backup disponível no Dashboard antes da operação. Os testes pgTAP atuais não foram executados no Postgres local ou remoto. O Advisor apresentou 31 avisos (19 RLS initplan, 11 funções SECURITY DEFINER acessíveis a authenticated, 1 proteção de senha vazada desabilitada); quatro avisos se referem às RPCs autenticadas de lobby/ready da Raid. A operação não ocultou esses avisos.
- O site público atual em card-realms.vercel.app ainda aponta para o projeto antigo lfmbvqixixbhffdpmvhp; o alvo autorizado é ywawwhnsvpfeppfcuwzg. O deploy manual Vercel aguarda o alinhamento de URL/chave pública e da SUPABASE_SECRET_KEY no ambiente Production do projeto card-realms; o deploy automático por Git continua desativado.
