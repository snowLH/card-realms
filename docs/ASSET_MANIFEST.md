# Manifesto de assets do ARPG

Este inventário acompanha o catálogo Phaser em [`src/game/arpg/assets.ts`](../src/game/arpg/assets.ts) e os pontos de carregamento das cenas. Uma seção separada registra a ilustração integrada diretamente à tela inicial por CSS, fora do runtime Phaser do ARPG. Arquivos soltos em `public/art/` e capturas de smoke não são tratados como assets do jogo aqui.

As dimensões de quadro, contagens, grades e escalas abaixo são os metadados registrados no manifesto, salvo quando a Bíblia de Arte documenta também o tamanho total do arquivo. Para imagens de cenário, o catálogo não declara dimensões. `scale` é a escala de renderização Phaser, não uma nova medida do arquivo.

As 58 imagens ativas foram codificadas com Sharp/WebP (`lossless: true`, `effort: 6`, `exact: false`). As dimensões e todos os valores de alpha são idênticos às fontes; cada canal RGB em pixels com alpha maior que zero também permaneceu idêntico. RGB oculto sob alpha zero pode diferir sem alterar a renderização. Os 96 PNGs originais permanecem arquivados em `../artifacts/archive/public-art/`; `scripts/verify-art-webp.mjs` reproduz essa comparação.

## Ilustração da tela inicial — fora do manifesto Phaser

| Asset | Caminho | Metadados | Uso |
| --- | --- | --- | --- |
| Portal da floresta da tela inicial | `/art/folklard-title-forest-portal-pixel-v3.webp` | WebP lossless RGB de 1672 × 941 px; 1.667.410 bytes | Arte original de pixel art com clusters quadrados, bordas em degraus e paleta contida, aplicada como imagem de fundo em `.title-screen` pelo CSS, com enquadramento responsivo para desktop e mobile. Não é carregada pelo runtime Phaser nem consta em `ARPG_ASSET_MANIFEST`. |

## Cenário e criaturas

| Asset | Caminho | Metadados documentados | Uso no jogo |
| --- | --- | --- | --- |
| Fundo de dungeon da Mata | `/art/dungeon-forest-background-v3.webp` | WebP lossless RGB, 1672 × 941 px; 2.125.002 bytes | Fundo configurado para a expedição da Mata; a cena também desenha o mundo procedural de salas. |
| Fundo de dungeon do Arquipélago | `/art/dungeon-archipelago-background-v3.webp` | WebP lossless RGB, 1672 × 941 px; 1.854.280 bytes | Fundo configurado para a expedição do Arquipélago; a cena também desenha o mundo procedural de salas. |
| Fundo de dungeon das Montanhas | `/art/dungeon-mountain-background-v3.webp` | WebP lossless RGB, 1672 × 941 px; 2.070.090 bytes | Fundo configurado para a expedição das Montanhas; a cena também desenha o mundo procedural de salas. |
| Fundo da arena clássica | `/art/forest-sanctuary-arena-v2.webp` | WebP lossless RGBA, 1672 × 941 px; 2.517.562 bytes | Fundo CSS do palco de batalha clássica em `src/app/globals.css`. |
| Mapas locais | `/art/local-map-{roots,archipelago,runic,mist,desert}-pixel-v2.webp` | WebP lossless RGB; cada arquivo mede 1672 × 941 px. | Imagens de fundo das cinco regiões definidas em `src/game/exploration/maps.ts`. |
| Atlas de criaturas folclóricas | `/art/folklore-creatures-chibi-portraits-v1.webp` | WebP lossless RGBA de 1254 × 1254 px; grade 5 × 5, 25 quadros de 250 × 250 px; escala 1. | Carregado pela cena de dungeon como `folklore-atlas`; serve retratos e fallback de inimigos. O PNG de origem fica arquivado fora de `public/`. |
| Segundo atlas de criaturas | `/art/folklore-creatures-second-atlas-chibi-portraits-v1.webp` | WebP lossless RGBA de 1254 × 1254 px; grade 5 × 5, 25 quadros de 250 × 250 px; escala 1. | Carregado pela cena como `folklore-atlas-2`; usado pelos perfis configurados, inclusive nas Montanhas. O PNG de origem fica arquivado fora de `public/`. |

## Avatar, inimigos e NPCs

