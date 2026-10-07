# Release 1.0 — checklist de aceite

Este documento acompanha o pedido de reformulação do ARPG e mantém o release como objetivo ativo. `PASS` exige evidência observável; compilar código ou escrever uma migration não comprova comportamento remoto.

## Revalidação vigente — 7 de outubro de 2026

- O Supabase autorizado `ywawwhnsvpfeppfcuwzg` está vinculado pela CLI e alinhado às migrations locais até `20261007105822_repair_raid_authority_wrappers`.
- Os testes pgTAP remotos de Raid, loadout, bootstrap de perfil e retirada do gacha passaram (43, 9, 11 e 13 asserções).
- `npm run verify:deploy`: PASS — typecheck, ESLint, 373/373 testes em 73 arquivos e build de produção local.
- O contrato em vigor é avatar/Lenda com dois poderes, sem apoiadores em combate, com cooperação em dungeons e chefes/inimigos folclóricos. As entradas antigas deste documento permanecem como histórico.
- Falta somente concluir o pacote prebuilt Vercel após retirar `.env.local` da coleta e executar a publicação autorizada.

## Revalidação do contrato final ARPG — 4 de outubro de 2026

- O personagem é o avatar próprio do jogador. O loadout de combate contém exatamente dois ataques: Raízes Ancestrais e Chama do Boitatá são iniciais gratuitas; as outras cartas são compradas e equipadas somente no Arquivo de Poderes da Guilda. Não há apoiadores folclóricos em combate. Armas, armaduras e buffs temporários vêm das dungeons.
- `npm run verify:deploy`: PASS local — 292/292 testes em 59 arquivos, além de typecheck, ESLint sem warnings e build de produção local. Esse gate não aprova a release enquanto staging e os demais aceites reais permanecerem pendentes.
- No IAB como visitante, a compra de Caipora custou 80 moedas e alterou o saldo de 500 para 420; a carta foi equipada, o avatar foi salvo e a dungeon foi aberta mostrando dois slots de ataque, HUD e equipamento. Essa evidência cobre lobby/avatar/entrada, não uma run completa. Mobile não foi validado nesta rechecagem.
- O staging `ywawwhnsvpfeppfcuwzg` não apareceu no Supabase logado no Vivaldi. Nenhuma migration remota foi aplicada; pgTAP e Supabase local estavam indisponíveis. Sem homologação de staging, a release 1.0 não está completa.

## Estado por fase

| Fase | Estado | Evidência e pendência |
| --- | --- | --- |
| Auditoria e limites da referência | PASS | `ARCHITECTURE_REPORT.md` e `REFERENCE_MAPPING.md` registram a auditoria do ZIP sem incorporar código, mapas ou assets do projeto de referência. |
| Gerador seeded e grafo de 8–12 salas | PASS local | Invariantes do grafo, 1.000 seeds da Mata, 250 seeds das Montanhas Rúnicas e rotas START→BOSS em 120 seeds pelos três biomas cobertos pela suíte atual; `npm run verify:deploy` passou com 173 testes em 30 arquivos. |
| Movimento físico entre salas, portas e extração | PASS no smoke local | Após alinhar o collider do sprite à sua área de pés, a execução CDP 844×390 percorreu o grafo seeded de 10 salas, derrotou o Curupira, recebeu loot elegível, extraiu pelo portal, voltou à Guilda e terminou sem erros de runtime. |
| Waves, salas especiais, loot e boss | PARCIAL | Smokes locais percorreram grafos de 8–12 salas nos três biomas. Na validação mais recente, o HUB iniciou uma run Chrome 844×390 com 11 salas; combates, elite de duas waves, tesouro, descanso, evento e loja foram resolvidos, inclusive por interação touch contextual. O Curupira foi derrotado com 111/154 HP; as quatro animações do Broto e do boss, padrões das três fases e uma barreira física foram observados; loot extraído, Guilda reaberta, 12/12 checks e zero erros de runtime. O smoke amostrou as animações a 16 ms e confirmou `idle`, `walk`, `attack` e `defeat`. Salas resolvidas permaneceram `cleared` nas revisitas. Os smokes anteriores dos biomas do Arquipélago e das Montanhas também observaram os quatro estados do Boto/Iara e Raijū/Amarok. Capturas: `curupira-root-arena-smoke.png`, `mata-sprout-enemy-smoke.png`, `mares-boto-enemy-smoke.png` e `montanhas-raiju-enemy-smoke.png`. O caminho autenticado permanece pendente. |
| Minimapa da dungeon e máscara de descoberta | PASS local | `TAB` abre diálogo acessível em 844×390, mostra salas visitadas e fronteira descoberta, conserva desconhecido o tipo das próximas salas, congela o relógio da cena e retorna ao jogo com `TAB`; o checkpoint JSONB preserva visitas e valida monotonicidade sem migration. Smoke 14/14, sem erros CDP; captura `arpg-map-overlay-smoke.png`. |
| Tela de título e entrada | PARCIAL | O build local mostra uma abertura pixel art original com JOGAR, ENTRAR, CONFIGURAÇÕES e CRÉDITOS; smokes em 1280×720, portrait 390×844/320×568 e landscape 844×390 conferiram modais, alternância de áudio, botões inteiros e JOGAR→Guilda. Capturas mobile: `title-screen-390x844.png`, `title-settings-390x844.png`, `title-credits-390x844.png`, `title-compact-portrait-320x568.png` e `title-landscape-844x390.png`. O portal de login usa o fluxo existente; esta cópia local não tem Supabase configurado e não prova autenticação real. |
| Objetos quebráveis | PARCIAL | A geração seeded coloca caixas, vasos, arbustos ou relíquias em salas visitáveis; cada prop destruído concede +1 fragmento temporário com animação, som e atualização do HUD. O checkpoint aceita somente o delta vinculado a novos IDs seeded, e a rota preserva a recompensa no saldo-base do combate autoritativo. `scripts/arpg-breakable-smoke.mjs` na build local 844×390 destruiu uma relíquia (54 HP→0), confirmou `active=false` e HUD 0→1, sem erros de runtime; capturas `breakable-objects-reward-before.png` e `breakable-objects-reward-after.png`. Testes locais de rota autenticada com mocks cobrem delta exato e preservação do saldo. Falta provar reload em browser autenticado/staging após liberar acesso ao projeto. |
| Run persistente e retomável | PARCIAL | API, RPCs, checkpoint seeded e retomada Phaser foram implementados. O servidor valida movimento, ataques, os dois ataques equipados, cooldowns, projéteis, hazards, mortes e recompensas da run. A evidência IAB desta rechecagem só registra entrada na dungeon e não valida uma run completa. Faltam smoke persistente autenticado e aplicar/validar migrations em Postgres. |
| Hub controlável e sistemas Card Realms | PARCIAL | O fluxo ativo da Guilda usa Ateliê para o avatar próprio, Arquivo para compra/equipamento de cartas, Mercador sem gear de combate, Bestiário, Eventos, Altar Mítico e Portal das Dungeons. Santuário e seleção de apoiadores não fazem parte da navegação ARPG. A evidência IAB confirma avatar salvo, compra e entrada; não é validação mobile nem de run completa. Staging e aceites dos demais sistemas permanecem pendentes. |
| Cartas e equipamento | PARCIAL | O loadout contém exatamente dois ataques próprios. Raízes Ancestrais e Chama do Boitatá são iniciais gratuitas; cartas adicionais são compradas com moedas de jogo e equipadas apenas no Arquivo de Poderes da Guilda. No IAB visitante, Caipora custou 80 moedas (500→420), foi equipada e apareceu entre os dois slots ao entrar. Armas, armaduras e buffs temporários vêm das dungeons. Não há apoiadores em combate. Persistência/progressão de staging falta homologar. |
| Arte, animações, efeitos e áudio | PARCIAL | O avatar customizado pelo jogador usa a configuração existente tanto na Guilda quanto na dungeon. Criaturas folclóricas são representadas como poderes nas cartas, ou como inimigos/NPCs do mundo, sem função de companheiro de combate. Restam o passe visual completo, NPCs/objetos pendentes e confirmação auditiva humana. |
| Mobile, gamepad e PWA | PARCIAL | A rechecagem final documentada não validou mobile nem run completa. Os registros anteriores de navegador/headless são históricos e não substituem aceite mobile; instalação em dispositivo, controles/acessibilidade e atualização PWA em aparelho continuam sem homologação. |
| Performance de stress mobile | PARCIAL | `scripts/arpg-mobile-performance-smoke.mjs` mede 3 s por cenário em Chrome com viewport 844×390, WebGL e sem throttling de CPU. Contagens carregadas exatamente: 10/25/50 inimigos, 100/300 projéteis e 300 partículas. A medição histórica mais baixa ficou em 47,2–49,7 FPS; quatro medições recentes na build local de produção, Chrome/WebGL 844×390 sem throttling, registraram 60,2–60,4 FPS em todos os sete cenários. As duas novas execuções em 4 de outubro confirmaram contagens exatas, FPS físico 60, canvas sem overflow e zero erros bloqueantes; `arpg-mobile-performance-smoke.json` contém o resultado atual. O aceite segue parcial até medição em aparelho real. Os pools de projéteis comportam até 320 objetos. |
| Supabase staging | BLOQUEADO por acesso ao projeto e validação local | O staging Card Realms `ywawwhnsvpfeppfcuwzg` não apareceu na interface Supabase logada no Vivaldi. Nenhuma migration remota foi aplicada. pgTAP e Supabase local estavam indisponíveis; schema, RPC, grants e RLS continuam sem homologação nesse projeto. |
| Gate final de produção | NÃO APROVADO | O gate local `npm run verify:deploy` passou: 292/292 testes em 59 arquivos, typecheck, ESLint sem warnings e build de produção local. A release 1.0 permanece incompleta enquanto faltarem homologação do staging/migrations/pgTAP e os demais aceites de produção. Nenhum deploy foi feito. |

