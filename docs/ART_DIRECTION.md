# Direção de arte — criaturas v2

## Resultado selecionado

- Modo: gerador de imagens nativo (built-in).
- Arquivo de produção: `public/art/folklore-creatures-five-elements.png`.
- Formato: PNG ARGB transparente, 1254 × 1254 px, grade rígida 5 × 5.
- Uso: recorte por coordenadas no componente `PixelCreature`.

## Prompt final

> Production-ready 2D pixel-art RPG creature sprite sheet with transparent background. Create exactly 25 separate full-body creature sprites arranged in a strict five-columns-by-five-rows grid. Every cell must be the same square size; one creature centered in each cell, consistent baseline and apparent scale, generous transparent padding, no overlap, text, labels, numbers, borders, scenery or watermark. Cohesive hand-authored 16-bit style, deliberate hard-edged pixel clusters, limited shared palette, crisp nearest-neighbor appearance, readable silhouettes at small size and three-quarter battle poses. No antialiasing, gradients, 3D, painterly rendering, hyperrealism or glossy generic AI concept-art appearance. Preserve culturally specific defining traits rather than converting the beings into generic fantasy monsters.
>
> Exact rows, left to right: Fire — Boitatá, Mula-sem-cabeça, Salamandra, Fênix, Aitvaras. Water — Iara, Boto-cor-de-rosa, Kelpie, Kappa, Ahuízotl. Nature — Curupira, Caipora, Mapinguari, Leshy, Amarok. Storm — Saci-Pererê, Raijū, Tengu, Ziz, Simurgh. Spirit — Black Shuck, Domovoi, Qilin, Banshee, Carbunclo. Preserve the identifying lore markers for each: Boitatá as a fire serpent rather than dragon; the headless mule's neck flame; amphibian Salamander; solar Phoenix; Aitvaras as fiery rooster; Iara as Amazonian river enchantress; pink river dolphin; dark Scottish water horse; Kappa's water dish; Ahuízotl's hand-ended tail; Curupira's backward feet; Caipora with peccary; Mapinguari's unusual forest-being anatomy; Leshy's bark and moss; giant Arctic Amarok; one-legged Saci with red cap and whirlwind; Raijū as lightning beast; mountain Tengu; cosmic bird Ziz; Persian Simurgh; one-eyed spectral Black Shuck; domestic Domovoi; Chinese Qilin rather than Western unicorn; Irish bean sí; luminous Andean/South-American Carbunclo.

O resultado foi inspecionado antes de entrar no projeto. O arquivo original gerado foi preservado no diretório de imagens geradas do Codex; a cópia usada pelo jogo fica versionável em `public/art/`.

## Direção de interface — produto mobile-first

A interface usa referências de jogos de gestão mobile apenas como linguagem, sem reproduzir telas, textos ou arranjos específicos. Os princípios adotados são:

- superfícies claras, azul sólido e contraste alto, com poucos efeitos decorativos;
- hub inicial orientado a ações reais: continuar, duelar, consultar coleção, equipe, baú e refúgio;
- cinco destinos persistentes na navegação inferior do celular e navegação lateral ampliada no computador;
- mesmos componentes e hierarquia em todos os tamanhos, sem transformar o desktop em um celular esticado;
- cartões com função clara, ícones consistentes e textos curtos, evitando excesso de gradientes, brilhos, pílulas e slogans;
- arte folclórica reservada para criaturas, mapa e arena; a interface de produto permanece neutra para não competir com o conteúdo;
- arena clara ao redor do cenário, placar escuro e controles brancos, mantendo as decisões de combate legíveis em telas estreitas.

O resultado foi verificado em `390 × 844` e `1440 × 900`, sem rolagem horizontal, sem overlay de erro e sem avisos no console do navegador. O hot reload de desenvolvimento do Turbopack apresentou um erro interno após várias mudanças de viewport; o build de produção compilou normalmente e é a referência de publicação.
