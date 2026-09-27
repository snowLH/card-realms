# Estado verificável do projeto

## Entregue na fundação atual

- Cinco elementos definidos uma única vez e compartilhados por regras, catálogo, UI e migration.
- Equipes de seis em tipos, criação de batalha, UI e snapshot SQL.
- Energia como cartas: baralho, embaralhamento, mão, compra, anexação, custo e descarte.
- Turno explícito com fase principal e troca forçada; troca voluntária encerra o turno.
- Defesa, velocidade, crítico, escudo e seis efeitos de status funcionais.
- IA que planeja anexações e escolhe ataques por custo, chance e afinidade.
- 25 criaturas de folclores e mitologias reais com proveniência estruturada.
- Sprite sheet 5×5, um recorte por criatura, coerente com a arte 2D do protótipo.
- Posição no mapa, adjacência entre regiões e viagem persistida.
- Save local v2 validado, migração do v1 e recuperação segura de corrupção.
- Token de batalha cifrado e autenticado; redirect de autenticação restrito à mesma origem.
- Migration de banco para catálogo real, cinco elementos e helpers privilegiados fora do schema exposto.
- Progresso remoto modelado para perfil, coleção, equipe, energia, inventário, mundo, missões, conquistas, casa e histórico.
- Bootstrap Server Component com alternância explícita entre fonte local, Supabase e cache de emergência.
- Viagem validada por adjacência, tesouro com ledger idempotente e equipe ativa de seis via RPCs transacionais.
- Salão PVP com convites apenas entre amigos aceitos, expiração, aceitação/cancelamento e reabertura de sala.
- Estado PVP persistente, controle otimista de versão, idempotência por ação, turno validado no banco e resultados gravados sem recompensas competitivas prematuras.
- Broadcast privado para desafios/eventos, polling de recuperação e projeção que não entrega mão, baralho ou tokens internos adversários.
- Acesso direto ao estado autoritativo de `battles`, `battle_actions`, `battle_events` e `battle_participants` removido das roles de cliente.
- 32 testes TypeScript e um conjunto pgTAP de 29 asserções para schema, grants, RLS, amizade e fronteira PVP.

## Limites ainda honestos

- As migrations de progresso e PVP estão versionadas, mas precisam ser aplicadas e validadas no projeto Supabase remoto; não há `.env.local` e o Postgres local do Supabase não está ativo (`127.0.0.1:54322` recusou conexão).
- O PVP não foi testado entre duas contas/sessões reais. Portanto, ele está implementado como fundação, mas **não está concluído nem homologado**.
- Replay/idempotência da rota demonstrativa contra NPC usa memória do processo; o PVP não reutiliza essa limitação e depende do commit transacional.
- O modo online está conectado no código, mas a sincronização entre dispositivos só pode ser comprovada após aplicar as migrations e fornecer credenciais.
- Não há ainda fluxo visual para criar/aceitar amizades; o Salão lista relações `accepted` já existentes.
- Matchmaking público, ranking, abandono/timeout, rematch e recompensas PVP balanceadas ainda não existem.
- O mapa representa deslocamento entre nós; não há colisão ou navegação livre por tiles.
- A IA não troca estrategicamente uma criatura viva e ainda não possui perfis de chefe.
- Inventário utilizável, missões jogáveis, captura, bestiário completo e áudio ainda não estão implementados; o PVP permanece não homologado.

## Próximos marcos recomendados

1. Conectar staging, aplicar todas as migrations, executar advisors/lint do banco e gerar tipos TypeScript.
2. Criar duas contas de teste, aceitar amizade e validar convite → aceite → turnos → reconexão → término em dois navegadores.
3. Adicionar testes SQL/RLS para acesso cruzado, replay simultâneo e corrida de versão.
4. Implementar amizade, seleção de equipe e aquisição de criaturas como fluxos verticais completos.
5. Extrair apresentação da arena em componentes menores e adicionar testes de interação PVP.
6. Adicionar pipeline de conteúdo versionado para 400+ seres e evoluir mapas por cenas/tiles.

Nenhum marco futuro deve ser apresentado ao jogador como concluído antes de funcionar entre sessões, contas e dispositivos reais.

## Homologação de staging — 27 de setembro de 2026

A origem continua sendo o projeto `Card Realms` (`lfmbvqixixbhffdpmvhp`) em `sa-east-1`, sem alterações nesta intervenção. O destino foi validado na conta `cryohive11@gmail.com`: organização Free `cryo` (`vdxeeviukkxoztfvmaoe`) e projeto vazio `Card Realms` (`ywawwhnsvpfeppfcuwzg`), em `us-east-1`, conectado ao repositório `snowLH/card-realms`. Esse projeto existente será o staging. O projeto antigo chamado `cryohive` continua fora de escopo e não foi alterado.

A branch remota `staging` foi criada a partir de `main`, e a integração Supabase foi configurada para aplicá-la somente no projeto de staging. O PR para `main` permanece aberto e não deve ser mesclado antes da homologação real.

O preflight somente de leitura está registrado em `docs/SUPABASE_TRANSFER.md`. A origem passou nos checks de saúde, integrações e Log Drains, mas a transferência de produção continua **BLOCKED** até que `henrysoldan@gmail.com` seja convidado para `cryo` e até que o backup lógico restarável seja gerado. O staging já existe e está vazio: sem tabelas públicas, sem usuários, sem buckets, sem migrations remotas e com uso de banco reportado como zero. As migrations e o PvP ainda não foram executados.

Até existir um projeto isolado, a matriz real permanece reprovada por ausência de execução — não por inferência a partir dos testes locais:

| Sistema | Resultado | Evidência atual |
| --- | --- | --- |
| Migrations staging | NOT TESTED | projeto e branch `staging` isolados; merge de implantação e aplicação remota ainda pendentes |
| RLS | NOT TESTED | pgTAP criado, ainda não executado contra o schema migrado |
| Login A/B | NOT TESTED | duas sessões reais ainda não executadas |
| Convite PvP | NOT TESTED | ainda não executado em staging |
| Aceite | NOT TESTED | ainda não executado em staging |
| Turnos | NOT TESTED | apenas motor local testado; falta ponta a ponta |
| Energia | NOT TESTED | apenas motor local testado; falta ponta a ponta |
| Rolagem server-side | NOT TESTED | implementação e contrato local validados; falta observação real |
| Troca voluntária | NOT TESTED | apenas motor local testado; falta ponta a ponta |
| Troca forçada | NOT TESTED | apenas motor local testado; falta ponta a ponta |
| Realtime | NOT TESTED | política/código preparados; canal real não assinado |
| Polling fallback | NOT TESTED | código presente; perda de evento real não ensaiada |
| Reconexão | NOT TESTED | refresh e queda de sessão real não ensaiados |
| Anti-replay | NOT TESTED | testes locais cobrem contrato; concorrência real não ensaiada |
| Dados privados | NOT TESTED | fronteira endurecida; HTTP/RPC/Realtime reais ainda não sondados |
| Resultado persistido | NOT TESTED | schema presente; logout/login real não ensaiado |
| Progresso remoto | NOT TESTED | schema presente; segunda sessão/dispositivo não ensaiado |

Verificações locais desta intervenção: `npm run typecheck` PASS, `npm run lint` PASS e `npm test` PASS (32/32). Esses resultados não promovem nenhum item da matriz real para PASS. O procedimento completo está em `docs/SUPABASE_STAGING.md`.
