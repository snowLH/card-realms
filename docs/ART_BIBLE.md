# Folklard — base visual de produção

A referência de personagens é Luzia, a Naturalista, em `docs/folklard-character-style-reference.png`: cabeça expressiva, corpo compacto, membros curtos, contorno escuro em degraus e pequenas rampas de cor. O catálogo ativo é v5. Arthur pode ser maior, mantendo essa base.

A política atual exige **zero geometria visível em runtime**, inclusive para UI, minimapa, HP, telegraphs, partículas, sombras, portais e magia. A aparência vem de imagens e atlases; a engine controla posição, animação, escala, rotação, tint e colisão. Física, navegação, distância, zonas e máscaras matemáticas permanecem invisíveis.

| Elemento | Padrão atual |
| --- | --- |
| Canvas lógico | 1280 × 720; desktop e mobile landscape |
| Tile | 32 × 32 px |
| Sala small | 21 × 11 tiles |
| Sala medium | 31 × 15 tiles |
| Sala large | 37 × 17 tiles |
| Arena de boss | 61 × 31 tiles; faixa exclusiva de layout |
| Células comuns | 1344 × 896 px |
| Personagens v5 | 4 × 6 frames de 256 px; escala pelo footprint |
| Atlas de efeitos | 8 × 8 frames de 128 px |
| Atlas props/UI/world | 8 × 8 frames de 64 px |

Preservar a paleta de cada bioma: verdes, musgo e bronze na Mata; água, espuma e madeira naval nas Marés; neve, pedra e azul rúnico nas Montanhas. Camelot conserva azul, prata e ouro sob a corrupção. Cenários originais continuam como base; tiles e props são sobrepostos sem esconder a arte da sala.

Sombras são frames de imagem. Telegraphs usam texturas temáticas e crop/máscara invisível alinhada à hitbox. HP usa moldura e preenchimento de imagem recortado. Painéis usam nine-slice/border-image de arte; elementos da cena que também são botões de interação não recebem uma moldura de UI.

Reduced motion reduz shake, zoom, pulsos e partículas; os sinais de perigo continuam presentes. Usar nearest neighbor e WebP lossless. Não mudar hitbox, dano, autoridade ou progressão para acomodar arte.

O pipeline, manifesto, fallback e regra de regressão estão em [AUTHORED_ART.md](AUTHORED_ART.md). Estudos antigos em `scripts/art-archive/` servem apenas como histórico offline e não são importados pela produção.
