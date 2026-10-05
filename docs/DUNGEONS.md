# Dungeons — conceitos de campanha

## Escopo e regras de representação

Este documento transforma os 15 conceitos de bioma do c512 §§19–23 em propostas editoriais. Nomes e níveis são planejamento, não conteúdo já existente no runtime. Cada dungeon pode virar um conjunto de salas pequenas/grandes, corredores, atalhos, loops, segredos, combate, loja, descanso, evento, armadilha, mini-chefe e chefe; os layouts devem ser variados e reproduzíveis por seed.

Cada região precisa declarar, antes de implementação, hooks próprios de tiles, luz, inimigos, armadilhas, eventos, objetos, loot, pool de chefes, música, ambiente e clima. Escuridão não pode prejudicar leitura de combate. Inscrições, arquitetura, artefatos e objetos de cotidiano só entram como tradição documentada quando acompanhados de fonte; props inventados são identificados como adaptação do jogo. Os conceitos seguem `docs/DUNGEON_SPEC.md`: o jogador controla o próprio avatar e mantém exatamente duas cartas de poder; recompensas de dungeon podem propor equipamento autorizado pelo fluxo server-side e recursos/buffs temporários, nunca cartas permanentes de poder.

Os níveis e condições abaixo são uma progressão sugerida. As recompensas são hooks a validar com as tabelas de loot e contratos de autorização existentes antes de qualquer integração.

## Catálogo

### 1. Mata Encantada

