# FASE 2 — DOCUMENTO DE DESIGN & DIREÇÃO VISUAL (CARD REALMS — VERTICAL SLICE)

Data: `2026-11-01`  
Versão: `1.0 — Vertical Slice (Brasil vs Japão)`

---

## 1. Visão do Jogo e Identidade

**Card Realms** é um jogo digital de estratégia, cartas e **tabuleiro vivo** em que lendas, criaturas e mitologias de diferentes culturas do mundo ganham presença física sobre territórios dinâmicos.

> **Pergunta Central:** *"Como seria uma batalha entre as lendas e criaturas que diferentes civilizações criaram ao longo da história, disputada sobre um tabuleiro mágico onde cada carta colocada ganha vida e transforma a paisagem?"*

O jogador atua como um **Estrategista de Reino**:
- Ele não controla um personagem com `WASD`.
- Ele molda as **4 Faixas de Território** do seu reino, ergue **Estruturas** sagradas, invoca **Lendas** que se materializam fisicamente em pé sobre suas cartas no tabuleiro, desencadeia **Eventos** climáticos/espirituais e toma a decisão tática central de cada criatura a cada turno:
  - **⚔️ INVESTIDA (Atacar)** a faixa oposta; **OU**
  - **🔮 DESPERTAR ANCESTRAL (Despertar Poder)** para alterar o estado do tabuleiro, confundir inimigos, criar ilusões ou transformar o terreno.

---

## 2. Estrutura do Tabuleiro Vivo (Perspectiva Estratégica Inclinada 2.5D)

O tabuleiro é renderizado no **Phaser 3** como uma **mesa ritualística tridimensional inclinada (2.5D)** diante dos dois estrategistas:

```text
================================================================================
                    [ 👑 CORAÇÃO DO REINO ADVERSÁRIO (20 PV) ]
      (Monumento físico no topo do tabuleiro — reage visualmente ao dano)
--------------------------------------------------------------------------------
  FAIXA 1 (Oeste)     FAIXA 2 (Centro-O)   FAIXA 3 (Centro-L)   FAIXA 4 (Leste)
+------------------+ +------------------+ +------------------+ +------------------+
| [TERRENO INIMIGO]| | [TERRENO INIMIGO]| | [TERRENO INIMIGO]| | [TERRENO INIMIGO]|
|  🏛️ Estrutura    | |  🏛️ Estrutura    | |  🏛️ Estrutura    | |  🏛️ Estrutura    |
|  🃏 Carta Base   | |  🃏 Carta Base   | |  🃏 Carta Base   | |  🃏 Carta Base   |
|  👹 Criatura 2.5D| |  👹 Criatura 2.5D| |  👹 Criatura 2.5D| |  👹 Criatura 2.5D|
+------------------+ +------------------+ +------------------+ +------------------+
                         ~~~ FRONTEIRA DE CONFLITO ~~~
+------------------+ +------------------+ +------------------+ +------------------+
|  👹 Criatura 2.5D| |  👹 Criatura 2.5D| |  👹 Criatura 2.5D| |  👹 Criatura 2.5D|
|  🃏 Carta Base   | |  🃏 Carta Base   | |  🃏 Carta Base   | |  🃏 Carta Base   |
|  🏛️ Estrutura    | |  🏛️ Estrutura    | |  🏛️ Estrutura    | |  🏛️ Estrutura    |
| [TERRENO ALIADO] | | [TERRENO ALIADO] | | [TERRENO ALIADO] | | [TERRENO ALIADO] |
+------------------+ +------------------+ +------------------+ +------------------+
                    [ 👑 CORAÇÃO DO REINO DO JOGADOR (20 PV) ]
================================================================================
```

### Presença Física no Tabuleiro
1. **Ligeira Inclinação Perspectiva (2.5D)**:
   - As faixas superiores (adversário) possuem escala perspectiva ligeiramente mais compacta no horizonte da mesa, enquanto as faixas inferiores (jogador) estão mais próximas da câmera, criando profundidade espacial genuína sem usar geometria proibida.
