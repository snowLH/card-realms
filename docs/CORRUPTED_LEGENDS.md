# Lendas Esquecidas: encontros, autoridade e restauração

“Quando o mundo esquece uma lenda, ela esquece quem era.”

Lendas Recordadas enfrentam Lendas Esquecidas para restaurá-las. O ciclo narrativo
é **ESQUECIMENTO → FRAGMENTAÇÃO → CORRUPÇÃO → CONFRONTO → RECORDAÇÃO →
PURIFICAÇÃO → RESTAURAÇÃO**. “Não viemos destruir as histórias esquecidas.
Viemos fazê-las lembrar.”

## Implementação integrada

As três expedições usam arenas de boss de 61 × 31 tiles (1952 × 992 px).
As salas comuns mantêm seus tamanhos e células de 1344 × 896 px. Depois de criar
os ramos, o gerador liga o boss a uma sala exterior ao norte, a pelo menos três
passos do início. O layout reserva uma faixa exclusiva para a arena, com um
corredor final reto e 288 px livres entre a arena e a sala comum mais ao norte.
Não há ampliação global das células. Geração determinística, grafo, corredores,
colisão, câmera e spawns usam esse mesmo layout.

Novas runs usam `encounters-v3`. Runs salvas com seeds regionais anteriores
mantêm o grafo, a arena de 37 × 17 e as coordenadas antigas através dos templates
legados; snapshots sem `bossEncounter` continuam aceitos. Não reposicionar uma
run já salva é essencial para a recuperação de checkpoints.

Arthur substitui o encontro final de Amarok nas **Montanhas Rúnicas**. Amarok
continua no catálogo jogável e seus assets antigos permanecem disponíveis.
Curupira Ancestral e Iara das Profundezas recebem arena monumental e o ciclo
comum de restauração, conservando suas estratégias de combate regionais. A
confirmação da restauração concede sua lenda e habilidades de assinatura.

## Componentes e contratos

| Arquivo em `src/game/arpg/bosses/` | Responsabilidade |
| --- | --- |
| `boss-definition.ts` | Lore, estados, fases, arena, intro, purificação e unlock |
| `boss-encounter-controller.ts` | Máquina de estados pura e snapshot serializável |
| `boss-combat-strategies.ts` | Registro de estratégias puras de combate |
| `boss-intro-controller.ts` | Poses temporizadas da entrada |
| `cinematic-input-lock.ts` | Lock por proprietário para todas as ações do jogador |
| `boss-purification-controller.ts` | Formação, aproximação e cores por lenda ativa |
| `boss-unlocks.ts` | Validação/migração de progresso e concessão idempotente |
| `boss-presentations.ts` | Registro de apresentações Phaser específicas |
| `boss-room-art.ts` | Background, overlays, props, colisões, spawn e posição do trono |
| `boss-room-presentation.ts` | Imagens do cenário, pertencentes ao mundo e preservadas após cleanup |
| `boss-encounter-completion.ts` | Finalização idempotente por sala, após confirmação |
| `boss-encounter-runtime.ts` | Adaptador Phaser: câmera, áudio, VFX e confirmação |
| `registry.ts` | Definições e seleção por região |
| `king-arthur/` | Definição, padrões, estratégia, arte, falas e kit jogável |

O snapshot percorre somente transições adjacentes:

`INACTIVE → ROOM_ENTERED → INTRO_LOCK → AWAKENING → COMBAT → DEFEATED →
PURIFICATION → RESTORED → UNLOCK → CLEARED`.

