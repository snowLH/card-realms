# Manifesto de arte do Folklard

O inventário executável está em [ARPG_ASSET_MANIFEST](../src/game/arpg/assets.ts), que incorpora [FOLKLARD_ART_MANIFEST](../src/game/arpg/art/manifest.ts) e [BOSS_ROOM_ART](../src/game/arpg/bosses/boss-room-art.ts). Caminhos offline são coletados e deduplicados a partir do mesmo catálogo. Matemática, colisões, layout e masks invisíveis continuam independentes da arte.

## Biblioteca compartilhada

| Pacote | Arquivo em public/art/authored | Grade | Conteúdo |
| --- | --- | --- | --- |
| FX | fx-atlas.webp | 8 × 8, 64 frames de 128 px | Telegraphs de Arthur/Curupira/Iara, quatro estados do Ward, mira, corrupção, purificação, partículas e impactos |
| Props | props-atlas.webp | 8 × 8, 64 frames de 64 px | Guilda, objetos quebráveis, mobiliário, decoração, cinco sombras e quatro estados do portal |
| UI | ui-atlas.webp | 8 × 8, 64 frames de 64 px | Ícones, painéis, botões, slots, molduras de HP, preenchimentos, divisores e tiles de minimapa |
| World | world-atlas.webp | 8 × 8, 64 frames de 64 px | Tiles regionais, cinco estados de porta por bioma, projéteis, lasers, linhas de mira e áreas de habilidade |
| Tilesets | mata-tiles.webp, mares-tiles.webp, runic-tiles.webp | 8 × 1, tiles de 32 px | Piso, paredes e obstáculos; somente o bioma ativo é carregado pela cena |
| Slices CSS | ui/, props/, world/ | 64 imagens por pacote | Recortes do mesmo atlas para DOM/CSS, solicitados conforme uso |
| Compatibilidade | runtime/ | 13 imagens | Keys preservadas para loot, objetos, sombras e projéteis |
| Refúgio | refuge/ | 6 imagens de 32 px | Poltrona, luminária, planta, livros, baú e suporte de mapa; fontes SVG rasterizadas offline |
| Placeholders | missing-texture.webp, missing-actor.webp, missing-tiles.webp | 64 px; 4 × 6 de 256 px; 8 × 1 de 32 px | Fallback de imagem com grade compatível e log de erro |

Phaser carrega os atlas FX/props/world uma vez por instância de jogo, reutiliza frames e carrega os painéis de UI necessários. React usa slices ou recorta o atlas com CSS. Imagens ausentes não são substituídas por geometria. HP usa moldura/nine-slice e crop; minimapa usa tiles; telegraphs usam a posição/ângulo/dimensão da hitbox matemática e imagem temática. Tween, frames, alpha, rotação e tint animam a arte existente.

## Personagens, armas e cenários

- Lendas jogáveis, NPCs e bosses preservam o catálogo v5 inspirado em Luzia: cabeça expressiva, membros curtos e contornos em degraus. Nenhuma folha de avatar é desenhada em runtime. Fontes de estudos procedurais antigos estão arquivadas em scripts/art-archive/, fora do bundle.
- Arthur restaurado e corrompido usam legend-king-arthur-spritesheet-v5.webp e monster-king-arthur-corrupted-spritesheet-v5.webp: 24 poses de 256 px, grade 4 × 6. Repouso e caminhada preservam as armas flutuantes. Autoria/licença anterior: [king-arthur-original-art.txt](../public/art/licenses/king-arthur-original-art.txt).
- As três arenas monumentais usam /art/boss-rooms/{curupira,iara,arthur}/arena.webp, 1952 × 992 px, correspondente a 61 × 31 tiles. O cenário permanece após a purificação. Colisões, spawn e trono estão registrados em BOSS_ROOM_ART. Origem: [boss-room-original-art.txt](../public/art/licenses/boss-room-original-art.txt).
- A Guilda mantém guild-room-wide-background-v2.webp, NPCs e props de atlas. Corredores e salas usam tiles/texturas, com posições decorativas determinadas por seed.
- Armas integram o pack CC0 de Bennyboi_hack do PR #14: weaponpack-alpha.png, 70 frames de 16 px, grade 10 × 7, spacing 1. O PNG original está preservado ao lado. A derivação remove somente o fundo cinza conectado à margem de cada frame, mantendo metal/cor interna. Veja [WEAPON_VISUALS.md](WEAPON_VISUALS.md).
- Fundos, retratos, mapas locais, baú animado e folhas de inimigos já aprovados continuam no manifesto existente. A reforma não redesenha os personagens.

## Proveniência e reprodução

Os quatro lotes novos são arte original produzida para este projeto com ImageGen. Os PNGs, hashes, referências e instruções ficam em scripts/art-sources/; não entram em public nem no bundle. Não são apresentados como assets externos CC0. Autoria, uso e licenças externas estão em [LICENSES.md](../LICENSES.md).

O pipeline de recorte/nearest neighbor/compressão, a integração dos renderers e o procedimento para o próximo boss estão em [AUTHORED_ART.md](AUTHORED_ART.md). Dimensões, contagens e pesos medidos estão em [qa/full-authored-art/audit.json](qa/full-authored-art/audit.json); não são estimados a partir do nome do arquivo.

## Offline e regressão

O service worker usa folklard-arpg-v26. A instalação inicial permanece pequena; o pacote completo é preparado por solicitação do jogador. /art/ também é cacheado sob demanda. Os móveis e placeholders integram ARPG_ASSET_PATHS.

visible-procedural-art.test.ts verifica todos os arquivos TS/TSX/CSS de produção, incluindo UI, VFX e minimapa. A única exceção de drawing surface é a máscara matemática invisível de arco, fora da display list. asset-manifest.test.ts confere os 256 frames, três tilesets, placeholders, caminhos offline e variáveis de CSS. Resultados e limitações da validação visual estão em [AUTHORED_ART_QA.md](AUTHORED_ART_QA.md).
