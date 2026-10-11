# Biblioteca de arte e separação de apresentação

`src/game/arpg/art/manifest.ts` centraliza atlases, frames, slices de CSS, tilesets regionais, imagens de compatibilidade, móveis e placeholders. `ARPG_ASSET_MANIFEST.authored` incorpora essa biblioteca ao pacote offline; caminhos são únicos e também incluem os móveis do Refúgio.

## Fontes e exportação

Os quatro PNGs de origem estão em `scripts/art-sources/{fx,props,ui,world}.png`. São lotes de arte original produzidos com ImageGen para este projeto. Os recortes revisados do exporter evitam invadir frames vizinhos. O source pack world é a revisão transparente; a revisão anterior não é usada.

```sh
node scripts/import-authored-art.mjs
node scripts/export-authored-art-css.mjs
node scripts/export-refuge-art.mjs
node scripts/normalize-weapon-atlas.mjs
```

A exportação apenas recorta, organiza pixels já existentes, ajusta escala com nearest neighbor e comprime WebP lossless. Não gera árvores, magia ou interfaces desenhando retângulos. Fontes SVG da mobília anterior ficam fora de `public` e são rasterizadas antes do build. As armas usam o pack CC0 integrado do PR #14, com original e derivação transparente preservados.

Os atlases contêm 64 frames cada. FX usa 128 px; props/UI/world usam 64 px. Três tilesets regionais contêm oito tiles de 32 px. Slices individuais de UI/world/props atendem CSS; Phaser reutiliza os atlases e carrega apenas o tileset da região atual. Não pré-carregar todos os slices CSS: o navegador solicita os usados, e a verificação de fallback reaproveita essas solicitações.

## Apresentação e lógica

- `AuthoredEffectLayer`: imagens persistentes por ID, animação por frame/tween/alpha/tint; destruição após o efeito terminar.
- `authoredImage`/`authoredPanel`: imagem ou nine-slice de atlas/asset com placeholder e erro quando falta.
- `AuthoredHealthBar`/`PixelHealthBar`: moldura e preenchimento recortado; divisores seguem thresholds da definição do boss.
- `combat-effects.ts`: áreas e impactos por elemento/lenda; partículas de folhas, água, neve, memória e eletricidade.
- `ArtSprite`: crop invisível de frame do atlas para React.
- `CSS_ART_VARIABLES`: única fonte dos caminhos exportados para CSS; `AuthoredCssAssets` verifica apenas imagens efetivamente solicitadas e substitui variáveis ausentes pelo placeholder.
- `missing-texture.ts`: mantém keys e seletores de frame existentes usando uma imagem de placeholder quando armas/projéteis falham. Tiles e atores têm placeholders com grade compatível.

O único Graphics de produção é `invisible-hazard-mask.ts`: off-display-list, invisível, usado exclusivamente como máscara matemática de arco. Não recebe função de aparência. O CSS de arco também recorta a imagem e nunca desenha sua borda.

## Próximo boss

1. Seguir [CORRUPTED_LEGENDS.md](CORRUPTED_LEGENDS.md) para definição, estratégia, registro regional, intro, estado autoritativo e desbloqueio idempotente.
2. Produzir arena e sprites coerentes com v5, sem mexer no tamanho das células comuns ou nos gates de progressão.
3. Registrar frames de warning/danger para círculo, arco, linha e retângulo no manifesto. Usar a mesma posição, ângulo e dimensões da hitbox; recortar o arco com a máscara invisível.
4. Apresentação própria pode combinar frames de memória/corrupção e estados de animação, mantendo o ciclo comum de purificação.
5. Usar os frames de partículas da lenda ativa durante purificação. Ward e portal têm estados explícitos; portas têm cinco frames por bioma.
6. Testar solo, party, reconexão, reduced motion, mobile e falta de asset. Nunca reintroduzir fallback geométrico.

`visible-procedural-art.test.ts` examina todo o código/CSS de produção, não somente Phaser. Falha com shapes, drawing surfaces, SVG inline, gradientes, ícones vetoriais e utilitários de superfície geométrica. Testes, matemática, física e receitas offline arquivadas são separados do renderer. A máscara invisível tem uma exceção única e verificada.