HP zero entra em `DEFEATED`, desabilita dano e remove ataques pendentes. O ator
permanece na cena, sem o caminho normal de morte/despawn. Após 1200 ms começa a
purificação de 6500 ms. Ao chegar a `RESTORED`, `purificationVisualFinished`
devolve imediatamente input e câmera; a Scene continua funcionando durante o
save. `restorationPersisted` só ocorre após confirmação e permite
`UNLOCK/CLEARED`, abertura das portas e concessão de XP/recompensas da run.
Falha ou atraso de save produz toast e retry, sem repetir a coreografia. No
offline, uma tentativa sem resposta expira em 12 s; callbacks atrasados de
tentativas substituídas ou cenas destruídas são ignorados. No servidor, o RPC
idempotente tem limite de espera de 4 s e devolve um recibo não confirmado para
retry, preservando a prova autoritativa já gravada.

`completeBossEncounter(room, actor)` concentra destruição/null do runtime,
remoção do ator, título, efeitos, hazards e projéteis; velocidade zero, câmera
seguindo jogador, avanço procedural, sala concluída, portas abertas, um portal,
checkpoint e HUD. A proteção por ID de sala impede duplicação de XP/shards e
portal. O selo final respeita `room.state === "combat"`: concluir os pré-requisitos
não pode reabrir a conexão durante a luta ou a espera do recibo.

Ao receber o golpe final dentro de um callback de física, projéteis são
desativados e reciclados sem destruir seus bodies durante a iteração. A remoção
final ocorre no update da Scene. Isso evita uma exceção de `setVelocity` que foi
reproduzida no navegador e interrompia o ciclo após HP zero.

O lock cinematográfico zera velocidade e limpa movimento, ataque, dash,
habilidades, troca de arma e interação. A Scene continua ativa: física, câmera,
partículas, áudio, animações e heartbeats funcionam. A primeira intro leva
7000 ms. Somente quando todos já a viram, a intro dura 1800 ms e aceita voto
de skip dos participantes; unanimidade encurta a intro, e o limite de duração
evita softlock se alguém desconectar. A preferência `prefers-reduced-motion`
remove o pan gradual e reduz partículas; não há novo shake/zoom/flash.

## Arthur: combate e personagem restaurado

Fases: **O Rei Ferido** (100–70%), **Camlann Não Terminou** (70–35%) e
**O Rei Que Não Pode Ser Esquecido** (35–0%). A estratégia usa golpes frontais,
avanço curto, guarda/contra-ataque, fraqueza, fileiras espectrais, lanças,
memórias de Mordred, setores alternados e Último Juramento. Os hazards são
arcos, retângulos ou círculos, com criação, impacto, fim e dano explícitos.
Telegraphs duram pelo menos 850 ms, cooldowns e invulnerabilidade impedem dano
por quadro. Memórias alteram a apresentação; não mudam colisões escondidas.
Alvos vivos são ordenados por ID para decisões determinísticas em co-op.

Arthur inicia sentado no trono, move a mão/cabeça, acende as rachaduras,
cambaleia, apoia-se em Excalibur e assume combate. HP zero deixa a espada no
chão e Arthur de joelhos. A purificação aproxima a party em formação e liga
cada jogador à lenda por VFX de sua afinidade. As memórias de Camlann somem,
mas cicatrizes e armadura marcada permanecem. As falas são “Este não é Camlann.”
e “Então… finalmente terminou.”

O unlock concede o item de lenda e as duas habilidades no inventário real.
Arthur participa do enum, seleção, avatar/loadout e validação SQL; não pode ser
comprado para contornar a restauração. O kit utiliza a arma flutuante existente:
Corte de Camelot projeta uma lâmina espectral; Juramento da Távola cura aliados
próximos e cria proteção fixa de raio 180 px por 5 s (25% de mitigação).
Último Juramento oferece 35% de mitigação por 4 s ao atingir vida crítica,
com cooldown de 45 s. A memória desses efeitos é serializável e compartilhada
pelos motores offline, solo autoritativo e co-op.

## Save, servidor e co-op

O save adiciona arrays deduplicados com defaults seguros:
`purifiedBossIds`, `unlockedLegendIds` e `seenBossIntroIds`. Migrações antigas
e isolamento por conta são preservados. Offline, o armazenamento local deve
confirmar a escrita antes de liberar o unlock. Online, o cliente não é a fonte
de verdade e não pode conceder Arthur por flags locais.