## Próximos marcos

1. Exercitar padrões e telegráficos autoritativos no browser autenticado, cobrindo movimento, dash, checkpoint e retomada.
2. Ligar um Postgres local ou provisionar `SUPABASE_DB_PASSWORD` de staging; confirmar o histórico remoto, aplicar as migrations em ordem, executar pgTAP e verificar RLS/grants/RPCs no projeto alvo.
3. Exercitar em navegador com conta autenticada: iniciar, limpar sala, recarregar, retomar, finalizar, repetir request e confirmar inventário/recompensa idempotentes.
4. Completar os templates visuais, animações, música e áudio fora da dungeon, salas especiais, hub, acessibilidade e a matriz mobile/PWA; registrar cada aceite com evidência.
5. Rodar `npm run verify:deploy` e o smoke end-to-end completo antes de qualquer promoção. A publicação continua sujeita às regras de `AGENTS.md`.

## Incremento P0 — sincronismo de movimento persistente — 3 de outubro de 2026

- O endpoint de combate aceitava comandos `sync`, mas substituía a posição enviada pelo cliente pela posição salva anteriormente. Isso impedia deslocamento em qualquer run autenticada.
- O endpoint agora passa a posição recebida ao simulador, que valida distância por tempo decorrido, velocidade, caminho caminhável e obstáculos. A retomada Phaser continua inicializando na posição do checkpoint; teleporte continua rejeitado.
- O teste de rota autenticada confirma um deslocamento válido, rejeita um teleporte e mantém o último checkpoint válido. Os 15 testes da rota passaram.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 211/211 testes em 34 arquivos e build Next.js 16.3.6 local.
- O hub carregou no smoke visual do browser local, mas sem sessão autenticada isso não homologa a run persistente. Staging segue sem senha PostgreSQL/CLI disponível; nenhuma migration remota ou publicação ocorreu.

## Incremento P0 — interação física em salas especiais — 3 de outubro de 2026

- Descanso, evento e loja agora mostram props próprios ao entrar na sala: fogueira, altar ou banca temática com marcador “INTERAGIR”. A escolha não abre na entrada; o jogador pode cruzar as portas até se aproximar a 128 px e interagir com `E`, gamepad ou controles de toque.
- Depois da interação, a escolha React abre, as portas travam durante a decisão e o prop vira “RESOLVIDO” após a sala ser limpa.
- Smoke visual CUA em build local: a banca do Mercador Eremita apareceu na sala; a aproximação e `E` abriram as três opções, “Seguir viagem” resolveu a sala e devolveu o controle. Foi run visitante, então não prova persistência autenticada.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 211/211 testes em 34 arquivos e build de produção Next.js 16.3.6 local.
- Os props ainda usam arte procedural simples; faltam spritesheet de NPC e acabamento ambiental. Homologação autenticada e staging continuam pendentes; nenhum dado remoto ou deploy foi alterado.

## Incremento de validação de checkpoint — 3 de outubro de 2026

- A rota autenticada agora lê a run ativa e valida cada checkpoint novo contra o checkpoint salvo, além de validar estrutura/seed/grafo.
- A transição exige que salas previamente limpas, XP, buffs, loot e portal permaneçam; salas novas precisam ser adjacentes e a movimentação tem de seguir corredor alcançável. Isso bloqueia um payload que marca o grafo inteiro limpo e salta direto para a vitória do boss.
- O XP salvo tem de caber no máximo calculado a partir das ondas seeded das salas já visitadas, incluindo o maior bônus de XP de relíquia disponível.
- Bônus de velocidade e dano ficam limitados aos valores do jogo e só podem aumentar no tipo de sala que os oferece, após a sala ficar limpa.
- `runLoot` só aceita itens/cartas do plano assinado da run e exige que a sala designada já esteja limpa.
- A validação não simula ondas, HP de inimigos ou boss e não transforma os clears informados pelo cliente em evidência autoritativa; a fase de combate permanece parcial.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 151/151 testes em 28 arquivos e build Next.js 16.3.6 local.
- Banco e deploy remoto não foram alterados nesta etapa.

## Incremento P1 — sprite original e smoke completo — 3 de outubro de 2026

- O Cartógrafo recebeu originalmente `artifacts/archive/public-art/cartographer-adventurer-spritesheet-v2.png`; o avatar atual é gerado em SVG pelo runtime em `player-sprites.ts`.
- Dungeon e Guilda agora renderizam o mesmo sprite animado. A primeira repetição revelou que o collider estreito ficava preso no limite inferior de uma passagem; reposicionei o footprint e repeti o percurso.
- O smoke CDP final passou em viewport landscape 844×390: 10 salas seeded, 21 transições/visitas, salas de combate/elite/descanso/loja/tesouro/evento, Curupira derrotado, loot elegível, resultado de extração, retorno à Guilda e zero erros de runtime.
- A run visitante terminou com 126/154 HP. O teste local não alterou o Supabase.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 151/151 testes em 28 arquivos e build local Next.js 16.3.6.
- Apenas o personagem do jogador recebeu esse passe. Arte de criaturas e NPCs, boss, cenário detalhado, áudio e o restante do escopo visual seguem pendentes; nenhuma migration ou publicação remota ocorreu.

## Correção do projétil inimigo e extração — 3 de outubro de 2026

