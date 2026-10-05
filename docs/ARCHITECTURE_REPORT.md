# Card Realms — Architecture Report

Auditoria realizada em 2 de outubro de 2026 sobre o checkout existente e o arquivo soul-knight-main.zip. O ZIP foi lido diretamente, sem extrair recursos para o projeto. Ele foi usado apenas para mapear responsabilidades de gameplay.

Este documento preserva o snapshot inicial da auditoria. A seção “Atualização de estado” no final registra mudanças posteriores; para status e critérios de aceite vigentes, use `docs/RELEASE_1_0.md`.

## Resumo

Card Realms já é uma aplicação Next.js com um ARPG Phaser jogável integrado. O código atual já contém uma dungeon procedural em grafo de 8–12 salas e o runtime físico percorre corredores entre elas. Isso substitui a descrição antiga, ainda presente em alguns relatórios de status, de uma arena linear de cinco salas.

A reformulação deve continuar incremental: preservar autenticação, progresso, conteúdo e serviços online; consolidar o ARPG como a experiência principal; completar a apresentação e o loop de exploração antes de expandir para novos biomas.

## Stack e fronteiras

- Next.js 16.3.6, React 19.3 e TypeScript 5.9.
- Phaser 3.90 para movimento, colisão, câmera, inimigos, projéteis, salas e hub. Phaser é carregado dinamicamente pelos runtimes em src/game/arpg/runtime.
- Supabase SSR/JS e Postgres para identidade, snapshot do jogador, inventário, loadout, progresso, Raids, PvP e recompensas persistentes.
- Vitest e Testing Library para os motores de domínio e componentes.
- PWA com manifest em landscape e service worker que não armazena páginas autenticadas nem chamadas de API.
- O gate de release configurado é npm run verify:deploy. Vercel mantém auto-deploy por Git desabilitado.

A página raiz é um Server Component que chama loadPlayerBootstrap. GameShell é a fronteira cliente: inicia na Guilda dos Cartógrafos para usuários autenticados/visitantes e mantém menu legado para compatibilidade. O shell React administra estado de conta, navegação, diálogos, HUD, controles touch e comunicação com APIs. O loop de jogo fica no Phaser, sem recarregar a página entre salas.

## Mapa de código

- src/app: página raiz, layout, estilos, manifest, callback de autenticação e route handlers.
- src/components/game: shell e sistemas existentes de mapa, coleção, equipe, refúgio, PvP e Raids.
- src/components/arpg: sessão de jogo, Guilda jogável, seleção de expedição, Arsenal, HUD, controles touch, loot e escolha de evento.
- src/game/arpg/domain: contratos do ARPG, loadout, HUD e bridge.
- src/game/arpg/content: armas, armaduras, relíquias, cartas, suportes, inimigos, expedições e regras dos biomas.
- src/game/arpg/dungeon: RNG com seed, grafo, gerador, layout físico, templates, tile data, controller, manager e salas especiais.
- src/game/arpg/runtime: criação Phaser, cena do hub, cena da dungeon e mundo de salas.
- src/game/arpg/raid: motor cooperativo validável no servidor.
- src/server e src/lib/supabase: bootstrap, autoridade de servidor, autenticação e adaptadores.
- supabase/migrations: progresso, catálogo, RLS, economy, Raids, PvP e sistemas ARPG.
- public/art: atlas de criaturas e arte própria do Card Realms; não foram introduzidos assets do ZIP.

## Sistemas atuais

### Experiência e gameplay

A Guilda dos Cartógrafos é uma cena Phaser controlável, selecionada por padrão em GameShell. Há estações para navegar aos sistemas existentes e ao portal de expedições. A seleção da expedição abre ArpgGame dentro do mesmo shell.

O ARPG já tem movimento top-down, mira, ataque, dash, colisão, câmera, touch landscape, gamepad, dois suportes alternáveis e quatro cartas-habilidade. Armas, armaduras, relíquias e papéis de combate são definições data-driven. Melee, ranged, charger, caster e elite agora têm intenções/ataques distintos no runtime local; inimigos e projéteis reaproveitam grupos Phaser. O Curupira Ancestral possui comportamento de boss, mudanças de fase e spritesheet original com idle, caminhada, ataque e derrota. Os outros tipos de inimigo ainda não têm animação dedicada.

A dungeon usa uma seed de run, grafo ortogonal, estados por sala, rooms físicas ligadas por corredores, tiles de chão/parede, portas, waves, eventos de descanso/loja, sala de tesouro e minimapa que revela os nós conhecidos. O gerador valida entre 8 e 12 nós, coordenadas únicas, conexões recíprocas, acessibilidade e distância do boss. Há teste automatizado de 1.000 seeds.