`src/server/arpg/boss-progress.ts` usa dois RPCs **service-role only**:
`get_corrupted_legend_progress` e `record_corrupted_legend_progress`.
O último recebe o usuário e o escopo da run/sala, sem HP, timers ou boss ID do
cliente. A transação consulta a prova autoritativa já salva, valida propriedade,
boss da região, participação, estado restaurado e duração da purificação. Em
co-op somente membros elegíveis segundo a contribuição existente recebem
inventário. A party compartilha intro, fases, derrota e purificação. Replays,
CAS, reconnect e retries não duplicam o unlock nem a quantidade dos itens.

`player_boss_progress` tem RLS de leitura do próprio usuário e escrita somente
pelo serviço. O checkpoint ignora tentativa de injetar boss state e não permite
trocar loadout durante lock. O servidor calcula movimento, dano, hazards e
coreografia durante o lock; não aceita ações ofensivas dos clientes.

O ambiente online precisa da migração existente
`supabase/migrations/20261010004944_corrupted_legend_restoration.sql`. Os testes
executam suas funções, permissões, prova de autoridade, loadout e idempotência
em PostgreSQL local via PGlite. Este passe de correção não adiciona ou altera
migrações. Se a função estiver ausente em um ambiente, o servidor retém o unlock
para retry, com movimento liberado após a purificação. Nenhum deploy ou ajuste
de configuração Vercel faz parte deste passe.

## Adicionar a próxima Lenda Esquecida

1. Criar `<boss>/definition.ts` com ID estável, fases, tempos, falas e o
   `playableLegendId` apenas se houver uma lenda jogável de fato.
2. Registrar a definição em `registry.ts` e escolher a região. Não criar
   condicionais por boss em `DungeonScene`.
3. Implementar padrões e estratégia pura em `<boss>/patterns.ts`/`combat.ts`;
   registrar em `boss-combat-strategies.ts`. Receber snapshot, clock, jogadores
   e limites da arena, sem Phaser, timers locais, aleatoriedade não determinística
   ou escrita de save. Hazards precisam antecipar exatamente a área de dano.
4. Registrar uma apresentação e suas folhas em `boss-presentations.ts`; o preload
   carrega os assets registrados. Compartilhar a seleção de pose com o co-op em
   `src/components/arpg/boss-encounter-view.tsx`, como `king-arthur/art.ts`.
   Usar a base v5 da Naturalista e o exportador comum. Registrar a arte de arena
   em `BOSS_ROOM_ART`: background de 1952 × 992, foreground/props opcionais,
   colisões em pixels locais alinhadas a tiles de 32, spawn e thronePosition.
   O preload carrega todas as imagens declaradas; Phaser e co-op usam o mesmo
   background, e os motores compartilham a posição do trono. O builder de tiles
   lê as colisões do boss da região. Preservar a abertura sul de três tiles e
   um centro livre para esquiva. Não desenhar árvores, tronos, mesas ou ruínas
   com Graphics; reservar Graphics para telegraphs, partículas, magia e sombras.
5. Para novo personagem jogável, atualizar enum/catálogo, habilidades, sprite
   manifest, avatar e loadout. Criar **nova migração SQL** com a allowlist
   região/boss, IDs de inventário e assinatura das habilidades. Nunca editar uma
   migração já aplicada ou confiar em IDs de recompensa enviados pelo cliente.
6. Documentar autoria, fonte, licença e uso da arte em `ASSET_MANIFEST.md` e
   `public/art/licenses/`; preservar o footprint 64px e armas flutuantes.
7. Adicionar testes de thresholds, telegraphs, estados, morte evitada, confirmação,
   migração, replay/reconnect e party. Executar typecheck, lint, testes e build;
   verificar intro/skip, purificação, persistência, mobile e reduced motion.

