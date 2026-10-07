# Folklard — direção de arte do ARPG

Este documento descreve o estado visual encontrado no código do ARPG e os princípios para os próximos passes. A identidade é uma aventura original de folclore em pixel art. Referências de gênero podem orientar legibilidade e ritmo, mas não autorizam copiar personagens, interfaces, mapas, símbolos ou composições de outros jogos.

## Identidade e regras visuais

- O jogador cria e controla o próprio avatar. A mesma configuração aparece na Guilda, no Refúgio e nas expedições; a moradia mostra o Cartógrafo criado no Ateliê, sem residente folclórico. As criaturas do folclore são tema do Bestiário, dos inimigos e das cartas de poder, não companheiros ao redor do jogador.
- O avatar leva exatamente dois poderes principais equipados em todos os modos de combate: dungeon, combate clássico, PvP e raid. Eles são aprendidos e escolhidos no Arquivo de Poderes da Guilda; duas cartas iniciais são gratuitas e outras podem ser compradas. Não representar slots, comandos ou apoiadores folclóricos.
- Armas e armaduras são equipamentos encontrados em dungeons. A escolha de equipamento na Guilda prepara a expedição; ao achar arma ou armadura num baú durante a run, a interface compara o item atual com o encontrado e permite equipar na hora ou manter o atual. Não existe comando para trocar arma manualmente durante o combate. Melhorias temporárias de sala — cura, velocidade e dano básico — pertencem à run. Diferenciar poder principal, equipamento e melhoria temporária.
- Manter silhuetas e estados legíveis em escala pequena. Ataques, cooldowns, dano, raridade e perigo precisam de ícone, forma, animação ou texto além da cor.
- Respeitar `prefers-reduced-motion` também no Phaser: o portal de saída fica estático e o dano não aplica tremor de câmera; a preferência pode mudar enquanto a cena está aberta.
- Preservar a origem cultural de cada figura. Não reduzir seres folclóricos a monstros genéricos de fantasia nem substituir seus traços reconhecíveis por ornamentos arbitrários.

## Escala e renderização do jogo

| Elemento | Configuração atual |
| --- | --- |
| Canvas lógico Phaser | Padrão de 1280 × 720 px, proporção 16:9, para dungeon e Guilda em desktop. No gameplay touch em retrato de até 900 px, dungeon e Guilda usam dimensões responsivas do palco; a Guilda usa `Phaser.Scale.RESIZE`. |
| Dimensionamento | `Phaser.Scale.FIT` e centralização preservam a proporção em desktop e na Guilda em paisagem. Dungeon e Guilda usam viewport lógica responsiva em retrato; HUD, cabeçalho, prompt e controles têm regras próprias para essa orientação. |
| Renderização pixelada | `pixelArt: true`, `antialias: false`, `roundPixels: true`; CSS usa `image-rendering: pixelated` no canvas |
| Tile de dungeon | 32 × 32 px |
| Avatar do jogador | Spritesheet SVG gerada de `AvatarConfig` por clusters numa grade inteira de pixels 3 × 3 px; folha de runtime 4 × 13 quadros de 189 × 189 px, escala Phaser 0,46 |

O breakpoint touch em retrato reorganiza a HUD e coloca joystick à esquerda e botões de ataque, dash, interação e dois poderes à direita. A Guilda ocupa o viewport em retrato sem deformar o mundo 16:9; o botão Interagir e a instrução ficam separados do joystick. A tela inicial compacta mantém JOGAR, ENTRAR, CONFIGURAÇÕES e CRÉDITOS dentro da área visível em 640 × 360, 844 × 390 e 932 × 430. O Ateliê e o Refúgio têm layouts responsivos. Essas evidências confirmam as composições verificadas, sem generalizar para todos os aparelhos. O manifesto de instalação PWA declara `orientation: "landscape"`; essa preferência não descreve o layout responsivo do site aberto no navegador e a instalação como PWA não foi validada.

## Paleta e linguagem da interface

O passe em `src/app/folklard-art-pass.css` estabelece uma linguagem comum para título, Ateliê, loadout, expedições, HUD, controles e Guilda:

- **Mundo:** tinta escura `#101a15`, verde-floresta `#17271e` e verde elevado `#23382a`.
- **Livro e informação:** pergaminho `#ead9ad` e pergaminho claro `#f4e8c8`, texto escuro e espaço suficiente para leitura.
- **Molduras e recompensa:** madeira `#42271d`, bronze `#b77d3c` e ouro `#edc66c`.
- **Magia e foco:** turquesa `#75d5c4`, usado para acentos e foco visível; o estado também deve ser reconhecível por forma ou rótulo.
- **Acabamento:** contornos e molduras inspirados em objetos de aventura, sombras compactas e cantos predominantemente retos. Painéis de jogo mantêm fundo escuro; escolhas de equipamento e cartas usam fundo claro para separar informação interativa do mundo.

