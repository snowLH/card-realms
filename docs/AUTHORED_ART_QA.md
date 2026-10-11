# Reforma visual: auditoria e QA

Esta entrega substitui a apresentação procedural por imagens/atlases no Phaser e na interface React. Preserva personagens v5, cenários aprovados, arenas monumentais e o ciclo compartilhado dos bosses. Arthur continua seguindo a base da Naturalista. O boss final exige todas as salas anteriores, incluindo ramificações; as assistências de QA não existem em produção.

## Escopo e auditoria reproduzível

Execute `node scripts/audit-authored-art.mjs` depois de `npm run build`. A referência anterior é `018df58456a4df21a9cf935f21d8589180e2cacc`; o resultado completo fica em [audit.json](qa/full-authored-art/audit.json).

| Medida textual | Antes | Depois |
| --- | ---: | ---: |
| Ocorrências em src + scripts + shell público offline, incluindo arquivos offline/testes | 1.384 | 23 |
| Arquivos com ocorrências | 41 | 6 |
| Ocorrências no código de produção de src | 1.368 | 2 |
| Arquivos de produção com ocorrências | 34 | 1 |

Foram removidas 1.366 ocorrências do código de produção segundo a mesma busca. Contagens textuais não equivalem a elementos desenhados: incluem comentários, receitas arquivadas e testes. As duas ocorrências restantes de produção pertencem à única máscara técnica de arco, `invisible-hazard-mask.ts`: Graphics fora da display list, explicitamente invisível, mais preenchimento usado internamente no stencil. As outras 21 ficam em scripts offline/arquivos arquivados/testes. Colisões, Zones, cálculos de distância, bounds de câmera e clipping continuam invisíveis.

O teste `visible-procedural-art.test.ts` varre todos os TS/TSX/CSS de produção e a página HTML de recuperação offline, verificando shapes, superfícies de desenho, SVG inline, gradientes, Lucide, utilitários e superfícies CSS geométricas. Os dois backplates de debug têm guards de produção conferidos pelo teste. Nenhum uso geométrico de aparência foi encontrado na auditoria final; a verificação textual complementa a inspeção das telas, sem prometer detectar qualquer implementação futura possível.

## Arte, memória e carregamento

- 221 imagens WebP novas: 4.864.190 bytes (4,64 MiB). Incluem quatro atlases, três tilesets, 192 slices, 13 imagens de compatibilidade, seis móveis e três placeholders.
- Quatro atlases com 64 frames cada (256 frames); FX tem 1024 × 1024 px, props/UI/world têm 512 × 512 px. Três folhas regionais de oito tiles de 32 px completam sete novas folhas/atlases. Nenhuma folha de personagem foi redesenhada nesta reforma.
- Armas do PR #14: original CC0 mais derivação transparente, 6.889 bytes. Total novo em public, incluindo ambas: 4.871.079 bytes. Autoria e licença estão em [LICENSES.md](../LICENSES.md).
- Quatro PNGs de origem: 11.183.505 bytes (10,67 MiB), guardados fora de public e do bundle. Exportação recorta/organiza pixels existentes com nearest neighbor e compressão lossless.
- Phaser compartilha FX/props/world e carrega somente o tileset do bioma ativo. Estimativa RGBA8 dos três atlases: 6 MiB; conjunto compartilhado com painéis, compatibilidade e placeholders: 13.141.632 bytes (12,53 MiB). Não inclui atores/cenários existentes, slices do navegador, armas, mipmaps ou overhead do driver. Não é medição de VRAM.
- A antiga folha de props de 1448 × 1086 px (6.290.112 bytes RGBA8) deixou de ser pré-carregada. Os slices CSS são solicitados conforme uso; a verificação de fallback reaproveita o cache.
- O fundo repetido da dungeon usa canvas limitado ao viewport. Pan altera a origem da textura, zoom altera escala, e somente resize altera a resolução. Não reserva mais um canvas do tamanho da dungeon monumental. O teste cobre pan/zoom/resize e limpeza de listeners.

O pacote offline completo tem 308 arquivos e aproximadamente 38,8 MB, incluindo os assets existentes. Não é baixado integralmente na instalação inicial. A instalação completa é solicitada pelo jogador; /art também entra no cache sob demanda. A tela de recuperação usa quatro imagens de UI e o placeholder, presentes no cache inicial e verificados por teste. O manifesto de instalação usa os PNGs existentes; o SVG legado não é carregado nem incluído no pacote.

