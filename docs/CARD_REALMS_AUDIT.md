# FASE 1 — AUDITORIA COMPLETA DO REPOSITÓRIO (CARD REALMS)

Data da auditoria: `2026-11-01`  
Objetivo: Mapear todo o repositório atual antes da reformulação profunda para **Card Realms — Jogo Digital de Estratégia, Cartas e Tabuleiro Vivo**, classificando cada subsistema em **🟢 MANTER**, **🟡 REAPROVEITAR OU REFAZER** e **🔴 ARQUIVAR**.

---

## 1. Diagnóstico Geral do Estado Atual

1. **Saúde Técnica do Repositório**:
   - `npm run typecheck` (`tsc --noEmit`) passa sem erros.
   - A suíte de testes (`vitest run`) conta com **127 arquivos de teste (663 testes)** passando integralmente.
   - O projeto utiliza **Next.js 16.4**, **React 19.3**, **Phaser 3.90**, **Tailwind CSS 4**, **Zod 4** e **Supabase**.
2. **Problema de Produto e Identidade Atual**:
   - O repositório havia sido convertido anteriormente para um ARPG de ação em tempo real estilo *dungeon crawler* (`Folklard`), onde o jogador controla um único avatar com `WASD` em salas procedurais (`src/game/arpg/runtime/dungeon-scene.ts`).
   - Essa direção de ARPG em tempo real diverge da missão central do projeto: **Card Realms**, um jogo estratégico de cartas e **tabuleiro vivo inclinado (2.5D)** onde culturas do mundo (começando por **🇧🇷 Folclore Brasileiro** vs **🇯🇵 Folclore Japonês**) constroem territórios, invocam criaturas que ganham presença física sobre as cartas no tabuleiro, erguem estruturas, disparam eventos climáticos e escolhem a cada turno entre **⚔️ Investida (Atacar)** ou **🔮 Despertar Ancestral (Poder)** para destruir o **👑 Coração do Reino** adversário.
3. **Política de Arte e Qualidade Visual Existente**:
   - O repositório já possui uma excelente infraestrutura de **arte autoral em pixel art coesa** (`src/game/arpg/art/manifest.ts`, `public/art/*-v5.webp`, `src/game/content/character-portraits.ts`) e um teste automatizado rigoroso (`src/game/arpg/art/visible-procedural-art.test.ts`) que proíbe geometria improvisada (`Graphics`, `fillRect`, gradientes CSS, SVGs soltos) em código de produção.
   - As folhas de personagem `v5` (baseadas na referência da Naturalista em `docs/folklard-character-style-reference.png`) possuem 24 poses animadas em grade lógica de 64px (`idle`, `walk`, `attack`, `shoot/cast`, `damage`, `defeat`) e cobrem lendas chave como **Curupira**, **Iara**, **Boto**, **Mapinguari**, **Kappa**, **Raijū**, além de retratos `v5` consistentes no catálogo para **Saci-Pererê**, **Boitatá**, **Kitsune**, **Oni**, **Tengu**, entre outros.

---

## 2. Classificação dos Sistemas Existentes

### 🟢 MANTER (Código e Infraestrutura Reutilizáveis Diretamente)

| Módulo / Caminho | Função Atual | Como Será Usado no Novo Card Realms |
| :--- | :--- | :--- |
| `src/lib/supabase/*`, `src/proxy.ts`, `src/components/auth/*` | Autenticação Supabase, sessão SSR/client e diálogo de login. | Mantido integralmente para login de conta e persistência do estrategista. |
| `src/server/player/progress.ts`, `src/game/player/*`, `src/game/save/local-progress.ts` | Bootstrap de progresso remoto (Supabase) e progresso local (`localStorage` v4 com validação Zod). | Mantido integralmente; continuará salvando moedas, XP, nível e coleção sem quebrar compatibilidade com o banco de dados. |
| `src/game/arpg/art/manifest.ts`, `src/game/arpg/art/runtime-art.ts`, `src/game/arpg/art/health-bar.ts` | Manifesto central de atlases (`fx`, `props`, `ui`, `world`), tilesets de bioma (`mata-tiles`, `mares-tiles`, `runic-tiles`), barras de vida e camadas de efeito no Phaser. | Base visual coesa para renderizar os terrenos vivos, estruturas, efeitos de invocação, projéteis, impactos e molduras nine-slice no tabuleiro Phaser. |
| `src/game/content/character-portraits.ts`, `src/game/arpg/runtime/legend-sprite-sheets.ts` | Coordenadas dos retratos `v5` e folhas de sprites animados `v5` (24 frames). | Usados nas cartas da mão e na **materialização física animada** das criaturas sobre os territórios do tabuleiro. |
| `src/components/ui/*` (`art-sprite.tsx`, `pixel-icon.tsx`, `dialog.tsx`, `button.tsx`, `badge.tsx`), `src/app/authored-art.css` | Componentes visuais baseados em fatias de atlas pixel art e ícones padronizados. | Usados em toda a interface tática da partida, mão de cartas, inspetor de território e seleção de deck. |
| `src/components/pwa/*`, `src/app/offline/*`, `src/app/instalar/*`, `src/lib/native-app.ts` | Suporte PWA, modo offline e empacotamento Capacitor (PC/Android). | Mantido para permitir partidas locais/offline no navegador e dispositivos móveis. |
| `src/components/game/collection-view.tsx`, `src/components/game/profile-view.tsx`, `src/components/game/refuge-view.tsx` | Enciclopédia Cultural (Bestiário), Perfil do Jogador e Refúgio. | Mantidos como telas de consulta cultural e progressão acessíveis pelo menu. |