- O callback de sobreposição entregava o jogador à rotina de reciclagem de projéteis em uma colisão. A cena agora identifica o membro real do grupo mesmo se Phaser inverter os argumentos; o handler também rejeita qualquer objeto externo ao grupo.
- Testes unitários cobrem argumento direto, argumento invertido e colisão sem membro do grupo. O smoke browser local passou em viewport landscape 844×390 numa dungeon seeded de 12 salas: combate, elite, evento, loja, descanso, tesouro, boss, recompensa, extração e retorno ao HUB sem erros de runtime.
- `npm run verify:deploy`: PASS — TypeScript, ESLint, 156/156 testes em 29 arquivos e build Next.js de produção local.
- A run foi de visitante; migration, progresso Supabase e deploy remoto não foram alterados. A autoridade integral de combate no servidor permanece pendente.

## Loadout autenticado congelado na run — 3 de outubro de 2026

- A rota de início lê o Arsenal salvo com credencial de servidor; aplica o schema compartilhado com a API do Arsenal e usa arma/armadura da conta no checkpoint inicial.
- Tokens autenticados versão 5 assinam o snapshot completo do loadout. Ao retomar, a rota devolve o snapshot originalmente assinado mesmo depois que o jogador alterou o Arsenal; dados do pedido do browser não substituem o valor da conta.
- Testes de rota cobrem snapshot persistido, payload forjado, loadout inválido e retomada com equipamento anterior. `npm run verify:deploy`: PASS — 159/159 testes em 29 arquivos e build local.
- O E2E autenticado real e a execução da migration persistente seguem pendentes por falta de acesso Postgres ao staging. Não houve alteração de banco ou deploy.

## Cura de checkpoint limitada — 3 de outubro de 2026

- A validação de transição agora limita cura ao valor máximo de descanso, tônico, baú assinado ou cache determinístico; armadura coletada pode conceder apenas seu aumento real de HP máximo.
- Testes de checkpoint rejeitam regeneração arbitrária e excesso de cura, e aceitam descanso e baú dentro do limite.
- `npm run verify:deploy`: PASS — 161/161 testes em 29 arquivos e build local.
- Isso reduz outra falsificação gradual de estado, mas não substitui a simulação server-side de ondas e mortes; a run continua parcial até essa fronteira e homologação autenticada.

## Incremento P1 — áudio procedural da dungeon — 3 de outubro de 2026

- A cena ARPG agora cria ambiência tonal por região e efeitos Web Audio originais para ataques, habilidades, dano, portas, baús, boss, portal e resultado de run. O áudio só desbloqueia após gesto do jogador e falhas/ausência de Web Audio não interrompem a partida.
- A barra superior ganhou toggle acessível de som; a preferência de mute fica em `localStorage` e acompanha recriação da cena.
- `agent-browser` confirmou carregamento da Guilda sem overlay, presença do toggle e alternância persistida on/off. O smoke CDP visitante 844×390 percorreu uma run seeded de 11 salas/23 visitas, derrotou o boss, extraiu a recompensa, voltou à Guilda e terminou sem eventos CDP de exceção ou falha de rede.
- O log do smoke também expôs chaves React duplicadas quando o loot da run continha cópias repetidas; a chave da lista agora inclui a posição do item. O gate posterior passou: typecheck, lint, 161/161 testes em 29 arquivos e build Next.js local.
- O smoke foi de visitante. Música completa, áudio de outras áreas, autoridade server-side integral, migration autenticada e deploy continuam pendentes; nenhum banco remoto ou deployment foi alterado.

## Incremento P0 — escolha especial validada no checkpoint — 3 de outubro de 2026

- A transição autenticada agora reconstrói as opções de descanso, evento e loja no servidor. O checkpoint precisa corresponder exatamente a uma opção: HP, fragmentos, buff, equipamento, XP, loot e estado do portal não podem combinar recompensas de escolhas diferentes.
- A suíte cobre resultados válidos de evento e rejeita fragmentos ou bônus combinados fora da escolha. `npm run verify:deploy`: PASS — typecheck, lint, 162/162 testes em 29 arquivos e build de produção local.
- O smoke CDP visitante passou em viewport landscape 844×390: seed de 8 salas e 14 visitas; evento, loja, descanso, tesouro, combate, elite, boss, extração e retorno ao HUB. Não houve eventos CDP nem avisos de chave duplicada no servidor.
- Isso valida os efeitos das salas especiais, mas clears de combate ainda são declarados pelo cliente. A autoridade integral das waves/boss permanece pendente; sem migration, staging autenticado ou deploy remoto.

## Incremento P0 — clear de combate limitado por tempo do servidor — 3 de outubro de 2026

- Ao entrar em cada sala, o Phaser envia primeiro o checkpoint de localização. A API exige que essa entrada esteja salva antes de aceitar a sala como limpa e calcula um tempo mínimo com base nas waves seeded e no tipo de sala, usando `updated_at` do checkpoint persistido.
- Testes de rota verificam rejeição antes do tempo mínimo e aceitação depois; o gate passou com 164/164 testes em 29 arquivos, typecheck, lint e build local.
- O smoke browser de visitante passou depois da mudança em viewport 844×390: 10 salas/24 visitas, boss, recompensa, extração, retorno à Guilda e eventos CDP vazios. Ele valida o cliente; não exercita a persistência autenticada.
- Esta trava impede clears instantâneos, mas ainda permite fabricar um clear depois de aguardar. Não é simulação de ataque, HP ou morte; autoridade server-side integral, acesso ao staging/migration e deploy continuam pendentes.

## Incremento P0 — recompensas de combate recalculadas no servidor — 3 de outubro de 2026

- Para cada sala combat/elite/boss recém-limpa, a API reconstrói as waves seeded e exige o delta exato de XP e fragmentos que elas concedem. O bônus de XP usa a relíquia congelada no token HMAC da run autenticada.
- Testes cobrem clear com delta correto e rejeição de fragmentos ausentes; `npm run verify:deploy` passou com 165/165 testes em 29 arquivos, typecheck, lint e build local.
- A validação de rewards não é E2E autenticada de staging: o smoke CDP permanece visitante, e não houve migration ou deploy.
- O cliente ainda declara que venceu a sala. O servidor limita os clears por entrada/tempo e calcula recompensas, mas não simula movimentos, ataques, HP dos inimigos ou mortes. A autoridade completa permanece pendente.

## Incremento P1 — arte e navegação das Montanhas Rúnicas — 3 de outubro de 2026

- As Montanhas Rúnicas agora usam 12 templates nativos com piso glacial e padrões de ruína, santuário e arena; 250 seeds confirmaram spawns caminháveis.
- Hub e dungeon aceitam clique/toque no chão com pathfinding A*. Mouse, touch e rota por porta para uma sala adjacente passaram em smoke CDP mobile 844×390; o hub também passou em 1366×768 e 844×390 sem overflow.
- `npm run verify:deploy`: PASS com 173 testes em 30 arquivos, typecheck, lint e build de produção local.
- A matriz móvel/PWA completa e as animações/arte dos inimigos seguem parciais.

## Incremento P0 — grants das runs e atualização do runbook — 3 de outubro de 2026

- O inventário local do Supabase foi reconciliado para as 33 migrations existentes e separado explicitamente do histórico remoto confirmado em setembro.
- O teste pgTAP de runs persistentes agora planeja 22 asserções, incluindo negação de RPC privada para `anon`/`authenticated`, grants da role de servidor, wrappers `SECURITY INVOKER` e `search_path` vazio nos helpers privilegiados.
- A lista local e o plano pgTAP conferem estaticamente (33/33 migrations e 22/22 asserções declaradas). O pgTAP não foi executado porque CLI, Docker e acesso Postgres autenticado não estão disponíveis; o status de staging permanece bloqueado e nenhuma migration foi aplicada.