## Capturas e fluxos verificados

As imagens em [qa/full-authored-art](qa/full-authored-art) foram capturadas no navegador local, sem editar a aparência. Há comparação antes/depois da [Guilda antes](qa/full-authored-art/guilda-before.png), [Guilda depois](qa/full-authored-art/guilda-after.png), [Mata antes](qa/full-authored-art/mata-before.png) e [Mata depois](qa/full-authored-art/mata-after.png).

| Área / fluxo | Evidência e resultado |
| --- | --- |
| Guilda, três biomas e Refúgio | guilda/mata/mares/montanhas/refuge-after.png; personagens, tiles, decoração e móveis por imagem |
| Loja, descanso, evento, loot, mapa e equipamento | shop/rest/event/loot/minimap-after.png; painéis por imagem, texto legível e interação funcional |
| Arthur | arthur-ward/phase3/restored/extraction-after.png; Ward, thresholds, HP zero sem despawn, restauração, saída e persistência |
| Curupira | curupira-intro/telegraphs/phase3/purification-after.png; intro, padrões regionais e purificação |
| Iara | iara-intro/phase2/phase3/skill/purification-after.png; telegraphs de água e habilidade real causando dano |
| Co-op local, dois participantes | coop-intro/ward/phase3/purification-after.png e coop-input-lock/coop-restoration.json; lock comum, fases sem duplicação, ambos na coreografia e confirmação somente após RESTORED |
| Mobile landscape, 852 × 393 | mobile-landscape/combat/reduced-motion/purification-after.png; controles touch, dash/poderes, telegraphs e purificação |
| Desktop 1280 × 720 e 1536 × 708 | desktop-1280-after.png e capturas de produção; interface sem overflow horizontal |
| Recuperação offline | offline-recovery-after.png; texturas carregadas, botão legível, retorno à página inicial e nenhum overflow horizontal |
| Falha de asset | missing-image-fallback.json; imagem de botão bloqueada localmente, variável CSS substituída por missing-texture.webp e erro registrado |

QA solo utilizou entrada/dano assistidos para alcançar os três thresholds e repetir intros/purificação. Também usou movimento, ataque, poderes, baús, portal e navegação reais. Não equivale a completar naturalmente todos os ramos em cada captura. O gate que exige todas as salas é coberto por testes de geração/progressão e permanece no fluxo publicado.

Intro longa, versão curta, reduced motion, bloqueio de movimento/ataques/poderes, HP zero mantendo o boss, liberação de input durante confirmação de save, retry e portal único foram conferidos. O save de visitante usado nos testes foi restaurado ao estado anterior ao QA; não está incluído nos artefatos.

A simulação co-op utiliza componentes e engine de produção com requests interceptados apenas para um room ID fictício, sem banco externo. Os dois participantes recebem cura auxiliar para as capturas. A confirmação é em memória e não comprova autorização de recompensa online. Testes de domínio/API/migração cobrem essa autoridade; não houve sessão online autenticada neste ambiente. O harness está em scripts/qa, fora do aplicativo de produção; a rota temporária foi removida e retorna 404 no build final.

Não foram testados aparelho físico, instalação PWA em dispositivo real ou deploy. Reduced motion e mobile foram emulados no navegador. O deploy automático da Vercel permanece desligado; nenhuma configuração de publicação foi alterada.

## Verificações finais

Os resultados das quatro verificações, bundle e medições de desempenho são registrados após o build final abaixo. Logs e JSONs indicam o escopo de cada medição; não se inferem FPS de combate ou memória total da máquina a partir de uma amostra ociosa.

Dois testes antigos excediam cinco segundos ao reunir todos os biomas ou folhas de retratos num único caso. Foram parametrizados por bioma/folha, mantendo todas as seeds, pixels, asserts e o limite de tempo. A execução completa em threads também apresentou dois timeouts de inicialização de JSDOM no Windows. A configuração agora usa forks no Windows e preserva threads no Linux CI. Os seis arquivos envolvidos passaram juntos (59 testes, 18,97 s) antes da execução completa final.