2. **Carta + Criatura Materializada**:
   - Quando uma **Carta de Lenda** é invocada em uma das 4 faixas, a **moldura física da carta** encaixa no pedestal do território e permanece visível no chão do tabuleiro.
   - Sobre/atrás da carta, a **Criatura se materializa em pé** (usando sua folha animada `v5` ou retrato `v5` com respiração/idle, sombra projetada no solo, aura elemental e indicadores de Ataque/Vida).
3. **Estruturas Físicas**:
   - Cada território possui espaço para **1 Criatura** e **1 Estrutura** (além do próprio **Terreno** ativo naquela faixa).

---

## 3. Os 8 Territórios Vivos e Reações Ambientais

Cada um dos 8 espaços de território (4 do jogador + 4 do adversário) possui um **Bioma Ativo** que altera tanto o **visual do tabuleiro** (tiles, flora/rochas/água, partículas ambientes) quanto as **regras táticas**:

| Ícone | ID | Nome do Território | Efeito Estratégico e Sinergia | Reação Ambiental Viva |
| :---: | :--- | :--- | :--- | :--- |
| 🌳 | `mata-encantada` | **Mata Encantada** | **+2 ATQ** para lendas de *Natureza* (Curupira, Mapinguari, Saci). Regenera **+1 PV** no início do turno para lendas brasileiras na faixa. | Árvores e raízes vivas brotam; folhas flutuam. Se atingida por **Fogo**, transforma-se em 🔥 *Terra Vulcânica*. Se atingida por **Enchente**, vira 🌊 *Rio dos Espíritos*. |
| 🌊 | `rio-dos-espiritos` | **Rio dos Espíritos** | **+2 ATQ** e **+1 Escudo** ao invocar lendas de *Água* (Iara, Kappa, Boto). Reduz em **-1 ATQ** criaturas de *Fogo* na faixa. | Águas correntes, vitórias-régias/corais e gotas luminosas. Apaga queimaduras e converte 🔥 *Terra Vulcânica* em 🌾 *Campos Ancestrais*. |
| 🏔️ | `montanha-antiga` | **Montanha Antiga** | Concede **+2 Vida Máxima / Armadura Rúnica** à criatura posicionada e **+1 ATQ** para lendas da montanha/tempestade (Tengu, Oni, Raijū). | Rochas ancestrais, cristais e pilares. Resistente a vendavais. |
| 🔥 | `terra-vulcanica` | **Terra Vulcânica** | **+2 ATQ** para lendas de *Fogo* (Boitatá, Oni). Ao fim do turno, causa **1 de dano de brasa** a criaturas não-ígneas posicionadas nela. | Brasas vivas, fendas incandescentes e fagulhas subindo. Derrete ❄️ *Reino Congelado*. |
| ❄️ | `reino-congelado` | **Reino Congelado** | Reduz em **-1 ATQ** criaturas inimigas na mesma faixa oposta e concede **+2 Vida** a Estruturas aliadas na faixa. | Cristais de geada e flocos de neve suaves. |
| 🌾 | `campos-ancestrais` | **Campos Ancestrais** | Terreno neutro inicial equilibrado. Concede **+1 PV** ao invocar qualquer criatura caso ainda não tenha sido transformado. | Solo fértil de pedras cartográficas pronto para receber qualquer bioma. |
| 🏜️ | `deserto-sagrado` | **Deserto Sagrado** | Luz solar intensa: impede que criaturas na faixa oposta fiquem ocultas em *Véu/Ilusão* e concede **+1 ATQ** em ataques diretos ao Reino. | Areias douradas e relíquias solares. |
| 🌙 | `reino-espiritual` | **Reino Espiritual** | **+2 ATQ** para lendas de *Espírito* (Kitsune, Tengu, Saci) e potencializa todo **🔮 Despertar Ancestral** usado a partir desta faixa (+1 de impacto/cura). | Santuário etéreo com lanternas espirituais e estrelas místicas flutuando. |

---

## 4. Regras da Partida, Recursos e Fases do Turno

### 4.1. Objetivo: 👑 O Coração do Reino
- Cada estrategista protege o seu **Coração do Reino** com **20 Pontos de Vida (PV)**:
  - **🇧🇷 Brasil — Árvore Ancestral de Pindorama**: Uma árvore colossal sagrada no centro da retaguarda brasileira.
  - **🇯🇵 Japão — Santuário Torii das Mil Eras**: Um portal espiritual sagrado guardado por lanternas ancestrais.