## Incremento P1 — animação original do Broto Enraivecido — 3 de outubro de 2026

- A Mata associa `sprout` a uma spritesheet RGBA original de 4×4 quadros: idle, caminhada, ataque e derrota. O perfil usa quadros de 313 px, escala 0,2 e footprint de colisão preservado; o PWA pré-carrega o asset no cache v5.
- Inimigos animados aguardam 420 ms após aparecer antes de começar a perseguir, deixando a pose idle legível durante a entrada. O contato melee reproduz attack antes de retomar a animação de movimento.
- Smoke CDP no build de produção local, viewport 844×390: 11 salas, 22 entradas, Curupira derrotado, padrões e barreiras de raiz observados, loot extraído, retorno à Guilda; os quatro estados do Curupira e do Broto apareceram, 10/10 checks passaram e não houve eventos CDP. A captura do Broto está em `mata-sprout-enemy-smoke.png`.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 188/188 testes em 33 arquivos e build Next.js 16.3.6 local.
- Só o Broto recebeu arte animada entre os inimigos comuns nesta etapa. Outros inimigos, arte de NPCs/objetos, composição ambiental, autoridade server-side integral, homologação Supabase autenticada e deploy permanecem pendentes; nenhuma migration ou alteração remota foi feita.

## Incremento P1 — animação original do Boto-cor-de-rosa — 3 de outubro de 2026

- O inimigo `skirmisher` do Arquipélago agora usa spritesheet RGBA original 4×4 com idle, caminhada, ataque e derrota, perfil na escala 0,22 e associação ao bioma; o PWA pré-carrega a arte no cache v6.
- Smoke CDP local 844×390: 11 salas/24 entradas, Iara derrotada, saque extraído e retorno à Guilda. Os quatro estados do Boto e da Iara foram observados; 11/11 checks passaram sem eventos CDP. Captura: `mares-boto-enemy-smoke.png`.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 189/189 testes em 33 arquivos e build Next.js 16.3.6 local. NPCs e outros inimigos ainda não receberam seu passe visual; staging autenticado, authority server-side integral e deploy permanecem pendentes.

## Incremento P1 — animação original do Raijū — 3 de outubro de 2026

- O inimigo `stormBeast` das Montanhas agora usa folha RGBA original 4×4 com idle, caminhada, ataque e derrota; o perfil aplica escala 0,22 e entrou no cache PWA v7.
- Smoke de animação CDP em 844×390 concluiu a primeira sala de combate e observou os quatro estados do Raijū; captura: `montanhas-raiju-enemy-smoke.png`. Uma full-run gerou 12 salas e 26 entradas, derrotou Amarok com 19/150 HP, extraiu o loot e voltou à Guilda; os quatro estados de Amarok e Raijū apareceram e `events` ficou vazio.
- O harness agora pode forçar `ARPG_SMOKE_FORCE_CHEST_PATHFINDING=1`: outra run confirmou o ramo A* do próprio jogo, alcançando e abrindo três baús. Essa seed terminou em derrota no boss, portanto serve como evidência de movimento/interação com baús, não de vitória. As falhas anteriores de aproximação foram eliminadas pelo fallback de pathfinding.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 190/190 testes em 33 arquivos e build Next.js 16.3.6 local.
- Broto, Boto e Raijū agora cobrem um inimigo comum animado em cada bioma. Outros inimigos, NPCs/objetos, autoridade server-side integral, staging autenticado e release 1.0 permanecem pendentes; nenhuma migration ou publicação foi feita.

## Incremento P0 — padrões de boss autoritativos — 3 de outubro de 2026

- Os padrões entram agora no estado de combate persistido: a Mata usa os seis ataques de Curupira com transição gradual de fase; Iara cria varreduras e correntes telegráficas; Amarok cria faixas de gelo e investidas. Volleys, telegráficos, dano e teleportes do boss passam pela simulação do servidor.
- As áreas perigosas são sincronizadas com o Phaser; decoys são visuais, e as raízes da arena permanecem como barreiras de colisão autoritativas durante sua duração. O caminho local de especiais deixa de aplicar dano duplicado quando a autoridade persistente está ativa. Dash na marca temporal da detonação também é resolvido pelo servidor.
- Testes focados comprovam acerto dentro do aviso, esquiva por movimento, dash no instante da detonação, bloqueio por raízes, padrões de fase 2 de Iara/Amarok e transições Curupira para emboscada e arena final. `npm run verify:deploy` passou sem warnings: typecheck, ESLint, 209 testes em 34 arquivos e build local Next.js 16.3.6.
- O combate ainda precisa de smoke visual no browser com uma run autenticada. E2E Supabase staging, migrations/pgTAP e validação remota continuam pendentes; nenhuma alteração remota ou publicação foi feita. Release 1.0 continua parcial.

## Incremento P0 — combate persistente simulado no servidor — 3 de outubro de 2026

- O endpoint de encontro reconstrói inimigos e waves da seed, persiste o estado de combate no checkpoint JSONB por revisão CAS e calcula movimento, cooldowns, ataques, habilidades, suportes, dano de contato, projéteis ranged, volleys básicos do boss, mortes, XP e fragmentos no servidor. Runs de visitante permanecem locais; projéteis autoritativos aparecem no Phaser.
- O clear agora exige `victory` no estado salvo; a extração exige vitória simulada do boss e portal. Checkpoints do cliente não aceitam `serverCombatState`, XP/fragmentos não podem mudar por checkpoint, a entrada começa junto a uma porta e o sync de retomada usa a posição salva pelo servidor.
- Testes de rota cobrem clear válido com rewards exatos e extração positiva após boss victory salvo, além das rejeições de payload forjado. `npm run verify:deploy` passou com 200 testes em 34 arquivos, typecheck, ESLint sem avisos e build Next.js 16.3.6 local.
- Padrões específicos dos bosses foram implementados e verificados localmente; E2E autenticado no Supabase staging e migrations/pgTAP continuam pendentes porque a CLI ainda requer a senha Postgres de staging. Nenhuma migration, alteração de dados remotos ou publicação foi feita. Release 1.0 continua parcial.

## Incremento P0 — dash autoritativo persistente — 4 de outubro de 2026

- O servidor agora aplica deslocamento do dash com limite de 610 px/s por 170 ms, interrompe a trajetória em paredes, obstáculos e raízes ativas e grava a próxima recarga no estado JSON do combate. O comando usa a direção normalizada e ignora a posição local já deslocada, evitando que a validação de caminhada rejeite a esquiva.
- O teste focado confirma deslocamento limitado, recarga de 820 ms, rejeição de repetição precoce e `sync` aceito logo após o dash. `npx vitest run src/game/arpg/dungeon/combat-authority.test.ts`: 16/16; `npm run verify:deploy`: PASS — typecheck, ESLint, 216/216 testes em 35 arquivos e build local Next.js 16.3.6.
- O smoke autenticado continua pendente. A conta Supabase conectada não tem permissão para ler o projeto de staging alvo; credenciais de banco e ferramentas locais também faltam. Nenhuma migration, alteração remota ou publicação ocorreu; Folklard 1.0 continua parcial.

## Incremento P1 — destruição de objeto quebrável — 4 de outubro de 2026

