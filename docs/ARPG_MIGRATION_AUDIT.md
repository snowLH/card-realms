# Card Realms — Auditoria e Plano de Migração para ARPG

Data: 2026-10-01

## 1. Arquitetura atual encontrada

O projeto atual é um Next.js full-stack com domínio de jogo desacoplado de React, APIs próprias e Supabase como fonte de verdade online. A camada `src/game` concentra regras puras, `src/components/game` renderiza o jogo, `src/app/api` valida fronteiras HTTP e `src/server` contém operações privilegiadas.

O gameplay principal ainda é TCG por turnos: equipe de seis criaturas, energia em cartas, D6, troca, IA, PvP e Raids. O mapa regional, coleção, bestiário, avatar, refúgio, missões, amizade e progressão já são módulos separados e podem sobreviver à troca de gameplay.

## 2. Tecnologias atuais

- Next.js 16.3.6 + React 19.3 + TypeScript 5.9.
- Supabase SSR/JS, Postgres, RLS, Realtime e RPCs.
- Vitest + Testing Library.
- Framer Motion, Radix UI, Tailwind/PostCSS e CSS próprio.
- PWA parcial: manifest existente; service worker/offline shell ainda precisa ser completado.
- Vercel com Git auto-deploy desativado e gate `verify:deploy`.

## 3. Funcionalidades reaproveitáveis

Preservar: autenticação, perfis, usernames, coleção de criaturas, raridades, cinco elementos, inventário, moedas/XP, missões, conquistas, amigos, eventos, raids, mapa mundial/regiões, avatar, refúgio, histórico, loot idempotente, Realtime, RLS, RPCs, segurança, catálogo folclórico e assets 2D.
## 4. Funcionalidades que devem ser substituídas

Substituir como gameplay principal: batalha TCG por turnos, equipe de seis durante combate, energia anexada por turno, D6 para acertar, IA por turnos, mesa de cartas como arena principal e PvP TCG como prioridade.

Esses módulos não serão apagados agora. Serão movidos para legado/compatibilidade até o ARPG assumir a rota principal e até saves antigos estarem migrados.

## 5. Arquivos principais atuais

- `src/components/game/game-shell.tsx`: orquestra menus e telas.
- `src/components/game/battle-arena.tsx`: arena TCG atual.
- `src/game/battle/*`: motor de turno legado.
- `src/game/content/*`: criaturas, regiões e expansão.
- `src/game/player/*`: snapshot remoto.
- `src/game/save/*`: save local versionado.
- `src/game/raid/*` e `src/server/raid/*`: raids atuais.
- `src/game/pvp/*` e `src/server/pvp/*`: PvP autoritativo.
- `src/lib/supabase/*`: clientes e fronteiras Supabase.
- `supabase/migrations/*`: schema, RLS, RPCs e catálogo.

## 6. Estrutura do Supabase

O banco já possui perfis, catálogo de criaturas, instâncias possuídas, equipes, progresso mundial, inventário, energias, missões, conquistas, amizade, raids e tabelas autoritativas de PvP. Há funções transacionais, ledgers idempotentes e RLS. A migração ARPG deve adicionar tabelas novas para loadout, equipamentos, cartas-habilidade, runs e loot, sem apagar as tabelas antigas.
## 7. Riscos

- Perder compatibilidade com saves/coleções se a migração reutilizar IDs com outro significado.
- Misturar gameplay em tempo real com RPCs por frame e criar latência/custo desnecessário.
- Tentar reaproveitar o motor TCG dentro do ARPG e gerar acoplamento excessivo.
- Fazer o mobile depois do desktop e repetir os problemas de responsividade anteriores.
- Carregar catálogo/assets completos no bootstrap e prejudicar memória em celulares.
- Conceder loot raro confiando no cliente.
- Tentar multiplayer antes da vertical slice singleplayer estar sólida.

## 8. Plano de migração

1. Congelar o TCG como legado, sem apagá-lo.
2. Criar `src/game/arpg` como domínio e runtime independente de React/Supabase.
3. Integrar um renderer 2D próprio ao shell Next.js.
4. Construir vertical slice da Mata Encantada.
5. Implementar movimento, mira, ataque, dash, colisão e inimigos.
6. Implementar exatamente dois suportes alternáveis.
7. Converter cartas em habilidades equipáveis de quatro slots.
8. Adicionar armas, armaduras, relíquias e loot de run.
9. Persistir somente checkpoints/resultados relevantes no Supabase.
10. Integrar PWA landscape, touch e gamepad.
11. Só então migrar raids e cooperativo para o runtime novo.

## 9. Arquitetura proposta