## Evidência e limites da verificação

Foram aprovados `npm run typecheck`, `npm run lint`, `npm test` e
`npm run build`. A suíte atual tem 605 testes em 116 arquivos; cobre 900 layouts nas
três regiões, estados, thresholds, HP zero, save antigo, intro/skip, co-op de
dois/quatro participantes e seis testes que executam a migração SQL real.

QA no navegador local confirmou arena 61 × 31, primeira intro, intro repetida
e skip, movimento bloqueado com Scene ativa, ataques reais, três fases,
ajoelhar/soltar espada, purificação, unlock gravado, seleção após reload e
kit jogável com arma flutuante. A verificação usa o auxiliar de desenvolvimento
`?debugDungeon=1&bossQA=1` para chegar ao boss sem repetir todas as salas e
aplicar dano entre fases. Ele só existe em development e somente no motor
offline; não é um controle de dano disponível em produção/servidor.

A revisão das folhas v5 conferiu Arthur jogável, o boss sentado no trono,
combate nas três fases, ajoelhar vivo, purificação e restauração no navegador
local, incluindo reduced motion. Nenhum erro de console foi registrado.
Os testes também validam as oito poses da intro completa/curta e o mesmo
atlas/quadro no co-op após serialização/reconexão.

Co-op foi validado por simulação do motor autoritativo e transações SQL, sem
uma lobby online com contas/dispositivos reais, pois não havia ambiente
Supabase autenticado nesta execução. A UI co-op existente apresenta a arena
inteira com poses do mesmo atlas v5 e hazards SVG; o pan da câmera é específico
do runtime Phaser. Arthur usa a base da Naturalista no boss, no personagem
jogável e no co-op, com fontes de geração arquivadas e exportação reproduzível.
As três arenas agora usam arte original em WebP lossless e paleta de 128 cores,
com pixels lógicos de 2 × 2. O mundo mantém as imagens quando o encontro é
destruído; a purificação remove o tint de corrupção, recuperando a paleta sem
apagar cicatrizes ou ruínas. Prompts, exportação e licença estão documentados em
`boss-room-art-prompts.md` e `public/art/licenses/boss-room-original-art.txt`.
Balanceamento e animações ainda merecem uma rodada de playtest humano.

O passe de correção de arte/HUD/pós-boss está registrado em
[BOSS_ROOM_QA.md](BOSS_ROOM_QA.md), com screenshots reais em 1536 × 708,
falha/atraso de save e limites explícitos da verificação.


## Regra de progressão final da dungeon

Em dungeons `encounters-v3`, a Lenda Esquecida é sempre o confronto final. A conexão física para a arena monumental permanece selada até **todas as outras salas geradas** estarem em estado `cleared`. Isso inclui ramificações, salas de combate, elite, tesouro e encontros especiais; o jogador pode voltar livremente para concluir o que deixou para trás. Checkpoints legados mantêm a rota histórica para evitar soft-lock.

No cooperativo, a sequência compartilhada já visita todas as salas uma única vez e coloca o boss por último. No modo procedural, `boss-access.ts`, `DungeonManager` e o selo direcional do `DungeonWorldRuntime` aplicam a mesma regra.

## Lendas restauradas por região

- Mata Encantada: **Curupira Ancestral — O Guardião que Esqueceu a Floresta** → restaura Curupira.
- Arquipélago das Marés: **Iara das Profundezas — A Canção que Ninguém Mais Ouve** → desbloqueia Iara e seus dois poderes de assinatura.
- Montanhas Rúnicas: **Rei Arthur — O Rei que se Recusou a Terminar** → desbloqueia Rei Arthur e seus dois poderes de assinatura.

Os três usam a mesma máquina de estados de introdução, combate, derrota sem morte, purificação, restauração e confirmação persistente. A arte regional reutiliza os sprites pixel-art v5 já licenciados do projeto; Arthur mantém sua apresentação dedicada de Camelot.
