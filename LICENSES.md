# Licenças e proveniência de arte externa

## 16x16 weapon sprites free — Bennyboi_hack

- **Autor:** Bennyboi_hack
- **Página de origem:** https://opengameart.org/content/16x16-weapon-sprites-free
- **PNG original:** https://opengameart.org/sites/default/files/weaponpack.png
- **SHA256 do PNG original:** `37f4ce4a3e875b8e7f23897e583c1991253788eff271a1c283498e38629e45d3`
- **Cópia no repositório:** `public/art/vendor/opengameart/bennyboi-hack/weaponpack.png`
- **Licença declarada pelo autor:** Creative Commons Zero 1.0 Universal (CC0 1.0)
- **Licença oficial:** https://creativecommons.org/publicdomain/zero/1.0/
- **Crédito obrigatório:** não; o crédito acima é voluntário.
- **Derivação local:** `public/art/vendor/opengameart/bennyboi-hack/weaponpack-alpha.png`, exportada por `scripts/normalize-weapon-atlas.mjs`. Remove o matte cinza conectado à borda de cada célula e os vazios revisados dentro das cordas dos arcos (frames 12/32); preserva o RGB da arte e os cinzas metálicos internos das outras armas.
- **Uso:** frames das 12 armas obtíveis no ARPG. O arquivo original é preservado; o derivado transparente é carregado, e o Phaser aplica seleção de frame, escala, rotação, pivô e tint em tempo de execução.

O arquivo foi selecionado diretamente da publicação do autor no OpenGameArt, e não de uma cópia de terceiros. A automação `scripts/vendor-weapon-sprites.py` obtém o PNG do endereço oficial, valida o formato e a dimensão 170×119 e o grava no caminho indicado. Não modificar a fonte nem substituir o arquivo por outra obra sem revisar a licença e este registro.

## Biblioteca original Folklard — reforma visual

- **Origem/autoria:** arte original produzida com OpenAI ImageGen a pedido do projeto; não é uma importação de obra de terceiros.
- **Fontes:** `scripts/art-sources/fx.png`, `props.png`, `ui.png`, `world.png`; hashes e dimensões em `scripts/art-sources/provenance.json`.
- **Direção e uso:** referência Naturalista/v5, pixel art 2D coerente com Folklard. Quatro atlases, três tilesets regionais, slices de UI/props/world, sombras, telegraphs, partículas, magia, purificação, corrupção, Ward, portais, portas e placeholders.
- **URL externa/licença de terceiro:** não aplicável às imagens geradas para o projeto. A origem não deve ser apresentada como CC0 de terceiros.
- **Exportação:** `scripts/import-authored-art.mjs` e `scripts/export-authored-art-css.mjs`; somente recorte, organização, nearest neighbor e compressão lossless.
- **Mobília do Refúgio:** preserva os seis desenhos existentes no commit `018df58`; fontes offline em `scripts/art-sources/refuge`, exportadas com `scripts/export-refuge-art.mjs`. Não há SVG inline em produção.

Os cenários, boss rooms e personagens v5 existentes continuam preservados. A biblioteca nova não contém sprites extraídos de jogos comerciais, Pinterest ou Google Images.
