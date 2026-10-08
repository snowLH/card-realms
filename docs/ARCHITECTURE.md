# Arquitetura atual — Folklard ARPG

## Componentes e fronteiras

`GameShell` (React) organiza navegação e sessão. `src/game/arpg/runtime` controla o loop Phaser, entrada, entidades, colisões e apresentação; `src/game/arpg/dungeon` produz grafos, conteúdo seed determinístico e valida checkpoints. `src/game/arpg/content` fornece dados de lendas, equipamentos, habilidades, inimigos e mapas.

A interface React não é autoridade de dano nem de moedas. O servidor valida posse e progresso em APIs estreitas; Supabase/Postgres com RLS, RPCs e registros idempotentes é autoridade para a economia autenticada. Uma run de visitante não deve gerar recompensa remota.

## Regras invariantes do gameplay
1. **Combate em tempo real** — não usar dados, turnos, mão de energia ou equipe de seis para controlar o jogador.
2. **Herói único e dois poderes de assinatura** — arma A sempre disponível; arma B obtida durante a run; buffs são de dungeon.
3. **Recompensa permanente apenas quando confirmada** — clientes não escrevem loot ou saldo diretamente.
4. **Seed determinística** — grafo, waves e props precisam coincidir no cliente/servidor. Não usar aleatoriedade de `Math.random()` na lógica reproduzível.
5. **Salas conectadas por portas físicas** — estado de clear persiste por run; morte/retorno não reabre ondas já vencidas.
6. **Input acessível** — teclado/mouse, touch e gamepad, com mira manual prioritária e auto-lock apenas para inimigo alcançável/visível.
7. **Folclore autoral** — personagens e lore respeitam suas tradições, sem código, arte ou personagens de marcas externas.

## Organização do runtime
- `dungeon-scene.ts`: orquestra entidades físicas e cenas Phaser; reduzir gradualmente a concentração de responsabilidades.
- `combat-targeting.ts`: seleção de inimigo e mira livre de dependência de Phaser.
- `enemy-behavior.ts`: decisões de perseguição, retirada e manutenção de distância.
- `weapon-slots.ts`: troca e recolhimento de armas, com contratos puros.
- `dungeon/content.ts`: waves seeded determinísticas por região e sala.
- `dungeon/combat-authority.ts`: validação/simulação do combate persistente.
- `coop-dungeon/shared-run.ts`: estado compartilhado do cooperativo.

## Compatibilidade histórica
Pastas `src/game/battle`, `src/game/pvp`, alguns handlers e tabelas Postgres têm dados legados; não são modos ativos do jogo. Sua retirada física depende de auditoria dos imports, testes de migração de saves e staging autorizado. Não reintroduzir seu UI.

## Release
1. Comitar mudanças coesas diretamente em `main`, sem branches alternativas.
2. Esperar `npm run verify:deploy` verde; executar smokes de dungeon/PWA e teste manual quando disponível.
3. Não promover produção sem conferir migrations e acesso ao ambiente correto.
4. Visual: todas as tarefas de pixel art, tilesets, animação e acabamento são destinadas ao Work; veja `docs/ART_PASS_HANDOFF.md`.