- O modo de depuração da dungeon agora expõe HP/atividade dos props para inspeção; isso só é instalado quando `debugDungeon=1`. `scripts/arpg-breakable-smoke.mjs` iniciou uma run visitante na build de produção local, alcançou a sala de combate e atacou um arbusto a 88 px com a Espada de Ferro.
- Estado observado: arbusto 20 HP→0 e inativo; os efeitos de pulso/destroços apareceram e a captura posterior mostra o prop removido. O browser não registrou erro de runtime. Capturas: `breakable-objects-before.png` e `breakable-objects-broken.png`.
- O servidor local recebeu um `GAME_ACTION_SECRET` aleatório e efêmero para assinar o token da run visitante; nenhum segredo foi salvo no repositório e nenhuma sessão Supabase, migration remota ou publicação foi usada. Drop de recurso, persistência do estado quebrado e run autenticada continuam pendentes.

## Incremento P1 — ícones e cache de instalação PWA — 4 de outubro de 2026

- O service worker listava `/icon.svg`, mas o arquivo não existia. Como a instalação pré-armazena o conjunto essencial com `cache.addAll`, a resposta 404 impedia a ativação do worker.
- Adicionei um ícone original em SVG, PNGs de 192×192, 512×512 e 512×512 maskable no manifest, e Apple Touch Icon 180×180; a revisão do cache subiu para v11 para atualizar instalações existentes.
- `scripts/arpg-pwa-smoke.mjs` validou a build local de produção: manifest 200 em standalone/landscape, ícones declarados, respostas 200 e dimensões corretas, Apple Touch Icon, service worker ativado, assets no cache v11 e remoção do cache v10 anterior. `npm run verify:deploy`: PASS — typecheck, lint, 216/216 testes em 35 arquivos e build Next.js 16.3.6.
- Isso comprova os assets e a ativação offline no browser local; instalação em aparelho e a matriz mobile completa seguem pendentes. Nenhuma migration, conta de staging ou publicação foi usada.

## Incremento P1 — Arquivo das Lendas e Mercador no HUB — 4 de outubro de 2026

- A Guilda passou de seis para oito estações físicas. O Arquivo das Lendas abre a preparação ARPG de quatro cartas e dois suportes; o Mercador abre a loja da Vila e oferece retorno explícito à Guilda. Os props são próprios para mesa de cartas e banca de mercador; os marcadores das estações são ovais em vez de caixas de interface. A Mercadora ganhou spritesheet original 4×4 com animações de espera, trabalho, fala e caminhada, pré-carregada pelo service worker PWA v12.
- `scripts/arpg-hub-smoke.mjs` confirmou no build de produção: caminho físico e `E` no Cartógrafo, Arquivo→loadout com cartas, Mercador→loja→retorno à Guilda, tap-to-move na viewport 844×390, sem overflow ou erros CDP. A suíte do grafo verificou rotas até as oito estações. Captura: `arpg-hub-mobile-smoke.png`.
- O Mercador reutiliza o empório existente de energias; ainda faltam o catálogo de cosméticos/itens pedido e os demais NPCs/diálogos da Guilda. `npm run verify:deploy` passou com typecheck, ESLint, 216/216 testes em 35 arquivos e build de produção Next.js 16.3.6. O smoke PWA semeou um cache v11 antes do registro, confirmou ativação v12 e remoção do legado, e encontrou a spritesheet da Mercadora no cache essencial. Nenhum dado Supabase ou remoto foi alterado.

## Incremento P1 — Santuário dos Espíritos na Guilda — 4 de outubro de 2026

- A Guilda agora tem nove estações físicas. O Santuário possui um prop próprio com dois espíritos animados e abre uma tela focada nos dois slots de suporte; o Arquivo agora abre apenas as quatro cartas-habilidade. Arsenal continua reunindo equipamentos e relíquias.
- `scripts/arpg-hub-smoke.mjs` confirmou o percurso WASD e `E` até o Santuário, exatamente dois slots de suporte e foco isolado do Arquivo; também repetiu Cartógrafo, loja do Mercador, retorno à Guilda e tap-to-move mobile. Sem overflow ou exceções CDP. Captura: `arpg-hub-mobile-smoke.png`.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 216/216 testes em 35 arquivos e build Next.js 16.3.6 local. Nenhum dado remoto foi alterado; a seleção remota de loadout continua aguardando a validação Supabase de staging.

## Incremento P1 — Portal físico das dungeons — 4 de outubro de 2026

- Adicionei um portal pixel art caminhável à Guilda, distinto do Portal de Raid. `E` no arco conduz diretamente à seleção de expedição; o Cartógrafo permanece como acesso ao mapa/expedições.
- A Guilda soma dez estações com rota testada pelo grafo. `scripts/arpg-hub-smoke.mjs` confirmou a aproximação WASD ao portal e a entrada por `E`, além do percurso desktop completo e seleção de suportes no mobile via joystick e botão Interagir; o loadout coube em 844×390 sem overflow e o CDP não registrou erros.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 216/216 testes em 35 arquivos e build de produção Next.js 16.3.6 local. Nenhuma publicação ou alteração remota ocorreu.

## Incremento P1 — catálogo do Mercador e cosméticos do Refúgio — 4 de outubro de 2026

- O catálogo vende o Arco da Mata (180 moedas), o Manto Ritual (140) e três móveis do Refúgio (45/60/75). Visitantes compram com o saldo local; para contas, a API chama uma RPC que fixa os preços no servidor, bloqueia duplicatas e debita moedas junto da concessão de inventário. O save remoto do Refúgio também valida a posse dos móveis cosméticos.
- Saves locais v4 passam a incluir a decoração. A migration concede inventário aos jogadores que já usavam esses móveis e cria a compra transacional; nove checks pgTAP cobrem preço, concessão, duplicata, chave inválida e saldo insuficiente. A migration e o pgTAP foram escritos, mas não executados: o acesso ao staging continua negado e nenhum dado remoto foi alterado.
- Smoke browser de produção local: arco e manto comprados e listados no Arsenal; os três cosméticos ficaram utilizáveis, foram salvos no Refúgio e continuaram visíveis após recarregar. O saldo foi de 500 a 0, e o catálogo foi revisado em 390×844.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 219/219 testes em 36 arquivos e build de produção Next.js 16.3.6. O aceite de compra autenticada permanece pendente de staging; nenhum deploy foi feito.

## Incremento P1 — água e partículas de folha na Mata — 4 de outubro de 2026

- Salas florestais com água agora recebem reflexos horizontais animados em tons verde-água; folhas pequenas flutuam com movimento e opacidade escalonados. As posições e atrasos usam a semente ambiental da sala para manter o desenho estável entre visitas.
- O primeiro preview local iniciou a run visitante numa sala inicial sem rio. A revisão visual posterior confirmou o template fluvial `mata-combat-river` em 844×390; veja o incremento “revisão visual de sala fluvial” ao fim deste checklist. O passe ambiental completo segue pendente.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 219/219 testes em 36 arquivos e build Next.js 16.3.6. A instância de revisão usou um `GAME_ACTION_SECRET` descartável somente no processo local; nenhum segredo foi salvo, nenhuma migration foi aplicada e nenhum deploy foi feito.

## Incremento P1 — Altar Mítico conectado ao boss semanal — 4 de outubro de 2026

- Corrigi uma divergência funcional do hub: o Altar Mítico estava apresentado como altar de relíquias e redirecionava para o Arsenal. Ele agora abre o calendário das Raids Míticas semanais; a estação separada foi identificada como Eventos.
- O smoke automatizado do hub agora caminha até o Altar, confere o prompt e verifica a tela semanal. Nesta sessão, o navegador integrado confirmou o prompt ao alcançar fisicamente a estação e abriu “Raids Míticas de sábado”; a execução de E2E da estação foi substituída por essas evidências mais o teste de roteamento porque o CDP local `127.0.0.1:9224` recusou conexão.
- A suíte focal passou, incluindo os testes que fixam altar→Raid, Arquivo→cartas, Santuário→suportes, Mercador→loja e Portal→expedições. `npm run verify:deploy`: PASS — typecheck, ESLint, 221/221 testes em 37 arquivos e build Next.js 16.3.6. Sem alteração remota ou deploy.

