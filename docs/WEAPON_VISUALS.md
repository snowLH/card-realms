# Sistema visual das armas ARPG

A implementação ativa usa sprites pixel-art gerados em runtime pelo próprio projeto. Não há sprites ripados, dependência de IP de terceiros nem pacote externo obrigatório para esta camada.

## Cobertura

As 12 armas atualmente obtíveis possuem textura, silhueta e movimento próprios:

| Região | Arma | Perfil visual | Movimento |
| --- | --- | --- | --- |
| Mata Encantada | Espada de Ferro | lâmina reta de ferro | swing |
| Mata Encantada | Arco da Mata | longbow vegetal | recoil |
| Mata Encantada | Cajado Ritual | cajado com orbe espiritual | cast |
| Mata Encantada | Lâmina do Guardião dos Espinhos | lâmina viva serrilhada | swing |
| Arquipélago das Marés | Lâmina das Marés | lâmina ondulada aquática | swing |
| Arquipélago das Marés | Arco Ribeirinho | arco recurvo | recoil |
| Arquipélago das Marés | Cajado do Canto da Iara | foco aquático/canto | cast |
| Arquipélago das Marés | Arco de Coral das Marés | arco de coral | recoil |
| Montanhas Rúnicas | Sabre Rúnico | sabre com runas | swing |
| Montanhas Rúnicas | Arco do Rastro do Alicanto | arco mineral luminoso | recoil |
| Montanhas Rúnicas | Cajado do Raijū | foco de relâmpago | cast |
| Montanhas Rúnicas | Espada da Nevasca | espada larga de gelo | swing |

## Regras de runtime

- Cada ID de arma tem uma texture key exclusiva em `weapon-visuals.ts`.
- A arma flutua separada do corpo da Lenda e segue alvo/mira.
- A orientação é quantizada em 16 direções para manter leitura pixel-art.
- Espadas usam arco de ataque, arcos têm recuo, cajados pulsam durante o cast.
- Arcos usam projétil em forma de flecha; cajados usam foco mágico.
- O baú mostra a textura exata da arma encontrada, não apenas um ícone genérico por categoria.
- `weapon-visuals.test.ts` falha se uma nova arma for adicionada sem perfil visual.

Os arquivos de arte continuam gerados pelo código para manter consistência e evitar introduzir um pacote visual externo sem revisão de arte/licença.