`npm run typecheck`, `npm run lint`, `npm test` e `npm run build` passaram. A suíte completa contém 121 arquivos e 641 testes. O build não inclui authored-art-qa; [production-guards.json](qa/full-authored-art/production-guards.json) registra rota 404, assistências de boss/debug ausentes mesmo com query de QA, reduced motion ativo, nenhuma imagem DOM quebrada e ausência de overflow. Testes incluem layout sem overlap, progressão até o boss, estados/padrões/purificação, unlock idempotente, migração, co-op, frames/manifesto/fallback, crop de HP, transparência das armas, cache offline e proibição de desenho visível.

## Bundle e desempenho medidos

Comparação com os JSONs anteriores preservados; o bundle corresponde à soma de todos os chunks estáticos de produção, e não à transferência inicial de uma rota. As imagens são contabilizadas separadamente.

| Bundle | Antes | Depois |
| --- | ---: | ---: |
| Chunks JS/CSS | 60 | 59 |
| Bytes sem compressão | 3.832.425 | 3.747.372 |
| Bytes com gzip | 1.071.553 | 1.024.206 |

Redução agregada: 85.053 bytes sem compressão (2,22%) e 47.347 bytes gzip (4,42%). Veja [bundle-before.json](qa/full-authored-art/bundle-before.json) e bundle em [audit.json](qa/full-authored-art/audit.json).

| Amostra ociosa de 5 s | FPS antes | FPS depois | p95 antes/depois | Heap JS antes/depois |
| --- | ---: | ---: | --- | --- |
| Guilda, 1536 × 708 | 60,03 | 60,05 | 16,9 / 16,9 ms | 30.000.048 / 22.352.449 bytes |
| Mata, 1536 × 708 | 60,19 | 60,04 | 16,8 / 16,9 ms | 31.957.345 / 40.558.966 bytes |
| Mata mobile emulada | sem baseline | 59,96 | 16,8 ms depois | 38.861.480 bytes depois |

As amostras usam requestAnimationFrame no build de produção local, sem forçar coleta de lixo. O mobile tinha viewport solicitado 852 × 393; innerHeight retornou 394 durante a medição e a captura tem 852 × 393. Touch e reduced motion foram emulados. Esse método mede cadência aproximada do navegador em repouso, sem benchmark de GPU, combate prolongado ou aparelho físico. A amostra de heap da Mata aumentou 8.601.621 bytes (8,20 MiB); a Guilda diminuiu 7.647.599 bytes (7,29 MiB). Heap varia com carregamento/GC e não mede texturas/GPU ou memória total do processo. Não se atribui essa diferença apenas à troca do fundo.

Provas: [Guilda antes](qa/full-authored-art/performance-before.json), [Guilda depois](qa/full-authored-art/performance-after.json), [Mata antes](qa/full-authored-art/mata-performance-before.json), [Mata depois](qa/full-authored-art/mata-performance-after.json), [mobile depois](qa/full-authored-art/mobile-performance-after.json) e [mobile em produção](qa/full-authored-art/mobile-production-after.png).

## Arquivos e entrega

Esta reforma altera 418 arquivos em relação a 018df58, incluindo assets, testes, fontes de exportação, documentação e 47 provas de QA (7.974.843 bytes). O PR separado contra main contém 454 arquivos porque inclui também as correções relacionadas de bosses do commit 018df58, antes pendentes no PR #16. O pack de armas do PR #14 foi integrado com sua licença e derivação transparente; não depende do merge daquele PR.

Os arquivos centrais são src/game/arpg/art/, runtime/dungeon-world.ts, dungeon-scene.ts, hub-scene.ts, bosses/*presentation*, src/components/ui/, as apresentações ARPG/co-op, src/app/authored-art.css, os estilos existentes, public/art/authored/, public/offline.html, os manifestos offline e scripts de exportação/auditoria. A lista completa por arquivo é o diff do PR.

Implementação e procedimentos para continuar: [AUTHORED_ART.md](AUTHORED_ART.md), [ASSET_MANIFEST.md](ASSET_MANIFEST.md), [CORRUPTED_LEGENDS.md](CORRUPTED_LEGENDS.md) e [simulação de co-op](../scripts/qa/README.md). Nenhum elemento visível construído por primitivas geométricas foi identificado nas áreas auditadas. Permanecem as limitações de QA online autenticado/dispositivo físico descritas acima. Não houve merge, deploy, alteração de migração externa ou mudança de configuração da Vercel.