## Incremento P1 — Arquivista animada no Arquivo das Lendas — 4 de outubro de 2026

- Criei originalmente `artifacts/archive/public-art/guild-archivist-spritesheet.png`, personagem com ciclos de espera, leitura/escrita, fala e caminhada. A folha antiga está preservada; a Guilda ativa usa `public/art/guild-archivist-spritesheet-v1.webp`.
- O CUA confirmou a personagem e seu prompt no preview local da Guilda. A tecla E não abriu a estação durante esta revisão; o fluxo Arquivo→cartas já tem cobertura anterior, mas esta interação física precisa de nova verificação. O PWA foi atualizado para cache v13 e a checagem de cache espera a nova imagem; o smoke PWA/CDP não foi executado nesta rodada.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 221/221 testes em 37 arquivos e build Next.js 16.3.6. Nenhuma migration, gravação remota ou publicação foi feita.

## Incremento P1 — persistência de objetos quebrados na run — 4 de outubro de 2026

- O checkpoint de run agora mantém os IDs seeded dos props destruídos. Ao retomar, a cena não recria os props quebrados; dados antigos recebem a lista vazia por compatibilidade.
- A validação aceita apenas IDs que existam em salas visitadas, exige lista sem duplicatas, impede ressuscitar props e limita novas quebras à sala corrente. O schema fica no JSONB existente, sem migration de tabela.
- Os testes focais passaram (16 em `run-checkpoint.test.ts` e 5 em `breakable-objects.test.ts`), incluindo restauração visual sem recriar o prop. `npm run verify:deploy` passou sem warnings: typecheck, lint, 224/224 testes em 37 arquivos e build Next.js 16.3.6. Ainda falta verificar reload de uma run autenticada no browser porque não há acesso ao Supabase staging; nenhum dado remoto ou publicação foi alterado.

## Incremento P1 — temas por área e variação do boss — 4 de outubro de 2026

- Título, HUB, Mata Encantada, Arquipélago das Marés e Montanhas Rúnicas têm melodias pentatônicas originais distintas, sintetizadas com osciladores Web Audio em volume baixo após gesto do jogador. Na sala final, cada bioma troca para sua variação de boss; ao terminar a luta, retorna ao tema de exploração.
- As salas de evento, loja e descanso tocam uma breve assinatura ao serem abertas. O botão acessível do HUB compartilha `arpg.soundEnabled` com a tela de título e a dungeon, incluindo persistência local e suporte a armazenamento bloqueado. Mutar interrompe o agendamento; reativar reinicia o tema, e encerrar a cena limpa o timer e os nós de áudio.
- Testes isolados cobrem os temas, a troca de boss, o ciclo de mute/retomada, encerramento do contexto e persistência/estado acessível dos controles de título e HUB. `npm run verify:deploy`: PASS — typecheck, ESLint, 231/231 testes em 40 arquivos e build local Next.js 16.3.6. A escuta ainda precisa ser verificada no browser; o runtime de automação disponível não abriu uma sessão controlável nesta rodada. Nenhuma migration ou publicação foi feita.

## Incremento P1 — smokes locais de HUB, PWA e viewports — 4 de outubro de 2026

- O smoke do HUB passou em Chrome headless para desktop e 844×390: dez estações navegáveis, Arquivo, Mercador, Santuário, Altar Mítico e Portal; tap-to-move/joystick, alternância de som acessível e persistente, sem overflow ou erros fatais. Captura atualizada: `arpg-hub-mobile-smoke.png`.
- O smoke PWA passou contra a build de produção local; agora deriva cache e assets do próprio `sw.js`, conferindo v13, todos os 18 assets essenciais, ícones e remoção do cache v12.
- A auditoria de seis viewports passou, sem corte nem exceções; canvas e controles aparecem nas paisagens, e a orientação portrait mostra a tela de rotação. Capturas e JSONs foram atualizados pelos scripts `scripts/arpg-cdp-audit.mjs` e `scripts/arpg-pwa-smoke.mjs`.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 231/231 testes em 40 arquivos e build local Next.js 16.3.6. A inspeção acústica humana, instalação real em celular, smoke autenticado e validação de staging continuam pendentes; nenhuma alteração remota ou publicação ocorreu.

## Incremento P0 — run visitante completa pelo HUB — 4 de outubro de 2026

- `scripts/arpg-full-run-smoke.mjs` foi atualizado para o fluxo atual: JOGAR entra na Guilda e o teste caminha até o Cartógrafo para abrir as expedições. O roteador do smoke agora rastreia salas já visitadas para não revisitar lojas/eventos que permanecem com estado `active`.
- Execução local Chrome/CDP em 844×390: grafo de 12 salas, todas as categorias especiais e ramos laterais percorridos, combates e baú de elite resolvidos, Curupira derrotado com 125/154 HP, quatro animações do boss e quatro do Broto observadas, três padrões de boss e duas barreiras físicas observadas, loot extraído e retorno à Guilda. Os 12 checks passaram, sem erros de runtime.
- Este smoke usa run visitante e prova o fluxo de jogo local; não comprova salvamento, inventário ou recompensa autenticados. Nenhum dado remoto foi alterado.

## Incremento P1 — praça orgânica da Guilda — 4 de outubro de 2026

- Substituí o piso quadriculado uniforme por pedras em fiadas deslocadas, liguei as dez estações à praça com caminhos curvos, redesenhei o centro como um medalhão circular e acrescentei canteiros e quatro lanternas com brilho animado. As coordenadas, navegação física e colisões das estações permaneceram iguais.
- Revisei `arpg-hub-mobile-smoke.png` em 844×390. `scripts/arpg-hub-smoke.mjs` passou 31/31 checks em desktop e mobile, incluindo Cartógrafo, Arquivo, Mercador, Santuário, Altar, Portal, áudio persistido, joystick/touch e ausência de erros/overflow.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 231/231 testes em 40 arquivos e build local Next.js 16.3.6. A revisão global de arte, staging autenticado e instalação em aparelho permanecem pendentes; nenhuma alteração remota ou publicação ocorreu.

## Incremento P1 — naturalista do Bestiário — 4 de outubro de 2026

- Criei originalmente `artifacts/archive/public-art/guild-bestiary-keeper-spritesheet.png`, folha transparente de Luzia. A folha antiga está preservada; a Guilda ativa usa `public/art/guild-bestiary-keeper-spritesheet-v1.webp`. Luzia alterna ciclos de estudo, idle, fala e caminhada, ocupa fisicamente a estação do Bestiário e `E` mantém o acesso ao catálogo com origens.
- `scripts/arpg-hub-smoke.mjs` passou 33/33 checks em desktop e 844×390, confirmando Luzia→Bestiário e os percursos anteriores sem overflow ou erros fatais. `scripts/arpg-pwa-smoke.mjs`, em perfil limpo, confirmou service worker v14, cache essencial com 19 assets e remoção do v13.
- Após o novo cenário e a folha da Luzia, repeti `scripts/arpg-full-run-smoke.mjs`: grafo de 12 salas, Curupira derrotado com 116/154 HP, padrões das três fases, duas barreiras físicas, loot/extração e retorno à Guilda; 12/12 checks, sem erros CDP.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 231/231 testes em 40 arquivos e build local Next.js 16.3.6. Não houve migration, gravação remota ou publicação.

## Incremento P1 — revisão visual de sala fluvial — 4 de outubro de 2026

