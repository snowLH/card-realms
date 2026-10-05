# Handoff técnico para o art pass

## Direção de produto que deve permanecer fixa

- O jogador cria e personaliza o próprio avatar no Ateliê. O mesmo `AvatarConfig` aparece na Guilda, na exploração e nos combates.
- Cada personagem entra em combate com exatamente dois poderes folclóricos equipados. As cartas são adquiridas e escolhidas no Arquivo da Guilda.
- Armas e armaduras são obtidas nas dungeons. Buffs são temporários da dungeon. A Guilda não vende equipamento que altere combate.
- Criaturas do folclore são poderes, inimigos ou conteúdo de coleção; não são uma equipe controlável nem apoiadores em combate. Não criar slots, comandos, sprites auxiliares ou animações de troca de apoiador.
- A apresentação existente de cartas, elementos e terreno continua como parte do jogo. O art pass pode renovar imagens e animações sem alterar autoridade, dano, custo, cooldown, loot ou contratos de rede.

## Fronteiras de código

| Área | Responsabilidade | Ponto de entrada |
| --- | --- | --- |
| Manifesto Phaser | Paths, texturas, frames, escalas e ciclos de animação substituíveis | `src/game/arpg/assets.ts` |
| Configuração do render | Canvas lógico, escala, antialias e pixel snapping | `src/game/arpg/runtime/render-config.ts` |
| Avatar e animações | Folha do Cartógrafo configurada pelo avatar e estados do sprite | `src/game/arpg/runtime/player-sprites.ts` |
| Inimigos | Perfil de textura, escala e animações por tipo | `src/game/arpg/runtime/enemy-sprites.ts` |
| NPCs da Guilda | Texturas e ciclos idle/working/talking/walking | `src/game/arpg/runtime/hub-scene.ts` e manifesto |
| Baú | Frames, alinhamento ao chão e animação de abertura | `src/game/arpg/runtime/treasure-chest-sprites.ts` |
| Dungeon | Mundo 2D, objetos, inimigos, loot, porta e extração | `src/game/arpg/runtime/dungeon-scene.ts`, `src/game/arpg/runtime/dungeon-world.ts` |
| Lobby | Guilda e estações do jogador | `src/game/arpg/runtime/hub-scene.ts`, `src/components/game/game-shell.tsx` |
| Combate por cartas | Avatar, dois poderes, energia, efeitos, terreno e apresentação | `src/game/battle/`, `src/game/pvp/`, `src/components/game/battle-arena.tsx` |
| Raid | Estado e rotas específicos da Raid; preserve a distinção de runtime, nunca volte a exigir equipe de seis | `src/game/raid/`, `src/game/arpg/raid/`, `src/app/api/raids/`, `src/app/api/arpg/raids/` |

## Contrato de arte e animação

- A viewport lógica do jogo é 1280×720; a escala ajusta à tela com FIT/CENTER. Preserve pixels nítidos (`pixelArt`, `antialias: false`, `roundPixels: true`) e valide desktop, landscape mobile e portrait com a tela de rotação existente.
- Atualize imagens, frames, nomes e dimensões no manifesto em `src/game/arpg/assets.ts`; dungeon e Guilda devem carregar e registrar as animações por esse catálogo. Não espalhe novos paths `/art/` pelos módulos de gameplay.
- Preserve baseline e footprint de colisão independentes das áreas transparentes do sprite. Alterações de dimensões precisam manter a navegação, portas, baús, drops e colisões.
- Estados existentes incluem idle, walk, attack, hit, dodge, interact, victory e ko para o Cartógrafo; inimigos têm idle, walk, attack e defeat. Baú tem closed/open. O art pass pode criar variações de frames desde que mantenha o contrato de estado e a ordem documentada no manifesto.
- Feedback de acerto e fim de batalha deve continuar ligado a estado confirmado pelo servidor. O evento visual carrega `source: "server-confirmed"`, `roomId`, `actionId` e `revision`; não antecipar VFX de acerto/vitória antes da resposta aceita.
- Ataques críticos, dano, raridade e telegraphs devem continuar distinguíveis por forma, movimento ou texto, e não só por cor. SFX não podem ser o único sinal de uma ação.

## Conteúdo e telas

- O jogador controla um Cartógrafo próprio. O HUD mostra vida/armadura, arma, equipamento e exatamente duas cartas de poder.
- O Arquivo mostra poderes comprados/equipados; o Ateliê altera somente aparência; o Mercador pode tratar cosméticos sem vender armas/armaduras de combate.
- A dungeon concede armas/armaduras e buffs temporários nos sistemas de loot existentes. Preserve raridade, ícones e feedback de saque.
- A apresentação de terreno/bioma faz parte da leitura do tabuleiro e das dungeons. Cada bioma tem paleta e tiles existentes em `docs/ART_BIBLE.md` e `docs/DUNGEON_SPEC.md`.
- `public/sw.js` mantém uma lista parcial de arquivos de arte para precache. Se houver substituição de paths ou novos assets essenciais, revisar essa lista junto do manifesto.

## Regras para o trabalho do art pass

1. Não alterar regras do jogo ou persistência para acomodar uma imagem.
2. Não reintroduzir captura, times de seis, apoiadores, powers aleatórios de dungeon ou equipamento comprado no lobby.
3. Usar assets próprios do projeto. O ZIP citado como referência não é fonte para extrair ou reutilizar imagens.
4. Ao trocar uma spritesheet, registrar no manifesto dimensões, contagem/grade, escala, origem/baseline e animações; adicionar uma verificação de existência do arquivo e um smoke visual representativo.
5. Rodar `npm run verify:deploy` antes de promover qualquer build. Alterações de banco devem ser revisadas/aplicadas somente ao staging autorizado e verificadas antes de qualquer release.

## Evidência e estado da validação

O manifesto e os eventos visuais do ARPG foram validados em 7 arquivos de teste (20 testes), lint focal e typecheck focal. A refatoração do combate clássico, PvP, Raid e fluxo de loadout passou pelo gate integrado local: typecheck, ESLint sem warnings, 292/292 testes em 59 arquivos e build Next.js 16.3.6. Essa evidência não substitui a homologação SQL/pgTAP no staging, que não está disponível na conta conectada, nem a validação em dispositivo real.

## Contrato técnico atual antes do art pass

- Combate clássico, PvP e Raid antiga usam o avatar do jogador e exatamente dois poderes. Guest usa avatar/poderes locais validados e estado assinado; conta autenticada usa o snapshot remoto. O loadout é salvo antes de abrir PvP ou batalha clássica.
- Poderes adicionais são comprados/equipados na Guilda. Armas, armaduras e buffs temporários permanecem nos sistemas de dungeon. Raid ARPG é um modo separado; salas históricas de Raid não são retomadas automaticamente.
- TeamView e a escolha obrigatória de criatura inicial não fazem parte do caminho ativo. Preservamos snapshots e RPCs antigos para compatibilidade histórica. Não adicionar slots/ações/sprites de apoiadores no art pass.
- O inventário local contém 38 migrations. pgTAP 016–019 foi contado/inspecionado estaticamente, sem execução: staging `ywawwhnsvpfeppfcuwzg` não aparece na conta Supabase conectada. A cobertura 019 ainda não exercita o backfill de rewards históricos.