A tela de entrada apresenta **Folklard — Crônicas de Aurória** sobre a arte original de pixel art `public/art/folklard-title-forest-portal-pixel-v3.webp`, com clusters quadrados, bordas em degraus e paleta contida. O raster mede 1672 × 941 px. O asset está integrado como fundo responsivo no CSS para desktop e mobile e faz parte do precache do service worker. A arte é independente dos sprites da dungeon e serve apenas de cenário para o título.

## Avatar e Ateliê

`CharacterCreator2D` permite ajustar pele, cabelo, roupa, armadura e cor de destaque. A prévia usa `createCartographerAvatarIdleSpritesheet()`, uma tira SVG compacta com os quatro quadros de idle (4 × 1, 756 × 189 px); o runtime usa `createCartographerAvatarSpritesheet()`, a folha completa de 52 quadros (4 × 13, 756 × 2457 px). Ambas partem da mesma função de desenho: cada quadro é composto de retângulos em coordenadas inteiras sobre uma grade interna de 63 × 63 células, convertidos para SVG com arestas nítidas. A tira compacta mantém o retrato leve sem mudar as animações e o tamanho usados na Guilda ou na dungeon.

A imagem identifica o avatar criado pelo jogador, não uma criatura de apoio. Guilda, Refúgio, dungeon, combate clássico, PvP e as novas raids usam o modelo de avatar próprio; cada modo de combate usa exatamente dois poderes equipados. Salas históricas de raid em formato legado aparecem como arquivo, sem reabrir o combate antigo. As linhas 11 e 12 têm poses distintas: `cast-skill-1` ergue uma mão com brilho pixelado ascendente; `cast-skill-2` abre os braços e acende marcas rúnicas laterais. Cada animação percorre seus quatro quadros uma vez, por até 400 ms. A dungeon associa a pose ao slot usado; o combate clássico e o PvP usam o slot do evento de poder aceito e mostram o glifo pixelado da carta para o lado que agiu. Os glifos de voo cruzam o campo, explosões aparecem no lado do alvo e autocuras ficam junto ao avatar. As apresentações não substituem cooldowns, efeitos, dano ou autoridade do combate.

Armaduras indisponíveis no Ateliê aparecem como encontradas em baús; seus quadros de escolha não devem sugerir compra de poderes ou recrutamento de criaturas. A aplicação de equipamento visual e sua disponibilidade dependem do inventário já mantido pelo jogo.

## Guilda física e Arquivo de Poderes

A Guilda é uma cena Phaser explorável, não somente uma página de menu. A composição atual usa piso de lajes, caminhos curvos entre estações, limites de cenário e uma praça central octogonal. Placas identificam expedições, forja, Arquivo de Poderes, Bestiário, Ateliê, mercador, Refúgio, eventos, altar e portal. Móveis e sinalização são desenhados proceduralmente; NPCs da forja, mercador, Arquivo e Bestiário usam folhas próprias. Em touch retrato, a viewport Phaser acompanha o palco e a câmera continua preservando a geometria; joystick, Interagir, prompt e cabeçalho têm posições próprias. A captura em 390 × 844 confirmou interação sem overflow ou sobreposição. As estações laterais podem sair parcialmente do enquadramento inicial, mas a câmera segue o avatar e cada rota continua alcançável.

O Arquivo combina estantes, mesa e selo decorativo. Deve comunicar compra e seleção de dois ataques folclóricos para o avatar. A lista de poderes pode usar cores elementais, mas raridade, posse, compra e equipamento também precisam de rótulos e estados visuais distintos. A loja de cartas não deve ser confundida com o Mercador de equipamento ou com as escolhas temporárias da dungeon.

## Dungeons e ambientação procedural

O runtime constrói tilesets de CanvasTexture em execução e os aplica aos grafos de salas. A paleta e os acentos variam por região. Duas variantes de piso são escolhidas deterministicamente pela seed da sala, com chance de 22% por tile de chão. Marcas caminháveis ajudam a reduzir repetição sem cobrir obstáculos, água, runas, portas ou o centro das salas. Um passe adicional coloca quatro, cinco ou seis agrupamentos decorativos nas bordas, conforme o tamanho da sala. A seleção evita spawns de jogador e inimigos, obstáculos, água, runas, portas e baús; são objetos visuais sem mudança de colisão ou layout.