- Conforme o Coração do Reino perde vida (Estágios: Intacto `20–14 PV`, Abalado `13–7 PV`, Crítico `6–1 PV`, Destruído `0 PV`), sua representação visual no tabuleiro muda (rachaduras, fumaça, chamas espirituais, tremores de câmera).
- **Vitória**: O primeiro estrategista a reduzir o **Coração do Reino** adversário a `0 PV` vence imediatamente a partida!

### 4.2. Recurso Estratégico: Sopro Ancestral (Energia de Invocação)
- Cada carta possui um custo de **Sopro Ancestral** (`1` a `5`).
- No **Turno 1**, o estrategista possui **3 de Sopro Ancestral Máximo**.
- A cada novo turno do jogador, seu Sopro Ancestral Máximo aumenta em `+1` (até o limite de `8`) e é totalmente recarregado.
- Isso garante que já no **Turno 1** o jogador possa colocar um **Território** (custo 1) **e** invocar sua primeira **Lenda** (custo 2), fazendo o tabuleiro ganhar vida desde o primeiro minuto!

### 4.3. Mão e Baralho
- Cada estrategista começa com um **Grimório (Deck) de 16 cartas** e compra **4 cartas iniciais**.
- No início de cada turno, compra **1 carta** (limite máximo de 7 cartas na mão).

### 4.4. Fluxo do Turno
1. **Fase de Alvorecer (Automática)**:
   - Sopro Ancestral é recarregado e expandido (`+1` máx, até 8).
   - Compra 1 carta do Grimório.
   - Efeitos de início de turno dos **Territórios** e **Estruturas** são ativados (ex.: regeneração na *Mata Encantada*, Sopro extra de Santuários).
   - Todas as criaturas aliadas no tabuleiro ficam **Prontas para Agir** (`canAct = true`), exceto aquelas paralisadas/atordoadas.
2. **Fase de Estratégia e Conflito (Livre ordem pelo jogador)**:
   - **Jogar Cartas da Mão**:
     - 🗺️ **Carta de Território**: Escolhe uma faixa para transformar o bioma.
     - 👹 **Carta de Lenda**: Escolhe uma faixa aliada vazia para materializar a criatura (dispara a **Sequência de Invocação em 10 etapas**). Criaturas recém-invocadas entram em *Ritual de Chegada* e podem agir no turno seguinte (a menos que possuam a característica **Impulso Veloz**, como *Saci-Pererê* e *Raijū*, ou recebam bênção de evento).
     - 🏛️ **Carta de Estrutura**: Ergue uma construção física no slot de estrutura de uma faixa aliada.
     - ✨ **Carta de Evento**: Desencadeia um fenômeno imediato sobre uma faixa ou sobre todo o tabuleiro.
   - **Comandar Criaturas no Tabuleiro** (1 ação por criatura pronta no turno):
     - Ao clicar numa criatura aliada pronta no tabuleiro, o estrategista escolhe entre:
       - **⚔️ INVESTIDA (Atacar)**; ou
       - **🔮 DESPERTAR ANCESTRAL (Poder)**.
3. **Fase de Crepúsculo (Encerrar Turno)**:
   - Efeitos ambientais de fim de turno resolvem (ex.: brasa da *Terra Vulcânica*, expiração de *Confusão* ou *Ilusão*).
   - O turno passa para o oponente.

---

## 5. A Mecânica Principal: ⚔️ INVESTIDA vs 🔮 DESPERTAR ANCESTRAL

Toda criatura em Card Realms oferece um dilema tático real a cada turno:

### Opção A — ⚔️ INVESTIDA (Ataque de Faixa)
- A criatura avança na sua faixa contra a faixa oposta:
  1. **Combate entre Criaturas**: Se houver uma criatura inimiga na faixa oposta:
     - A atacante causa seu **Ataque Efetivo** (Ataque Base + Bônus de Sinergia de Terreno + Bônus de Estrutura) à criatura defensora.
     - A criatura defensora revida simultaneamente com metade do seu Ataque (arredondado para cima) em combate corpo a corpo, a menos que a atacante possua *Alcance/Voo* ou *Ilusão*.
     - **Status Confuso (`confused`)**: Se a criatura atacante estiver *Confusa* (ex.: pelo poder do **Curupira**), seu ataque desvia na mata — causando dano reduzido a uma faixa aleatória ou ferindo o próprio território inimigo!
     - **Status Véu de Ilusão (`veiled`)**: Se a defensora estiver protegida por *Ilusão* (ex.: pelo poder da **Kitsune**), o primeiro ataque contra ela desfaz a miragem sem causar dano!
  2. **Cerco a Estrutura / Golpe ao Coração do Reino**: Se **não** houver criatura inimiga na faixa oposta:
     - Se houver uma **Estrutura inimiga** naquela faixa, a investida destrói ou danifica a estrutura; qualquer dano excedente atinge o **👑 Coração do Reino**!
     - Se a faixa estiver totalmente aberta, a criatura golpeia diretamente o **👑 Coração do Reino adversário**!

### Opção B — 🔮 DESPERTAR ANCESTRAL (Poder Exclusivo da Lenda)
- Em vez de realizar uma Investida comum, a criatura canaliza seu mito de origem (**Despertar Ancestral**).
- Cada Lenda possui um efeito tático único que interage com os terrenos, posições e status do tabuleiro!

---

## 6. Primeira Coleção de Cartas (Vertical Slice: 🇧🇷 Brasil vs 🇯🇵 Japão)

Priorizando **CONSISTÊNCIA > QUANTIDADE**, a Vertical Slice traz **22 cartas profundamente projetadas** (10 Lendas, 4 Territórios, 4 Estruturas e 4 Eventos):

### 6.1. 👹 Cartas de Lenda — 🇧🇷 Folclore Brasileiro (5 Lendas)

| Carta | Custo | ATQ | PV | Terreno Favorito | 🔮 Despertar Ancestral (Poder) |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Curupira**<br>*Guardião dos Pés Virados* | `2` | `3` | `5` | 🌳 Mata Encantada (`+2 ATQ`, regenera `+1 PV`) | **Rastro Invertido**: Transforma seu território em 🌳 *Mata Encantada*, aplica **Confusão** à criatura inimiga na faixa oposta (fazendo-a errar o alvo e sofrer `2` de dano de desorientação). |
| **Iara**<br>*Senhora do Canto das Águas* | `3` | `3` | `6` | 🌊 Rio dos Espíritos (`+2 ATQ`, `+1 Escudo`) | **Canto da Margem**: Inunda a faixa aliada em 🌊 *Rio dos Espíritos*, reduz o ATQ da criatura oposta em `-2` e restaura `3 PV` das lendas brasileiras adjacentes. |
| **Saci-Pererê**<br>*Travesso do Redemoinho* | `2` | `2` | `4` | 🌳 Mata / 🌙 Espírito (`+2 ATQ`, *Impulso Veloz*) | **Redemoinho de Vento**: Troca a posição da criatura inimiga oposta com outra faixa inimiga, causa `2` de dano de vento e compra `1 carta`. |
| **Boitatá**<br>*Serpente de Fogo da Mata* | `4` | `4` | `6` | 🔥 Terra Vulcânica / 🌳 Mata (`+2 ATQ`) | **Círculo Incandescente**: Transforma o território inimigo oposto em 🔥 *Terra Vulcânica*, causa `3` de dano ígneo imediato na faixa oposta e concede `+2 Escudo` ao Boitatá. |
| **Mapinguari**<br>*Colosso da Floresta* | `5` | `5` | `8` | 🌳 Mata / 🏔️ Montanha (`+2 ATQ`, Guardião) | **Rugido da Terra Viva**: Causa `2` de dano a todas as criaturas inimigas, enraíza a faixa oposta e restaura `3 PV` de si mesmo. |

### 6.2. 👹 Cartas de Lenda — 🇯🇵 Folclore Japonês (5 Lendas)

