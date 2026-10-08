# Handoff exclusivamente visual — ChatGPT Work

Este documento especifica o que Work deve produzir **quando solicitado**. O assistente que edita gameplay, backend ou banco não deve fazer a reforma visual.

## Base atual (não alterar)
- Jogo ARPG 2D top-down em Phaser com três biomas, salas procedurais conectadas, chefes, loot, progressão e Guilda física.
- **Heróis folclóricos** com duas habilidades de assinatura e duas armas. Nenhum apoio/party de seis em combate, nenhuma mecânica TCG ou tabuleiro por turnos.
- Input teclado/mouse, joystick e touch. HUD e interações precisam caber em mobile paisagem e desktop.
- Manter colisões, footprints e pontos de spawn independentes das texturas. Arte nunca altera dano, hitboxes, recompensa, cooldown ou autoridade.

## Entregas visuais em ordem
1. **Biblioteca de estilo e escala**: pixel size coerente, paleta por região, espessura de borda, sombra, direção da luz e silhuetas legíveis a 32/48/64 px.
2. **Mata Encantada completa**: chão/walls/obstáculos/foreground animado, props quebráveis, portas, baús, loot, sala de elite, evento, descanso, mercador e arena de Curupira. Tilemaps/atlas coesos, sem ilusões de profundidade que afetem navegação.
3. **Guilda**: tilemap real em camadas, 10 estações já navegáveis, NPCs diferenciados, realce contextual e feedback de interação.
4. **Heróis e inimigos**: spritesheets autorais por lenda e função, idle/walk/attack/dash/hit/defeat, alinhadas ao chão, transparência e frame geometry explícitas.
5. **Combat readability**: projéteis, telegraphs, críticos, hit flashes, perigo de boss, indicadores de recarga e armas, incluindo alternativas a cor para acessibilidade.
6. **Arquipélago e Montanhas**: reaproveitar componentes de renderer, criar tilesets regionais e silhuetas distintas.
7. **Acabamento**: HUD mobile/desktop, tipografia pixel art legível, som/UX, transições e revisão de FPS em aparelho real.

## Entradas do Work
- Manifesto: `src/game/arpg/assets.ts`; gameplay Phaser: `src/game/arpg/runtime`.
- HUD e controls: `src/components/arpg`; CSS visual: `src/app/arpg.css`, `src/app/folklard-art-pass.css`.
- Referências de especificação: `docs/ART_BIBLE.md`, `docs/DUNGEON_SPEC.md`, `docs/ASSET_MANIFEST.md`.
- Assets publicados: `public/art`. Não presumir que fontes PNG arquivadas externamente existam no clone.

## Contrato para cada spritesheet novo
Registrar caminho do arquivo, `textureKey`, `frameWidth`, `frameHeight`, linhas/colunas, escala de exibição, baseline, sequências de animação e animação fallback. Revisar precache `public/sw.js`. Usar `pixelArt: true`, `antialias: false`, `roundPixels: true`.

## Aceite
- Sem PNG ausentes em CI, 404 de assets, sprite bleeding ou animações fora dos frames.
- Responsividade 844×390, 932×430, 1366×768 e 1920×1080; portrait com aviso/roteamento vigente.
- Gameplay e autenticação sem mudanças, `npm run verify:deploy` verde.
- Layout e efeitos legíveis para pessoas daltônicas; SFX nunca como único sinal.
- Nenhuma cópia de sprites, mapas, personagens, código ou áudio proprietários de Soul Knight ou de outros jogos.