React/Next continuará responsável por login, HUB, menus, coleção, inventário, bestiário e social. O gameplay será executado por um motor 2D integrado ao projeto, com loop próprio de atualização/renderização e estado de run local. Supabase confirma inventário permanente, recompensas e eventos, nunca posição por frame.
## 10. Estrutura de pastas proposta

```text
src/game/arpg/
  domain/        tipos estáveis, stats, elementos e contratos
  content/       armas, armaduras, cartas, suportes, inimigos e salas
  runtime/       loop, cenas, colisão, combate, projéteis e pooling
  dungeon/       grafo da run, salas e geração
  input/         teclado, mouse, touch e gamepad
  persistence/   DTOs de checkpoint/resultado
src/components/arpg/
  arpg-game.tsx
  landscape-gate.tsx
  touch-controls.tsx
  run-hud.tsx
src/app/api/arpg/
  run/start, run/finish, rewards
```

O motor TCG atual permanece em `src/game/battle` durante a transição e será marcado como legado quando o ARPG cobrir o fluxo principal.

## 11. Plano do MVP — vertical slice Mata Encantada

Entregável mínimo jogável: personagem top-down, WASD/mira, ataque, dash, controles touch landscape, Curupira + Boitatá como dois suportes alternáveis, quatro cartas-habilidade, três armas, três armaduras, inimigos comuns, elite, mini boss, Curupira Ancestral, salas conectadas, baú, loot, inventário, retorno ao HUB, save e PWA.

A ordem prática será: runtime → input → combate → inimigos → dungeon → suportes → cartas → equipamentos → loot → boss → persistência → PWA → performance/polimento.

## Decisão técnica inicial

Usar Phaser como runtime 2D integrado ao Next.js, carregado somente no cliente e somente ao entrar no gameplay. React não movimentará entidades por DOM; React será overlay/HUD e shell. O runtime ARPG não importará Supabase diretamente: persistência passa por contratos estreitos e APIs/RPCs idempotentes.
## 12. Estado implementado em 2026-10-01

A vertical slice da Mata Encantada foi concluída sobre Phaser e integrada ao HUB. O runtime suporta teclado/mouse, touch landscape e gamepad, movimento, mira, ataque, dash, dois suportes alternáveis, quatro cartas-habilidade, cinco salas, loot, baús, armas, armaduras, boss e retorno ao HUB.

O Arsenal ARPG substituiu a equipe de seis criaturas no fluxo principal sem apagar o TCG legado. O loadout usa 1 arma, 1 armadura, 2 suportes e 4 cartas-habilidade; a posse de equipamento é normalizada no cliente e validada novamente no servidor.

A PWA possui manifest landscape, service worker para assets estáticos e CTA de instalação. HTML autenticado e `/api/*` não entram no cache do service worker.

O runtime foi generalizado em `runtime/dungeon-scene.ts`: movimento, combate, pooling, HUD, baús e input são compartilhados, enquanto cada expedição fornece inimigos, ondas, sprites, cenário, loot, cores e mensagens por configuração.

A segunda dungeon, Arquipélago das Marés, está jogável com Boto-cor-de-rosa, Kappa, Kelpie, Ahuízotl e Iara das Profundezas. Um smoke automatizado completou as cinco salas, abriu quatro baús e derrotou a Iara.

### Persistência e segurança

Runs recebem token assinado com `GAME_ACTION_SECRET` e ID de expedição. A API rejeita expedição incompatível com o token e vitórias impossíveis em menos de 15 segundos. Visitantes nunca alteram progresso permanente.

A migration `20261001225950_arpg_multi_expedition_rewards.sql` adiciona first-clear idempotente por expedição. Mata Encantada concede apenas itens normais previstos pelo servidor; Arquipélago concede Lâmina das Marés, Armadura de Conchas e Arco Ribeirinho. Os equipamentos épicos Cajado do Canto da Iara e Armadura do Ahuízotl ficam fora da concessão automática.

A migration também amplia a validação server-side do Arsenal para os equipamentos do Arquipélago. O cliente autenticado continua sem permissão de conceder loot a si mesmo.

### Validação atual

O projeto possui `npm run verify:deploy`, que executa typecheck, ESLint, Vitest e build de produção antes de qualquer deploy. O Arquipélago foi validado em 844×390 sem overflow e uma run completa automatizada terminou com vitória na sala 5.

As migrations ARPG ainda precisam ser aplicadas e homologadas em um Supabase de staging antes de publicar o código que depende delas. A máquina local atual não possui Docker/Podman nem projeto Supabase local linkado, portanto essa validação SQL não deve ser considerada concluída até o staging.
