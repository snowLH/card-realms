# Card Realms — Art Bible

## Identidade

ARPG de ação em pixel art, ambientado em tradições folclóricas. A leitura é de videogame portátil: silhuetas nítidas, cenário por tiles, contraste entre piso/obstáculos/entidades e HUD compacto. O mundo deve parecer Card Realms; referência de estrutura não transfere personagens, mapas, armas ou símbolos de outra obra.

## Escala de produção

| Elemento | Padrão |
| --- | --- |
| Canvas lógico | 1280 × 720, landscape 16:9 |
| Tile de dungeon | 32 × 32 px |
| Microgrid opcional | 16 × 16 px |
| Sala SMALL | 11 × 11 tiles (352 px) |
| Sala MEDIUM | 15 × 15 tiles (480 px) |
| Sala LARGE | 21 × 21 tiles (672 px) |
| Célula de layout | 896 px entre centros |
| Corredor | 128 px de largura |
| Margem do mundo | 160 px |
| Jogador | spritesheet 4 × 13 com frames de 189 × 189 px; collider de footprint 22 × 28 px |
| Inimigo comum | 32–56 px de silhueta, collider guiado pelo footprint |
| Baú de tesouro | spritesheet 2 × 2 com frames de 627 × 627 px; renderização nominal a 92 × 92 px |
| Boss | 72–128 px de silhueta, com telegraph que não depende apenas de cor |

Phaser deve permanecer com pixelArt, antialias desligado e roundPixels ligado. Arte importada usa escala inteira ou nearest-neighbor. Nenhum filtro blur em sprites ou tiles.

## Avatar próprio do jogador

- O personagem controlado é o avatar criado e customizado pelo próprio jogador no Ateliê; “Cartógrafo” é o nome histórico do perfil/runtime, não um companheiro folclórico.
- A configuração existente do avatar (`AvatarConfig`) é reutilizada e passada tanto à Guilda quanto à dungeon. A spritesheet animada usa uma grade de 4 × 13 com os estados de movimento, combate e duas poses de poder; não se cria um segundo schema de avatar.
- O corpo de colisão segue a área dos pés e deixa a silhueta visual livre. Criaturas folclóricas aparecem como identidades e artes das cartas de poder, nunca como seguidores no combate.
- O catálogo atual cobre o personagem do jogador, bosses, inimigos comuns e demais perfis selecionados nas três dungeons, além dos NPCs originais do HUB: Mestre da Forja, Mercadora, Arquivista e Luzia, cada um com folha própria. As folhas atuais de NPC e inimigo usam seis linhas em grade 4×6. Props quebráveis usam pixel art procedural por bioma; ainda faltam revisão visual sistemática e composição ambiental completa de todas as salas.
- As salas receberam detalhes procedurais animados por bioma: árvores, tochas e vaga-lumes na Mata; reflexos d'água no Arquipélago; cristais e luz rúnica nas Montanhas. Esses acentos ampliam os tiles atuais e ainda não substituem uma composição ambiental completa.

## Curupira Ancestral

- A folha atual é `public/art/monster-curupira-ancestral-spritesheet-v2.webp`: WebP lossless RGBA de 1024 × 1536 px, grade 4 × 6 e quadros de 256 × 256 px.
- As linhas representam idle, caminhada, ataque, disparo, dano e derrota. `src/game/arpg/runtime/enemy-sprites.ts` registra quatro quadros por estado; somente o boss da Mata usa esse perfil.
- O renderer escala a arte para a arena e mantém collider no footprint, separado da silhueta transparente. `enemy-sprites.test.ts` valida formato WebP, canal alpha, grade e mapeamento das linhas.
- A luta alterna padrões telegráficos: fase 1 combina arco e raízes; fase 2 usa rastros falsos, decoys e emboscadas; fase 3 altera temporariamente a arena com raízes físicas que bloqueiam caminhos.
- O smoke browser observou os quatro estados e os padrões das três fases; a captura `curupira-root-arena-smoke.png` mostra duas barreiras físicas ativas. Os perfis configurados para bosses, inimigos comuns, elites e mini-chefes usam folhas dedicadas; os atlases continuam como retratos e fallbacks para IDs não mapeados. Os objetos e as salas especiais ainda precisam de acabamento visual próprio.