| Carta | Custo | ATQ | PV | Terreno Favorito | 🔮 Despertar Ancestral (Poder) |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Kitsune**<br>*Raposa das Nove Ilusões* | `2` | `3` | `5` | 🌙 Reino Espiritual (`+2 ATQ`) | **Miragem Kitsunebi**: Transforma seu território em 🌙 *Reino Espiritual*, envolve a si mesma e aliados adjacentes em **Véu de Ilusão** (bloqueia o próximo ataque) e drena `2 PV` da criatura oposta. |
| **Kappa**<br>*Guardião do Redemoinho* | `2` | `2` | `6` | 🌊 Rio dos Espíritos (`+2 ATQ`, `+2 Escudo`) | **Desafio do Prato d'Água**: Transforma seu território em 🌊 *Rio dos Espíritos*, ganha `+3 Escudo` na carapaça e puxa uma criatura inimiga lateral para a faixa oposta, causando `2` de dano. |
| **Tengu**<br>*Mestre dos Ventos da Montanha* | `3` | `4` | `5` | 🏔️ Montanha / 🌙 Espírito (`+2 ATQ`) | **Vendaval de Yamabushi**: Desloca-se para outra faixa aliada livre (ou troca de lugar com um aliado), concede `+2 ATQ` a si mesmo neste turno e golpeia a faixa oposta com `3` de dano cortante. |
| **Oni**<br>*Demônio do Trovão Rubro* | `4` | `5` | `7` | 🏔️ Montanha / 🔥 Vulcânico (`+2 ATQ`) | **Clava de Ferro Ardente**: Destrói imediatamente qualquer Estrutura inimiga na faixa oposta, racha o solo inimigo em 🔥 *Terra Vulcânica* e causa `3` de dano ao ocupante ou ao Coração do Reino. |
| **Raijū**<br>*Fera do Relâmpago* | `3` | `4` | `4` | 🏔️ Montanha / 🌙 Espírito (`+2 ATQ`, *Impulso Veloz*) | **Salto entre Nuvens**: Descarrega um relâmpago que causa `3` de dano à criatura oposta e `2` de dano direto ao **👑 Coração do Reino** inimigo. |

### 6.3. 🗺️ Cartas de Território (4 Cartas)

1. **Mata Profunda** (Custo `1`): Transforma um território em 🌳 **Mata Encantada** e cura `2 PV` da criatura aliada posicionada nele.
2. **Nascente dos Espíritos** (Custo `1`): Transforma um território em 🌊 **Rio dos Espíritos** e concede `+2 Escudo` à criatura aliada na faixa.
3. **Santuário do Reino Espiritual** (Custo `1`): Transforma um território em 🌙 **Reino Espiritual** e compra `1 carta`.
4. **Picos da Montanha Antiga** (Custo `1`): Transforma um território em 🏔️ **Montanha Antiga** e reforça a criatura ou estrutura aliada com `+2 PV`.

### 6.4. 🏛️ Cartas de Estrutura (4 Cartas)

1. **Altar da Clareira Viva** (Custo `2`, `5 PV`, Brasil): Estrutura física de floresta. No início do turno, restaura `2 PV` da criatura aliada na faixa e concede `+1 ATQ` se o terreno for 🌳 *Mata Encantada*.
2. **Fonte das Águas Doces** (Custo `2`, `5 PV`, Brasil): Estrutura ribeirinha. Concede `+1 Escudo` por turno à criatura na faixa e protege o Coração do Reino absorvendo até `3` de dano de ataques que passarem pela faixa.
3. **Portão Torii Espiritual** (Custo `2`, `5 PV`, Japão): Estrutura sagrada. Concede `+1 ATQ` e **Véu de Ilusão** no turno em que uma criatura Yokai é invocada nesta faixa.
4. **Torre de Vigia da Montanha** (Custo `2`, `6 PV`, Japão): Fortaleza rochosa. Dispara flechas espirituais causando `1` de dano ao inimigo na faixa oposta ao final de cada turno.

### 6.5. ✨ Cartas de Evento (4 Cartas)

