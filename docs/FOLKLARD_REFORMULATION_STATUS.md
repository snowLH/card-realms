# Folklard — continuidade da reformulação

Atualizado em 8 de outubro de 2026, após a validação local desta rodada. **As quatro fases da missão ainda não estão concluídas.** Este registro distingue mudanças implementadas, evidência real e trabalho pendente; títulos de commits anteriores não comprovam a conclusão da missão.

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
- Extração local das Marés: +90 moedas/+180 XP. Mata: +60 moedas/+120 XP. Após retorno e recarga, o visitante manteve **230 moedas, 300 XP, seis equipamentos e Iara escolhida**. Isso prova persistência local do visitante; não comprova reconexão de uma conta autenticada.
- Loot real comparado em 360×800, 393×873, 800×360, 854×393, 915×412, 1280×720 e 1920×1080: ações com pelo menos 44 px, conteúdo acessível por rolagem e efeitos completos das armas.
- Loja real com zero fragmentos na versão corrigida: três compras desabilitadas e “Seguir viagem” focada, visível e alcançável em landscape pequeno. Em portrait, a proteção de orientação pausa a dungeon e pede rotação; não confundir com teste físico de iPhone.
- Os 13 sprites v3 carregaram na seleção de Lendas; Iara v3 e NPCs foram inspecionados na Guilda e Iara na dungeon. A seleção mantém repouso estático conforme o CSS existente; animações de ação pertencem ao jogo.
- Não foram encontrados avisos/erros de console no ciclo local completo observado.

## Publicação e builds

Este registro é criado **antes** de enviar e publicar a revisão. Confirmar a revisão exata e as conclusões dos novos jobs no GitHub Actions; não tratar este texto como evidência de sucesso remoto futuro.

- A publicação web requer o gate completo e inspeção do deploy exato. Auto-deploy Vercel permanece desabilitado.
- Alterações em `mobile/` e `desktop/` acionam builds reais Android, iOS Simulator, Windows e Linux. APK com assinatura incompatível deve preservar o download oficial.
- Apple nesta execução: **PWA via Safari → Adicionar à Tela de Início**. Não executar App Store/TestFlight nem workflows Apple assinados. O build de simulador é permitido e não representa instalação física.
- Não houve teste físico de APK, EXE, AppImage ou PWA instalada em iPhone/iPad nesta rodada. Não declarar assinatura, instalação ou certificação sem evidência.

## Trabalho ainda necessário

1. Estabilidade: concluir auditoria de leaks/FPS, joystick e multitoque reais, dash, orientação/safe areas nativas, checkpoint/retry/reconexão e persistência autenticada. Montanhas Rúnicas ainda precisa de percurso completo real.
2. Arte: a base de atores v3 **não conclui a fase visual**. Fazer passes próprios de inimigos, elites, minibosses e bosses com poses, ataques e transições; depois retratos/fallbacks, armas/objetos, três biomas, Guilda, UI e VFX. Rever escala, personalidade, anatomia e qualidade no tamanho real do jogo.
3. Conteúdo/progressão: revisar as 26 habilidades, variedade e balanceamento de armas/reliquias/loot, encontros e economia do servidor. Um loot comum repetido no fim da Mata foi observado; avaliar a recompensa do boss no contexto do balanceamento, sem inventar raridades no cliente.
4. Cooperativo/distribuição: testar dois clientes reais, host/membros, mortes, reconexão e extração autoritativa; conferir builds e downloads finais e testar instalação/atualização em dispositivos reais quando disponíveis.

## Estudos preservados

O stash `Folklard original sprite atlas studies and art continuity pending QA` preserva estudos v2 rejeitados e trabalho anterior. **Não aplicar o stash inteiro sobre a base v3**: conflita com carregador, cena e direção de arte atual. Extrair somente itens úteis após revisão. Não apagar estudos antes de preservar o material necessário.