- `scripts/arpg-river-visual-smoke.mjs` iniciou uma run visitante com seed reproduzível `mata-encantada:river-visual-10`, percorreu a porta norte da sala inicial e confirmou a entrada física em `mata-combat-river`.
- Revisei a captura em 844×390: a água, seus reflexos, portas e navegação da sala aparecem no gameplay; os cinco checks passaram e nenhum erro de runtime foi registrado. Evidência: `arpg-river-visual-smoke.png`.
- O smoke fornece uma resposta local sintética ao início da run para fixar a seed; não valida sessão persistente/autenticada. `npm run verify:deploy` passou com typecheck, ESLint, 231/231 testes em 40 arquivos e build local Next.js 16.3.6. Staging e revisão visual completa continuam pendentes; nenhuma migration, gravação remota ou publicação ocorreu.

## Incremento P1 — HUD compacta e cooldowns mobile — 4 de outubro de 2026

- Em paisagem com toque, removi os quatro cartões de habilidade duplicados da HUD superior e passei a mostrar prontidão/contagem regressiva nos próprios botões de habilidade. Os quatro equipamentos ficam numa faixa compacta junto do minimapa; a HUD desktop não muda.
- O teste de componente confirma estado acessível de cooldown e encaminhamento da habilidade correta. O smoke visual em 844×390 foi repetido na sala fluvial; os controles laterais permanecem disponíveis e o gameplay não gera erros de runtime. Captura: `arpg-river-visual-smoke.png`.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 232/232 testes em 41 arquivos e build local Next.js 16.3.6. A suíte cresceu novamente no incremento de pausa abaixo; staging e validação em aparelho continuam pendentes.

## Incremento P0 — pausa durante a expedição — 4 de outubro de 2026

- Implementei `Esc` e um botão acessível para pausar/retomar. A cena Phaser pausa de verdade; o diálogo oferece “Retomar” e “Voltar à Guilda”, e entradas de movimento/ataque pendentes são limpas ao pausar.
- O smoke browser confirmou o diálogo acessível, relógio da cena imóvel durante 220 ms, retomada por `Esc`, mesma sala/seed e zero erros: 8/8 checks. `bridge.test.ts` também verifica a limpeza de controles sem perder escolhas de sala ou loot já abertas.
- `npm run verify:deploy`: PASS — typecheck, ESLint, 233/233 testes em 42 arquivos e build local Next.js 16.3.6. Não houve migration, gravação remota ou publicação.

## Incremento de validação — jornada completa da Mata — 4 de outubro de 2026

- Build de produção local isolada, Chrome 844×390: JOGAR abriu a Guilda, o Cartógrafo iniciou a expedição, o grafo gerou 11 salas e o jogador atravessou 24 entradas físicas; limpou combates e elite de duas ondas, abriu o tesouro, derrotou o Curupira (147/154 HP), coletou loot, extraiu e voltou à Guilda.
- Os 12 checks passaram: grafo no intervalo 8–12, boss alcançado, vitória/extração, retorno à Guilda, zero erros de runtime, quatro animações do boss e do Broto, três padrões do Curupira, barreiras físicas e portas abertas/fechadas. Run visitante, sem Supabase ou mutação remota.
- O smoke aguarda em posição neutra por 620 ms antes de se aproximar de inimigos ainda ocultos; isso permitiu observar idle sem influenciar o estado do inimigo. `node --check scripts/arpg-full-run-smoke.mjs` passou. Nenhuma publicação foi feita.

## Incremento P1 — fragmento de objetos quebráveis — 4 de outubro de 2026

- Cada objeto quebrável concede um fragmento temporário da run na destruição. O Phaser mostra um fragmento animado, toca o sinal de loot e atualiza HUD/checkpoint; não cria moeda ou recompensa permanente.
- A validação soma somente um fragmento por novo ID determinístico válido, inclusive junto a recompensa de cache, sala especial ou clear autoritativo. O endpoint alinha o saldo-base do estado de combate para não perder fragmentos em ações seguintes. Cobertura em `run-checkpoint.test.ts` e `route.test.ts`.
- `scripts/arpg-breakable-smoke.mjs` na build de produção local 844×390 destruiu relíquia de 54 HP e observou 1 fragmento, objeto inativo e zero erros. `npm run verify:deploy`: PASS — typecheck, lint, 236/236 testes em 42 arquivos e build local. A retomada autenticada contra staging segue sem homologação por falta de acesso; nenhum segredo foi salvo, migration remota aplicada ou publicação feita.
- Repeti também `scripts/arpg-full-run-smoke.mjs` após o incremento: run visitante de 10 salas, 24 entradas, elite, tesouro, Curupira (130/154 HP), extração e retorno à Guilda. Os 12 checks passaram, incluindo animações/padrões do boss e do Broto, portas e ausência de erros de runtime.

## Incremento P1 — ação touch para salas especiais e jornada completa — 4 de outubro de 2026

- `TouchControls` mostra a ação acessível “Interagir com sala especial” enquanto a sala atual de evento, descanso ou loja está ativa. O teste de componente confirma o rótulo e o encaminhamento para `queueInteract`; o smoke de jornada exerce essa ação touch para abrir as opções, escolhe e confirma a conclusão.
- A amostragem do estado de animação no smoke passou de 80 ms para 16 ms para não perder o `idle` curto no spawn. A run completa em build de produção local, Chrome 844×390, gerou 11 salas e registrou 23 resoluções, incluindo revisitas sem respawn; elite de duas waves, tesouro e as três salas especiais foram resolvidos. Curupira derrotado com 111/154 HP, quatro animações do Broto e do boss, padrões das três fases, loot/extração e retorno à Guilda. Os 12 checks passaram sem erros de runtime.
- `node --check scripts/arpg-full-run-smoke.mjs` e `npx eslint scripts/arpg-full-run-smoke.mjs` passaram; o `npm run verify:deploy` do mesmo snapshot passou com typecheck, ESLint, 237/237 testes em 42 arquivos e build local. Run visitante; staging autenticado, instalação em aparelho e revisão auditiva continuam pendentes. Nenhuma gravação remota ou publicação ocorreu.

## Revalidação P1 — matriz de viewports — 4 de outubro de 2026

- Atualizei `scripts/arpg-cdp-audit.mjs` para aguardar a transição atual do título → Guilda → rotas do Cartógrafo → jogo e incluir diagnóstico útil se o canvas não abrir.
- Repeti a matriz na build local de produção: 1920×1080, 1366×768 e 1280×720; mobile landscape 844×390 e 932×430; portrait 390×844. Cada viewport passou 5/5 checks: layout sem overflow, canvas/touch conforme orientação, gate de rotação no portrait e zero erros fatais.
- `npm run verify:deploy` passou neste snapshot: typecheck, ESLint, 237/237 testes em 42 arquivos e build Next.js 16.3.6. Essa cobertura é em Chrome headless; instalação/acessibilidade em aparelho real, staging e revisão auditiva seguem pendentes. Sem alteração remota ou publicação.

## Revalidação P0 — jornadas completas nos três biomas — 4 de outubro de 2026

