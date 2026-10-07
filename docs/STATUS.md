# Estado verificável do projeto

## Estado vigente — 7 de outubro de 2026

- O projeto autorizado é o Card Realms `ywawwhnsvpfeppfcuwzg` na conta `cryohive11`; a CLI está vinculada a esse ref. O projeto de produção antigo `lfmbvqixixbhffdpmvhp` não foi alterado.
- O contrato atual usa avatar/Lenda com dois poderes, cooperação em dungeons e inimigos/bosses folclóricos. O legado de equipes de seis criaturas e apoiadores aparece abaixo somente como histórico.
- As migrations locais e remotas estão alinhadas até `20261007105822_repair_raid_authority_wrappers`. A correção restaura a validação da segunda arma e dos dois poderes sem perder a autoridade avatar/ARPG, contribuição e eventos Realtime.
- PgTAP remoto passou nos testes focais: Raid avatar/ARPG (43 asserções), loadout (9), bootstrap de novo perfil (11) e retirada do gacha legado (13).
- `npm run verify:deploy` passou neste snapshot: typecheck, ESLint, 377 testes em 73 arquivos e build de produção Next.js 16.3.6 via Webpack.
- A versão jogável está publicada em [card-realms.vercel.app](https://card-realms.vercel.app/) (deployment `dpl_4jhsK2FLsqaeMzTfimufPbqVVB36`, READY). O smoke de produção abriu JOGAR → Guilda, percorreu o avatar com WASD, abriu a rota Mata Encantada e iniciou uma run de 9 salas com HUD e dois poderes.
- O endpoint de progresso responde `401` JSON sem sessão, como esperado; manifest e ícones publicados respondem `200`. A inspeção de logs do deployment não encontrou erros `500` no período verificado.
- O build prebuilt foi publicado sem `.env.local`. A configuração mantém Git auto-deploy desativado; o pacote de produção respeita o limite Hobby de 12 funções primárias.

Os registros abaixo são históricos. Quando uma linha antiga disser que o staging ou as migrations estavam bloqueados, ela descreve o snapshot daquela data.

## Registro histórico/superado — fundação de setembro de 2026

Este bloco preserva o estado anterior à migração do combate para avatar + dois poderes. As referências a equipes de seis criaturas e às 33 migrations descrevem aquele snapshot, não o contrato ou inventário atuais; consulte as seções finais deste documento para o estado vigente.

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
- 33 migrations no repositório e dois arquivos de testes pgTAP; o histórico remoto atual ainda não foi confirmado para as versões adicionadas depois da homologação de setembro.
- Homologação real de PVP registrada em 27 de setembro de 2026 com duas contas autenticadas, duas sessões independentes e o Supabase de staging; essa evidência é histórica e não cobre as mudanças posteriores de dungeon.

## Homologação de staging — 27 de setembro de 2026 (evidência histórica)

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

## Verificações automatizadas — snapshot de setembro de 2026

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: PASS, 98/98.
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

## ARPG de expedições, cartas-habilidade e suportes — 2 de outubro de 2026

> Registro histórico do desenho anterior. O contrato vigente, definido em 4 de outubro de 2026, substitui os quatro slots de carta e suportes: avatar próprio, dois ataques equipados no Arquivo da Guilda e nenhum apoiador folclórico em combate. Os dados legados de suporte permanecem apenas por compatibilidade.

- Duas dungeons jogáveis estão disponíveis no runtime Phaser: Mata Encantada e Arquipélago das Marés, com 8–12 salas geradas por run, loot próprio e boss final.
- O Arsenal usa exatamente quatro slots de cartas-habilidade; seleção, persistência local e HUD/touch deixam de depender de IDs hard-coded no runtime.
- O catálogo atual possui 13 cartas-habilidade com raridade, criatura de origem, comportamento, cooldown e fonte de aquisição explícitos.
- O sistema de suporte mantém exatamente dois slots equipados. Curupira e Boitatá são iniciais; Saci-Pererê e Iara são desbloqueios de dungeon persistidos no mesmo inventário ARPG.
- Cada suporte tem passiva, habilidade ativa, sprite e cooldown próprios. O cooldown da habilidade é individual por suporte, então trocar de companheiro não herda a recarga do anterior.
- Cartas comuns/incomuns já entram por baús de dungeon e são registradas no inventário server-side no primeiro clear elegível; o smoke validou baú → Arsenal → slot → ativação no Phaser.
- Cartas lendárias são classificadas como recompensa de boss, mas a concessão persistente permanece desligada da run singleplayer enquanto a vitória ainda for declarada pelo cliente; a função server-side foi preparada sem ser exposta ao fluxo atual.
- A habilidade Mítica é `Tempestade do Horizonte`, ligada ao Roc, que já é `mythic` no catálogo. A Raid do Roc pode concedê-la como segunda recompensa idempotente além da criatura Mítica.
- As migrations novas foram geradas pelo Supabase CLI e restringem os RPCs privilegiados a `service_role`; `security definer` permanece no schema `private` com `search_path = ''`.
- Equipamentos especiais agora possuem efeitos mecânicos próprios, enquanto itens comuns permanecem simples: cadência em movimento, eco espiritual, cleave, piercing, cura periódica, defesa em movimento, redução de cooldown e contra-ataque.
- O Arsenal mostra o nome e a descrição desses efeitos. O smoke `arpg-equipment-effects-smoke.mjs` confirmou o Cajado do Canto da Iara + Manto da Névoa do Kelpie equipados no Phaser; o `Eco Restaurador` disparou corretamente no quarto ataque básico.
- Relíquias fazem parte do loadout ARPG. Bússola do Cartógrafo aumenta XP, Talismã dos Rastros cura ao abrir baú e Concha do Encanto reduz o cooldown da habilidade do suporte. `relicId` agora atravessa localStorage, snapshot remoto, API e a migration `20261002132323_arpg_relic_loadout.sql`.
- Equipamentos especiais compartilham as mesmas regras entre dungeon e Raid ARPG por helpers puros (`getWeaponAttackProc`, cooldowns, defesa móvel e contra-ataque), evitando divergência entre modos.
- A Raid ARPG já possui motor server-authoritative para 2–5 jogadores, três fases de boss, input versionado/idempotente, contribuição server-side e loadout congelado a partir de `player_arpg_loadouts` no banco; o cliente não envia dano, HP, vitória ou equipamento arbitrário.
- A arena cooperativa aceita teclado/touch e agora também gamepad: stick esquerdo move, direito mira, A ataca, B executa dash, X usa suporte, Y troca suporte e o D-pad ativa as quatro cartas-habilidade.
- A arena cooperativa separa input contínuo de ações discretas: um pacote de movimento lento não bloqueia ataque/dash/habilidade. Payloads de polling/Realtime com versão inferior à já aplicada são ignorados, impedindo regressão visual de estado.
- O GET de Raids agora descobre a sala `lobby`/`active` do próprio usuário via RLS e a `RaidView` retoma automaticamente `roomId + gameplayMode` após refresh/login. O teste confirma retomada direta de uma Raid ARPG ativa sem redigitar código.
- A suíte pgTAP local foi ampliada de 45 para 50 asserções planejadas para cobrir tabela/RLS do Arsenal e privilégios da ponte server-side de snapshot da Raid; essas novas asserções permanecem pendentes de execução porque o Postgres local está desligado.
- Verificação da rodada de 2 de outubro: TypeScript PASS, ESLint 0 erros/0 warnings, Vitest 132/132 e build Next.js 16.3.6 PASS via `npm run verify:deploy` (atualizada para 138/138 no incremento abaixo).
- Os smokes `arpg-support-switch-smoke.mjs` e `arpg-equipment-effects-smoke.mjs` validaram troca Saci/Iara, habilidades de suporte, Eco Espiritual, Eco Restaurador, dash do Kelpie e ausência de overflow/erros fatais em runtime.
- `supabase db lint --local` não pôde rodar porque o Postgres local em `127.0.0.1:54322` está desligado. Nenhuma migration desta fase foi aplicada a banco remoto nesta sessão.

## Incremento de dungeon procedural — 2 de outubro de 2026

- O renderer agora escolhe variações de piso, água e obstáculos conforme o padrão do template. Paredes e obstáculos bloqueiam movimento; spawns usam posições caminháveis e inimigos colidem com o ambiente.
- Portas conectadas deslizam ao fechar/abrir com collider atualizado e poeira procedural. Waves apresentam inimigos com telegraph escalonado de raízes/folhas.
- O plano de loot assinado distribui equipamento/carta entre tesouro, elite, combate marcado e boss. Combate comum pode render cache determinístico de cura/fragmentos ou nenhum drop.
- O Curupira libera loot assinado seguido de portal de extração. A run só conclui ao interagir com o portal; a ação contextual também aparece nos controles de toque.
- Runs locais recebem seed única. Fluxos autenticados continuam usando seed e plano emitidos pela API.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 138 testes e build de produção local.
- Browser no build local confirmou carregamento do hub, início de run e renderização da sala inicial. A travessia completa e a verificação 844×390 landscape ainda ficam pendentes.
- Nenhuma migration Supabase foi necessária, e nenhum deploy remoto foi realizado nesta etapa.

## Verificação final do vertical slice procedural — 3 de outubro de 2026

- Smoke browser automatizado no build local em viewport mobile landscape de 844×390: run seeded de 11 salas, travessia por corredores/portas, clears, retorno a sala limpa sem respawn, Curupira derrotado, loot elegível, extração pelo portal e retorno à Guilda.
- O resultado do smoke confirmou 144/154 HP após o boss e nenhuma exceção de runtime.
- O smoke confirmou a navegação de volta ao HUB a partir da tela de resultado; o modo local `?debugDungeon=1` agora expõe grafo, salas, portas, waves e diagnóstico do runtime.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 138/138 testes (incluindo invariantes sobre 1.000 seeds) e build Next.js de produção local.
- O smoke usou sessão visitante e não gravou estado no Supabase; a persistência autenticada de recompensas continua coberta pelo token/RPC existente e não foi revalidada nesta rodada.
- Nenhuma migration foi aplicada e nenhum deploy remoto foi realizado.

## Correção do ciclo de combate e extração — 3 de outubro de 2026

- O smoke de 12 salas encontrou um caso em que o callback de sobreposição de projétil inimigo passava o jogador para a rotina de reciclagem. O handler agora seleciona o membro real do grupo em qualquer ordem de argumentos e rejeita objetos que não pertençam ao grupo.
- A regressão foi coberta por testes unitários para argumento direto, ordem invertida e par sem membro do grupo. A run local completou salas de combate, elite, evento, loja, descanso e tesouro; derrotou o boss, abriu a recompensa, concluiu a extração e voltou à Guilda sem erros de runtime.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 156/156 testes e build de produção local.
- Diagnóstico do Phaser permanece disponível apenas com `?debugDungeon=1`; não houve migration, acesso ao banco remoto ou deploy.

## Incremento P1 — loadout autenticado congelado na run — 3 de outubro de 2026

- O início autenticado agora lê `player_arpg_loadouts` pelo servidor, valida cada equipamento, relíquia, suporte e carta contra os catálogos e deriva o checkpoint inicial da arma/armadura salvas.
- O token HMAC versão 5 congela o loadout inicial. A retomada usa esse snapshot mesmo se o Arsenal da conta mudar depois; o browser recebe o loadout validado do servidor e não pode substituí-lo no pedido de início.
- O endpoint do Arsenal e o token de run compartilham o mesmo schema estrito. Testes cobrem loadout da conta, payload forjado, linha inválida e retomada após mudança no Arsenal.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 159/159 testes em 29 arquivos e build local Next.js.
- Cobertura autenticada foi por mocks; E2E com Supabase staging segue pendente por falta da senha Postgres da CLI. Nenhuma migration ou deploy foi feito.

## Incremento P0 — cura de checkpoint limitada — 3 de outubro de 2026

- Checkpoints de run autenticada agora limitam aumentos de HP às fontes do jogo: até 35 no descanso, 30 no tônico da loja, cura assinada do baú/cache e aumento de HP concedido ao equipar armadura do plano de loot.
- Testes rejeitam cura forjada em sala comum e excesso sobre as quantias de descanso/baú, preservando essas recompensas legítimas.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 161/161 testes em 29 arquivos e build de produção local.
- A progressão de clears ainda vem do cliente; a fronteira de combate server-authoritative permanece pendente. Sem alteração de banco ou deploy.

## Limitações restantes

- Não se declara a homologação PVP autenticada de produção como `PASS` até repetir o fluxo A/B completo no domínio público após esta publicação.
- A região do staging (`us-east-1`) difere da produção (`sa-east-1`), portanto a homologação funcional não mede paridade de latência.
- Matchmaking público, ranking, abandono/timeout, rematch e recompensas PVP balanceadas ainda não existem.
- Missões jogáveis, captura, bestiário de 400 seres e editor de casa continuam fora desta etapa. A dungeon tem ambiência e efeitos procedurais; música completa e áudio das outras áreas ainda faltam.
- O combate demonstrativo contra NPC mantém replay em memória; essa limitação não é usada pelo PVP persistente.

O procedimento reproduzível, os secrets e as sondagens estão em `docs/SUPABASE_STAGING.md`.

## Incremento P0 — runs persistentes de dungeon — 3 de outubro de 2026

- A migration `20261003133418_arpg_persistent_runs.sql` cria armazenamento privado de runs, índice para uma run ativa por jogador, checkpoints com revisão otimista e RPCs restritos à role de servidor.
- A rota `/api/arpg/run` agora inicia ou retoma uma run autenticada, salva checkpoints validados contra o grafo seeded, mostra um resumo de run ativa e finaliza recompensas de forma idempotente. Visitantes continuam jogando em sessão local.
- O Phaser recupera sala, progresso, HP, equipamento, loot e estado de extração. O salvamento ocorre em marcos seguros; entrar numa sala ou abrir um baú sem decidir a recompensa não grava progresso intermediário.
- A seleção de expedição oferece “Continuar run” e impede iniciar outra expedição enquanto houver uma run ativa.
- `npm run verify:deploy`: PASS nesta revisão — TypeScript, ESLint, 145/145 testes e build local Next.js de produção.
- Smoke CDP contra o build local em 844×390: uma execução inicial travou no baú após o sprite do jogador ficar inativo. A causa foi reproduzida no callback de colisão de projétil inimigo e corrigida no incremento de 3 de outubro registrado abaixo; o smoke completo de 12 salas passou depois da correção.
- A validação local da migration e do pgTAP continua sem execução: `supabase db lint --local --schema public,private --level warning --fail-on error` não conectou a `127.0.0.1:54322` porque o Postgres local/Docker está desligado.
- A CLI encontrou e vinculou o staging documentado, `Card Realms` (`ywawwhnsvpfeppfcuwzg`, `us-east-1`). Não apliquei migration porque `supabase migration list --linked` falhou na autenticação Postgres (`cli_login_postgres`, senha não configurada); sem ler o histórico remoto não é seguro executar `db push`.
- `supabase db lint --linked` alcançou o staging e revelou um erro anterior neste código: `public.record_mission_events` tem conflito entre a variável PL/pgSQL `mission_id` e a coluna de mesmo nome no `ON CONFLICT`. A migration `20261003141927_fix_mission_events_ambiguity.sql` corrige o alvo para a constraint nomeada; ainda aguarda lint/aplicação no banco alvo.
- O MCP segue sem listar esse staging, mas a identidade do projeto foi confirmada pela CLI. Nenhuma migration foi aplicada a projetos sem relação nem foi feito deploy.
- **Este P0 permanece parcial:** a rota valida estrutura e caminho do checkpoint, mas a cena ainda envia resultados de combate do cliente. O servidor não reproduz a simulação de ondas/boss para provar as mortes. Assim, conclusão de boss e recompensas ainda não satisfazem autoridade integral de servidor e não recebem PASS.
- Nenhum deploy remoto foi realizado.

## Incremento de transições de checkpoint — 3 de outubro de 2026

- A rota autenticada lê a run ativa salva e valida o checkpoint recebido como transição do estado anterior, com progresso monotônico e caminho conectado ao grafo seeded.
- O total de XP é limitado à recompensa máxima das ondas seeded nas salas visitadas, considerando o bônus da Bússola do Cartógrafo; testes rejeitam XP sem encontro disponível.
- Buffs de velocidade/dano aceitam apenas os tetos de design e só avançam depois de limpar, respectivamente, uma sala de descanso ou loja.
- A lista `runLoot` é validada contra os itens/cartas do plano assinado no token e os respectivos quartos limpos.
- A API rejeita regressão de salas/XP/buffs/loot/portal, teleporte por corredores não alcançáveis e saltos que tentam declarar todas as salas limpas com vitória do boss. Testes cobrem progressão válida, regressão, salto forjado e o fluxo autenticado da rota.
- A regra não valida simulação dos encontros nem a vida/dano server-side dos inimigos. O jogador ainda pode falsificar clears passo a passo; autoridade completa de combate permanece pendente.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 151/151 testes em 28 arquivos e build Next.js de produção local.
- Sem execução de migrations, alteração de dados remotos ou deploy nesta etapa.

## Incremento P1 — sprite original e smoke completo — 3 de outubro de 2026

- O Cartógrafo usou originalmente `artifacts/archive/public-art/cartographer-adventurer-spritesheet-v2.png`; a folha atual do avatar é gerada em SVG pelo runtime em `src/game/arpg/runtime/player-sprites.ts`.
- O collider de dungeon foi reposicionado para manter o footprint dentro das passagens; depois do ajuste, o percurso CDP completo passou em 844×390.
- Resultado: grafo seeded com 10 salas, chefe derrotado, loot elegível, extração concluída, retorno à Guilda e nenhum erro de runtime; HP final 126/154.
- `npm run verify:deploy`: PASS — typecheck, lint, 151/151 testes e build Next.js 16.3.6.
- Arte de inimigos/NPCs/chefes, objetos, cenário de acabamento, áudio, autoridade server-side dos combates e execução da migration persistente seguem pendentes. Sem alteração de banco ou deploy remoto.

## Incremento P1 — áudio procedural da dungeon — 3 de outubro de 2026

- A cena ARPG agora cria ambiência tonal por região e efeitos Web Audio originais para ataques, habilidades, dano, portas, baús, boss, portal e resultado de run. O contexto só é desbloqueado após gesto do jogador; ausência/bloqueio de Web Audio não interrompe a partida.
- A barra superior oferece toggle de mute acessível e persistente no navegador. A cena acompanha mudanças do controle e libera contexto/oscillators ao encerrar.
- `agent-browser` confirmou Guilda renderizada sem overlay e a alternância do controle on/off persistida. O smoke CDP visitante 844×390 percorreu 11 salas/23 visitas, venceu o boss, abriu recompensa, extraiu e voltou à Guilda sem eventos CDP de exceção ou rede.
- O mesmo smoke revelou avisos de chaves React duplicadas na lista quando itens de loot repetiam; a chave agora inclui o índice. `npm run verify:deploy`: PASS — TypeScript, ESLint, 161/161 testes em 29 arquivos e build Next.js local.
- Música e áudio de outras áreas ainda faltam. O smoke foi visitante; sem migration, homologação autenticada ou deploy remoto. A autoridade integral de combate server-side permanece pendente.

## Incremento P0 — escolha especial validada no checkpoint — 3 de outubro de 2026

- A validação de transição agora calcula as opções de descanso, evento e loja a partir do conteúdo da dungeon. O novo checkpoint precisa corresponder a um único resultado exato de HP, fragmentos, buffs, loadout, XP, loot e portal; isso bloqueia empilhar resultados de escolhas diferentes ou gastar fragmentos que o jogador não possuía.
- Testes aceitam as escolhas de evento válidas e rejeitam fragmentos/buffs forjados; o fluxo da rota persiste uma entrada em sala especial sem declarar que ela foi limpa.
- O smoke CDP visitante passou em 844×390: grafo de 8 salas, 14 visitas, combate/elite/evento/loja/descanso/tesouro, boss derrotado, extração e HUB; nenhum evento de exceção/rede nem aviso de chave React duplicada.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 162/162 testes em 29 arquivos e build Next.js local.
- A prova server-side de mortes e ondas continua pendente: checkpoints ainda podem declarar clears passo a passo. Nenhuma migration, homologação autenticada ou publicação foi realizada.

## Incremento P0 — clear de combate limitado por tempo do servidor — 3 de outubro de 2026

- Ao detectar entrada em uma sala, o Phaser envia o novo `currentRoomId` antes de ativar as waves. A API só aceita um clear de combate se o checkpoint salvo já marcar aquela sala como atual e se o tempo de servidor desde o salvamento atingir o mínimo calculado a partir das waves seeded e do tipo de encontro.
- Testes de rota cobrem clear prematuro e clear após o tempo mínimo. `npm run verify:deploy`: PASS — TypeScript, ESLint, 164/164 testes em 29 arquivos e build Next.js local.
- O smoke visitante de 844×390 passou depois da mudança: 10 salas/24 visitas, caminhos de combate/especiais/elite/tesouro, boss derrotado, extração e retorno ao HUB; zero eventos CDP.
- O limite temporal é uma defesa gradual contra clears instantâneos; não comprova que os ataques acertaram nem que os inimigos morreram. A autoridade de combate server-side ainda está pendente. Sem migration, teste Supabase autenticado ou deploy remoto.

## Incremento P0 — recompensas de combate recalculadas no servidor — 3 de outubro de 2026

- Para cada sala combat/elite/boss recém-limpa, a API reconstrói as waves a partir da seed e calcula XP e fragmentos exatos. XP considera a relíquia inicial assinada no token; fragmentos não aceitam falta/excesso por checkpoint.
- Testes de rota aceitam o delta previsto e rejeitam uma sala marcada limpa sem fragmentos seeded. O gate passou: `npm run verify:deploy`, TypeScript, ESLint, 165/165 testes em 29 arquivos e build local.
- O smoke CDP é visitante e não comprova esse caminho autenticado; E2E com staging, migration/pgTAP e deploy continuam pendentes.
- Clears continuam sendo declarados pelo Phaser. O servidor não simula posição, ataques, HP de inimigos nem mortes; o combate autoritativo integral permanece pendente.

## Incremento P1 — templates e arte de piso das Montanhas Rúnicas — 3 de outubro de 2026

- A geração da terceira expedição usava templates da Mata. As Montanhas agora têm 12 templates nativos, padrões de glaciar, ruína rúnica, santuário e arena de cume, além de paleta de gelo/pedra e glifos procedurais sem collider.
- A validação percorre 250 seeds rúnicas com spawns caminháveis; o teste existente continua validando 1.000 seeds da Mata. `npm run verify:deploy` passou com 167 testes em 29 arquivos.
- O smoke CDP em 844×390 carregou o canvas e o segundo atlas, confirmou ausência de overflow horizontal e de exceções/erros de rede. A rota local foi iniciada com uma chave `GAME_ACTION_SECRET` efêmera; nenhuma chave foi persistida.
- Sem migration, alteração remota ou deploy. Props em camadas e simulação de combate autoritativa continuam pendentes.

## Incremento P1 — movimento por clique/toque com pathfinding — 3 de outubro de 2026

- O clique/toque no chão agora gera rota A* em grade caminhável para o hub e para a dungeon. A navegação respeita paredes, obstáculos e corredores; durante combate a rota fica dentro da sala atual e um controle manual cancela o destino.
- Clique curto move; segurar o botão esquerdo continua permitindo ataque. Toque no chão não dispara ataque, e os botões de ataque, joystick, WASD e gamepad continuam ativos. As estações do hub agora exigem aproximação e interação em vez de teletransportar o jogador pelo clique no rótulo.
- Testes cobrem caminho ao redor de obstáculos, grade segura do hub, rota a cada estação e caminho START→BOSS em 120 seeds distribuídas pelos três biomas. `npm run verify:deploy`: PASS com 173 testes em 30 arquivos, typecheck, lint e build local.
- Smoke CDP confirmou deslocamento real em dungeon por mouse (118 px) e toque (198 px) em 844×390; com o A* atual, o personagem também percorreu a porta aberta e entrou na sala especial adjacente. Na Guilda, clique/toque aproximam do Cartógrafo, clique não teletransporta e `E` abre Expedições. Desktop 1366×768 e mobile 844×390 sem overflow; nenhum erro de runtime.

## Incremento P0 — auditoria de grants das runs persistentes — 3 de outubro de 2026

- O teste `supabase/tests/002_arpg_durable_runs.test.sql` agora declara 22 asserções. Além das verificações da tabela/RPCs públicas, cobre grants CRUD da role de servidor, bloqueio de chamada direta às funções privadas por `anon`/`authenticated`, wrappers públicos `SECURITY INVOKER` e `search_path` vazio nas quatro funções `SECURITY DEFINER` privadas.
- `docs/SUPABASE_STAGING.md` agora separa o inventário local de 33 migrations do histórico remoto comprovado, atualiza a sequência lexical e registra que o staging ainda precisa de `migration list`, lint SQL e pgTAP para as versões atuais.
- A CLI Supabase, Docker e acesso autenticado ao Postgres continuam indisponíveis neste ambiente. As novas asserções estão escritas, mas não executadas; não houve migration, mudança remota ou deploy.

## Incremento P1 — animação original do Curupira e estados das portas — 3 de outubro de 2026

- A folha original do Curupira foi preservada em `artifacts/archive/public-art/curupira-boss-spritesheet.png`; hoje o boss usa `public/art/monster-curupira-ancestral-spritesheet-v2.webp`.
- `DungeonWorldRuntime` registra OPEN, CLOSING, CLOSED e OPENING por conexão. O diagnóstico expõe o estado junto do collider; os cues de abrir/fechar já passam pelo áudio procedural da dungeon.
- `npm run verify:deploy`: PASS — typecheck, lint, 175/175 testes em 31 arquivos e build Next.js 16.3.6.
- Smoke CDP de visitante, 844×390, build de produção local: grafo de 12 salas, rota de 8 passos até o Curupira, extração e retorno à Guilda; idle/walk/attack/defeat observados; open/closed apareceram no diagnóstico, e opening também foi capturado em uma execução; 7/7 checks passaram e a lista de erros ficou vazia.
- Nenhuma migration, conta autenticada, dado Supabase ou deployment remoto foi usado. A simulação autoritativa do combate e a arte dos demais personagens continuam pendentes.

## Incremento P1 — papéis de combate para inimigos — 3 de outubro de 2026

- `EnemyDefinition` agora declara papéis melee, ranged, charger, caster e elite para as três regiões. Os estados de distância favorecem perseguição, recuo ou posição de conjuração; ataques locais usam projétil, investida com indicador, área telegráfica ou rajada conforme o papel.
- Testes validam as intenções de movimento e as atribuições de papel para Mata, Arquipélago e Montanhas.
- `npm run verify:deploy`: PASS — typecheck, lint, 181/181 testes em 32 arquivos e build Next.js 16.3.6.
- Smoke CDP de visitante, 844×390, build local: percorreu todas as 8 salas em 13 entradas, visitou combate, descanso, elite, evento, loja e tesouro, repetiu salas já limpas sem respawn, derrotou o Curupira, extraiu loot e voltou à Guilda; 7/7 checks passaram sem erros de runtime. O smoke não captura telemetria por tipo de ataque.
- Nenhuma migration, persistência autenticada ou publicação remota foi feita; o combate autoritativo e as animações dos demais inimigos seguem pendentes.

## Incremento P1 — animação original do Amarok — 3 de outubro de 2026

- O boss das Montanhas Rúnicas usa uma spritesheet original de quatro linhas com idle, caminhada, ataque e derrota; o profile compartilha o pipeline de animação do Curupira e preserva collider de footprint.
- O PWA pré-carrega a arte e invalida o cache estático anterior. A integração recebeu cobertura estrutural do PNG, grade, transparência e associação da região. O smoke local 844×390 percorreu 9 salas em 18 entradas, observou os quatro estados do Amarok, derrotou o boss, extraiu a run e voltou à Guilda; 7/7 checks passaram e os eventos CDP ficaram vazios.
- A captura do smoke também expôs compressão do HUD mobile. O CSS agora distribui status, loadout, minimapa e cartas em faixas distintas; a captura posterior mostra os painéis legíveis sem colisão entre eles.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 182/182 testes em 32 arquivos e build Next.js 16.3.6.
- Nenhuma migration, conta autenticada, alteração remota ou deployment foi necessária nesta etapa.

## Incremento P1 — animação original da Iara — 3 de outubro de 2026

- O boss do Arquipélago agora usa spritesheet RGBA original 4 × 4 de idle, caminhada, ataque e derrota. O pipeline de perfil foi generalizado para Curupira, Iara e Amarok; a Iara está associada à expedição correta e a folha entrou no pré-cache PWA v4.
- O smoke de produção local em 844 × 390 gerou 11 salas e percorreu 26 entradas, incluindo combate, elite, evento, descanso, loja, tesouro e boss. Observou os quatro estados da Iara e open/closed/opening nas portas; extraiu a recompensa, voltou à Guilda, passou 7/7 checks e terminou sem eventos CDP.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 183/183 testes em 32 arquivos e build Next.js 16.3.6.
- Nenhuma migration, conta autenticada, alteração remota ou deployment foi usada. A autoridade integral de combate e a homologação autenticada em Supabase staging continuam pendentes.

## Incremento P1 — padrões de três fases do Curupira — 3 de outubro de 2026

- A luta da Mata agora combina arco e raízes telegráficas na fase 1, rastros falsos com decoys e emboscadas na fase 2, e raízes físicas temporárias que bloqueiam caminhos na fase 3. O boss executa ao menos um padrão em cada fase mesmo quando sofre dano explosivo.
- Testes unitários cobrem a transição mínima entre fases e a sequência de padrões; o smoke local também verifica cobertura das três fases e presença de collider de raiz.
- Smoke browser no build de produção local, viewport 844×390: 9 salas geradas, 17 entradas, Curupira derrotado, padrões observados nas três fases, duas barreiras físicas simultâneas, loot extraído, retorno à Guilda, quatro animações do boss e 9/9 checks sem erros CDP.
- A captura `curupira-root-arena-smoke.png` mostra a arena durante a fase 3 com as duas barreiras ativas.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 187/187 testes em 33 arquivos e build Next.js 16.3.6.
- Nenhuma migration, alteração remota, validação autenticada em staging ou deployment foi feita; esses bloqueios de release continuam registrados acima.

## Incremento P1 — animação original do Broto Enraivecido — 3 de outubro de 2026

- A Mata associa o inimigo comum `sprout` à spritesheet RGBA original 4×4 com idle, caminhada, ataque e derrota. O perfil usa quadros 313×313, escala 0,2 e footprint de colisão preservado; `public/sw.js` pré-carrega a folha no cache PWA v5.
- O surgimento dos inimigos animados agora inclui 420 ms de pausa para leitura do idle; o ataque melee do inimigo troca temporariamente para a animação attack.
- Smoke CDP do build de produção local em 844×390: 11 salas/22 entradas, boss e padrões das três fases, duas barreiras simultâneas, extração e retorno à Guilda; quatro estados do Broto e do Curupira observados, 10/10 checks, eventos CDP vazios. Captura: `mata-sprout-enemy-smoke.png`.
- `npm run verify:deploy`: PASS — typecheck, lint, 188/188 testes em 33 arquivos e build Next.js 16.3.6.
- Outros inimigos comuns, NPCs/objetos, acabamento visual da 1.0, validação de staging autenticada e autoridade integral server-side seguem pendentes. Nenhuma migration, alteração remota ou publicação ocorreu nesta etapa.

## Incremento P1 — animação original do Boto-cor-de-rosa — 3 de outubro de 2026

- O Arquipélago associa `skirmisher` a uma spritesheet RGBA original 4×4 de idle, caminhada, ataque e derrota. O perfil usa quadros 313×313, escala 0,22, footprint próprio e cache PWA v6.
- Smoke CDP do build local em 844×390: 11 salas/24 entradas, Iara derrotada, extração e retorno à Guilda; os quatro estados do Boto e da Iara, 11/11 checks e nenhum evento CDP.
- Captura: `mares-boto-enemy-smoke.png`. `npm run verify:deploy`: PASS — typecheck, lint, 189/189 testes em 33 arquivos e build Next.js 16.3.6.
- Broto e Boto cobrem dois inimigos comuns, mas os demais inimigos, NPCs/objetos, autoridade integral server-side, homologação Supabase autenticada e release 1.0 continuam pendentes. Nenhuma migration ou publicação foi feita.

## Incremento P1 — animação original do Raijū — 3 de outubro de 2026

- As Montanhas associam `stormBeast` a uma spritesheet RGBA original 4×4 de idle, caminhada, ataque e derrota. O profile usa quadros 313×313, escala 0,22 e cache PWA v7.
- Smoke CDP focado em 844×390 concluiu a primeira sala de combate e viu os quatro estados do Raijū; captura: `montanhas-raiju-enemy-smoke.png`.
- Uma full-run após esta integração gerou 12 salas/26 entradas, derrotou Amarok com 19/150 HP, extraiu o loot, voltou à Guilda e observou os quatro estados de Amarok e Raijū, sem eventos CDP.
- `ARPG_SMOKE_FORCE_CHEST_PATHFINDING=1` forçou o harness a usar o A* do próprio jogo; três baús foram alcançados e abertos. Essa seed terminou em derrota no Amarok, então comprova navegação/interação e não vitória.
- As tentativas anteriores (duas derrotas no boss e uma aproximação de baú travada) foram sucedidas pela run completa bem-sucedida e pelo fallback A*; o gate ainda depende da autoridade server-side, staging autenticado e revisão restante de 1.0.
- `npm run verify:deploy`: PASS — typecheck, lint, 190/190 testes em 33 arquivos e build Next.js 16.3.6.
- Nenhuma migration, alteração remota, staging autenticado ou deploy foi feito. A simulação server-side completa, outros inimigos/NPCs/objetos e release 1.0 seguem pendentes.

## Incremento P0 — padrões de boss autoritativos — 3 de outubro de 2026

- O checkpoint de combate agora persiste padrões e fases do boss, telegráficos circulares/lineares, impacto calculado no servidor e teleportes determinísticos. Curupira segue sua sequência de seis padrões; Iara usa varredura/corrente; Amarok usa faixas de gelo/investida.
- O Phaser projeta avisos e raízes ativas da resposta do servidor; o modo persistente não executa os especiais locais que aplicavam dano concorrente. Movimento, colisão das raízes e dash no timestamp de impacto são decididos na simulação server-side.
- Testes focados cobrem acerto e esquiva, dash, barreira, transições e padrões regionais. `npm run verify:deploy` passou sem warnings: typecheck, ESLint, 209 testes em 34 arquivos e build local Next.js 16.3.6. Ainda falta o smoke visual autenticado no browser e homologação de staging/migrations/pgTAP; nenhum dado remoto foi alterado.

## Incremento P0 — combate persistente simulado no servidor — 3 de outubro de 2026

- A rota persistente de encontro agora reconstitui as waves seeded e salva `serverCombatState` dentro do checkpoint JSONB usando revisão CAS. Movimento caminhável e velocidade, cooldowns, ataques, habilidades, suportes, contato inimigo, projéteis ranged, volleys básicos do boss, HP, mortes, XP e fragmentos são calculados na API; runs visitantes continuam no modo local. Os projéteis server-side também são renderizados no Phaser.
- Clears requerem `victory` do simulador salvo; vitória da expedição exige boss derrotado e portal. Checkpoints não podem injetar o estado server-side nem alterar XP/fragmentos; transições não deixam sala de combate ativa. A inicialização exige posição junto a uma porta da sala e retomada sincroniza pela posição persistida.
- Testes focados incluem clear válido com rewards exatos, extração positiva após vitória salva do boss e rejeições de payload forjado. `npm run verify:deploy`: PASS — typecheck, ESLint sem avisos, 200/200 testes em 34 arquivos e build de produção Next.js 16.3.6 local.
- Padrões específicos de inimigos/bosses e E2E autenticado, migrations/pgTAP e dados de staging continuam sem validação por indisponibilidade da senha Postgres; nenhuma mudança remota ou deploy foi feito.

## Incremento P0 — sincronismo de movimento persistente — 3 de outubro de 2026

- Corrigido o endpoint de encontro: o caminho `sync` passava a posição já persistida por cima da posição atual enviada pelo Phaser, anulando todo deslocamento em combate autenticado.
- A posição atual segue agora para o simulador server-side, que valida velocidade por tempo decorrido, caminho caminhável e obstáculos. No retorno de uma retomada, o Phaser parte da posição persistida e os teletransportes continuam recusados.
- Teste integrado da rota autenticada cobre deslocamento válido, tentativa de teleporte e preservação do checkpoint válido. `npx vitest run src/app/api/arpg/run/route.test.ts`: 15/15 passaram.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 211/211 testes em 34 arquivos e build de produção Next.js 16.3.6 local.
- O hub carregou no browser local; não havia sessão autenticada para homologar combate persistente. Staging permanece sem senha PostgreSQL/CLI autenticada; nenhuma migration remota ou publicação ocorreu. Release 1.0 continua parcial.

## Incremento P0 — interação física em salas especiais — 3 de outubro de 2026

- Descanso, evento e loja agora recebem props procedurais contextualizados (fogueira, altar e banca de mercador). Um prompt dentro da sala indica interação; entrar na sala não abre mais o modal de escolha.
- A interação só ocorre quando o personagem está até 128 px do prop e usa `E`, gamepad ou controle de toque. As portas ficam livres até a escolha; após confirmar, são reabertas e o prop mostra “RESOLVIDO”.
- Smoke visual CUA no browser local confirmou banca, aproximação do jogador, abertura das três opções com `E`, escolha “Seguir viagem” e retorno ao jogo. O percurso foi visitante, sem autenticação Supabase.
- Cobertura de alcance passou; `npm run verify:deploy`: PASS — typecheck, ESLint, 211/211 testes em 34 arquivos e build Next.js 16.3.6 local.
- A banca e os demais props ainda usam ilustrações procedurais básicas; os outros NPCs, o acabamento de cenário e a validação autenticada continuam pendentes. Nenhuma migration remota ou publicação ocorreu.

## Incremento P1 — Mestre da Forja na Guilda — 3 de outubro de 2026

- Uma spritesheet original 4×4 foi integrada à Guilda e pré-carregada pelo service worker PWA v8. O Mestre da Forja usa poses distintas de espera, trabalho, fala quando o jogador se aproxima do Arsenal e caminhada curta entre as estações.
- Smoke CUA local de visitante confirmou a arte na Guilda, o destaque do Arsenal, o prompt do Mestre da Forja e a troca para a pose de fala após aproximação. A cena não tem collider próprio para o NPC.
- `npm run verify:deploy`: PASS — typecheck, ESLint sem avisos, 211/211 testes em 34 arquivos e build de produção Next.js 16.3.6 local.
- A Guilda segue parcial: os demais NPCs, sistemas narrativos e acabamento ambiental ainda não estão completos. Staging autenticado e gate de release continuam pendentes.

## Incremento P1 — objetos quebráveis nas dungeons — 3 de outubro de 2026

- Salas que não são de chegada recebem de um a três props determinados pelo seed da run e pelo id da sala: caixas, vasos, arbustos ou relíquias adequados à região. O helper evita água, paredes, pedras bloqueadas e o centro da rota.
- Projéteis e ataques de área danificam esses objetos. O último acerto dispara som, pulso e detritos; os props não têm collider, não bloqueiam movimento e não concedem recompensa.
- Smoke de visitante chegou à segunda sala e confirmou duas caixas renderizadas. O acerto destrutivo ainda não foi confirmado visualmente; a duração dos objetos não é persistida após reload.
- A suíte cobre seed, posições caminháveis e durabilidade, incluindo redução de HP até quebra. `npm run verify:deploy`: PASS — typecheck, ESLint sem avisos, 215/215 testes em 35 arquivos e build Next.js 16.3.6.
- O smoke visual confirmou o spawn na sala; ainda falta comprovar no browser um golpe destruindo o prop.

## Incremento P1 — acentos ambientais por bioma — 3 de outubro de 2026

- A Mata desenha árvores nos obstáculos de pedra e varia entre tochas pulsantes e vaga-lumes segundo o padrão da sala. O Arquipélago anima reflexos sobre tiles de água; as Montanhas animam cristais nos obstáculos e faíscas sobre glifos.
- Os objetos ficam em camadas visuais acima do tilemap e não alteram tiles navegáveis ou colisores. As escolhas de ambiente se mantêm iguais para a mesma seed e sala.
- `npm run verify:deploy`: PASS — typecheck, ESLint sem avisos, 215/215 testes em 35 arquivos e build Next.js 16.3.6 local. O smoke no build de produção local confirmou acentos visuais na Mata; os três biomas ainda precisam de revisão comparativa em salas além da START.

## Incremento P1 — tela de título pixel art — 4 de outubro de 2026

- A abertura agora apresenta uma ilustração original da floresta e do portal; a versão PNG inicial está preservada em `artifacts/archive/public-art/title-screen-forest-portal.png`, e a tela ativa usa `public/art/folklard-title-forest-portal-pixel-v3.webp`. Há JOGAR, ENTRAR, CONFIGURAÇÕES e CRÉDITOS. O botão de entrada reaproveita o fluxo existente de login; quando Supabase não está configurado, o modal informa isso e não simula uma conta.
- Configurações lê e grava `arpg.soundEnabled`, a mesma preferência aplicada pela dungeon. Créditos e configurações usam modais acessíveis; o service worker foi atualizado para cache PWA v9.
- Smoke CUA no build de produção local, 1280×720: conferiu a composição do título e os quatro botões, alternou o áudio e o restaurou ao estado ligado, abriu créditos e o portal de entrada, e confirmou JOGAR → HUB da Guilda. Não havia Supabase configurado, então a autenticação real não foi tentada.
- `npm run verify:deploy`: PASS — typecheck, ESLint sem avisos, 215/215 testes em 35 arquivos e build Next.js 16.3.6.
- Login Supabase real, conta autenticada e progresso remoto não foram homologados nesta etapa; nenhuma alteração de banco ou deployment foi feita.

## Incremento P1 — smoke móvel da abertura — 4 de outubro de 2026

- O build local passou em portrait 390×844 e 320×568 e landscape 844×390: ilustração carregada, quatro controles visíveis, viewport sem overflow horizontal e todos os botões dentro da tela.
- Em 390×844, toque abriu Configurações, alternou o áudio e restaurou o valor inicial; Créditos mostrou as quatro linhas sem cortar o modal. Capturas: `title-screen-390x844.png`, `title-settings-390x844.png`, `title-credits-390x844.png`, `title-compact-portrait-320x568.png` e `title-landscape-844x390.png`.
- Isso fecha a revisão visual móvel da abertura, não a matriz mobile completa de dungeon/PWA. Autenticação real e progresso remoto continuam sem homologação local.

## Incremento P0 — dash autoritativo persistente — 4 de outubro de 2026

- O simulador aplica o dash no servidor com limite de 610 px/s por 170 ms e cooldown derivado da armadura, bloqueando paredes, obstáculos e raízes ativas. O estado JSON registra `nextDashAtMs`; posições locais já deslocadas são ignoradas no comando de dash, e a resposta autoritativa reposiciona o Phaser.
- A cobertura verifica distância máxima, cooldown, repetição antecipada e sincronização imediatamente após a esquiva. `npx vitest run src/game/arpg/dungeon/combat-authority.test.ts`: 16/16. `npm run verify:deploy`: PASS — typecheck, ESLint, 216/216 testes em 35 arquivos e build de produção Next.js 16.3.6.
- A conta Supabase conectada lista outros projetos, e `get_project`/`list_migrations` no staging `ywawwhnsvpfeppfcuwzg` retornaram acesso negado. Faltam também senha PostgreSQL, access token, CLI, Docker e `psql`; não foi possível validar nem aplicar migrations/pgTAP. Nenhuma alteração remota ou publicação ocorreu.
- A run persistente ainda precisa de smoke autenticado em browser; o dash agora tem cobertura local focada, mas isso não comprova o fluxo real de staging. A revisão visual mobile e os demais itens parciais da release continuam no checklist.

## Incremento P1 — destruição de objeto quebrável — 4 de outubro de 2026

- O diagnóstico `debugDungeon=1` reporta atividade, HP, tipo e coordenadas dos props quebráveis; fora desse modo, esses dados não são expostos pelo debug do browser.
- Smoke `scripts/arpg-breakable-smoke.mjs` na build de produção local: run visitante em 844×390, sala de combate da Mata, Espada de Ferro, aproximação a 88 px e arbusto de 20 HP reduzido a zero/inativo. O efeito de quebra remove o prop; não houve exceções ou falhas de rede. Capturas: `breakable-objects-before.png` e `breakable-objects-broken.png`.
- Para iniciar o token da run no build local, o processo recebeu um `GAME_ACTION_SECRET` aleatório e efêmero; nenhum segredo foi persistido. O smoke não usou Supabase nem prova a quebra em run autenticada. Recurso e estado da quebra não são persistidos; release segue parcial.

## Incremento P1 — ícones e cache de instalação PWA — 4 de outubro de 2026

- O service worker pré-armazena o conjunto essencial com `cache.addAll`; `/icon.svg` estava listado, mas faltava no `public`, então a resposta 404 impedia a ativação do worker.
- Adicionei ícone original SVG, PNGs 192×192 e 512×512, variante maskable 512×512 e Apple Touch Icon 180×180 ao manifest/cache; a versão subiu para v11 para atualizar instalações existentes.
- `scripts/arpg-pwa-smoke.mjs` validou manifest 200, modo standalone/landscape, PNGs e dimensões, Apple Touch Icon, service worker `activated`, assets no cache v11 e remoção do cache v10 anterior na build local de produção.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 216/216 testes em 35 arquivos e build Next.js 16.3.6. Instalação em aparelho e matriz mobile completa seguem pendentes; nenhuma migration ou publicação ocorreu.

## Incremento P1 — Arquivo das Lendas e Mercador no HUB — 4 de outubro de 2026

- A Guilda passou de seis para oito estações físicas com caminhos navegáveis. O Arquivo abre o loadout de cartas/suportes; o Mercador leva ao empório existente e o botão de retorno mantém o jogador na Guilda quando a entrada veio do HUB. Props usam mesa de cartas e banca; os marcos visuais agora são ovais. A Mercadora tem spritesheet original 4×4 com animações de espera, trabalho, fala e caminhada, pré-carregada no cache PWA v12.
- `scripts/arpg-hub-smoke.mjs` passou em build de produção: aproximação ao Cartógrafo, interação `E`, Arquivo→cartas, Mercador→loja→Guilda e tap-to-move em 844×390; sem overflow nem erros CDP. A suíte verifica rotas até as oito estações. Captura: `arpg-hub-mobile-smoke.png`.
- O empório ainda vende energias; itens/cosméticos, demais NPCs/diálogos e validação autenticada da progressão continuam pendentes. A integração da Mercadora foi aprovada por `npm run verify:deploy` — typecheck, ESLint, 216/216 testes e build Next.js 16.3.6 — e pelos smokes de hub desktop/mobile e PWA v12. O smoke PWA semeou um cache v11 antes do registro e confirmou sua remoção, com a spritesheet da Mercadora no cache v12.

## Incremento P1 — Santuário dos Espíritos na Guilda — 4 de outubro de 2026

- Adicionei a nona estação física, com pedestal e duas chamas espirituais. Ela abre direto os dois slots de suporte e as opções desbloqueadas; Arquivo das Lendas abre a coleção de quatro cartas-habilidade, sem outros equipamentos na tela.
- O smoke de produção percorreu a Guilda com WASD, pressionou `E` no Santuário e verificou os dois slots; também confirmou foco do Arquivo, entrada do Cartógrafo, Mercador e retorno, tap-to-move mobile, sem overflow ou erros fatais. A suíte do grafo passou rotas para todas as nove estações.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 216/216 testes em 35 arquivos e build Next.js 16.3.6.

## Incremento P1 — Portal físico das dungeons — 4 de outubro de 2026

- A Guilda agora tem dez estações. O portal pixel art fica separado do Portal de Raid e leva direto à escolha de expedição; o Cartógrafo mantém o acesso ao mapa.
- O smoke de produção confirmou aproximação WASD e `E` no portal, além do Santuário alcançado pelo joystick móvel e os dois slots abertos pelo botão Interagir. A tela de suporte não teve overflow em 844×390; nenhuma exceção fatal CDP ocorreu.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 216/216 testes em 35 arquivos e build Next.js 16.3.6.

## Incremento P1 — mapa expandido e descoberta persistente — 4 de outubro de 2026

- `TAB` abre um mapa modal acessível com as salas alcançadas e as conexões já descobertas; as salas na fronteira continuam com tipo desconhecido. O mapa pausa a cena e fecha com `TAB` ou `ESC`, que retoma a partida.
- O checkpoint JSONB agora carrega `visitedRoomIds`, restaura o conjunto visitado ao retomar e rejeita visitas novas fora da sala atual. Checkpoints antigos continuam aceitos sem migration; a validação mantém visitas alcançáveis, sem duplicatas e monotônicas.
- A captura do overlay em 844×390 expôs posicionamento herdado do minimapa compacto e overflow vertical. O layout expandido reseta as coordenadas do HUD e compacta mapa, legenda e botão de continuação em paisagem curta; o smoke exige que painel e botão caibam na viewport.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 236/236 testes em 42 arquivos e build local Next.js 16.3.6. `scripts/arpg-river-visual-smoke.mjs`: 14/14 checks em 844×390, incluindo sala fluvial física, diálogo acessível, máscaras, pausa, fechamento e retomada; zero erros de runtime. Capturas: `arpg-map-overlay-smoke.png` e `arpg-river-visual-smoke.png`.
- Staging autenticado, migrations/pgTAP remotos e gate final seguem bloqueados pela falta de acesso ao projeto e credenciais Postgres; nenhuma alteração remota ou publicação foi feita.

## Incremento P1 — benchmark de stress mobile — 4 de outubro de 2026

- `scripts/arpg-mobile-performance-smoke.mjs` agora exercita 10/25/50 inimigos, 100/300 projéteis e 300 partículas em Chrome/WebGL com viewport 844×390. O harness confirma as quantidades criadas, o canvas dentro da viewport e ausência de exceções ou falhas de rede bloqueantes; fecha sua própria aba e salva `arpg-mobile-performance-smoke.json` mesmo quando a meta de FPS falha.
- A primeira medição marcou 47,2–49,7 FPS sob carga; duas repetições recentes no build de produção local, Chrome 154/WebGL, 844×390 sem throttling, marcaram 60,2–60,3 FPS em todos os cenários. As contagens exatas e ausência de erros/overflow foram confirmadas nas duas; a divergência mantém o aceite parcial até medição estável em aparelho real.
- Os pools de projéteis agora suportam 320 objetos para cobrir o cenário de 300. `npm run verify:deploy` passou com typecheck, ESLint, 236/236 testes em 42 arquivos e build Next.js 16.3.6. Nenhuma migration, gravação remota ou publicação ocorreu.

## Incremento de validação — jornada completa da Mata — 4 de outubro de 2026

- Build de produção local isolada, Chrome 844×390: JOGAR abriu a Guilda, o Cartógrafo iniciou a expedição, o grafo gerou 11 salas e o jogador atravessou 24 entradas físicas; limpou combates e elite de duas ondas, abriu o tesouro, derrotou o Curupira (147/154 HP), coletou loot, extraiu e voltou à Guilda.
- Os 12 checks passaram: boss alcançado, extração e retorno, zero erros de runtime, animações de idle/walk/attack/defeat do Broto e do boss, padrões das três fases, duas raízes físicas e portas abertas/fechadas. O smoke aguarda em posição neutra por 620 ms antes de seguir inimigos ocultos, para não provocar contato antes de observar idle.
- Run visitante; sem Supabase ou mutação remota. `node --check scripts/arpg-full-run-smoke.mjs` passou. Performance pesada, staging autenticado e gate final continuam parciais; nenhuma publicação ocorreu.

## Incremento P1 — fragmentos de objetos quebráveis — 4 de outubro de 2026

- Destruir um prop seeded concede um fragmento temporário da run, com sprite animado de coleta, cue de loot e atualização imediata do HUD/checkpoint. O recurso não vira moeda ou item permanente.
- A validação aceita +1 somente por ID de prop novo e válido. O prêmio pode coexistir com cache, escolha especial ou clear; a rota mantém esse saldo no estado autoritativo de combate após a próxima ação.
- Testes focais de checkpoint e da rota autenticada com mocks locais cobrem delta forjado e preservação do fragmento. `npm run verify:deploy` passou: typecheck, lint, 236/236 testes em 42 arquivos e build local.
- Smoke de produção local em 844×390: relíquia de 54 HP destruída, HUD/checkpoint com 1 fragmento, prop inativo e zero erros. O fluxo é visitante/local; reload autenticado em staging continua pendente por falta de acesso. Nenhuma alteração remota ou publicação ocorreu.
- A jornada completa foi repetida após a mudança: 10 salas, 24 entradas, elite, tesouro, Curupira derrotado com 130/154 HP, extração e retorno à Guilda; 12/12 checks e zero erros de runtime.

## Incremento P1 — ação touch em salas especiais e jornada completa — 4 de outubro de 2026

- Em sala ativa de evento, descanso ou loja, `TouchControls` agora exibe o botão acessível “Interagir com sala especial”. `ArpgGame` deriva sua disponibilidade do nó atual e esconde a ação enquanto escolha, loot ou fim de run está aberto. O teste de componente verifica o rótulo e `queueInteract`.
- `scripts/arpg-full-run-smoke.mjs` interagiu pelo controle touch, abriu e concluiu evento, descanso e loja. Revisitas permaneceram limpas. A coleta de animação agora amostra a cada 16 ms e observou `idle`, `walk`, `attack` e `defeat` do Broto sem perder o evento curto.
- Smoke na build local de produção, Chrome 844×390: 11 salas, 23 resoluções, elite de duas waves, tesouro, Curupira derrotado com 111/154 HP, loot, extração e retorno à Guilda. As 12/12 verificações passaram, incluindo os quatro estados do boss, fases, barreira física e zero erros de runtime.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 237/237 testes em 42 arquivos e build local Next.js 16.3.6. `node --check` e ESLint do smoke passaram. Run visitante; homologação autenticada, migrations no staging, aparelho real e revisão auditiva continuam pendentes. Nenhuma alteração remota ou publicação ocorreu.

## Revalidação P1 — matriz responsiva desktop e mobile — 4 de outubro de 2026

- `scripts/arpg-cdp-audit.mjs` agora espera as transições atuais do HUB e das rotas do Cartógrafo; diagnóstico de falha inclui a rota visível e estado do canvas.
- Build local de produção no Chrome 154: 1920×1080, 1366×768, 1280×720, 844×390, 932×430 e 390×844 retrato passaram 5/5 checks cada. Não houve overflow nem erro fatal; controles touch apareceram nas duas paisagens móveis e o gate de rotação ocupou a viewport retrato.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 237/237 testes em 42 arquivos e build local Next.js 16.3.6. Cobertura headless não substitui teste de instalação, controles e leitor de tela em dispositivo real; staging autenticado e revisão auditiva ainda pendentes.

## Revalidação P0 — jornadas completas nos três biomas — 4 de outubro de 2026

- Ajustei somente o harness `scripts/arpg-full-run-smoke.mjs` para escolher esquiva de boss com base na posição atual do jogador e evitar limites da sala; nenhum atributo ou regra do jogo mudou.
- Em build de produção local, Chrome 844×390: Arquipélago das Marés (11 salas), Iara derrotada com 24/154 HP; Montanhas Rúnicas (12 salas), Amarok com 85/150 HP; Mata Encantada (12 salas), Curupira com 138/154 HP. Cada run visitante completou extração e retorno à Guilda, passou 12/12 checks e não registrou erro de runtime.
- Foram observados os quatro estados de animação de Iara/Boto, Amarok/Raijū e Curupira/Broto. Na Mata: padrões das três fases, duas barreiras de raiz, elite em duas waves, tesouro e interação touch de loja/descanso/evento.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 237/237 testes em 42 arquivos e build Next.js 16.3.6. A homologação autenticada/staging, migrations/pgTAP, validação em aparelho real e revisão auditiva continuam pendentes; sem gravação remota ou publicação.

## Revalidação P0 — travessia desktop completa — 4 de outubro de 2026

- O `scripts/arpg-full-run-smoke.mjs` ganhou modo de viewport desktop 1366×768 com WASD, E, atalhos de habilidade e mouse; o modo touch 844×390 permanece padrão. As coordenadas de inimigos ativos ficam disponíveis apenas no debug local `debugDungeon=1`.
- Em build local de produção, Chrome desktop headless: Mata gerou 12 salas, registrou 27 entradas, resolveu combate, elite de duas waves, tesouro e evento/descanso/loja, derrotou Curupira com 101/154 HP, extraiu e voltou à Guilda. 12/12 checks passaram, incluindo animações de Curupira/Broto, fases, raízes físicas, portas e zero erros de runtime.
- A travessia desktop headless está coberta. Ainda falta validar mouse/teclado e acessibilidade em aparelho/navegador real, além de staging autenticado, migrations/pgTAP e revisão auditiva; nenhum dado remoto foi alterado nem publicação feita.

## Revalidação final dos smokes locais — 4 de outubro de 2026

- Repeti os três percursos touch na build local de produção, Chrome 844×390: Iara terminou com 45/154 HP, Amarok com 34/150 HP e Curupira com 111/154 HP. As três runs visitantes passaram 12/12 checks, extraíram o loot, voltaram à Guilda e não registraram erros de runtime.
- Na Mata foram observados idle/walk/attack/defeat do Broto e do Curupira, padrões das três fases, duas barreiras de raiz e estados de portas aberta/fechada/abrindo/fechando. A extensão da amostragem a até oito salas de combate/elite capturou o idle do Broto neste run.
- O smoke desktop headless 1366×768 permanece aprovado: Curupira com 101/154 HP e 12/12 checks. `node --check` e ESLint passaram após a última edição do harness. O `npm run verify:deploy` do snapshot do jogo passou com typecheck, ESLint, 237/237 testes em 42 arquivos e build Next.js 16.3.6.
- Permanecem pendentes staging autenticado e migrations/pgTAP/RLS/grants remotos, validação PWA/acessibilidade/performance em dispositivo real e revisão auditiva humana. Não foi feita escrita remota nem publicação.

## Rechecagem de ambiente e benchmark mobile — 4 de outubro de 2026

- A listagem do conector Supabase retornou somente `cryohive` (ativo, fora do escopo autorizado) e `SnowLH's Project` (inativo). O staging Card Realms `ywawwhnsvpfeppfcuwzg` continua ausente da conta conectada; CLI, Docker, `psql` e variáveis de acesso ao banco não estão disponíveis localmente. Não consultei nem alterei outro projeto.
- Repeti o benchmark de produção local duas vezes em Chrome/WebGL emulado a 844×390, sem throttling. Nos sete cenários (0, 10, 25 e 50 inimigos; 100 e 300 projéteis; 300 partículas), ambas as rodadas ficaram entre 60,3–60,4 FPS, com contagens corretas, canvas sem overflow e zero erros bloqueantes. O JSON contém a segunda rodada; a medição de 47,2–49,7 FPS segue registrada como variação histórica.
- O desempenho local ficou estável nas quatro rodadas recentes, mas aparelho real continua pendente. Nenhuma migration, escrita remota ou publicação foi realizada.
- Revalidei também o PWA na mesma build: 10/10 checks para manifest standalone/landscape, ícones, assets essenciais, ativação do service worker e remoção do cache v13 após a ativação do v14. O smoke exige URL loopback, limpa somente Service Worker/Cache Storage na origem local e semeia a versão anterior antes do registro; valida ciclo de atualização no browser, não instalação real em aparelho.

## Estado de release após rechecagem de 4 de outubro de 2026

- Full-run Mata 844×390: 14/14 checks, 9 salas/18 resoluções com revisitas, boss 120/154 HP, três fases, duas barreiras, estados animados do boss/Broto, baú frames 1–3 e zero erros. Dimensões observadas pelo debug real: 80,194–94,221 px durante entrada; nominal 92 px a escala 0,14673046.
- O último relatório de performance (`2026-10-04T12:11:10.446Z`) passou 6/6 checks a 58,3–60,5 FPS sem throttling; PWA v15 passou 10/10. São verificações locais/headless, não instalação ou medição em aparelho real.
- A sessão do navegador Supabase vê o projeto de produção `lfmbvqixixbhffdpmvhp` e 19 migrations sem nome ARPG; o staging autorizado `ywawwhnsvpfeppfcuwzg` não aparece. Isso não prova ausência de schema; nenhuma consulta SQL ou escrita remota ocorreu. A v1.0 segue parcial por falta de staging verificável, validação em dispositivo real e revisão auditiva humana.
- O layout compacto do HUD touch landscape está em implementação/revisão. Não há resultado visual do HUD nem novo `verify:deploy` neste registro; esses gates aguardam a validação coordenada.

## Contrato final do lobby e validação — 4 de outubro de 2026

- O jogador usa seu próprio avatar, criado/customizado no Ateliê. O mesmo `AvatarConfig` é aplicado à Guilda e à dungeon. Criaturas folclóricas aparecem como poderes em cartas, não como companheiros de combate.
- O loadout tem exatamente dois ataques. Raízes Ancestrais e Chama do Boitatá são cartas iniciais gratuitas; as demais cartas são compradas com moedas de jogo e equipadas apenas no Arquivo de Poderes da Guilda. Armas, armaduras e buffs temporários vêm das dungeons; a loja do lobby não vende equipamento de combate.
- `npm run verify:deploy`: PASS — 292/292 testes em 59 arquivos no gate final registrado abaixo, além de typecheck, ESLint sem warnings e build local.
- Evidência IAB com visitante: saldo de 500 para 420 moedas após comprar Caipora por 80; Caipora equipada; avatar salvo no Ateliê; entrada na dungeon com dois slots de ataque, HUD e equipamento visíveis. Isso confirma esses passos de lobby/entrada; não confirma execução de uma run completa nem validação mobile.
- O staging `ywawwhnsvpfeppfcuwzg` não apareceu na interface Supabase logada no Vivaldi. Nenhuma migration remota foi aplicada. pgTAP e Supabase local estavam indisponíveis; o schema do staging continua sem homologação. A release 1.0 permanece incompleta.

## Contrato final de combate: avatar + dois poderes — 4 de outubro de 2026

- Este registro supersede referências de etapas anteriores a equipes de criaturas, apoiadores e escolha obrigatória de criatura inicial. Combate clássico, batalhas PvP e o backend antigo de Raid agora usam o avatar próprio e exatamente dois poderes distintos. Uma conta autenticada nova pode ir direto à Guilda/Ateliê; as duas cartas iniciais são gratuitas, e poderes adicionais são comprados/equipados no Arquivo da Guilda.
- A batalha clássica e a readiness PvP verificam dois poderes conhecidos e possuídos sem exigir arma, armadura ou relíquia de dungeon. Antes de sair do Arquivo para PvP ou iniciar uma batalha clássica, o loadout é persistido. Visitantes enviam a configuração local do avatar e os dois poderes ao início da batalha; o servidor valida o par e assina o estado. Para conta autenticada prevalece o snapshot remoto.
- Equipes e tabelas antigas continuam armazenadas para histórico, mas `TeamView` e o gate `StarterChoice` não são montados. Rotas de combate antigas não reabrem batalhas PVP v2. Salas antigas de Raid ficam classificadas como legado e não entram na retomada automática. Novas salas congelam o modo avatar; Raid ARPG segue como modo próprio. Nenhuma dungeon ou Raid ARPG usa ações/controles de apoiador; somente três chaves de checkpoint antigo são lidas e descartadas na normalização.
- O teste integrado final passou: `npm run verify:deploy` — TypeScript, ESLint sem warnings, Vitest 292/292 em 59 arquivos e build local Next.js 16.3.6.
- As 38 migrations do repositório e os planos pgTAP recentes conferem estaticamente: 016 (10), 017 (38), 018 (26) e 019 (52). Não foi possível executar pgTAP nem validar em banco a conversão/backfill de salas e recompensas antigas, inclusive o arquivamento de lobby sem snapshot válido.
- O staging autorizado `ywawwhnsvpfeppfcuwzg` continua ausente da conta Supabase conectada no Vivaldi. Não houve consulta de schema, aplicação de migration, gravação remota ou deploy; produção não foi usada como substituto. A release permanece incompleta até a homologação no staging e os aceites reais de dispositivo/acessibilidade.