| Asset | Caminho e quadro | Grade, escala e animações | Uso no jogo |
| --- | --- | --- | --- |
| Avatar configurável do jogador | Sem arquivo `/art/`: `createCartographerAvatarSpritesheet()` em `runtime/player-sprites.ts` gera a folha de runtime SVG em data URI a partir de `AvatarConfig`, medindo 756 × 2457 px. Cada quadro usa grade lógica de 63 × 63 células, renderizadas em blocos de 3 × 3 px. | Runtime: 52 quadros de 189 × 189 px; 4 × 13; escala 0,46. Linhas 0–10: idle, walk-down, walk-up, walk-left, walk-right, attack, hit, dodge, interact, victory e ko. Linha 11: `cast-skill-1` (mão erguida e brilho ascendente). Linha 12: `cast-skill-2` (braços abertos e runas laterais). Cada pose de poder percorre quatro quadros a 10 fps, sem repetição. A oficina de aparência e o Refúgio usam `createCartographerAvatarIdleSpritesheet()`: quatro quadros idle em uma tira 4 × 1 de 756 × 189 px. | A oficina e o Refúgio usam a tira leve; Guilda e dungeon usam a folha completa. A configuração do jogador acompanha as cenas. Os modos clássico e PvP escolhem a pose pela carta/slot do evento de poder confirmado e exibem o glifo da carta; o modo avatar da raid usa o avatar e dois poderes configurados. Atores folclóricos não entram como apoiadores do jogador. |
| Curupira, chefe da Mata | `/art/monster-curupira-ancestral-spritesheet-v2.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,32. Seis estados: idle, walk, attack, shoot, damage e defeat. | Chefe da dungeon Mata Encantada. |
| Amarok, chefe das Montanhas | `/art/monster-amarok-elder-wolf-spritesheet-v2.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,32. Seis estados. | Chefe da dungeon Montanhas Rúnicas. |
| Iara, chefe do Arquipélago | `/art/monster-iara-boss-spritesheet-v2.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,32. Seis estados. | Chefe da dungeon Arquipélago das Marés. |
| Broto inimigo | `/art/monster-sprout-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,25. Seis estados. | Inimigo comum da Mata Encantada. |
| Boto inimigo | `/art/monster-boto-enemy-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,25. Seis estados. | Inimigo comum do Arquipélago das Marés. |
| Raijū inimigo | `/art/monster-raiju-enemy-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,25. Seis estados. | Inimigo comum das Montanhas Rúnicas. |
| Outros perfis de inimigo | `/art/monster-shade-spritesheet-v1.webp`, `/art/monster-thorn-spritesheet-v1.webp`, `/art/monster-corrupted-guardian-spritesheet-v1.webp`, `/art/monster-mapinguari-spritesheet-v1.webp`, `/art/monster-carbunclo-enemy-spritesheet-v1.webp`, `/art/monster-ahuizotl-enemy-spritesheet-v1.webp`, `/art/monster-alicanto-enemy-spritesheet-v1.webp`, `/art/monster-kappa-enemy-spritesheet-v1.webp`, `/art/monster-kelpie-enemy-spritesheet-v1.webp`, `/art/monster-ratatoskr-enemy-spritesheet-v1.webp` e `/art/monster-yeti-enemy-spritesheet-v1.webp`. | WebP lossless RGBA; todos medem 1024 × 1536 px em grade 4 × 6, com quadros de 256 × 256 px e seis estados. Escala conforme perfil no manifesto. | Perfis de inimigos, elites e mini-chefes nas três dungeons. Carregados quando a configuração da dungeon os seleciona. |
| Roc, chefe da raid | `/art/monster-roc-raid-boss-spritesheet-v1.webp` | WebP lossless RGBA de 1024 × 1536 px, grade 4 × 6, 24 quadros de 256 × 256 px. | Arte do chefe da raid; carregada pelo componente de arena da raid. |
| Mestre da Forja | `/art/guild-blacksmith-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,4. Idle, walking, talking e working. | NPC da Guilda. |
| Mercadora | `/art/guild-merchant-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,4. Idle, walking, talking e working. | NPC da Guilda. |
| Arquivista | `/art/guild-archivist-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,4. Idle, walking, talking e working. | NPC da Guilda. |
| Luzia, guardiã do Bestiário | `/art/guild-bestiary-keeper-spritesheet-v1.webp`; quadro de 256 × 256 px; 24 quadros. | WebP lossless RGBA, 4 × 6; escala 0,4. Idle, studying, talking e walking. | NPC da Guilda. |

Os estados contínuos de idle/walk/work/talk repetem; ataque e derrota dos inimigos são animações de execução única. A escala e a colisão usam o footprint de gameplay, independente das áreas transparentes do quadro.

## Objeto da dungeon

| Asset | Caminho | Metadados documentados | Uso no jogo |
| --- | --- | --- | --- |
| Baú de tesouro | `/art/treasure-chest-spritesheet-v2.webp` | WebP lossless RGBA de 1254 × 1254 px; 4 quadros de 627 × 627 px em 2 × 2. Escala calculada para exibição nominal de 92 × 92 px. O manifesto guarda baseline por quadro. | Baú de loot na dungeon; frame 0 fechado, frames 1–3 abrem a 10 fps em execução única. |

## Adornos procedurais já integrados

Estes elementos são desenhados pelo Phaser em código; não são arquivos adicionais de imagem.

- **Guilda — `runtime/hub-scene.ts`:** piso de lajes, caminhos curvos e bordas, canteiros de folhagem, postes com luzes, praça central com ornamentos e letreiro. Móveis/props das estações também são formas e gráficos Phaser: mesa de expedições e mapa, forja com brilho animado, estantes e mesa do Arquivo, balcão do Mercador, manequim/equipamento do Ateliê, refúgio, portal e altar. Os quatro NPCs usam as spritesheets listadas acima.
- **Dungeon — `runtime/dungeon-world.ts`:** tileset de CanvasTexture gerado em execução com 8 tiles de 32 × 32 px (256 × 32 px no total), paleta própria por bioma, detalhes de chão, água, paredes, obstáculos e runas. Duas variantes de piso são escolhidas de forma determinística por semente, com chance de 22% por tile de chão. Marcas decorativas caminháveis aparecem nas salas sem cobrir portas ou centros.
- Cada sala recebe de quatro a seis agrupamentos estáticos em tiles caminháveis próximos às bordas, conforme o tamanho da sala. A escolha é determinística por seed e evita os spawns possíveis de jogador/inimigos, portas, baús, obstáculos, água e runas. A Mata recebe raízes no contorno e folhagem; o Arquipélago recebe rochas e acentos de espuma; as Montanhas recebem cristais. Esses objetos são visuais: não criam colisores nem mudam o grafo da dungeon.
- **Mata Encantada:** obstáculos viram árvores procedurais; certas salas recebem tochas animadas, outras vaga-lumes; folhas animadas complementam o piso.
- **Arquipélago das Marés:** reflexos animados na água e marcas de correnteza no piso.
- **Montanhas Rúnicas:** cristais procedurais nos obstáculos e fagulhas rúnicas animadas.
- Efeitos ambientes e tweens de salas inativas ficam ocultos e pausados; só a sala ativa anima. Paredes de corredor, portas e poeira de porta também são elementos Phaser, não imagens externas.

## Telas e controles responsivos do ARPG

- O runtime usa canvas lógico de 1280 × 720 px como padrão. Na dungeon, o jogo touch em retrato (viewport de até 900 px) passa ao Phaser as dimensões do palco e reorganiza a HUD; joystick fica à esquerda e ataque, dash, interação contextual e dois poderes ficam à direita. O estado do código não comprova, por si só, legibilidade visual em aparelho.
- A Guilda usa canvas Phaser em 1280 × 720 px com `FIT` em desktop e paisagem; em touch retrato, usa `RESIZE` com a viewport do palco. A captura em 390 × 844 confirmou palco integral, sem stretch/overflow, joystick de 104 × 104, Interagir de 80 × 68 e prompt sem sobreposição. O indicador de orientação antigo não é uma tela de bloqueio ativa no componente atual. Em 844 × 390 o canvas e o prompt foram conferidos sem overflow e sem sobreposição de controles.
- A tela inicial e a oficina do avatar têm regras CSS responsivas. A visualização do avatar no Ateliê usa a tira idle compacta listada acima; isso não altera a folha de jogo.
- A instalação como PWA declara `orientation: "landscape"` em `src/app/manifest.ts`. As telas em retrato do navegador e essa preferência da instalação são estados distintos.

## Interface de combate — retratos e efeitos

- O `run-hud.tsx` exibe exatamente dois poderes equipados, cada qual com número, retrato associado à carta, nome e cooldown. Os dois botões de `touch-controls.tsx` repetem esses dados no controle touch. Em retrato e paisagem compacta, o nome aparece em até duas linhas a 9 px e o cooldown a 10 px; os alvos dos cartões ficam entre 68 e 78 px. O retrato vem de `PixelCreature` e do catálogo existente: é um ícone da carta, não um apoiador desenhado no cenário.
- A HUD mostra bônus temporários da run quando ativos: velocidade de movimento e dano básico, com rótulos, valor e ícone. Vida, sala, inimigos e fragmentos permanecem em seu próprio grupo. Esses bônus de dungeon não ocupam os dois slots de poder principal do avatar.
- A HUD identifica arma, armadura e relíquia atuais. Ao encontrar arma ou armadura no baú, `loot-choice.tsx` compara item equipado e achado e oferece “Guardar e manter atual” ou “Equipar agora”. Não há comando de troca manual de arma durante o combate. A tela de equipamento da Guilda é separada da escolha de loot da run.
- `runtime/dungeon-scene.ts` desenha VFX com Graphics/tweens Phaser. Boitatá (`boitata-flame`) usa uma silhueta serpentina de fogo e Raízes Ancestrais (`ancestral-roots`) usa raízes angulares em expansão; outros projéteis e áreas variam por elemento/criatura. Na resolução autoritativa, o efeito acompanha a confirmação recebida do servidor. Não há uma spritesheet externa nova para essas assinaturas.
- No combate clássico e no PvP, o avatar usa a pose do slot aceito. A apresentação escolhe um glifo pixelado próprio da carta e posiciona efeitos de voo, explosão e autocura conforme o tipo, após a confirmação do evento; a arte não anuncia resultado antes do evento autoritativo. Os dois poderes equipados são os únicos comandos de poder do avatar, sem apoiadores.

O contrato de arte documenta o tile de dungeon como 32 × 32 px e descreve estes efeitos em [`docs/ART_BIBLE.md`](ART_BIBLE.md).

## Precache e cache offline

[`public/sw.js`](../public/sw.js) usa `CACHE_VERSION = "card-realms-arpg-v20"` e pré-carrega a arena clássica, os dois atlases, os seis spritesheets de inimigos, as quatro folhas de NPC, a arte do título e assets de Hub/loot. Os mapas regionais e os fundos da dungeon são cacheados sob demanda. A folha do avatar é um SVG de dados gerado no navegador, sem URL estática para precache. Os PNGs originais substituídos estão preservados em `../artifacts/archive/public-art/`.

O service worker trata qualquer URL same-origin sob `/art/` como cacheável sob demanda: tenta a rede e grava respostas bem-sucedidas no cache; se a rede falhar, usa uma resposta em cache quando disponível. Portanto, omissão de `CORE_ASSETS` significa ausência do precache de instalação, não exclusão do cache após o primeiro carregamento.

## Limites conhecidos

- O catálogo declara dimensões dos quadros e metadados das folhas, mas não o tamanho do arquivo para a maior parte dos assets. Não completar essas medidas por inferência. Para o Roc, os outros chefes, o baú e os dois atlases, `docs/ART_BIBLE.md` ou `docs/ART_DIRECTION.md` registra dimensões e grades totais.
- A cena `dungeon-scene.ts` carrega o fundo configurado da expedição; quando recebe um grafo de dungeon, desenha o mundo de salas com o `DungeonWorldRuntime`. A imagem `dungeon-arena` é exibida no caminho de fallback sem grafo.
- Os perfis de inimigos atualmente configurados têm folhas WebP próprias; os atlases continuam carregados para retratos e fallbacks de IDs sem perfil dedicado. A composição ambiental completa e o acabamento visual de todas as salas seguem pendentes conforme a Bíblia de Arte.
- O catálogo cobre o runtime ARPG documentado aqui; a ilustração do título está documentada separadamente por ser aplicada em CSS fora de `ARPG_ASSET_MANIFEST`. Assets de UI e outros modos fora deste escopo continuam sem inventário aqui.
- Evidência deste passe no navegador local: título e dungeon em 1920×1080, 1366×768, 1280×720, 640×360, 844×390, 932×430, 1024×768 e 390×844; os checks de viewport, overflow, canvas, HUD touch, dois poderes nomeados, alvos e ausência de erro de runtime passaram. Os poderes touch foram inspecionados visualmente em 844×390 e 568×320. A Guilda passou em retrato e paisagem touch (390×844 e 844×390); Ateliê e Refúgio foram conferidos em 390×844 e 1280×720. O PvP autenticado e o PWA instalado não foram validados; nada aqui afirma validação em produção.
- As assinaturas de habilidade documentadas são VFX geométricos do runtime, não animação desenhada quadro a quadro. A leitura de cada carta e de cada tela especial ainda precisa de revisão visual sistemática.