- **Mata Encantada:** pisos em verdes musgo, raízes nos detalhes e no contorno interno das salas, agrupamentos de folhagem junto às bordas, árvores em obstáculos, folhas e vaga-lumes; salas de ruínas, santuário, altar, arena ancestral ou acampamento podem receber tochas animadas.
- **Arquipélago das Marés:** tons azul-esverdeados, agrupamentos de rocha e espuma nas bordas, marcas de correnteza e reflexos animados sobre tiles de água.
- **Montanhas Rúnicas:** pedra azul-ardósia, agrupamentos de cristais nas bordas, marcas de piso frias, cristais nos obstáculos e fagulhas sobre runas.

Esses adornos são principalmente formas geométricas, CanvasTexture e tweens Phaser, não tilesets ilustrados completos. A seleção aleatória usa a semente da dungeon e da sala; efeitos de ambientação de salas fora da ativa ficam pausados.

## Combate, HUD e progressão em imagem

O HUD apresenta vida, armadura, arma, mapa e exatamente dois poderes equipados. Cada slot e botão touch combina retrato associado à carta, número, nome e cooldown; o retrato é ícone de habilidade, não companheiro. Em retrato e paisagem compacta, o nome cabe em até duas linhas de 9 px e o cooldown usa 10 px; as cartas touch medem de 68 a 78 px. O HUD também mostra, quando ativos, bônus temporários da run para velocidade de movimento e dano básico, em faixa separada de arma, armadura e relíquia. O loot pode ser guardado ou equipado na hora; não há troca manual de arma durante a luta. Não adicionar faixa de companheiros.

Os efeitos das cartas da dungeon têm silhuetas reconhecíveis no runtime: Boitatá lança uma faixa serpentina de fogo; Raízes Ancestrais irradia raízes angulares a partir do ponto de impacto. Outros projéteis e efeitos de área variam por elemento e criatura. Esses efeitos da dungeon são Graphics e tweens Phaser, não novas spritesheets ilustradas. No combate clássico e no PvP, cada carta do catálogo tem um glifo de VFX em pixels próprio, desenhado somente após o evento autoritativo `ability_used`; o slot desse mesmo evento seleciona a pose do avatar. A apresentação visual não antecipa acerto nem altera o resultado do servidor.

Baús de dungeon mostram silhuetas compatíveis com o tipo de item encontrado — espada, arco, cajado, peitoral ou manto — e a raridade declarada. A cena de loot compara arma/armadura encontrada com a atualmente equipada e oferece equipar agora ou guardar e manter o item atual. O HUD identifica o equipamento em uso; não desenhar um controle separado para troca manual de arma em combate. Salas de descanso, loja e evento usam escolhas breves com custo em fragmentos da run, mostrando claramente se o efeito é temporário.

## Atlas de criaturas folclóricas — registro preservado

O runtime usa `public/art/folklore-creatures-chibi-portraits-v1.webp`, atlas WebP lossless RGBA de 1254 × 1254 px em grade 5 × 5 com 25 quadros de 250 × 250 px. Ele atende aos retratos do Bestiário e aos fallbacks de inimigos; não representa apoiadores do avatar. O PNG de origem está preservado em `../artifacts/archive/public-art/folklore-creatures-five-elements.png`.

Prompt de produção arquivado para manter os requisitos de leitura e identidade do atlas:

> Production-ready 2D pixel-art RPG creature sprite sheet with transparent background. Create exactly 25 separate full-body creature sprites arranged in a strict five-columns-by-five-rows grid. Every cell must be the same square size; one creature centered in each cell, consistent baseline and apparent scale, generous transparent padding, no overlap, text, labels, numbers, borders, scenery or watermark. Cohesive hand-authored 16-bit style, deliberate hard-edged pixel clusters, limited shared palette, crisp nearest-neighbor appearance, readable silhouettes at small size and three-quarter battle poses. No antialiasing, gradients, 3D, painterly rendering, hyperrealism or glossy generic AI concept-art appearance. Preserve culturally specific defining traits rather than converting the beings into generic fantasy monsters.
>
> Exact rows, left to right: Fire — Boitatá, Mula-sem-cabeça, Salamandra, Fênix, Aitvaras. Water — Iara, Boto-cor-de-rosa, Kelpie, Kappa, Ahuízotl. Nature — Curupira, Caipora, Mapinguari, Leshy, Amarok. Storm — Saci-Pererê, Raijū, Tengu, Ziz, Simurgh. Spirit — Black Shuck, Domovoi, Qilin, Banshee, Carbunclo. Preserve the identifying lore markers for each: Boitatá as a fire serpent rather than dragon; the headless mule's neck flame; amphibian Salamander; solar Phoenix; Aitvaras as fiery rooster; Iara as Amazonian river enchantress; pink river dolphin; dark Scottish water horse; Kappa's water dish; Ahuízotl's hand-ended tail; Curupira's backward feet; Caipora with peccary; Mapinguari's unusual forest-being anatomy; Leshy's bark and moss; giant Arctic Amarok; one-legged Saci with red cap and whirlwind; Raijū as lightning beast; mountain Tengu; cosmic bird Ziz; Persian Simurgh; one-eyed spectral Black Shuck; domestic Domovoi; Chinese Qilin rather than Western unicorn; Irish bean sí; luminous Andean/South-American Carbunclo.

