# Card Realms — Dungeon Specification

## Objetivo

Executar uma run da Mata Encantada como uma rede de salas modulares. A dungeon é instanciada no início da run com uma seed e fica dentro de uma única sessão Phaser. O jogador se move pelo chão e pelos corredores; entrar em outra sala não recarrega React nem navega a rota.

## Avatar, poderes e origem dos itens

- O jogador controla o próprio avatar, criado/customizado no Ateliê com o `AvatarConfig` existente. A Guilda e a dungeon exibem a mesma configuração; não há avatar ou schema paralelo para o ARPG.
- O loadout de combate tem exatamente duas cartas/ataques próprios (`abilityIds`). As criaturas folclóricas identificam os poderes nas cartas e não acompanham nem lutam ao lado do jogador.
- Raízes Ancestrais e Chama do Boitatá são as duas cartas iniciais gratuitas. Cartas de poder adicionais são compradas com moedas de jogo e equipadas exclusivamente no Arquivo de Poderes da Guilda. A dungeon não concede cartas permanentes.
- Armas e armaduras são obtidas nas dungeons; buffs de salas especiais são temporários da run. O Mercador da Guilda não vende equipamento que altere combate.

## Modelo

DungeonGraph contém seed, regionId, floor, startRoomId, bossRoomId e rooms. Cada DungeonRoom declara id, gridX/gridY, type, size, state, templateId, floor, distanceFromStart, conexões cardeais, waves e rewardTableId.

Tipos atuais: start, combat, treasure, event, elite, rest, shop e boss. Tamanhos: small, medium e large. Estados: unvisited, discovered, active, combat e cleared. CombatRoomController usa idle, entering, locked, spawning, combat, wave_complete e cleared.

Uma coordenada lógica pertence a no máximo uma sala. Conexões são ortogonais e precisam ser recíprocas. Ausência de conexão significa parede, sem porta/corredor.

## Geração

- START em (0,0).
- Quantidade aleatória entre 8 e 12.
- Caminho principal com 6–8 salas contando START, seguido por ramificações em células livres.
- Boss no fim do caminho principal, a pelo menos quatro conexões do START.
- Uma sala de tesouro e uma elite obrigatórias; quando há espaço, também uma event, uma rest e uma shop.
- Todos os nós precisam ser alcançáveis. A seed reproduz o layout e o conteúdo gerado.
- O gerador tenta até 24 variantes determinísticas de uma seed e valida antes de entregar o grafo.

A implementação atual cobre as regras acima e tem um teste que percorre 1.000 seeds. Também testa tiles, sobreposição física, manager e controller. A garantia adicional de segurança é que uma conexão precisa apontar para o vizinho na coordenada correta e voltar pelo lado oposto.

## Grid físico e tamanhos

Tile base: 32 px. Templates atuais usam 11×11, 15×15 e 21×21 tiles para SMALL, MEDIUM e LARGE. Salas ficam em células físicas com centros separados por 896 px; corredores ligam os centros das portas e têm 128 px de largura. O canvas é 1280×720. A câmera usa bounds por sala e anima o pan durante a travessia. Clique/toque no chão calcula caminho A* sobre tiles caminháveis e corredores conectados; paredes e obstáculos bloqueiam rotas, movimento manual substitui o destino e uma sala em combate restringe o path ao seu interior.

A grade lógica não equivale diretamente a pixels. Ela preserva salas sem sobreposição e reserva espaço para corredor. O runtime constrói o tilemap de todas as salas, mas instancia a IA de combate somente ao ativar a sala atual. Isso reduz gameplay ativo; conteúdo puramente visual do fundo ainda deve ser mantido leve.

## Templates

A Mata, o Arquipélago e as Montanhas Rúnicas possuem 12 definições cada: início; cinco combate; tesouro; evento; elite; descanso; loja; boss. Cada bioma registra tamanho, padrão visual, portas, pontos de spawn/recompensa e camadas previstas. O renderer distingue detalhes de piso, água/glaciar, glifos rúnicos e obstáculos de pedra; glifos são caminháveis e spawns evitam tiles bloqueados. A Mata acrescenta árvores sobre os obstáculos, tochas oscilantes ou vaga-lumes conforme o padrão; o Arquipélago recebe reflexos animados na água; as Montanhas recebem cristais e brilhos nos glifos. Descanso, evento e loja têm props procedurais próprios; a composição ainda usa tile patterns básicos e precisa de camadas ambientais ilustradas.

Camadas finais: GROUND, GROUND_DETAILS, WATER, DECORATION_BOTTOM, WALLS, COLLISION, OBJECTS, CHARACTERS, FOREGROUND, LIGHTS e EFFECTS. Todo obstáculo deve ser definido em tiles e sua colisão precisa corresponder ao desenho.