- Ajustei o vetor de esquiva do `scripts/arpg-full-run-smoke.mjs` para acompanhar a posição ao vivo do boss e evitar as bordas da arena. O ajuste é apenas do roteiro de automação; não muda dano, vida ou regras de combate do jogo.
- Na build de produção local, Chrome 844×390, Arquipélago das Marés gerou 11 salas e derrotou Iara com 24/154 HP; Montanhas Rúnicas gerou 12 salas e derrotou Amarok com 85/150 HP; Mata Encantada gerou 12 salas e derrotou Curupira com 138/154 HP. Os três fluxos concluíram loot/extração e retorno à Guilda, com 12/12 checks e sem erros de runtime.
- O smoke observou idle/walk/attack/defeat de Iara e Boto, Amarok e Raijū, e Curupira e Broto. Na Mata, também observou os padrões das três fases, duas barreiras físicas de raiz, salas especiais via toque, elite de duas waves e tesouro. Capturas: `iara-boss-smoke.png`, `mares-boto-enemy-smoke.png`, `amarok-boss-smoke.png`, `montanhas-raiju-enemy-smoke.png`, `curupira-boss-smoke.png` e `curupira-root-arena-smoke.png`.
- A repetição de `npm run verify:deploy` após o ajuste passou: typecheck, ESLint, 237/237 testes em 42 arquivos e build local Next.js 16.3.6. São runs visitantes locais; staging autenticado, migrations/pgTAP, teste em aparelho real e revisão auditiva permanecem pendentes. Nenhuma alteração remota ou publicação ocorreu.

## Revalidação P0 — travessia desktop completa — 4 de outubro de 2026

- Ampliei `scripts/arpg-full-run-smoke.mjs` com modo desktop que usa viewport 1366×768, WASD, E, atalhos de habilidade e mouse; o modo touch 844×390 segue como padrão. O debug local inclui posições dos inimigos ativos para direcionar a mira e a esquiva; só é exposto com `debugDungeon=1`.
- Smoke na build local de produção, Chrome desktop headless: Mata gerou 12 salas e 27 entradas, incluindo revisitas sem respawn; completou combate, elite de duas waves, tesouro e evento/descanso/loja, derrotou Curupira com 101/154 HP, extraiu e voltou à Guilda. 12/12 checks, quatro animações do Broto e do boss, três padrões do Curupira, duas barreiras de raiz e zero erros de runtime.
- `node --check` e ESLint do smoke passaram. A build de produção usada passou no `npm run verify:deploy` (typecheck, ESLint, 237/237 testes em 42 arquivos e build Next.js 16.3.6). Navegador headless não comprova teclado/mouse em hardware real; staging autenticado, migrations/pgTAP, dispositivo real e revisão auditiva seguem pendentes. Nenhuma alteração remota ou publicação ocorreu.

## Revalidação final dos smokes locais — 4 de outubro de 2026

- Repeti as jornadas touch na build de produção local, Chrome 844×390: Arquipélago das Marés (Iara com 45/154 HP), Montanhas Rúnicas (Amarok com 34/150 HP) e Mata Encantada (Curupira com 111/154 HP). As três concluíram loot, extração e retorno à Guilda, com 12/12 checks e zero erros de runtime. A Mata observou idle/walk/attack/defeat do Broto e do Curupira, padrões das três fases, duas barreiras de raiz e portas em todos os estados.
- O modo desktop headless 1366×768 segue aprovado com 12/12 checks (Curupira com 101/154 HP). `node --check` e ESLint passaram no harness após a amostragem de entrada ser estendida a oito salas de combate/elite.
- O `npm run verify:deploy` já havia passado após a última mudança no código do jogo: typecheck, ESLint, 237/237 testes em 42 arquivos e build local Next.js 16.3.6. Depois desse gate, as alterações foram somente no smoke e documentação; o smoke recebeu nova checagem sintática e lint.
- Isso comprova os fluxos locais em Chrome headless. A v1.0 ainda aguarda homologação autenticada, acesso ao staging para migrations/pgTAP/RLS/grants, validação PWA/acessibilidade/performance em dispositivo real e revisão auditiva humana. Não houve escrita remota nem publicação.

## Revalidação PWA e atualização do cache — 4 de outubro de 2026

- O smoke agora exige `APP_URL` em loopback e limpa somente Service Worker e Cache Storage da origem local antes de semear o cache v13 e registrar o worker v14. Isso força o ciclo de instalação/ativação que remove o cache antigo, sem apagar cookies ou progresso local.
- Na build de produção local, manifest, standalone/landscape, ícones 192/512 e maskable, Apple Touch Icon 180×180, ativação do worker, assets essenciais e remoção do cache anterior passaram; 10/10 checks. `node --check` e ESLint do smoke passaram.
- O PWA continua parcial até instalar e validar atualização/offline em dispositivos e navegadores reais; nenhuma publicação ocorreu.

## Rechecagem de acesso, desempenho e baú — 4 de outubro de 2026

- A leitura somente visual do navegador Supabase encontrou produção `Card Realms` (`lfmbvqixixbhffdpmvhp`) com 19 migrations visíveis e nenhuma nomeada ARPG. O staging `ywawwhnsvpfeppfcuwzg` não está acessível nesta sessão. Isso não demonstra ausência de schema (migrations manuais ou com outros nomes são possíveis); nenhum SQL, migration ou escrita foi executado. `docs/SUPABASE_STAGING.md` guarda a limitação e o inventário observado.
- O último JSON de performance, `2026-10-04T12:11:10.446Z`, passou 6/6 checks entre 58,3–60,5 FPS sem throttling. O smoke PWA v15 passou 10/10 checks em build local. A instalação, performance e atualização em dispositivo real continuam pendentes.
- O full-run da Mata no Chrome 844×390 passou 14/14 checks em uma run de 9 salas e 18 resoluções, incluindo revisitas; Curupira terminou com 120/154 HP, foram observadas três fases, duas barreiras e quatro estados do Curupira e do Broto, e os frames de abertura do baú 1–3. A checagem dimensional usou width/height do frame e dimensões de exibição reais no debug: 80,194–94,221 px durante o tween, 92 px no final e escala 0,14673046; zero erros.
- A v1.0 segue parcial: staging autenticado, dispositivo real e revisão auditiva humana permanecem pendentes. A evidência acima não altera banco nem representa publicação; a revisão final de código e o gate de build após o HUD compacto continuam separados.

## Revalidação multiplayer: avatar + dois poderes — 4 de outubro de 2026

- Atualização do contrato: combate clássico, PvP e a Raid antiga usam avatar próprio + exatamente dois poderes; a escolha inicial obrigatória de criatura e a tela de equipes saíram do caminho ativo. Equipamento completo continua validado e obtido nos sistemas ARPG/dungeon. A Raid ARPG permanece distinta; rooms legados não são retomados automaticamente.
- O loadout é salvo antes de navegar do Arquivo para PvP ou iniciar uma batalha. O modo visitante envia avatar/poderes locais e os valida contra o catálogo; o modo autenticado usa o snapshot e a posse remotos. Novas ações não aceitam captura, troca de criaturas ou campos de apoiador.
- **PASS local:** `npm run verify:deploy` completou typecheck, ESLint sem warnings, 292/292 testes em 59 arquivos e build de produção local no Next.js 16.3.6. Cobertura adicional inclui setup de visitante, persistência antes da navegação, prontidão de duas habilidades, motor Raid, rotas PvP e estado Raid.
- Inventário local: 38 migrations. Planos recentes conferidos estaticamente: 016 (10), 017 (38), 018 (26), 019 (52). Nenhum teste SQL/pgTAP foi executado. O teste 019 roda depois da migration e não simula atualização de linhas legadas: classificação/conversão de salas, snapshots e arquivamento de lobby inválido, nem backfill de recompensas já existentes; valide esses caminhos em banco descartável/staging.
- **Pendente para release:** o staging autorizado `ywawwhnsvpfeppfcuwzg` não aparece na conta conectada. Não foram aplicadas migrations, consultado schema remoto ou feito deploy. Ainda faltam homologação autenticada de PvP/Raid, validação em dispositivo real e os aceites de acessibilidade/auditivos já listados neste documento. O sucesso do gate local não aprova promoção ou release 1.0.
