# Card Realms — Crônicas das Lendas (Folklard)

**Jogo digital de estratégia, cartas e campo de batalha vivo em Pixel Art 2D** para navegador, tablet e celular, onde folclores e mitologias de diferentes culturas entram em conflito. Desenvolvido em **Next.js + React + Phaser 3 + TypeScript**, com suporte a persistência local e Supabase.

A experiência principal é **Card Realms: O Tabuleiro Vivo** (`src/game/card-realms` e `src/components/card-realms`): dois reinos frente a frente em uma arena viva de 4 territórios conectados, invocando lendas folclóricas materializadas, erguendo estruturas, transformando terrenos e escolhendo a cada turno entre **Investida (Ataque)** ou **Despertar Ancestral (Poder)** para destruir o **Coração do Reino** adversário. O módulo `src/game/arpg` permanece congelado para compatibilidade histórica com snapshots e expedições legadas.

## Como jogar Card Realms — Crônicas das Lendas
- Na Tela Inicial, clique em **JOGAR** para abrir a arena do **Tabuleiro Vivo** (ou acesse **COLEÇÃO** / **PERFIL** / **CONFIGURAÇÕES**).
- Escolha entre **Jornada Guiada**, **Duelo vs IA** (4 perfis táticos determinísticos: *Estratégica*, *Agressiva*, *Defensiva* e *Adaptativa*) ou **2 Estrategistas (Local)**, e alterne entre os reinos **Brasil (Guardiões de Pindorama)** e **Japão (Império dos Espíritos Yōkai)**.
- Posicione cartas da mão (clique ou arraste com pré-visualização em tempo real) sobre os **4 Territórios conectados**:
  - **Cartas de Lenda (Criaturas)**: Materializam-se fisicamente sobre a carta no território com ritual elemental em 10 etapas, animações v5 de 24 poses (`idle`, `attack`, `awakening`, `damage`), raridades (*Comum*, *Rara*, *Épica*, *Lendária*), traços passivos, resistências e fraquezas elementais.
  - **Cartas de Território**: Transformam o bioma da faixa (*Mata Encantada*, *Rio dos Espíritos*, *Montanha Antiga*, *Terra Vulcânica*, *Reino Espiritual*, etc.) e ativam reações ambientais.
  - **Cartas de Estrutura**: Erguem santuários e torres físicas (*Altar da Clareira Viva*, *Fonte das Águas Doces*, *Portão Torii Espiritual*, *Torre de Vigia da Montanha*) que protegem a faixa e concedem auras.
  - **Cartas de Evento**: Desencadeiam fenômenos climáticos e astrais (*Enchente da Pororoca*, *Incêndio de Brasa Viva*, *Eclipse das Lendas*, *Neblina dos Espíritos*).
- A cada turno, cada criatura pronta realiza **1 ação principal**: **Investida** (ataque direto contra a faixa oposta ou Coração do Reino) ou **Despertar Ancestral** (habilidade folclórica única).
- Vença reduzindo o **Coração do Reino** adversário de 20 PV a 0 PV através dos 6 estágios visuais de deterioração.

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