### Incremento implementado na dungeon

Os templates agora declaram padrões de sala para a Mata e para o Arquipélago. O renderer escolhe variações de piso, água decorativa e obstáculos de pedra; paredes e obstáculos bloqueiam o movimento, os spawns evitam tiles bloqueados e inimigos colidem com o ambiente. O cenário ainda usa tile art e formas simples, sem composição completa de props/foreground.

Portas em conexões válidas deslizam até o batente ao fechar e saem da passagem ao abrir. O runtime expõe os estados OPEN/CLOSING/CLOSED/OPENING no diagnóstico; o collider acompanha o fechamento, a abertura emite poeira e a cena toca cues procedurais de abrir/fechar. A arte da porta ainda é geométrica, sem sprites dedicados. Waves usam um telegraph escalonado de raízes/folhas para tornar a entrada dos inimigos legível.

O plano de quatro itens assinado no servidor agora é alocado a salas distintas de tesouro, elite, combate e boss. Salas comuns de combate rolam cache determinístico (cura, fragmentos ou nenhum drop), evitando baú de equipamento em todo clear. O loot permanente continua elegível somente pelo token/RPC do servidor. Após derrotar o Curupira, a sala oferece o loot previsto e um portal; a extração encerra a run quando o jogador interage com ele.

As salas EVENT/REST/SHOP ainda usam overlays React sem NPCs/props físicos. Baús e elementos de cenário são geométricos. Há um modo local de debug detalhado em `?debugDungeon=1`.

### Dados, autenticação e saves

A página server-side busca claims e progresso remoto por helpers SSR. O fluxo de login Supabase passa pelo callback em src/app/auth/callback. Cookies são atualizados pelo proxy. O cliente do navegador usa apenas a chave publicável; a chave secreta fica nos módulos server-only.

Visitantes usam save local versionado e validado por Zod. Contas recebem snapshot e mutations estreitas por APIs; Postgres/RPCs são a fonte de verdade para inventário e economia. A run ARPG recebe token HMAC server-side com seed e plano de loot. A API de extração usa RPC transacional e ledger idempotente. O estado de frame, movimento, colisão, IA, projéteis e efeitos continua local.

### Conteúdo e sistemas online

O catálogo folclórico existente tem 25 criaturas no README, cinco elementos, regiões, coleção e bestiário. O loop TCG, equipe de seis, mapa regional, casa/refúgio, amizades e PvP permanecem acessíveis como legado e infraestrutura, sem serem removidos durante a migração.

O PvP TCG tem servidor autoritativo, privacidade de mão/baralho, versões, idempotência e atualização Realtime com polling de recuperação. Raids ARPG têm um motor cooperativo server-authoritative separado do singleplayer. Rotas atuais estão em src/app/api/battle, player, pvp, raids, map-party e arpg.

### PWA

src/app/manifest.ts declara nome, modo standalone e orientação landscape. src/components/pwa/service-worker-registration.tsx registra public/sw.js. O service worker ignora navegação HTML, /api e /auth; cacheia somente recursos estáticos same-origin.

## Referência C++ auditada

O ZIP contém fontes em Source/Game e arte em Resources, além de StageManager, StageFactory, classes Stage_1_*, Stage_2_*, Stage_3_*, Room, MonsterRoom, TreasureRoom, Door, TransferGate, ObjectManager, MonsterPool, ProjectilePool, WeaponFactory e UIManager.

StageManager mantém nível/fase, limpa objetos, escolhe o próximo Stage e posiciona TransferGate. StageFactory associa valores de level/stage a classes fixas. Stage agrega paredes, salas, baú/loja, posicionamento do jogador e passagem. MonsterRoom detecta entrada, instancia monstros do pool, adiciona barreiras/portas e, após a derrota de todos, marca-se limpa e gera baú. TreasureRoom escolhe entre comerciante e baú. ObjectManager reúne update, input, colisão, renderização e reciclagem de objetos. Os pools adquirem/reinicializam e devolvem entidades. WeaponFactory mapeia enum para implementações; UIManager desenha estado do jogador, fase, moedas e cooldown.

## Decisão

A base de tecnologia e os sistemas de conta continuam. O primeiro incremento já liga padrões visuais, obstáculos, portas, spawns, distribuição de loot e extração do boss ao grafo físico. O trabalho restante é completar props/arte em camadas, estados/áudio das portas e interações diegéticas das salas especiais. O TCG continua como compatibilidade até o hub e o Arsenal ARPG cobrirem os caminhos necessários.