Há também `public/art/folklore-creatures-second-atlas-chibi-portraits-v1.webp`, atlas WebP lossless RGBA de 1254 × 1254 px em grade 5 × 5 com 25 quadros de 250 × 250 px. A cena carrega ambos os atlases para os fallbacks configurados, inclusive conteúdo das Montanhas. O PNG original está preservado em `../artifacts/archive/public-art/folklore-creatures-second-atlas.png`.

## Lacunas visuais conhecidas

- A arte de fundo está conectada ao CSS do título e ao precache offline. Título e dungeon foram conferidos em desktop e em telas móveis representativas. A Guilda, o Ateliê e o Refúgio também foram conferidos em 390 × 844; o Ateliê e o Refúgio ainda não foram avaliados em todos os tamanhos móveis possíveis. O PWA instalado não foi validado.
- A Guilda tem layout físico e props em formas procedurais; seus ambientes ainda não usam um tileset ilustrado coeso para paredes, estações e chão.
- A dungeon tem tiles procedurais, adornos determinísticos nas bordas e VFX de assinatura para algumas habilidades. Ainda faltam composição completa por sala, camadas de foreground, luz volumétrica e acabamento próprio para todas as regiões e salas especiais. A maior parte dos adornos e VFX é desenhada por formas Phaser, não por arte quadro a quadro.
- O manifesto agora lista folhas de seis estados para bosses, inimigos comuns, elites e mini-chefes configurados. Os dois atlases continuam necessários para retratos e fallbacks; telegraphs e leitura visual de todas as definições ainda pedem revisão sistemática.
- Os adornos procedurais e VFX são formas Phaser e não substituem animações desenhadas à mão. Há assinaturas específicas para algumas cartas e variação de projétil/área por elemento; ainda falta uma revisão visual sistemática de todas as cartas, impactos, estados de perigo e salas especiais.
- Distinção de evidência: canvas, HUD, breakpoints, nomes de carta, bônus temporários, comparação de loot, poses e VFX descritos acima são comportamentos encontrados no código. Este passe capturou título e dungeon em 1920×1080, 1366×768, 1280×720, 640×360, 844×390, 932×430, 1024×768 e 390×844; também conferiu a Guilda em 390×844 e 844×390, o Ateliê e o Refúgio em 390×844 e 1280×720. Os nomes dos poderes foram revisados em touch paisagem. O PvP autenticado e o PWA instalado não foram abertos/instalados; nada aqui afirma validação em produção.

## Fontes de implementação

- Paleta e componentes visuais: `src/app/folklard-art-pass.css`.
- Título e marca: `src/components/game/title-screen.tsx`, `src/app/layout.tsx`.
- Avatar e folha procedural: `src/components/game/character-avatar.tsx`, `src/game/arpg/runtime/player-sprites.ts`.
- Guilda e estações: `src/game/arpg/runtime/hub-scene.ts`, `src/game/arpg/hub/content.ts`.
- Escala e renderização: `src/game/arpg/runtime/render-config.ts`, `src/game/arpg/runtime/create-game.ts`.
- Dungeon e ambientação: `src/game/arpg/runtime/dungeon-world.ts`.
- Assinaturas visuais de habilidades: `src/game/arpg/runtime/dungeon-scene.ts`.
- HUD, bônus temporários e controles touch com retratos/nome dos dois poderes: `src/components/arpg/run-hud.tsx`, `src/components/arpg/touch-controls.tsx`, `src/components/arpg/arpg-game.tsx`, `src/app/arpg.css`.
- Layout touch da Guilda: `src/components/arpg/arpg-hub.tsx`, `src/components/arpg/hub-touch-controls.tsx`, `src/app/folklard-art-pass.css`.
- Comparação do loot de equipamento durante a expedição: `src/components/arpg/loot-choice.tsx`.
- Contrato visual de equipamentos e poderes: `src/game/arpg/content/ability-cards.ts`, `src/game/arpg/content/equipment.ts`, `src/game/arpg/dungeon/special-rooms.ts`.
- Assets e metadados Phaser: `src/game/arpg/assets.ts`, `docs/ASSET_MANIFEST.md`.
