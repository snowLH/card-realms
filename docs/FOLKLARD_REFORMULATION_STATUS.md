# Folklard — continuidade da reformulação

Atualizado em 9 de outubro de 2026. **As quatro fases da missão ainda não estão concluídas.** Este registro distingue mudanças implementadas, evidência real e trabalho pendente; títulos de commits anteriores não comprovam a conclusão da missão.

## Referência da Naturalista — catálogo v5 e aventura offline

A referência posterior do usuário é a Naturalista Luzia: todos os personagens ativos devem seguir suas proporções compactas, cabeça grande, membros curtos, contorno em degraus e poucos tons. Esta direção substitui os estudos simplificados v3 e os estudos v4 de personagens; não substituir a referência por outra direção artística.

- 13 heróis, 17 perfis animados de inimigos/chefes e Roc foram redesenhados com a ferramenta integrada de geração de imagens. Os quatro NPCs existentes já seguem a referência e foram preservados/reexportados. São 35 folhas animadas, seis ações e 24 poses por folha. Todos os 124 retratos do Bestiário também seguem a nova família; 110 são próprios e os demais compartilham a arte de jogo. [Guia e fontes](character-art-v5.md), [prompts utilizados](character-art-v5-prompts.md).
- Grade lógica de 64 px, escala inteira 4×, transparência binária e paleta de até 48 entradas por folha animada; até 64 por atlas de retratos. Os 42 WebPs v5 somam 1.266.156 bytes. A seleção deixa de aplicar compensações antigas por herói e apresenta a arte em escala inteira 2×; a Guilda usa uma escala comum para heróis e NPCs.
- A apresentação carrega telas pesadas sob demanda e usa a mesma imagem de fundo comprimida de 1.667.410 para 215.806 bytes, preservando os 1672×941 px. A instalação automática do service worker baixa apenas seis arquivos essenciais; não inicia o download de todas as artes na abertura. Dungeons atuais não carregam os antigos atlases de retratos que não usam.
- `/offline` contém somente bootstrap público e progresso local. “Preparar jogo offline” baixa um pacote público com progresso visível; nunca guarda HTML autenticado, API ou dados pessoais da conta. A atualização só substitui o pacote completo depois de baixar todos os arquivos. Progresso offline continua separado da conta; sessões autenticadas mantêm combate e recompensas autoritativos do servidor.
- Evidência local: apresentação 393×873; Guilda offline; expedição da Mata com servidor local **encerrado**, avanço até a segunda sala, combate contra Broto, poder, dano, derrota e retorno à Guilda. Arte nova carregou a partir do pacote; nenhum erro de console no fluxo. Esse teste não comprova vitória/extração real desta versão, multitoque físico ou multiplayer autenticado.
- Medição local com CPU 4×, 2 Mbps e 150 ms: apresentação carregou em 3,8 s. A amostra anterior do site público foi 10,6 s; as origens diferem, portanto não atribuir toda a diferença somente ao código nem tratar isso como medição em aparelho físico.
- Gate local final aprovado: **534 testes em 99 arquivos**, TypeScript, lint e build de produção. A seleção usa um único cabeçalho com saldo e retorno à Guilda. A preparação offline aguarda a resposta do worker compatível, inclusive na atualização de jogadores que estavam com o cache antigo. Evidências no workspace `outputs/`: `folklard-all-characters-v5.png`, `legends-all-13-v5.png`, `title-mobile-v5.png`, `guild-mobile-offline-v5.png`, `dungeon-offline-combat-v5.png`, `loading-after-v5.json` e `verify-v5-hosting.log`. O SHA e a publicação devem ser conferidos após o envio; a seção de histórico abaixo preserva as validações das versões anteriores.
- A primeira publicação v5 (`dpl_CUtSM96pvVgSez3GWzGTEiruhRkE`, SHA `dd5a676`) falhou antes de substituir o alias: o adaptador da Vercel reloca o HTML pré-renderizado. O manifesto offline agora é gerado em `compiler.runAfterProductionCompile`, antes de o host recolher os arquivos públicos, sem depender do caminho desse HTML. Um teste usa uma árvore sem HTML pré-renderizado e verifica os arquivos e a invalidação por mudanças do shell. O build confirmou a geração de 130 arquivos/33,9 MB nessa etapa.
- Teste adicional do conjunto integrado: servidor local encerrado, quatro salas atravessadas, elite com os novos inimigos, dois poderes, dano e quatro fragmentos recolhidos; pausa confirmou 20/120 de vida e nenhum erro de console. Não se declarou vitória/extração dessa tentativa.
- Integração preserva a melhoria de armas de `27e4436`, encontrada no remoto durante a revisão. `aa96ab2` registra os personagens, `42ca383` registra offline/desempenho e `a844b63` centraliza a colisão dos projéteis nas novas texturas sem alterar seu raio ou dano. A integração foi feita por merge em `main`, sem reescrever o histórico.
- Bloqueio do cooperativo em produção: o site usa Supabase `ywawwhnsvpfeppfcuwzg`, enquanto a conexão disponível só expõe `lfmbvqixixbhffdpmvhp`. Não trocar o banco do site nem aplicar migrações no projeto errado. A conexão correta e duas contas autorizadas ainda são necessárias para testar sala, reconexão e extração entre amigos.