## Verificação de conclusão do vertical slice — 3 de outubro de 2026

`npm run verify:deploy` passou com TypeScript, ESLint, 138 testes e build de produção local. O smoke completo no browser percorreu 11 salas em viewport landscape 844×390, derrotou Curupira, exibiu recompensa elegível para extração, interagiu com o portal, retornou à Guilda e revisitou sala limpa sem respawn; não houve exceções de runtime. O gerador também valida 1.000 seeds na suíte.

Esta verificação usou um fluxo visitante/local e não escreveu progresso no Supabase nem validou a persistência permanente de recompensas em uma conta autenticada. Não foi aplicada migration nem feito deploy remoto.

## Incremento P0 — persistência de dungeon — 3 de outubro de 2026

Runs autenticadas agora têm um registro em `private.arpg_runs`, com seed, plano de loot assinado, estado, revisão de checkpoint e resultado terminal. Route Handlers usam RPCs estreitos pelo cliente administrativo; roles de navegador não recebem acesso direto à tabela ou às RPCs. A interface consulta a run ativa e pode inicializar Phaser com o checkpoint salvo. Visitantes continuam em memória local.

O checkpoint é validado no servidor contra Zod, o grafo derivado da seed, sala corrente, salas limpas, equipamento permitido e condições de extração. O browser serializa gravações e usa revisão otimista para evitar que duas abas sobrescrevam silenciosamente o mesmo estado.

Esta fronteira ainda não é autoridade de combate completa: o cliente produz o checkpoint, incluindo clear e HP. O RPC exige boss limpo e portal liberado antes de conceder a recompensa, mas não reproduz ondas, dano ou morte do boss. O claim de recompensa singleplayer só poderá receber aceite de autoridade integral depois de a simulação/registro de encontro tornar-se server-authoritative.

A migration `20261003133418_arpg_persistent_runs.sql` e seus testes pgTAP foram escritos, mas permanecem sem validação Postgres local porque não havia listener na porta 54322. A CLI encontrou e vinculou o staging documentado; a listagem do histórico remoto falhou por senha ausente para `cli_login_postgres`. O lint remoto revelou ainda uma ambiguidade preexistente em `public.record_mission_events`, corrigida localmente pela migration `20261003141927_fix_mission_events_ambiguity.sql`, ainda não aplicada. O gate de código local passou com 145 testes e build Next.js; essa evidência não equivale a aplicar ou homologar o schema.

O smoke CDP local de 3 de outubro passou na segunda execução em 844×390: 12 salas, boss, recompensa, extração e retorno à Guilda sem erros de runtime. A primeira execução falhou quando o jogador ficou inativo diante do baú final; o cenário não foi reproduzido e segue registrado como intermitência sem causa confirmada.

## Atualização de estado — 4 de outubro de 2026

Esta atualização substitui descrições anteriores de implementação quando houver divergência:

- A dungeon procedural opera nos três biomas (Mata Encantada, Arquipélago das Marés e Montanhas Rúnicas), com grafo de 8–12 salas, portas físicas e geração de spawns no runtime Phaser.
- As portas conectadas têm estados OPEN/CLOSING/CLOSED/OPENING, tween, collider sincronizado, poeira e cues; salas de descanso/evento/loja têm props físicos de interação. O acabamento ainda usa formas procedurais em parte dos objetos.
- Curupira, Iara, Amarok, Broto, Boto e Raijū usam spritesheets originais com idle/walk/attack/defeat. A Guilda tem dez destinos e folhas de NPC para Mestre da Forja, Mercadora, Arquivista e Luzia.
- Checkpoints autenticados incluem IDs de props quebrados e visitas; a validação limita esses IDs aos placements derivados da seed e mantém a transição monotônica. Cada quebra concede +1 fragmento temporário; a rota preserva o saldo no combate autoritativo, sem criar recompensa permanente.
- Em Chrome 844×390, uma run visitante recente iniciou na Guilda, gerou 11 salas, venceu a elite e o Curupira, extraiu e voltou à Guilda (12/12 checks, sem erros de runtime). Isso não homologa login, persistência/recompensas em conta real, staging, instalação em aparelho ou a meta de performance.
- O acesso ao staging Card Realms e a credenciais PostgreSQL não está disponível no ambiente atual; nenhuma migration foi aplicada nem houve publicação.
- `npm run verify:deploy` passou com typecheck, ESLint, 236 testes em 42 arquivos e build. Um smoke na build de produção local, 844×390, destruiu relíquia de 54 HP e confirmou HUD com 1 fragmento, prop inativo e zero erros; a homologação de reload autenticado em staging continua pendente.