---

### 🟡 REAPROVEITAR OU REFAZER (Adaptar para o Tabuleiro Vivo de Card Realms)

| Módulo / Caminho | Estado Atual | Plano de Reformulação |
| :--- | :--- | :--- |
| `src/components/game/game-shell.tsx` | Casca de navegação apontando para a Guilda ARPG e dungeons WASD como fluxo principal. | Adaptar para que a experiência principal seja o **Tabuleiro Vivo de Card Realms** (Partida Demonstrativa Guiada, Duelo vs IA Estrategista, Duelo Local 2 Jogadores e Grimório de Cartas), mantendo compatibilidade com os testes de navegação existentes. |
| `src/components/game/title-screen.tsx` | Apresenta o jogo como "Folklard — ARPG de masmorras". | Atualizar identidade visual e textual para **Card Realms — Lendas & Territórios**, destacando a batalha estratégica de cartas e tabuleiro vivo (mantendo controles de áudio, login e acessibilidade testados). |
| `src/app/guia/page.tsx` | Descreve controles WASD e salas de masmorra. | Atualizar para documentar também o sistema de **Tabuleiro Vivo de Card Realms**, os **4 Territórios**, as **4 Categorias de Cartas** (Território, Lenda, Estrutura, Evento), a escolha tática **⚔️ Investida vs 🔮 Despertar Ancestral** e o **👑 Coração do Reino**. |
| `src/game/arpg/runtime/arpg-audio.ts`, `sound-preference.ts` | Sintetizador Web Audio procedural por bioma e preferência de som compartilhada. | Reaproveitar `sound-preference.ts` e criar um módulo dedicado `src/game/card-realms/runtime/audio.ts` com trilhas e efeitos sonoros táticos para compra de carta, encaixe de terreno, ritual de invocação, despertar de poder, colisão de combate e dano ao Coração do Reino. |
| `src/game/content/creatures/*` | Catálogo rico de lendas com notas históricas e referências folclóricas do Brasil e do Japão. | Reaproveitar a curadoria folclórica para construir a **Vertical Slice** de **🇧🇷 Brasil vs 🇯🇵 Japão** em `src/game/card-realms/content/`. |

---

### 🔴 ARQUIVAR / CONGELAR (Não Expandir — Antigo Loop ARPG em Tempo Real)

| Módulo / Caminho | Motivo do Congelamento | Ação |
| :--- | :--- | :--- |
| `src/game/arpg/dungeon/*`, `src/game/arpg/runtime/dungeon-scene.ts`, `src/components/arpg/arpg-game.tsx` | Masmorras procedurais de ação em tempo real com controle WASD e mira de projéteis. | **Congelado/Arquivado**: Não receberá novas features nem será a experiência principal do jogador. Os arquivos permanecem no repositório para não quebrar rotas de API legadas ou testes de regressão de infraestrutura, mas o fluxo principal passa a ser `src/game/card-realms/`. |
| `src/game/arpg/coop-dungeon/*`, `src/game/arpg/raid/*`, `src/components/arpg/arpg-raid-arena.tsx` | Raids cooperativas de ação top-down. | **Congelado/Arquivado**: Mantido apenas para integridade de testes existentes; fora do foco da Vertical Slice de Card Realms. |
| `src/game/arpg/bosses/*` | Padrões de bullet-hell em tempo real. | **Congelado/Arquivado**: Substituído na experiência principal pelo conflito estratégico de reinos e destruição física do **👑 Coração do Reino** no tabuleiro. |

---

## 3. Conclusão da Auditoria e Próximo Passo

- A base de engenharia (Next.js, TypeScript estrito, testes Vitest, persistência Supabase/Local e biblioteca de pixel art autoral `v5`) é sólida e 100% funcional.
- O novo núcleo do jogo será construído de forma **totalmente desacoplada, pura e testável** dentro de `src/game/card-realms/`, dividido em:
  - `domain/` (regras de cartas, criaturas, territórios, jogadores e partida)
  - `board/` (estado do tabuleiro de 4 faixas, sistema de terrenos dinâmicos, posicionamento e efeitos de campo)
  - `gameplay/` (sistema de turnos, combate, habilidades de Despertar Ancestral, eventos climáticos, condição de vitória e IA tática)
  - `content/` (culturas Brasil e Japão, cartas da Vertical Slice e decks iniciais/demonstrativos)
  - `runtime/` (tabuleiro Phaser 2.5D inclinado, coreografia de invocação em 10 etapas, câmera tática, partículas de terreno vivo, áudio e input)
- A próxima etapa obrigatória antes do código é a **FASE 2 — DOCUMENTO DE DESIGN (`docs/CARD_REALMS_DESIGN.md`)**.