Próximos passos da missão maior: testar o cooperativo com a conexão correta; completar comparação visual dos três biomas, extração e persistência autenticada; continuar cenários/VFX e validar os novos builds nativos. As artes de personagens desta rodada não concluem as quatro fases.

## Estado atual — estabilidade e apresentação

- `1d74539`: tela de apresentação reconstruída com estilos isolados e pixel art existente; 11 tamanhos de tela conferidos, incluindo portrait, landscape e desktop. Publicada e reaberta no endereço oficial, com menus acessíveis. A identidade visual restante ainda precisa de trabalho.
- `c2b8be5`: morte oferece uma nova tentativa real; resultado aguarda confirmação antes de liberar a saída; falha de extração permite repetir o mesmo token. A intenção de pausa durante o carregamento é aplicada quando a cena realmente inicia.
- `90434e5`: falha de checkpoint ou combate interrompe a cena, neutraliza os controles e oferece recuperação pelo checkpoint do servidor. Ações já enfileiradas não continuam com uma revisão antiga. Testado com respostas controladas; reconexão de uma conta real continua pendente.
- `7bfe0d2`: novos seeds identificam a versão das regras de encontros. Chefes finais ficam na arena final; seeds antigos preservam suas ondas e limites de recompensa. Testes cobrem 100 mapas por bioma, compatibilidade anterior e criação cooperativa.
- `4155329a67d7669851b72c3075b5f5df5d684014`: setas funcionam na Guilda e na dungeon; Shift e Espaço acionam dash sem duplicar um acionamento simultâneo. Golpes de área locais respeitam a mesma proteção de 260 ms usada pelo servidor; não acumulam vários danos no mesmo instante.
- Gate local completo desse último código: **467 testes em 89 arquivos**, TypeScript, lint e build de produção aprovados no Node 22.23.3. Verify [37928480477](https://github.com/snowLH/card-realms/actions/runs/37928480477) concluído com sucesso no mesmo SHA.
- Deploy `dpl_83Q8V1vrJZysBs8HGFoMGhEYQ93c`: READY, SHA `4155329a67d7669851b72c3075b5f5df5d684014`, alias `card-realms.vercel.app` sem erro. No navegador público: apresentação, configurações, entrada na Guilda, acesso ao Cartógrafo usando setas, nova dungeon, Shift, pausa e retorno à Guilda; visitante preservado em 885 moedas/Nv. 3. Sem erro de console observado nesse fluxo.
- `1cc1beb`: rotação da Guilda ajusta a escala do mesmo canvas, preservando cenário e posição. ResizeObserver e controles são liberados ao sair; callbacks tardios não recriam a cena. Quatro testes do controlador e um de regressão do componente cobrem esse ciclo.
- `6ab7f64`: alterações em gameplay, componentes do jogo e arte agora acionam os builds Windows/Linux, Android e simulador iOS. Os filtros anteriores ignoravam esses arquivos. A proteção do certificado Android e a restrição a simulador iOS permanecem.
- Correção posterior de enquadramento: o grid CSS e as margens do Phaser centralizavam o canvas duas vezes. Em 1920×1080, a Guilda estava em (480,270); agora está em (320,180), com 1280×720, centralizada. A mesma regra corrige a dungeon.
- Gate local desse grupo: **473 testes em 90 arquivos**, TypeScript, lint e build de produção aprovados. Publicação e workflows remotos desse grupo ainda devem ser conferidos após o envio.

### Grupo posterior — inimigos originais da Mata

- Sombra da Mata, Espinho Vivo, Guardião Corrompido e Mapinguari têm quatro folhas v3 originais, desenhadas em grade 32×32 e exportadas em escala inteira 8×. Cada uma contém 24 quadros em seis ações; juntas ocupam 8.058 bytes. Não são recolorações ou redução das folhas pintadas anteriores, nem reutilização da Lenda Mapinguari.
- O manifesto e o carregador usam as novas folhas. Se a imagem falhar, o Canvas desenha os mesmos pixels originais. O Broto aponta explicitamente para sua folha v3 já existente; a folha de herói Mapinguari deixou de ser carregada inutilmente quando a animação própria do monstro está disponível.
- Mapinguari usa 96 px de quadro e pixels de 3 px na escala lógica do jogo. O raio de colisão continua vindo da definição do inimigo; a mudança de escala não altera esse raio.
- Nove testes novos verificam os WebPs reais, transparência binária, pixels 8×8 uniformes, margem dos quadros, seis ciclos distintos, silhuetas distintas e igualdade dos pixels exportados com o fallback executado. Foi corrigida uma pose de repouso estática do Espinho Vivo encontrada pelo teste, preservando a asserção.
- Gate completo local: **482 testes em 92 arquivos**, TypeScript, lint e build de produção aprovados. As quatro imagens foram carregadas pelo Phaser e apareceram em combates reais. Sombra e Mapinguari: primeira sala concluída e baú aberto. Espinho Vivo, Sombra e Guardião: primeira onda da elite concluída; Mapinguari: segunda onda concluída. Uma tentativa anterior terminou em derrota após equipar uma espada e continuar atacando de longe. Não atribuir essa derrota ao balanceamento sem nova evidência, nem juntar seeds para declarar vitória.
- Capturas: `inimigos-mata-v3-revisao.png`, `mata-inimigos-v3-no-jogo.png`, `mata-elite-v3-no-jogo.png`. Registros: `mata-inimigos-v3-percurso.json` e `mata-combate-v3-desempenho.json`. Amostras reais de combate nesse navegador ficaram próximas de 60 FPS; continuam pendentes medição sustentada e dispositivos físicos.
- Revisão posterior do canvas: tracks do grid agora têm mínimo zero também em janelas com teclado/mouse. A validação pública anterior revelou que o modo 915×412 com ponteiro fino cortava a cena em 515 px de altura; o novo build local mostra 732×412, inteiro e centralizado. Captura: `guilda-janela-baixa-915x412.png`. Conferir esse ajuste após a nova publicação.
- A fase visual continua parcial: outros inimigos, bosses, biomas, retratos, UI e VFX ainda precisam de passes próprios.

### Resultado remoto da rotação e enquadramento

`7e196cde4da2f34f83123b1f090106c8370cecb4`: Verify [37962076626](https://github.com/snowLH/card-realms/actions/runs/37962076626), desktop [37962076695](https://github.com/snowLH/card-realms/actions/runs/37962076695), Android [37962076618](https://github.com/snowLH/card-realms/actions/runs/37962076618) e simulador iOS [37962076713](https://github.com/snowLH/card-realms/actions/runs/37962076713) concluídos com sucesso. Android compilou e preservou o APK oficial; publicação pulada pela verificação de assinatura. Windows/Linux publicados com metadados desse SHA; `/instalar` exibiu a compilação correta e os três arquivos disponíveis.

Deploy `dpl_2FBkAMeDHS6neigQiNRGhAxnCmMZ`: READY no SHA acima, alias oficial sem erro. Guilda pública conferida em portrait, landscape e desktop: mesmo canvas, posição e interação próxima ao Cartógrafo preservados; E abriu as expedições depois das rotações. Visitante continuou em 885 moedas/Nv. 3. Capturas/registro: `Folklard-publico-7e196cd.png`, `guilda-publicada-7e196cd.png`, `guilda-rotacao-publicada-7e196cd.json`. O ajuste posterior para janela baixa com ponteiro fino e as quatro novas artes ainda precisam de novo SHA e publicação.

### Evidência de gameplay e limites

- Montanhas Rúnicas: sala comum, tesouro, evento, descanso, loja, elite, Yeti e arena do Amarok foram percorridos em tentativas reais. Uma run chegou ao Amarok e terminou em derrota com 41 HP restantes do boss; outra terminou em sala comum. **Ainda não há vitória, extração e persistência completas das Montanhas.** Não equiparar trechos de tentativas diferentes a uma run vencedora.
- Foi reproduzida a derrota seguida de “Tentar outra vez”, com novo seed, vida 120 e sem transportar o loot antigo. Na revisão `4155329`, as setas moveram a personagem e Shift aplicou velocidade real de dash de 610 px/s, por inputs de teclado. Sem alterar HP, loot, kills ou posições por código.
- Registros e capturas reais em `outputs/` do workspace: `controles-teclado-4155329.json`, `controles-publicados-4155329.png`, `montanhas-percurso-4155329.json`, `montanhas-v2-derrota-arena-final.png` e `Folklard-publico-7bfe0d2.png`.
- Ainda faltam testes com duas sessões autenticadas, reconexão e extração persistente reais, instalações físicas, multitoque em aparelhos e medição sustentada de desempenho/leaks. FPS configurado da física não comprova FPS real.
- Guilda local conferida em 360×800, 393×873, 800×360, 854×393, 915×412, 1280×720 e 1920×1080: o mesmo canvas permaneceu conectado e a interação próxima ao Cartógrafo permaneceu disponível sem mover novamente a personagem. E abriu a seleção após as sete rotações. Evidência: `guilda-rotacao-validada.json`, `guilda-rotacao-corrigida-393x873.png`, `guilda-1920-enquadramento-corrigido.png`.
- Três ciclos reais de entrada/saída da dungeon voltaram a **um canvas e 81 elementos DOM** na Guilda; o leitor da dungeon foi removido em cada retorno. Amostras curtas do primeiro ciclo ficaram em 59,46–60,29 FPS; outro ciclo ainda aquecendo marcou 45,63–47,50. O segundo foi medido durante carregamento e não é uma medida de gameplay. Heap aproximado variou com coleta automática; essas amostras não comprovam ausência de leaks, desempenho sustentado em combate ou desempenho físico. Registro: `ciclos-guilda-dungeon-desempenho.json`.

### Sequência de continuidade

1. Publicar e conferir as correções validadas de rotação/enquadramento; ampliar a medição de desempenho em combate e concluir o ciclo das Montanhas.
2. Continuar arte original 2D dos inimigos, elites, minibosses e bosses; depois biomas, Guilda, UI e VFX. As 18 folhas v3 anteriores não concluem essa fase.
3. Revisar habilidades, variedade, recompensas, progressão e utilidade dos NPCs, preservando autoridade e compatibilidade.
4. Validar co-op com contas autorizadas quando disponíveis; atualizar/conferir builds Windows, Linux, Android e simulador iOS e downloads reais. Sem App Store/TestFlight nesta missão.

## Correção da regressão artística dos personagens — 09/10/2026

O usuário rejeitou a substituição dos heróis e NPCs pelas folhas simplificadas de 32 px v3. Os testes de grade/paleta passaram, mas isso **não comprovava melhoria artística**: o resultado perdeu detalhe, expressão e coerência com a Guilda. A versão v3 dos personagens não deve ser descrita como reforma visual bem-sucedida nem voltar ao catálogo ativo.

- O catálogo compartilhado da seleção, Guilda e dungeon voltou às 13 folhas detalhadas preservadas, incluindo as versões com quadros seguros de Curupira, Amarok e Ahuízotl. Os quatro NPCs também usam novamente suas folhas detalhadas. Nenhum arquivo de arte anterior foi apagado ou redesenhado nessa recuperação.
- As folhas experimentais continuam preservadas; seus testes agora inspecionam os arquivos de estudo diretamente, sem confundi-los com o catálogo ativo. Os ciclos de animação, controles, colisões, pausa, rotação, saves, downloads e autoridade do servidor permanecem nos sistemas atuais.
- A verificação deve comparar o personagem real no mesmo cenário e no tamanho de jogo, além de testar as animações. Somente trocar caminhos e passar testes não basta para comprovar qualidade visual. A publicação desta recuperação depende do gate completo e da comparação visual local/pública.
- Atualização da run das Montanhas: após o registro anterior, uma única seed `montanhas-runicas:encounters-v2:677e2f5e-ad09-401b-bce5-4c927def0623` venceu Amarok e extraiu +120 moedas/+240 XP local. Após recarga: 410 moedas, 660 XP e nível 2. Evidência completa em `outputs/FOLKLARD_PUBLICACAO_EAA582A.md`. Isso não comprova persistência autenticada ou conclusão das quatro fases.

## Base preservada

- Trabalho direto em `main`, sem force push. As mudanças recentes até `32feadf` foram lidas e preservadas, incluindo auto-aim com retenção de alvo, neutralização de inputs cooperativos ao perder foco, PWA direta e hardening de CI.
- `4d4ec11`: os prazos locais de combate usam tempo ativo da cena; pausa e suspensão deixam de consumir cooldowns, ataques e dash. O relógio do servidor continua autoritativo.
- `edd346d`: escolhas de loot preservam decisão, foco, conteúdo rolável e ações acessíveis.
- `39dc21a`: testes de workflows aceitam CRLF e o teste de 250 seeds mantém as mesmas asserções com prazo compatível com o ambiente Windows.

## Mudanças desta rodada

- `10a0db5`: a lista de escolhas de salas rola dentro do painel. Foco por teclado revela a ação escolhida e se ajusta ao redimensionar. Cabeçalho, saldo e explicações ficam fora da lista rolável.
- `6f2a6db`: nova base original em pixel art 2D para as 13 Lendas, quatro NPCs da Guilda e Broto. São 18 folhas v3, 31.128 bytes no total, 24 quadros por folha, grade lógica 32×32, escala exata 8×, transparência binária e até 16 cores. O desenho puro e o exportador estão no repositório; o fallback de Canvas usa o mesmo desenho.
- A revisão de downloads nesta mesma rodada corrige o rótulo padrão Android para `signed-release`, rejeita classificações desconhecidas e impede que o workflow Android assinado substitua o APK oficial com certificado diferente ou não verificável. O APK novo permanece disponível como artefato nesse caso.
- Mensagem de extração deixa de atribuir todo loot de boss ao Curupira. O pulso do indicador de alvo acompanha o relógio ativo da cena.

## Verificação realmente executada

- `npm run verify:deploy` completo no Node 22.23.3: tipos, lint, **435 testes em 85 arquivos** e build de produção aprovados. Não houve redução das asserções para obter aprovação.
- 19 testes inspecionam os WebPs v3 efetivamente exportados: grade exata, paleta, alpha, margem por quadro, presença das poses e distinção entre ciclos. Teste específico confere os dois pés invertidos do Curupira.
- Testes de escolhas verificam Tab/Shift+Tab, setas, Escape, restauração de foco e rolagem após reduzir o espaço disponível. Testes de metadados executam os produtores reais sobre arquivos temporários e comparam tamanho, hash e classificação.
- Navegador local: runs reais completas com Iara na **Mata Encantada** e no **Arquipélago das Marés**, sem alterar HP, posições, kills, moedas ou loot por código. Foram percorridos combates, elites, minibosses, bosses e recompensas; a Mata também passou por loja, descanso, evento e tesouro. Mapinguari, Ahuízotl, Curupira Ancestral e Iara das Profundezas foram derrotados por inputs reais.
- Extração local das Marés: +90 moedas/+180 XP. Mata: +60 moedas/+120 XP. Após retorno e recarga, o visitante manteve **230 moedas, 300 XP, Iara escolhida e seis entradas já existentes da coleção (duas Lendas e quatro habilidades)**. Isso prova persistência local do visitante; não comprova persistência de armas coletadas, nem reconexão de uma conta autenticada.
- Loot real comparado em 360×800, 393×873, 800×360, 854×393, 915×412, 1280×720 e 1920×1080: ações com pelo menos 44 px, conteúdo acessível por rolagem e efeitos completos das armas.
- Loja real com zero fragmentos na versão corrigida: três compras desabilitadas e “Seguir viagem” focada, visível e alcançável em landscape pequeno. Em portrait, a proteção de orientação pausa a dungeon e pede rotação; não confundir com teste físico de iPhone.
- Os 13 sprites v3 carregaram na seleção de Lendas; Iara v3 e NPCs foram inspecionados na Guilda e Iara na dungeon. A seleção mantém repouso estático conforme o CSS existente; animações de ação pertencem ao jogo.
- Não foram encontrados avisos/erros de console no ciclo local completo observado.

## Publicação e builds

Este registro é criado **antes** de enviar e publicar a revisão. Confirmar a revisão exata e as conclusões dos novos jobs no GitHub Actions; não tratar este texto como evidência de sucesso remoto futuro.

- A publicação web requer o gate completo e inspeção do deploy exato. Auto-deploy Vercel permanece desabilitado.
- Alterações em `mobile/`, `desktop/`, gameplay e arte acionam builds reais Android, iOS Simulator, Windows e Linux. APK com assinatura incompatível deve preservar o download oficial.
- Apple nesta execução: **PWA via Safari → Adicionar à Tela de Início**. Não executar App Store/TestFlight nem workflows Apple assinados. O build de simulador é permitido e não representa instalação física.
- Não houve teste físico de APK, EXE, AppImage ou PWA instalada em iPhone/iPad nesta rodada. Não declarar assinatura, instalação ou certificação sem evidência.

## Trabalho ainda necessário

1. Estabilidade: concluir auditoria de leaks/FPS, joystick e multitoque reais, dash, orientação/safe areas nativas, checkpoint/retry/reconexão e persistência autenticada. Montanhas Rúnicas ainda precisa de percurso completo real.
2. Arte: a base de atores v3 **não conclui a fase visual**. Fazer passes próprios de inimigos, elites, minibosses e bosses com poses, ataques e transições; depois retratos/fallbacks, armas/objetos, três biomas, Guilda, UI e VFX. Rever escala, personalidade, anatomia e qualidade no tamanho real do jogo.
3. Conteúdo/progressão: revisar as 26 habilidades, variedade e balanceamento de armas/reliquias/loot, encontros e economia do servidor. Um loot comum repetido no fim da Mata foi observado; avaliar a recompensa do boss no contexto do balanceamento, sem inventar raridades no cliente.
4. Cooperativo/distribuição: testar dois clientes reais, host/membros, mortes, reconexão e extração autoritativa; conferir builds e downloads finais e testar instalação/atualização em dispositivos reais quando disponíveis.

## Mata v3: vitória completa e animações especiais

- Run vencedora única: `mata-encantada:encounters-v2:b48adb47-9a10-4c6d-8a10-161d1611de8a`. Oito salas descobertas, tesouro e altar usados, duas ondas da elite concluídas, sala comum concluída, melhoria de ataque comprada e Curupira derrotado nas três fases. A sala opcional de descanso foi atravessada sem usar a ação. Extração real: 425 XP durante a run e recompensa local de +60 moedas/+120 XP permanente. Nenhum atributo, kill, loot ou posição foi alterado por código.
- Após retorno à Guilda e recarga, o visitante manteve **290 moedas, 420 XP, Iara e as seis entradas preexistentes de Lendas/habilidades**. As quatro escolhas de loot dessa run repetiram o Cajado Ritual; isso registra uma questão de variedade para a fase 3, sem afirmar que quatro armas foram adicionadas à coleção local. Evidências: `mata-v3-vitoria-extraida.png`, `mata-v3-progresso-apos-recarga.json` e `mata-inimigos-v3-percurso.json`.
- A revisão encontrou ataques especiais locais que executavam dano/telegraph sem selecionar a pose própria. Quatro chamadas agora exibem ataque do charger e disparo do caster/miniboss durante o prazo já existente, sem mudar AI, dano, cooldown ou economia. O caminho autoritativo do servidor permanece separado e ainda exige validação própria.
- Verificação real em novo seed `mata-encantada:encounters-v2:dcdddf01-225b-457c-bfa2-778d94735ad6`: histórico do Phaser contém `thorn-enemy-attack` e `mapinguari-enemy-shoot`, acionados por combate e movimento reais. Registro separado: `mata-ataques-v3-validacao.json`. Essa tentativa de validação está pausada na elite e não constitui outra vitória.
- Gate do código final: **482 testes em 92 arquivos**, TypeScript, lint e build de produção aprovados. O SHA anterior `7430fc40fd3e57e2dfe316e44912ca55ce051210` teve Verify [37965071304](https://github.com/snowLH/card-realms/actions/runs/37965071304), desktop [37965071319](https://github.com/snowLH/card-realms/actions/runs/37965071319), Android [37965071408](https://github.com/snowLH/card-realms/actions/runs/37965071408) e simulador iOS [37965071403](https://github.com/snowLH/card-realms/actions/runs/37965071403) com sucesso. A publicação web foi aguardada para incluir a correção das poses especiais; conferir o novo SHA e deploy exatos antes de declarar essa revisão publicada.

## Estudos preservados

O stash `Folklard original sprite atlas studies and art continuity pending QA` preserva estudos v2 rejeitados e trabalho anterior. **Não aplicar o stash inteiro sobre a base v3**: conflita com carregador, cena e direção de arte atual. Extrair somente itens úteis após revisão. Não apagar estudos antes de preservar o material necessário.

## Resultado remoto e correção posterior

O commit `ec5950c97e52a0aa761d9f9c9d734b201d536172` foi enviado a `main`. Verify [37873737702](https://github.com/snowLH/card-realms/actions/runs/37873737702), desktop [37873737700](https://github.com/snowLH/card-realms/actions/runs/37873737700), Android [37873737701](https://github.com/snowLH/card-realms/actions/runs/37873737701) e simulador iOS [37873737796](https://github.com/snowLH/card-realms/actions/runs/37873737796) concluíram com sucesso. Windows/Linux foram publicados; a publicação Android foi pulada pela proteção de certificado, mantendo o APK oficial anterior. O deploy web `dpl_GGeiDhSfBnX1JW3T6t74sU52kKwf` ficou READY e assumiu `card-realms.vercel.app`. As 13 folhas v3 carregaram na seleção pública, sem erros de console.

Os instaladores completos desse commit foram baixados: Windows 111.436.666 bytes, SHA-256 `9e2f20dbe59986ab3a47121a659d85d413806771e92fb5156ac9ebaa8060e7a8`; Linux 124.961.411 bytes, SHA-256 `1e3b5ad2f8401122c6ce47a76c571b66e9e961b260112f9cff43810892949718`. Os dois hashes e tamanhos conferiram com os JSONs do commit; Windows continua sem Authenticode. APK oficial preservado: 4.051.722 bytes e SHA-256 `37878cd724d0b3e99dc2f12eef17dec795b24113468efc5c653b7d7921e3bdd2`. Os três downloads responderam 200 com MIME binário correto.

A conferência pública encontrou o catálogo `/instalar` ainda exibindo commit/hash antigos após os arquivos da release serem substituídos. A correção posterior faz consultas `no-store` à release, JSON e arquivo e oculta identidade/hash se a checagem do binário falhar. Dois testes reproduzem a retenção de um snapshot e a substituição do arquivo entre consulta e HEAD. O gate desse código passou com **437 testes** e confirmou `/instalar` dinâmica. Os workflows nativos agora incluem mudanças no catálogo e na página de instalação, para executar os builds exigidos também nesse grupo. Verificar o novo SHA, gate e deploy antes de declarar a correção posterior publicada.
