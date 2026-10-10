# Sistema visual das armas ARPG — sprites externos CC0

As 12 armas obteníveis do Folklard usam **arte externa em pixel art**. A fonte é o arquivo original `weaponpack.png` de **Bennyboi_hack**, sob **CC0 1.0**. Os desenhos procedurais de espadas, arcos e cajados foram removidos. A geração com Phaser Graphics permanece apenas para os dois projéteis auxiliares (flecha e foco mágico).

## Origem e licença

- Autor: Bennyboi_hack.
- Página oficial: https://opengameart.org/content/16x16-weapon-sprites-free
- PNG original: https://opengameart.org/sites/default/files/weaponpack.png
- Arquivo incluído no projeto: `public/art/vendor/opengameart/bennyboi-hack/weaponpack.png`
- Licença: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- Proveniência detalhada: [LICENSES.md](../../LICENSES.md).

O PNG original já foi incluído na branch de implementação. O script `scripts/vendor-weapon-sprites.py` permite reproduzir a aquisição a partir da fonte oficial e valida assinatura PNG, grade 170×119 e SHA256. O workflow temporário de download foi removido depois de incluir o arquivo, evitando deixar permissões de escrita desnecessárias no CI. **A integração só está pronta para merge quando os testes passarem**. O jogo carrega o arquivo local, não depende do OpenGameArt durante a partida.

## Mapeamento de frames

O spritesheet contém células 16×16 px separadas por um pixel transparente (passo de 17 px) em uma grade de 10 colunas e 7 linhas. Os índices são baseados em zero. A arte original é ampliada em runtime com o renderizador pixel-art do jogo; não é redesenhada.

| Região | Arma | Frame | Silhueta original | Movimento |
| --- | --- | ---: | --- | --- |
| Mata Encantada | Espada de Ferro | 26 | shrtSword | swing |
| Mata Encantada | Arco da Mata | 12 | shortBow | recoil |
| Mata Encantada | Cajado Ritual | 7 | staff | cast |
| Mata Encantada | Lâmina do Guardião dos Espinhos | 47 | bastardSword | swing |
| Arquipélago das Marés | Lâmina das Marés | 25 | scimitar | swing |
| Arquipélago das Marés | Arco Ribeirinho | 32 | longBow | recoil |
| Arquipélago das Marés | Cajado do Canto da Iara | 63 | wand | cast |
| Arquipélago das Marés | Arco de Coral das Marés | 12 | shortBow (coral) | recoil |
| Montanhas Rúnicas | Sabre Rúnico | 45 | rapier | swing |
| Montanhas Rúnicas | Arco do Rastro do Alicanto | 32 | longBow (dourado) | recoil |
| Montanhas Rúnicas | Cajado do Raijū | 67 | wand2 | cast |
| Montanhas Rúnicas | Espada da Nevasca | 21 | 2handSword | swing |

Os arcos Mata/Coral e Ribeirinho/Alicanto compartilham a silhueta original, mas recebem cores e escalas diferentes. A fonte de arte pode ser refinada no futuro sem alterar as regras de combate.

## Integração preservada

- `ARPG_WEAPON_VISUALS` associa cada ID a `textureKey`, `frame`, `originX/Y`, `baseRotation`, `tint` e parâmetros de animação.
- A arma flutua separadamente da Lenda e segue a mira ou o alvo. O ângulo continua quantizado em 16 direções.
- `swing`, `recoil` e `cast` preservam as durações, intensidades, recuos, oscilações e escalas existentes.
- A troca dos slots A/B altera o **frame**, mesmo quando a `textureKey` do spritesheet permanece a mesma.
- A revelação de loot em baús usa o frame e a tonalidade exatos da arma.
- Os atributos de dano, alcance, cadência, raridade e efeitos continuam definidos no catálogo de equipamentos, sem alterações.
- O caminho local do PNG está em `ARPG_ASSET_MANIFEST`, portanto entra na coleta de recursos do modo offline/PWA.

## Verificação

Depois de vendorizar o PNG:

```bash
python3 scripts/vendor-weapon-sprites.py
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Em QA visual, conferir as 12 armas em dungeon, a troca A/B, todas as direções de mira, a apresentação de baús e a ausência de 404/erros de textura no console. Os testes unitários cobrem registro completo, índices de frame, identidade visual, movimentos e criação exclusiva de texturas auxiliares.
