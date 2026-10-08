# Folklard — Crônicas de Aurória

**Roguelite de ação 2D para navegador e celulares**, com heróis e criaturas de folclores do mundo. Desenvolvido em **Next.js + React + Phaser + TypeScript**, com autenticação, salvamento online e modos cooperativos apoiados por Supabase.

O projeto surgiu como Card Realms (cartas por turnos), mas **o gameplay atual é o ARPG em tempo real**. Os modos TCG/PvP clássicos e a loja de energias antigas foram retirados da navegação; módulos internos de compatibilidade permanecem até que a migração dos dados históricos seja segura.

## Como jogar
- Comece na Guilda, selecione uma lenda folclórica e equipe **dois poderes de assinatura**.
- Entre numa expedição; dungeons de **8 a 12 salas** são montadas por seed com caminhos, encontros, salas especiais, baús, elites e boss final.
- Use WASD/mouse, gamepad ou touch landscape para **mover, mirar, atacar, desviar e trocar armas**. Em botões móveis a mira prioriza inimigos visíveis, nunca através de obstáculos.
- Encontre armas e melhorias na run, vença o chefe e atravesse o portal de extração.
- Progresso de visitante é salvo no navegador. Com conta, recompensas e inventário permanentes exigem confirmação do servidor.

## Conteúdo atualmente estruturado
- **13 lendas jogáveis**, incluindo Curupira, Iara, Kappa, Raijū, Amarok, Kelpie e Yeti, com poderes únicos.
- Três biomas: **Mata Encantada**, **Arquipélago das Marés** e **Montanhas Rúnicas**.
- Inimigos de funções diferentes (corpo a corpo, disparo, magia, investida, elite) e padrões especiais de boss.
- Guilda explorável, Arsenal, bestiário, relíquias, cartas-poder, equipamentos, Mercador de itens/cosméticos, Refúgio, mapa e Raids ARPG cooperativas.
- Dungeon procedural com checkpoints, combate validado para contas autenticadas, loot e portal final.
- PWA, áudio, controles móveis e opções de pausa.

Alguns recursos dependentes de Supabase ainda requerem homologação real em staging e dispositivo físico. **Build/testes automatizados não comprovam sozinhos a qualidade da jogabilidade nem a segurança de um banco de produção não verificado.**

## Executar localmente

Requer Node.js 22+.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`.

```bash
npm run verify:deploy
```

O comando executa typecheck, ESLint, Vitest e build de produção. Scripts de smoke em `scripts/arpg-*.mjs` ajudam a testar runs e PWA com browser local.

## Estrutura do projeto

| Diretório | Papel |
| --- | --- |
| `src/game/arpg/content` | Definições de lendas, poderes, armas, biomas, inimigos, loot |
| `src/game/arpg/dungeon` | RNG, grafo, geração de sala, combate autoritativo, checkpoint |
| `src/game/arpg/runtime` | Phaser, controle, projéteis, mira, câmera, hub e áudio |
| `src/components/arpg` | HUD, controles touch e sobreposição React |
| `src/components/game/game-shell.tsx` | Navegação e fluxo de conta |
| `src/app/api/arpg` e `src/server/arpg` | APIs, validação e autoridade online |
| `src/lib/supabase`, `supabase/migrations` | Identidade, RLS, RPCs e dados persistentes |
| `public/art` | Assets autorais do projeto, não de jogos de referência |
| `docs/ART_PASS_HANDOFF.md` | Contrato visual para Work |

## Produção e dados
- Site publicado anteriormente: https://card-realms.vercel.app
- Código: https://github.com/snowLH/card-realms
- A `main` é a branch ativa. **Commits não significam deploy automático.** O projeto mantém auto-deploy desabilitado; validar o gate antes de promover.
- Os ambientes Supabase de produção e staging não devem ser misturados. Nunca expor secrets no cliente.

## Referências de design
O ritmo de ação e a exploração em salas têm inspiração genérica em roguelites como Soul Knight; **personagens, arte, níveis, áudio e implementação devem ser originais**.