## Amarok das Montanhas Rúnicas

- A folha atual é `public/art/monster-amarok-elder-wolf-spritesheet-v2.webp`, WebP lossless RGBA de 1024 × 1536 px em grade 4 × 6, com quadros de 256 × 256 px.
- As linhas são idle, caminhada, ataque, disparo, dano e derrota. O runtime registra o perfil `amarok-boss` e usa collider no footprint para separar colisão da silhueta ampliada.
- A folha mantém a paleta glacial azul/prata e os glifos de gelo da região. O smoke 844 × 390 observou idle, caminhada, ataque e derrota durante a execução completa das Montanhas Rúnicas.

## Iara das Profundezas

- A folha atual é `public/art/monster-iara-boss-spritesheet-v2.webp`, WebP lossless RGBA de 1024 × 1536 px em grade 4 × 6, com quadros de 256 × 256 px.
- As linhas são idle, caminhada, ataque, disparo, dano e derrota. O runtime registra o perfil `iara-boss`, ligado ao boss do Arquipélago das Marés, e mantém o collider no footprint.
- A silhueta, as águas profundas, as pérolas e os mantos de correnteza dão identidade visual própria à arena marítima. O smoke CDP de 844 × 390 observou idle, caminhada, ataque e derrota na run completa do Arquipélago.

## Baú de tesouro

- `public/art/treasure-chest-spritesheet-v2.webp` é o asset original do Card Realms, servido como WebP lossless RGBA de 1254 × 1254 px em grade 2 × 2; cada quadro mede 627 × 627 px. A arte não usa recursos do ZIP de referência.
- `src/game/arpg/runtime/treasure-chest-sprites.ts` mapeia o frame 0 como baú fechado e os frames 1–3 como abertura em execução única a 10 fps. A escala de renderização é calculada a partir do frame para manter o baú em 92 × 92 px.
- Cada quadro ancora o desenho pelo mesmo baseline no chão. O surgimento procedural começa a 75% dessa escala e termina em 260 ms; o tween preserva o tamanho nominal. O prompt `[E] Abrir` aparece apenas ao alcance e vira `Abrindo…` durante a animação; o controle touch mantém o botão contextual existente.
- Após os 300 ms da abertura, o item atribuído sobe por 260 ms, pausa 80 ms, cai por 260 ms até uma célula caminhável da mesma sala e tem contato de 160 ms. Física e input de gameplay ficam suspensos, mas a cena continua ativa para a escolha React. A silhueta deriva do item existente: espada, arco, cajado, peitoral ou manto, em textura procedural 32 × 32 px com contorno de 2 px; cache reutiliza o fragmento de 24 px. Nenhuma nova rolagem ocorre.
- A raridade declarada controla cor de brilho, contorno pixelado, partículas e notas sintetizadas: comum `#d8cba5`, incomum `#8fc56b`, raro `#6ca4cc`, com estilos próprios também para épico, lendário e mítico. O sprite do item mantém as cores da silhueta. Depois da queda, ele permanece imóvel até a escolha.

## Paletas de base

Mata Encantada mantém as cores já usadas no runtime:
- chão: #304735;
- detalhe de chão: #38523d;
- parede/sombra: #1d241f;
- detalhe de parede: #4f5a4c;
- realce de pedra/madeira: #69745f;
- porta/raiz seca: #7d4d31.

Arquipélago das Marés:
- chão: #244957;
- detalhe: #2e6370;
- parede: #142a33;
- detalhe de parede: #3f7480;
- realce: #6ca4aa;
- porta: #396f80.

Montanhas Rúnicas:
- chão: #34495b;
- detalhe: #52697c;
- parede: #1c2835;
- detalhe de parede: #536b7d;
- realce rúnico/gelo: #a8c9da;
- porta: #6a8797;
- água glacial: #416b82.

Acentos de fogo, água, natureza, tempestade e espírito pertencem a ataques, drops e conteúdo emissivo. A UI de estrutura usa pergaminho, madeira escura, bronze e contraste claro.

## Leitura e camadas

Cada sala deve ser composta em ordem de fundo para frente:
GROUND → GROUND_DETAILS → WATER → DECORATION_BOTTOM → WALLS → COLLISION → OBJECTS → CHARACTERS → FOREGROUND → LIGHTS → EFFECTS.