## Entrada, portas e ondas

Ao entrar numa sala nova, DungeonManager atualiza a sala atual e revela os vizinhos. Para COMBAT, ELITE e BOSS: entrar → estado ACTIVE/COMBAT → fechar passagens conectadas → apresentar spawn → executar waves. MEDIUM usa uma ou duas waves; LARGE pode usar até três. O controller inicia a próxima wave depois que todos inimigos vivos forem derrotados. Apenas inimigos da sala atual recebem update de IA.

Porta lógica: OPEN → CLOSING → CLOSED e CLOSED → OPENING → OPEN. Portas conectadas deslizam entre a abertura e o batente; o estado atual também fica visível no diagnóstico, o collider é habilitado antes do fechamento e atualizado durante o tween, e é removido antes de abrir. Há poeira visual e cues Web Audio de fechar/abrir. A arte ainda usa formas geométricas em vez de sprites dedicados.

Ao terminar a última wave: marcar CLEARED, pausar IA da sala, abrir portas e permitir passagem. Reentrar numa sala CLEARED nunca respawna a mesma onda. A posição de player/enemy/loot precisa ser testada contra chão caminhável e obstáculos.

As definições de inimigo carregam um combatRole (`melee`, `ranged`, `charger`, `caster` ou `elite`). Melee persegue; ranged mantém distância e dispara; charger telegrapha direção e investe; caster marca uma área no chão; elite mantém alcance e dispara uma rajada. O papel e a intenção de movimento são data-driven, e movimento/telegraph/projéteis são processados localmente no Phaser.

## Salas especiais e loot

- START: ponto de chegada, sem respawn.
- COMBAT: baú de equipamento apenas nas salas designadas pelo plano assinado; salas comuns têm chance determinística de cache local (14% cura, 22% fragmentos, 64% nada), evitando equipamento após todo combate.
- TREASURE: baú e recompensa principal garantidos, normalmente sem combate.
- EVENT: altar/NPC com duas ou mais opções e consequência data-driven.
- ELITE: recompensa de equipamento assinada em uma sala designada e combate com spawn telegraph; uma tabela de qualidade própria ainda falta.
- REST: cura ou melhoria temporária da run.
- SHOP: comerciante físico e compras com moeda da run, sem alterar moedas permanentes no cliente.
- BOSS: arena large, intro e fases próprias; ao vencer, libera o loot de equipamento do plano assinado e um portal de extração. A run termina quando o jogador se aproxima e interage com o portal. Cartas de poder permanentes não fazem parte do loot de dungeon.

Descanso, evento e loja têm props procedurais contextuais dentro da sala, com prompt de interação. A escolha React só abre após o jogador se aproximar (128 px) e usar o comando de interação; em mobile paisagem, o controle touch oferece “Interagir com sala especial” enquanto um desses nós está ativo e sem modal concorrente. Até a interação, as portas ficam livres; após a escolha o prop mostra “RESOLVIDO”. A banca tem silhueta de mercador, mas não uma spritesheet própria para o comerciante da dungeon. O baú usa `public/art/treasure-chest-spritesheet-v2.webp`, arte original do Card Realms (sem recursos do ZIP de referência), com grade 2 × 2 de quadros 627 × 627 px. O frame 0 fica fechado; a interação toca os frames 1–3 uma vez a 10 fps antes de resolver o loot. Ambos os caminhos de recompensa renderizam o sprite a 92 × 92 px; o surgimento procedural anima alpha/posição e escala de 75% até o tamanho nominal sem alterar a escala final. Cada quadro preserva o mesmo baseline no chão. Os bounds por frame (topo e baseline) também posicionam o prompt acima da tampa sem cobri-la quando aberta. O prompt local `[E] Abrir` aparece apenas a até 136 px, muda para `Abrindo…` durante a animação e bloqueia nova abertura até a conclusão; o botão touch existente continua disponível. Os três bosses (Curupira, Iara e Amarok) e três inimigos comuns representativos (Broto, Boto e Raijū) têm ciclos originais de idle, walk, attack e defeat; mini bosses e demais definições de inimigo ainda precisam de ciclos dedicados.

Após a abertura de 300 ms, o `DungeonLoot` já atribuído sobe de `y−28` a `y−84` em 260 ms, pausa 80 ms, cai durante 260 ms e tem contato de 160 ms. O destino preferido fica 24 px abaixo do baú; se o tile ou a sala não forem seguros, tenta os dois vizinhos laterais e depois a célula caminhável mais próxima dentro da mesma sala. Só depois do contato abre a comparação React. Durante a apresentação, física e input de gameplay ficam suspensos, sem pausar a cena. O sprite de recompensa é o único item visual e permanece no chão até a escolha. Armas e armaduras usam cinco silhuetas procedurais de 32 × 32 px (espada, arco, cajado, peitoral e manto); caches podem reutilizar o fragmento de 24 px e só concedem cura/fragmentos após a queda. Silhueta e perfil de efeitos consultam a definição do item e preservam sua raridade, incluindo épico, lendário e mítico. A resolução da escolha concede apenas o equipamento/loot previamente atribuído à run; cartas permanentes ficam fora desse fluxo. Callbacks da apresentação verificam identidade e o slot visual impede duplicação.