- **Bioma / nível recomendado:** floresta tropical de fantasia brasileira; nível 1.
- **Guardião:** Curupira Ancestral.
- **Objetivo:** atravessar trilhas que se reordenam e desativar três marcos de raiz antes de alcançar a clareira.
- **Desbloqueio:** início da campanha.
- **Hooks de recompensa:** equipamento inicial de baixo nível, fragmentos temporários e material cosmético de folhas.
- **Tradição documentada:** a fonte descreve o Curupira como protetor da floresta que desorienta caçadores; traços físicos variam por região. [Instituto Butantan](https://butantan.gov.br/bubutantan/conheca-a-historia-do-curupira-o-defensor-das-arvores-e-dos-animais)
- **Adaptação do jogo:** trilhas falsas, raízes bloqueadoras e uma clareira-boss são mecânicas ficcionais. A paleta não representa uma comunidade indígena específica.

### 2. Pântano das Vozes

- **Bioma / nível recomendado:** várzea alagada e brejo de fantasia; nível 3.
- **Guardião:** Iara das Profundezas.
- **Objetivo:** localizar as fontes de três chamados, abrir uma rota seca e interromper o redemoinho central.
- **Desbloqueio:** concluir a Mata Encantada e alcançar o nível 3.
- **Hooks de recompensa:** equipamento defensivo, cura temporária e material cosmético de água.
- **Tradição documentada:** a FUNDAJ registra versões diversas da lenda da Iara e referências à sua circulação no folclore brasileiro; não fixa uma única narrativa. [Fundação Joaquim Nabuco — Pesquisa Escolar](https://pesquisaescolar.fundaj.gov.br/pt-br/artigo/iara/)
- **Adaptação do jogo:** transferi-la para um pântano e transformar canto/reflexo em pistas de combate é escolha ficcional, não uma localização tradicional afirmada pela fonte.

### 3. Ruínas Coloniais

- **Bioma / nível recomendado:** povoado colonial ficcional em ruínas; nível 5.
- **Guardião:** Mula-sem-cabeça.
- **Objetivo:** interromper um circuito de sinos e abrir o portão de extração sem bloquear rotas de fuga.
- **Desbloqueio:** concluir o Pântano das Vozes e alcançar o nível 5.
- **Hooks de recompensa:** arma de alcance médio, armadura e fragmentos temporários.
- **Tradição documentada:** o Tesauro do Centro Nacional de Folclore e Cultura Popular registra a mula encantada que galopa e lança fogo pelas narinas e boca. [CNFCP — Tesauro](https://antigo.cnfcp.gov.br/tesauro/00000550.htm)
- **Adaptação do jogo:** o povoado, a planta das ruínas e a arena não reproduzem sítio histórico real; não usar igreja, imagem devocional ou objeto sagrado como prop genérico.

### 4. Sertão Assombrado

- **Bioma / nível recomendado:** Caatinga e caminhos do semiárido; nível 7.
- **Guardião:** Saci-Pererê.
- **Objetivo:** reativar marcos de navegação após uma tempestade de poeira e seguir o redemoinho até a arena.
- **Desbloqueio:** concluir Ruínas Coloniais e alcançar o nível 7.
- **Hooks de recompensa:** equipamento leve, bônus temporário de movimento e material cosmético de vento.
- **Tradição documentada:** o Butantan registra variantes e misturas de influências na tradição do Saci; a Caatinga é um bioma exclusivamente brasileiro com paisagens e biodiversidade próprias. [Instituto Butantan](https://butantan.gov.br/bubutantan/dia-do-saci-conheca-a-historia-nao-tao-doce-mas-cheia-de-travessuras-da-lenda-do-folclore-brasileiro), [Ministério do Turismo](https://www.gov.br/turismo/pt-br/assuntos/noticias/turismo-na-caatinga-destaca-a-diversidade-do-unico-bioma-exclusivamente-brasileiro)
- **Adaptação do jogo:** usar o Saci como chefe deste bioma é uma escolha de campanha; os giros de vento e a travessia por marcos são mecânicas inventadas, não atributos universais da lenda.

### 5. Mangue Sombrio

- **Bioma / nível recomendado:** manguezal costeiro brasileiro; nível 9.
- **Guardião:** Vigia do Estuário (chefe original do jogo, sem atribuição folclórica).
- **Objetivo:** restaurar três passagens de maré e proteger o estuário durante um ciclo de ondas.
- **Desbloqueio:** concluir Sertão Assombrado e alcançar o nível 9.
- **Hooks de recompensa:** armadura resistente a empurrões, cura temporária e recurso cosmético de conchas.
- **Tradição / fonte contextual:** o ICMBio descreve manguezais como ecossistemas entre-marés que fornecem habitat a espécies terrestres, estuarinas e marinhas. [ICMBio — Monitoramento marinho-costeiro](https://www.gov.br/icmbio/pt-br/centrais-de-conteudo/publicacoes/publicacoes-diversas/estrategia_integrada_de_monitoramento_marinho_costeiro_monitora_subprograma_marinho_costeiro.pdf)
- **Adaptação do jogo:** lama, maré, raízes e o Vigia são conteúdo ficcional inspirado na ecologia do mangue; nenhum deles é apresentado como tradição local.

### 6. Floresta Amazônica Mítica

- **Bioma / nível recomendado:** floresta amazônica de fantasia; nível 11.
- **Guardião:** Mapinguari.
- **Objetivo:** seguir vestígios sem destruir o habitat e abrir uma clareira de passagem para extração.
- **Desbloqueio:** concluir Mangue Sombrio, registrar a pista da mata e alcançar o nível 11.
- **Hooks de recompensa:** arma pesada, material de armadura e fragmentos temporários.
- **Tradição documentada:** estudo publicado pela UFAC investiga a lenda e o imaginário acreano em torno do Mapinguari; as narrativas não devem ser reduzidas a uma descrição universal. [UFAC — *O imaginário acriano sobre a lenda do Mapinguari*](https://periodicos.ufac.br/index.php/amazonicas/article/view/9477)
- **Adaptação do jogo:** a trilha, a arena e o comportamento do chefe são ficcionais. Não atribuir a criatura a todos os povos amazônicos nem apresentar hipótese zoológica como fato.

### 7. Templo Andino

- **Bioma / nível recomendado:** encosta e complexo subterrâneo de inspiração andina; nível 13.
- **Guardião:** Supay.
- **Objetivo:** descer por plataformas de mina, marcar rotas seguras e vencer o guardião no salão final.
- **Desbloqueio:** concluir a Floresta Amazônica Mítica e alcançar o nível 13.
- **Hooks de recompensa:** arma de mineração ficcional, proteção temporária contra área e material cosmético mineral.
- **Tradição documentada:** o British Museum registra Supay/Tío na Diablada boliviana como senhor do mundo subterrâneo das minas e situa a dança na integração de práticas agrícolas ancestrais e católicas. [British Museum — objeto e comentário curatorial](https://www.britishmuseum.org/collection/object/E_Am1985-32-84-a-b)
- **Adaptação do jogo:** o templo, o percurso e o combate são ficcionais; não reproduzir cerimônias, máscaras ou itens rituais como decoração genérica.

### 8. Cavernas Mesoamericanas

- **Bioma / nível recomendado:** cavernas de fantasia com referência delimitada à arte zapoteca; nível 15.
- **Guardião:** Senhor-Morcego Zapoteca (Tzinacantecuhtli).
- **Objetivo:** iluminar câmaras em sequência e escapar do salão de eco antes que as rotas se fechem.
- **Desbloqueio:** concluir Templo Andino, descobrir a entrada subterrânea e alcançar o nível 15.
- **Hooks de recompensa:** equipamento de exploração, buff temporário de visão e fragmentos.
- **Tradição documentada:** o Met identifica um Tzinacantecuhtli zapoteca como figura híbrida associada a escuridão, cavernas e submundo. [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search/920429)
- **Adaptação do jogo:** “cavernas” e o percurso são cenário inventado, não reconstrução de um sítio zapoteca. Manter a referência zapoteca separada de tradições maias e mexicas.

### 9. Castelo Europeu Amaldiçoado

- **Bioma / nível recomendado:** fortaleza ficcional em costa atlântica; nível 17.
- **Guardião:** Banshee.
- **Objetivo:** descobrir qual ala ressoa com o lamento e sair do castelo antes da última badalada.
- **Desbloqueio:** concluir Cavernas Mesoamericanas e alcançar o nível 17.
- **Hooks de recompensa:** armadura de resistência, cura temporária e material cosmético de névoa.
- **Tradição documentada:** fonte pública de história e patrimônio irlandês descreve a banshee como mensageira sobrenatural de morte, tradicionalmente ouvida ou vista perto de uma morte e ligada a famílias de herança gaélica. [Ask About Ireland](https://askaboutireland.ie/reading-room/history-heritage/folklore-of-ireland/folklore-in-ireland/the-life-cycle/death/announcing-death/)
- **Adaptação do jogo:** a luta em um castelo é ficcional e não afirma que castelos sejam o cenário tradicional da banshee.

### 10. Floresta Eslava

- **Bioma / nível recomendado:** mata de conto eslavo, sem reivindicação de reconstrução histórica; nível 19.
- **Guardião:** Baba Yaga.
- **Objetivo:** resolver três tarefas de percurso sem quebrar os objetos de cenário e encontrar a saída da casa móvel.
- **Desbloqueio:** concluir Castelo Europeu Amaldiçoado e alcançar o nível 19.
- **Hooks de recompensa:** arma utilitária, buff temporário de evasão e recurso cosmético de madeira.
- **Tradição documentada:** estudo de Oxford situa Baba Yaga nos contos eslavos e examina como tradições orais e literárias se influenciam. [Oxford Academic](https://academic.oup.com/princeton-scholarship-online/book/33366/chapter-abstract/286471447)
- **Adaptação do jogo:** casa itinerante e tarefas são motivos de jogo a validar contra versões específicas do conto; não tratar “eslavo” como uma cultura uniforme.

### 11. Deserto Sobrenatural

- **Bioma / nível recomendado:** rota desértica ficcional, com contexto árabe delimitado; nível 21.
- **Guardião:** Jinn da Miragem.
- **Objetivo:** distinguir trilhas de calor de caminhos reais e interromper três focos de miragem.
- **Desbloqueio:** concluir Floresta Eslava, ativar o mapa astral e alcançar o nível 21.
- **Hooks de recompensa:** arma de longo alcance, buff temporário contra fogo e material cosmético de vidro.
- **Tradição documentada:** a Encyclopaedia Iranica descreve jenn/jinn como seres sobrenaturais no contexto árabe e persa, associados a fogo sem fumaça e invisibilidade; tradições variam. [Encyclopaedia Iranica](https://www.iranicaonline.org/articles/genie/)
- **Adaptação do jogo:** o “Jinn da Miragem” é um indivíduo ficcional e a ligação com dunas é escolha de cenário; jinn não são tratados como uma espécie inerentemente maligna.

### 12. Bosque Akan de Histórias

- **Bioma / nível recomendado:** mata de fantasia ancorada em contos Akan de Gana; nível 23.
- **Guardião:** Anansi.
- **Objetivo:** recuperar páginas de histórias roubadas, escolhendo caminhos que premiem observação em vez de dano bruto.
- **Desbloqueio:** concluir Deserto Sobrenatural e alcançar o nível 23.
- **Hooks de recompensa:** ferramenta de exploração, buff temporário de recarga e cosmético de teia.
- **Tradição documentada:** o Smithsonian identifica Anansi como figura Akan de contos-aranha e registra a continuidade de suas histórias na diáspora. [Smithsonian National Museum of African Art](https://collections.si.edu/search/detail/edanmdm%3Anmafa_93-17-1)
- **Adaptação do jogo:** o bosque, as páginas e o duelo são ficcionais. Este nome substitui o rótulo amplo “templo africano”; não fundir tradições Akan com Mami Wata, Ewe ou Zulu.

### 13. Floresta Japonesa

- **Bioma / nível recomendado:** floresta de fantasia com riachos e pântanos, sem mistura de tradições regionais; nível 25.
- **Guardião:** Kappa.
- **Objetivo:** controlar o nível da água e abrir comportas na ordem indicada por pistas do cenário.
- **Desbloqueio:** concluir Bosque Akan de Histórias e alcançar o nível 25.
- **Hooks de recompensa:** equipamento aquático, buff temporário de natação/movimento e material cosmético de bambu.
- **Tradição documentada:** o Museu Etnográfico Sueco apresenta o kappa como yōkai popular em contos e folclore japoneses e preserva uma variante regional de proteção associada a pepinos. [Etnografiska museet — Yokai](https://www.etnografiskamuseet.se/utstallningar/yokai/mer-om-yokai/)
- **Adaptação do jogo:** as comportas são mecânica ficcional; qualquer representação do kappa deve ser revisada para não transformar uma variante local em regra nacional.

### 14. Montanha Espiritual Asiática

- **Bioma / nível recomendado:** montanha Alborz de fantasia, recortada para a tradição persa; nível 27.
- **Guardião:** Simurgh.
- **Objetivo:** escalar em três rotas e levar uma pluma até a saída durante rajadas de vento.
- **Desbloqueio:** concluir Floresta Japonesa, coletar três marcas de altitude e alcançar o nível 27.
- **Hooks de recompensa:** armadura de escalada, cura temporária e cosmético de pluma.
- **Tradição documentada:** o Museu Aga Khan registra o Simurgh em manuscritos do *Shahnameh* e distingue papéis diferentes da ave no épico. [Aga Khan Museum](https://collections.agakhanmuseum.org/collection/artifact/isfandiyar-kills-the-simurgh-akm103)
- **Adaptação do jogo:** a montanha e a subida são ficcionais. “Asiática” é apenas o agrupamento provisório do c512; conteúdo final deve nomear região e tradição persas, sem estética pan-asiática.

### 15. Ilhas de Aotearoa

- **Bioma / nível recomendado:** costa, rio e cavernas de fantasia inspiradas em Aotearoa; nível 29.
- **Guardião:** Taniwha.
- **Objetivo:** mapear uma passagem de água, identificar se o guardião bloqueia ou protege a rota e concluir a travessia sem destruir o habitat.
- **Desbloqueio:** concluir Montanha Espiritual Asiática e alcançar o nível 29.
- **Hooks de recompensa:** equipamento de travessia, buff temporário aquático e cosmético de pedra verde.
- **Tradição documentada:** Te Ara, enciclopédia da Nova Zelândia, registra taniwha em tradições Māori como seres aquáticos que podem ser perigosos ou protetores, frequentemente ligados a locais específicos. [Te Ara — Taniwha](https://teara.govt.nz/en/taniwha)
- **Adaptação do jogo:** este conceito se restringe a Aotearoa/Māori; nome, local e representação de um taniwha específico exigem validação comunitária. Não usar “Oceania” como cultura única.

## Referência de implementação futura

Ao transformar uma entrada em dados, guardar `source/reference` por reivindicação de lore, distinguir fato de tradição de mecânica inventada e registrar variações regionais. Separar a documentação de boss da pool real de loot e dos IDs de habilidade: nenhum hook deste plano altera o limite de duas cartas equipadas.