Gameplay usa colisão no footprint e não na arte transparente. Spawns e baús ficam em pontos seguros de navegação. Obstáculos não podem bloquear uma conexão ou o espaço de entrada.

O primeiro passe implementa tiles de piso/detalhe/água/obstáculo, paredes de sala e corredor, com colisão em parede e obstáculo. Padrões de rio/ruínas/raízes/cristais, água do arquipélago e gelo/runa das montanhas variam o mapa. Glifos de piso são decorativos e caminháveis; obstáculos e spawns evitam tiles bloqueados. Poeira de porta, telegraph de raízes/folhas e animação simples de surgimento do baú já existem. Props, foreground, iluminação e composição por camadas ainda são trabalho futuro.

## Personagens, criaturas e movimento

Silhueta deve permanecer identificável no canvas de 844 × 390 CSS px. Contorno escuro de 1–2 pixels nativos, sombra simples sob a entidade e poucos detalhes de alto contraste. Estados necessários: idle, walk, attack, dash, hurt, death e interact. Inimigos precisam de telegraphs distintos para melee, ranged, charger e caster. O Curupira exige leitura própria para arco, corrida, raízes, rastros falsos e mudanças da arena.

O Broto Enraivecido da Mata usa `public/art/monster-sprout-spritesheet-v1.webp`, WebP lossless RGBA de 1024 × 1536 px: grade 4×6 de quadros 256×256, em ordem idle, walk, attack, shoot, damage e defeat. Seu perfil aplica escala 0,25 e mantém o collider dimensionado pelo footprint, não pelas bordas transparentes da folha. O Boto-cor-de-rosa do Arquipélago usa `public/art/monster-boto-enemy-spritesheet-v1.webp` e o Raijū das Montanhas usa `public/art/monster-raiju-enemy-spritesheet-v1.webp`, ambos na mesma grade e escala 0,25. Uma pausa de 420 ms depois do surgimento permite ler o idle antes da perseguição. Essas três criaturas tiveram os estados observados em smokes; as demais folhas de inimigos constam do manifesto e são carregadas conforme o perfil da dungeon.

## HUD, controles e menus

HUD em tela: vida/armadura no topo, exatamente duas cartas de ataque próprias, arma ativa e feedback da interação. Clique/toque no chão define um destino caminhável e o personagem navega por tiles; WASD, joystick e gamepad seguem como alternativas. Baú e portal de extração aparecem como ação contextual no toque, além do prompt de teclado. Cooldown usa máscara pixelada e estado textual curto. Os dois ataques equipados são comprados ou selecionados apenas no Arquivo da Guilda; Raízes Ancestrais e Chama do Boitatá são cartas iniciais gratuitas. Armas, armaduras e buffs temporários vêm da dungeon. Mobile landscape: joystick à esquerda; ataque, dash e as duas cartas à direita. Alvos de toque não se sobrepõem ao campo de batalha. Em telas touch landscape de até 520 px de altura, status, três ícones de equipamento e minimapa dividem a faixa superior; nomes completos continuam acessíveis e visíveis fora desse layout compacto. Cartas compactas mostram retratos, número e cooldown. Não há slots nem comandos de apoiadores folclóricos.

O hub físico continua como menu principal depois da entrada. Login e primeira entrada devem adotar moldura/portal do mundo sem esconder que a autenticação Google/Supabase é real. Menu clássico continua acessível durante a migração.

## Materiais e animação ambiental

Mata Encantada: musgo, raízes, ruínas, água rasa, folhas e luz espiritual; pedra tem borda irregular mas tileable. Marés: pedra úmida, madeira naval, água, espuma e luz azul. Portas, baús, altares e passagens precisam de estados de animação legíveis. Em salas distantes, pausar efeitos e IA.

## Áudio e acessibilidade

Separar ambiente, combate, UI, portas, drops e boss. Variação sonora não deve ser requisito para entender uma ação. Ataques críticos, dano, raridade e telegraph também precisam de forma, movimento ou texto, não somente matiz.

## Regra de ativos

Usar atlas e ilustrações existentes do Card Realms ou criar assets próprios. Não extrair nem reutilizar Recursos/BMPs do ZIP. Screenshots e imagens de referência servem para escala, densidade e leitura geral.