## Objetos quebráveis

Salas da run recebem de um a três objetos por seed, como caixas, vasos, arbustos e relíquias. A seleção usa o seed e o id da sala; os props ficam em chão caminhável e longe do centro/rota de chegada. Projéteis e ataques em área reduzem sua durabilidade; ao quebrar, o objeto desaparece com pulso e detritos, concede +1 fragmento temporário da run com animação de coleta e cue Web Audio, e atualiza HUD/checkpoint. Eles não têm colisão para não fechar corredores. IDs quebrados são incluídos no checkpoint, limitados a props derivados da seed em salas visitadas e validados como monotônicos; a retomada os restaura como ausentes. Fragmentos não viram moeda ou item permanente.

Recompensas permanentes de equipamento dependem de um token/RPC server-side. Nenhuma sala, boss ou resultado de dungeon concede carta de poder permanente; a compra de cartas usa o fluxo server-side próprio do Arquivo da Guilda. Loot temporário (fragmentos, cura e buffs da run) permanece limitado ao estado da run. O cliente não declara uma recompensa permanente sem autorização server-side.

## Minimap e debug

Minimap mostra sala atual, salas reveladas e conexões descobertas. Tipo de uma sala desconhecida não deve aparecer antes de descoberta. O visualizer textual atual renderiza os nós por coordenada. O painel local `?debugDungeon=1` inclui seed, id, tipo, estado, portas, inimigos, bounds e diagnóstico do runtime; fica desativado no fluxo normal.

## Verificação

`npm run verify:deploy` passou no snapshot documentado mais recente: TypeScript, ESLint, 237 testes em 42 arquivos e build local Next.js 16.3.6. A suíte cobre seeds para contagem, START/BOSS únicos, alcance do boss, salas especiais, simetria, coordenadas e acessibilidade; também valida sobreposição física, tiles, spawn caminhável, alocação de loot, caches, manager/controller, geração/durabilidade de props e transições monotônicas dos IDs quebrados. O smoke `scripts/arpg-full-run-smoke.mjs` completou a jornada da Mata em viewport 844×390, gerou 11 salas e registrou 23 resoluções, limpou elite de duas waves, abriu o tesouro, resolveu loja/descanso/evento usando a ação touch, derrotou o Curupira com 111/154 HP, coletou loot, extraiu e voltou à Guilda: 12/12 checks e zero erros de runtime. Observou idle/walk/attack/defeat do Broto e do boss, os padrões das três fases e uma barreira física. O smoke `scripts/arpg-breakable-smoke.mjs` destruiu uma relíquia e confirmou o fragmento no HUD, prop inativo e zero erros. São execuções visitantes/locais; ainda faltam homologação autenticada, aplicação/validação de migrations e cobertura browser em desktop/dispositivo real.

Na revalidação mais recente da build de produção local (Chrome 844×390), runs visitantes completas derrotaram Iara com 45/154 HP, Amarok com 34/150 HP e Curupira com 111/154 HP. Cada run concluiu extração e retorno à Guilda, passou 12/12 checks e teve zero erros de runtime. Na Mata foram observados os quatro estados do Broto e do Curupira, padrões das três fases e duas barreiras de raiz. `npm run verify:deploy` passou no snapshot do jogo com 237 testes em 42 arquivos e build Next.js 16.3.6; a edição posterior foi só no harness, cuja sintaxe e lint passaram. Continuam pendentes homologação autenticada, migrations/pgTAP no staging, validação em aparelho real e revisão auditiva humana.

A travessia da Mata também passou em Chrome desktop headless 1366×768 com teclado/mouse: 12 salas, 27 entradas, loot/extração, retorno à Guilda, Curupira com 101/154 HP, padrões de três fases e duas barreiras de raiz; 12/12 checks e zero erros. O critério do vertical slice está coberto em touch landscape e desktop headless; falta validar controles e acessibilidade em hardware real.

## Critério de aceite do vertical slice

HUB → portal → START → atravessar corredor → combate com porta fechando e spawn legível → waves → clear → porta abrindo → bifurcação → tesouro/elite/evento → boss com fases → loot → portal de saída → HUB. Visitando uma sala CLEARED, não há respawn. O smoke completou o fluxo em touch landscape 844×390 e em desktop headless 1366×768, com retorno à Guilda; instalação e interação em hardware real seguem sem homologação.
