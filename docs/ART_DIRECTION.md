# Folklard — direção de arte do ARPG

O jogo é um ARPG original de folclore, com 13 Lendas jogáveis, duas habilidades próprias por Lenda, duas armas A/B e uma relíquia. A Guilda, as expedições e o cooperativo continuam na engine Phaser. Não reintroduzir TCG, avatar genérico, armaduras ou PvP de turnos na interface.

## Regra de produção

Toda arte nova deve ser pixel art 2D: grade inteira, clusters intencionais, paleta limitada, silhuetas legíveis, sombreamento plano e animação quadro a quadro. Não aceitar render 3D, pintura lisa, antialiasing, halo suave, imagem reduzida ou anatomia incorreta. Não copiar assets, mapas ou interfaces de outros jogos.

A base atual v3 está desenhada em `src/game/arpg/runtime/folklard-pixel-actors.ts`. O exportador `scripts/generate-pixel-actors.mjs` rasteriza os desenhos originais; não transforma imagens existentes. Cada folha contém 24 quadros: quatro poses por ciclo de idle, walk, attack, shoot/ability, damage e defeat. A grade lógica é 32 × 32 pixels por quadro, exportada exatamente a 8× em WebP lossless com transparência binária. Cada folha tem no máximo 16 cores e margem transparente entre quadros.

O mesmo desenho puro alimenta o fallback de Canvas do Phaser. Não manter um fallback com outra aparência. O carregador de folhas é compartilhado entre seleção de Lendas, Guilda, dungeon e os perfis de inimigos que já usam esses atores.

## Identidades da base v3

| Lenda | Leitura visual |
| --- | --- |
| Curupira | Perfil à direita, cabelo vermelho, pele terrosa, folhas verdes e os dois pés com dedos apontando para trás. |
| Iara | Pele morena, cabelos azuis em faixas, uma cauda de peixe e magia de água em pixels sólidos. Nunca desenhar pernas, nem na derrota. |
| Boto | Disfarce elegante, chapéu claro, roupa rosada, focinho e cauda revelando sua natureza aquática. |
| Amarok | Lobo quadrúpede cinza, ombros altos, juba marcada e postura predatória. |
| Raijū | Corpo baixo de criatura elétrica, cauda em zigue-zague e raios amarelos. |
| Mapinguari | Grande figura da floresta, um olho, braços largos e boca no ventre. |
| Kappa | Casco atrás do corpo, bico e prato de água sobre a cabeça. |
| Kelpie | Cavalo aquático de pescoço longo, crina e cauda de água, cascos turquesa. |
| Ahuízotl | Criatura quadrúpede com cauda conectada ao corpo e terminada em mão. |
| Ratatoskr | Esquilo ereto, cauda grande, passos em saltos e sementes. |
| Carbunclo | Pequena criatura avermelhada com joia luminosa e orelha longa. |
| Alicanto | Ave dourada, asas e penas de mineral, bico e pés próprios. |
| Yeti | Corpo largo, face azulada e pelagem clara em clusters. |

Ferreiro, Mercador, Arquivista e Guardiã do Bestiário usam a mesma tinta escura, contornos escalonados, proporções e linguagem de cores. Ferramentas, livros, bolsas, trajes e poses de trabalho diferenciam os quatro. O Broto também tem uma folha v3.

## Escala e integração

- Tiles do mundo permanecem em 32 pixels; não alterar colisões para compensar arte.
- As folhas exportadas mantêm os quadros de 256 pixels e a grade 4 × 6 esperados pelo carregador existente.
- Phaser preserva `pixelArt`, `antialias: false` e `roundPixels`; o CSS preserva `image-rendering: pixelated`.
- Idle deve continuar sem reiniciar a animação a cada atualização. Respeitar redução de movimento.
- Armas A/B trocam manualmente por Q ou pelo botão próprio. Os dois poderes da Lenda continuam equipados durante a run.
- O HUD e as escolhas devem mostrar nome, custo, estado e efeito, além da cor. Manter ações acessíveis em telas pequenas e conteúdo rolável.

## Revisão e pendências

Os testes inspecionam os arquivos efetivamente exportados: grade 8× exata, ausência de pixels semitransparentes, limite de cores, margem por quadro, presença das 24 poses e ciclos diferentes de movimento/repouso e ataque/magia. A anatomia e a composição também precisam de revisão visual das folhas e do jogo em tamanho real.

A base de atores não conclui a reformulação visual inteira. Continuam necessários os passes próprios de inimigos, elites, minibosses e bosses, incluindo ataques e transição de fase; retratos e fallbacks antigos; cenários dos três biomas, objetos, Guilda, UI e VFX. Não declarar essas etapas concluídas por causa deste catálogo.

Os estudos de imagens geradas antes da direção estrita não foram promovidos. Assets antigos permanecem no histórico e no projeto enquanto referências ou consumidores antigos ainda forem necessários; novos consumidores devem seguir a direção acima.
