# Card Realms — Migration Plan

## Resultado da auditoria

A migração já está parcialmente feita. O jogo segue em Next.js/React e tem uma runtime Phaser separada. O hub jogável inicia como view padrão. A dungeon procedural já gera 8–12 salas e é percorrida fisicamente pelo jogador. Portanto, não é necessário substituir o projeto nem reimplementar o grafo descrito nos primeiros rascunhos.

Algumas notas anteriores, inclusive docs/STATUS.md, ainda dizem que Mata Encantada e Arquipélago têm cinco salas lineares. Corrigir as notas ao registrar novas verificações; o runtime de create-game já passa DungeonManager para DungeonScene.

## Preservar

- Next.js, React, rotas API e boundary Server/Client.
- Phaser como runtime 2D e loop local.
- Supabase, autenticação, RLS, RPCs estreitas, ledger e progresso.
- IDs estáveis de criaturas, cartas, armas, armaduras, suportes e relíquias.
- Saves de visitante versionados e snapshots remotos.
- PvP/TCG, mapa regional, coleção, refúgio e Raids até a substituição funcional.
- PWA, controles landscape, touch, gamepad e verify:deploy.
- A proibição de auto-deploy pelo Git em vercel.json.

## Já implementado

- Cena Phaser de hub controlável, seleção de expedição e cena ARPG.
- Movimento top-down, ataque, dash, suporte, cartas, armas, armaduras e relíquias.
- Gerador seeded com 8–12 nós, caminhos e bifurcações, tipos especiais, boss distante e validação.
- Layout pixel em tiles 32 px, corredores, portas e room states.
- Waves, controller de combate, clear persistente, baú de tesouro e minimapa de descobertas.
- 12 templates declarativos para Mata Encantada e conjunto equivalente para Arquipélago das Marés.
- Tilemaps por padrão de sala: detalhes de piso, água decorativa, obstáculos com colisão e pontos de spawn caminháveis.
- Portas conectadas deslizam ao fechar/abrir, com atualização do collider e poeira visual; inimigos colidem com paredes e portas.
- Inimigos das waves entram com telegraph escalonado de raízes/folhas, sem receber dano ou bloquear o jogador durante o aviso.
- Recompensas assinadas distribuídas entre tesouro, elite, combate marcado e boss; salas comuns têm cache determinístico de cura/fragmentos ou nenhum drop.
- Derrotar o Curupira libera loot assinado e um portal; a run só é extraída quando o jogador interage com esse portal.
- Seeds de runs locais são únicas; runs autenticadas continuam usando seed e plano assinados pelo servidor.
- Teste automatizado com 1.000 seeds e checagens de layout, tiles, pontos seguros, recompensas, manager e controller.
- Conteúdo declarativo de Mata, Arquipélago das Marés e Montanhas Rúnicas, com início, combate, tesouro, evento, elite, descanso, loja e boss em cada região.
- Props físicos interativos em descanso/evento/loja, com botão contextual acessível para interação touch em mobile paisagem; objetos quebráveis seeded e persistência monotônica dos IDs quebrados nos checkpoints.
- Cada objeto quebrável concede +1 fragmento temporário; a validação liga o delta aos novos IDs da seed e a rota mantém a recompensa no saldo-base do combate autoritativo.
- Spritesheets originais para os três bosses, Broto, Boto, Raijū e quatro NPCs da Guilda; portas com estados OPEN/CLOSING/CLOSED/OPENING sincronizados com collider, poeira e cues.
- Jornada local completa da Mata validada em 844×390: HUB, expedição, salas conectadas, tesouro, elite, Curupira, loot, extração e retorno.

## Próximos incrementos

1. Completar a direção visual por região com composição em camadas, baús/portas/altares dedicados e folhas dos mini bosses e demais criaturas; revisar visualmente todas as salas.
2. Homologar login, run retomável, recompensas, Mercador e catálogo em conta real; aplicar/verificar migrations e pgTAP, RLS, grants e RPCs no projeto Supabase de staging correto.
3. Validar instalação PWA, controles, acessibilidade e performance em dispositivo real; revisar teclado/mouse desktop em sessão interativa.
4. Fazer revisão auditiva humana dos temas/sinais e completar NPCs, diálogos e o fluxo narrativo do HUB.

## Estado desta etapa

Auditoria/documentação, primeiro passe de tiles/ambiente, portas, spawns, política de loot, hub físico, cartas/suportes, interação touch de salas especiais e instrumentação de debug foram implementados. `npm run verify:deploy` passou com TypeScript, ESLint, 237 testes em 42 arquivos e build de produção. Na revalidação mais recente, os smokes visitantes em Chrome 844×390 derrotaram Iara (45/154 HP), Amarok (34/150 HP) e Curupira (111/154 HP); cada run passou 12/12 checks, extraiu e voltou à Guilda sem erros de runtime. A Mata também observou quatro estados de animação do Broto e do boss, fases, duas barreiras de raiz, elite, tesouro e escolhas touch. Quatro medições recentes do benchmark marcaram 60,2–60,4 FPS nos sete cenários simulados; uma medição histórica ficou em 47,2–49,7 FPS, então o aceite de performance segue parcial até validar hardware real.

O incremento de objetos quebráveis concede +1 fragmento temporário por prop e preserva esse recurso nos checkpoints e estado de combate autenticado; testes locais e smoke de navegador visitante passaram. O fluxo de reload em conta autenticada ainda depende do acesso ao staging. A travessia completa também passou no Chrome desktop headless 1366×768 com WASD/mouse, 12/12 checks e retorno à Guilda; teste em sessão/hardware real segue pendente. `node --check` e ESLint passaram no harness após a última edição; o gate de deploy corresponde ao snapshot do jogo e não foi reexecutado após mudanças exclusivas no harness/documentação.

Não remover TCG, PvP, menu clássico nem dados persistidos enquanto os caminhos equivalentes do ARPG não estiverem utilizáveis. Não aplicar migrations remotas nem fazer deploy como atalho de validação. Qualquer mudança de schema fica local no arquivo de migration e precisa de verificação explícita contra o projeto alvo antes de produção.
