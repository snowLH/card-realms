# Personagens de Folklard — referência da Naturalista

A direção de arte segue a imagem enviada pelo usuário em 9 de outubro de 2026: [referência original](folklard-character-style-reference.png). Cabeça grande, membros curtos, silhueta compacta, olhos simples, contorno escuro em degraus e cores em poucos tons. Todos os personagens ativos usam a mesma família visual.

## Assets e identidade

- 13 lendas jogáveis: Curupira, Iara, Boto, Amarok, Raiju, Mapinguari, Kappa, Kelpie, Ahuizotl, Ratatoskr, Carbunclo, Alicanto e Yeti.
- 17 perfis de inimigos/chefes das três expedições, incluindo as versões ancestrais de Curupira, Amarok e Iara.
- Roc do cooperativo, com folha própria e seis ciclos de animação.
- Os quatro NPCs originais (ferreiro, mercador, arquivista e naturalista) já seguem a referência. Suas artes e identidades foram preservadas e reexportadas na mesma grade.
- As 124 fichas do Bestiário e os ícones de habilidades usam os novos retratos. As 13 lendas e Roc compartilham a primeira pose das folhas de jogo; as outras 110 criaturas têm retratos próprios. Os dados de catálogo, ataques, desbloqueios e progresso não são alterados por essa troca de imagens.

## Arquivos e reprodução

Os assets finais estão em `public/art/*-v5.webp`. Seleção, Guilda e expedições usam `src/game/arpg/runtime/legend-sprite-sheets.ts` e `src/game/arpg/assets.ts`. O Bestiário e os ícones compartilham `src/game/content/character-portraits.ts`.

As folhas animadas têm 4 colunas, 6 linhas e 24 poses: repouso, caminhada, ataque, poder, dano e derrota. Cada célula de 256 px deriva de uma grade lógica de 64 px, ampliada com vizinho mais próximo. O exportador preserva transparência binária, margens entre células e uma paleta de até 48 entradas por folha. Retratos usam até 64 entradas por atlas.

Geração: ferramenta integrada `image_gen`, com a referência enviada pelo usuário e a folha original de Luzia como referências de estilo. O [conjunto de prompts](character-art-v5-prompts.md) registra as instruções utilizadas. A geração criativa é separada da conversão de formato, enquadramento e compressão nos exportadores de `scripts/`.

Os PNGs originais e estudos anteriores permanecem no diretório `outputs/art-sources-v5` e `outputs/art-studies-v4` do workspace, fora da distribuição pública. Os estudos simplificados v3 e os estudos v4 não ficam ativos no catálogo.

## Validação

Os testes de qualidade conferem dimensões, pixels alinhados à grade, transparência, margens, poses distintas e orçamento de tamanho. A revisão visual compara as silhuetas com a referência e verifica os sprites nas telas reais. Esses testes estruturais não substituem a avaliação visual.