1. **Enchente da Pororoca** (Custo `2`): Inunda uma faixa (aliada e inimiga) transformando ambas em 🌊 **Rio dos Espíritos**, remove queimaduras e causa `2` de dano a todas as criaturas inimigas naquela faixa.
2. **Incêndio de Brasa Viva** (Custo `2`): Incendeia uma faixa inimiga transformando seu terreno em 🔥 **Terra Vulcânica** e causando `3` de dano ígneo à criatura e à estrutura inimiga naquela faixa.
3. **Eclipse das Lendas** (Custo `3`): Escurece o céu do tabuleiro; transforma os territórios centrais em 🌙 **Reino Espiritual** e permite que todas as suas criaturas prontas despertem poder com **+2 de impacto** neste turno.
4. **Neblina dos Espíritos** (Custo `2`): Cobre o lado aliado com bruma mística, concedendo **Véu de Ilusão** (bloqueia o próximo golpe) e `+1 Escudo` a todas as criaturas aliadas no tabuleiro.

---

## 7. Roteiro da "Primeira Partida Inesquecível" (Modo Demonstrativo / Seção 14)

Para cumprir a exigência da Seção 14 (*"A primeira partida precisa ser inesquecível"*), o jogo inclui um modo **Partida Demonstrativa Guiada (Brasil vs Japão)** além do modo livre contra IA e 2 Jogadores Local:
- **Estado Inicial Cinematográfico**:
  - O estrategista brasileiro já inicia com a Faixa 1 preparada com uma 🌳 **Mata Encantada** viva e a carta de **Curupira**, **Iara**, **Altar da Clareira Viva** e **Enchente da Pororoca** na mão.
  - O estrategista japonês possui um 🌙 **Reino Espiritual** preparado na Faixa 2, pronto para invocar **Kitsune** e **Kappa**.
- **Guia Tático Passo a Passo Não-Intrusivo**:
  - Sugere ao jogador invocar **Curupira** na 🌳 *Mata Encantada* para assistir à **Sequência de Invocação em 10 etapas** (runas no solo, folhas voando, Curupira surgindo em pé sobre a carta e câmera dando destaque).
  - No turno seguinte, demonstra o dilema entre **⚔️ Investida** e **🔮 Despertar Ancestral (Rastro Invertido)** para confundir o Yokai adversário.

---

## 8. Guia de Estilo e Direção Visual (Seção 10)

1. **Família Visual Unificada (`v5` Naturalista + `FOLKLARD_ART_MANIFEST`)**:
   - Todas as criaturas materializadas no tabuleiro usam exclusivamente as folhas de sprite `v5` (24 poses em grade lógica 64px) ou os retratos `v5` catalogados em `CHARACTER_PORTRAITS`, garantindo contorno escuro em degraus, cabeças expressivas e paleta coesa.
   - Todas as molduras de cartas, painéis de território, barras de vida, ícones de elemento, relíquias, árvores, rochas, corais, portais, altares e partículas usam os atlases autorais (`ui`, `props`, `world`, `fx` e tilesets `mata-tiles`, `mares-tiles`, `runic-tiles`).
2. **Zero Geometria Procedural**:
   - Em conformidade total com `visible-procedural-art.test.ts`, nenhuma superfície do tabuleiro ou da UI usa `Graphics`, `fillRect`, gradientes CSS ou SVGs soltos. Tudo é construído com nine-slices (`authoredPanel`), sprites (`authoredImage`), tiles e animações de quadros.
3. **10 Etapas da Invocação no Phaser**:
   1. Seleção da carta na mão com destaque na faixa alvo.
   2. Deslizamento visual da carta até o território escolhido.
   3. Encaixe físico da moldura da carta no pedestal do território.
   4. Aparição do selo rúnico mágico (`FX_ART.wardAppear` / `FX_ART.purificationRing`).
   5. Reação imediata do ambiente (explosão de folhas, gotas d'água, brasas ou estrelas místicas).
   6. Pulso luminoso da carta encaixada (`FX_ART.purificationFlash`).
   7. Sombra física (`PROP_ART.shadowMedium`) e coluna de energia emergindo da carta.
   8. Materialização da criatura em pé sobre a carta com escala elástica.
   9. Animação de entrada da lenda + acorde sonoro folclórico.
   10. Movimento sutil de câmera (zoom/pan tático suave) destacando a lenda recém-invocada.
