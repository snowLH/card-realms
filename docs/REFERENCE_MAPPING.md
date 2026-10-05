# Card Realms — Reference Mapping

## Limite de uso

soul-knight-main.zip é referência de organização do gameplay. Não foram copiados código, BMPs, sprites, mapas, armas, personagens, nomes ou identidade visual. O jogo continua usando Next.js, React, Supabase, Phaser e o universo folclórico próprio do Card Realms.

## Correspondência de sistemas

| Referência C++ | Responsabilidade observada | Card Realms | Diferença deliberada |
| --- | --- | --- | --- |
| StageManager | controla level/stage, cria fase, limpa objetos e avança pelo portão | DungeonManager + DungeonGraph | run usa seed, grafo e progresso por sala |
| Stage / StageFactory | fase abstrata e seleção de layouts fixos por level/stage | generateDungeon + RoomTemplateRegistry + conteúdo de expedição | grafo procedural; região e template são dados |
| Stage_1_*, Stage_2_*, Stage_3_* | constroem paredes, posicionam player, portal e obstáculos para cada mapa fixo | RoomTemplateDefinition + layout + tiles por sala | não haverá uma classe por mapa |
| Room | guarda canto, tamanho e deslocamento | DungeonRoom + RoomPixelLayout | coordenada lógica e posição física são separadas |
| MonsterRoom::IsInside | verifica entrada do jogador uma vez | updateProceduralRoom + DungeonManager.enterRoom | transição pela posição Phaser; sem teleportar sala a sala |
| MonsterRoom::SetDoors | fecha perímetro e instancia barreiras e portas visuais | DungeonWorldRuntime.setDoorsLocked | portas só existem em conexões válidas; deslizam, sincronizam collider e reportam OPEN/CLOSING/CLOSED/OPENING; arte ainda geométrica |
| MonsterRoom::SetMonsters / PlacedMonster | cria composição de monstros e posições de spawn | conteúdo data-driven + CombatRoomController + spawnProceduralWave | waves e comportamento ficam fora do renderer de template |
| MonsterRoom::IsCleared | aguarda monstros vivos, limpa a sala e libera passagem/recompensa | CombatRoomController + DungeonManager.clearRoom + política de recompensa | estado CLEARED persiste durante a run; loot permanente segue plano assinado |
| TreasureRoom | escolhe comerciante ou baú e posiciona no centro | template SMALL + baú interativo e recompensa assinada | baú ainda usa formas procedurais; animação e acabamento visual dedicados seguem pendentes |
| Door | entidade de apresentação da passagem | DoorEntry no DungeonWorldRuntime | tween, collider sincronizado, poeira e cues de áudio; OPEN/CLOSING/CLOSED/OPENING estão implementados |
| TransferGate | interação que chama NextStage | portal de entrada/saída e finalização de run | reservado a entrada, saída, mudança de andar e boss |
| ObjectManager | update, input, colisão, render e reciclagem central | Phaser Scene e sistemas pequenos | mantém a API do engine e evita um manager global monolítico |
| MonsterPool | adquire e reinicializa monstros por tipo; libera ao morrer | grupo Arcade reutilizável + definições EnemyDefinition | ampliar para VFX/drops/números de dano quando necessário |
| ProjectilePool | recicla projéteis com estado limpo | grupos Phaser de projéteis e recycleProjectile | nenhum código C++ portado |
| Weapon / WeaponFactory | comportamento de ataque e fábrica por enum | WeaponDefinition + behavior reutilizável | definições são data-driven; exceções especiais podem ter behavior próprio |
| UIManager | estado, fase, moedas e recargas | RunHud / TouchControls em React com estado enviado pelo ArpgBridge | overlays não dirigem o loop de frames |
| boss classes / skills | padrões e estados específicos de boss | dados do bioma + comportamento de boss na cena | identidade, golpes e recompensas são originais |

## Fluxo equivalente

1. Jogador atravessa fisicamente uma conexão do grafo.
2. A cena ativa apenas o nó atual para gameplay.
3. Se houver combate, o controller fecha portas e começa spawn/waves.
4. O último inimigo encerra a onda; a última onda marca CLEARED.
5. A cena reabre passagens e libera a recompensa definida para aquele nó; combate comum pode não gerar cache.
6. Reentrada consulta o estado da run e não instancia a mesma onda novamente.
7. Após o loot do boss, o portal de extração encerra a run e volta à Guilda; não há navegação de página entre salas.

## Invariantes do Card Realms

- Coordenadas de sala são únicas e conexões N/S/L/O são bidirecionais.
- RoomTemplate registra bioma, tipo, tamanho e portas.
- IA e efeitos só rodam para inimigos vivos da sala de gameplay atual.
- Aleatoriedade reproduzível usa runSeed; conteúdo persistente é decidido por APIs/RPCs.
- A arquitetura serve o ARPG de folclore e suas cartas, suportes e equipamentos, sem reproduzir os conteúdos da referência.
