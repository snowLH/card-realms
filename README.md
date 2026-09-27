# Card Realms — Mundo dos Colecionadores

RPG 2D de cartas colecionáveis para navegador, mobile-first, baseado em criaturas de folclores e mitologias reais. Esta versão consolida a fundação do protótipo original sem descartar seus mapas, arena, refúgio, autenticação e direção de interface.

## Regras centrais

- Existem exatamente cinco elementos: Fogo, Água, Natureza, Tempestade e Espírito.
- Cada lado leva exatamente seis criaturas; uma fica ativa e cinco permanecem disponíveis para troca.
- Energia é um baralho de 30 cartas (seis por elemento), com mão inicial de cinco, compra e descarte.
- Cada turno permite até duas anexações de energia e uma ação principal: atacar, trocar ou passar.
- Troca voluntária consome a ação principal e encerra o turno. Troca após derrota é uma fase obrigatória e não consome a ação do novo turno.
- Ataques consomem as energias anexadas mesmo quando o D6 falha. Defesa, velocidade, crítico, escudo, afinidade elemental e efeitos de status participam do cálculo.
- O ciclo de vantagem é: Fogo → Natureza → Espírito → Tempestade → Água → Fogo.

## O que funciona

- mapa com posição persistida do jogador e viagem apenas entre regiões vizinhas;
- batalha completa contra NPC, com motor autoritativo no servidor e IA baseada na mão, custo, chance de acerto e afinidade;
- 25 seres de tradições reais, cada um com nome, origem, nota de fonte, adaptação, atributos, golpes e sprite próprio;
- save local v2 validado por Zod e migração segura do save demonstrativo anterior;
- token de batalha opaco e autenticado com AES-256-GCM;
- coleção, equipe, perfil e refúgio responsivos;
- autenticação Supabase e snapshot remoto para perfil, coleção, equipe, energias, inventário, mundo, missões, conquistas, casa e histórico;
- mutações remotas transacionais para viagem, tesouro idempotente e ativação de equipe;
- fundação PVP com desafios entre amigos, snapshot de equipes, ações versionadas/idempotentes, projeção que oculta a mão adversária e atualização por Realtime com polling de recuperação;
- testes do motor, dos turnos, da IA, dos efeitos e do save.

O modo visitante continua usando o save local v2. Quando há conta e schema compatível, Supabase passa a ser a fonte de verdade e o armazenamento do navegador vira apenas cache de emergência. Sem credenciais válidas, o jogo informa o fallback em vez de simular sincronização.

O PVP ainda **não está homologado como concluído**: as migrations precisam ser aplicadas em um projeto Supabase e o fluxo completo precisa passar em duas sessões autenticadas reais. Missões jogáveis completas, captura, editor do refúgio e o catálogo de 400+ criaturas continuam como marcos posteriores. A prevenção de replay da batalha demonstrativa contra NPC ainda é local ao processo e não é usada pelo PVP persistente.

## Executar localmente

Requisitos: Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`.

Verificações:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Configurar Supabase

1. Copie `.env.example` para `.env.local` e informe a URL, a chave publicável, `SUPABASE_SECRET_KEY` somente no servidor e uma chave aleatória longa em `GAME_ACTION_SECRET`.
2. Aplique as migrations de `supabase/migrations/` em ordem com a CLI do Supabase.
3. Habilite os provedores desejados e cadastre `http://localhost:3000/auth/callback` no ambiente local.
4. Em produção, use o domínio real nos redirects e mantenha `SUPABASE_SECRET_KEY` exclusivamente no servidor.

As migrations movem helpers `SECURITY DEFINER` para um schema não exposto, substituem o enum antigo pelos cinco elementos, sincronizam o catálogo inicial, criam o progresso remoto e adicionam a fronteira PVP autoritativa. Aplicar a migration não substitui a homologação de RLS e duas contas em staging.

## Arquitetura

- `src/game/domain/`: contratos de elementos, criaturas e mundo;
- `src/game/content/`: dados declarativos de criaturas e regiões;
- `src/game/battle/`: estado, regras puras e planejamento da IA;
- `src/game/player/`: contrato validado do snapshot remoto;
- `src/game/pvp/`: contratos HTTP e projeção de visibilidade do duelo;
- `src/game/save/`: persistência local versionada;
- `src/app/api/battle/`: validação da fronteira HTTP e autoridade do servidor;
- `src/app/api/player/`: leitura e mutações do progresso autenticado;
- `src/app/api/pvp/`: convites, leitura de sala e confirmação de ações;
- `src/server/`: orquestração exclusiva do servidor para progresso e PVP;
- `src/components/game/`: mapa, coleção, equipe, arena e refúgio;
- `supabase/migrations/`: esquema, RLS, catálogo e endurecimento de segurança;
- `docs/TECHNICAL_AUDIT.md`: auditoria do protótipo recebido;
- `docs/ARCHITECTURE.md`: limites, invariantes e caminho de expansão.
- `docs/SUPABASE_STAGING.md`: criação do staging, migrations, secrets e roteiro de homologação A/B.

## Publicação existente

- Protótipo anterior: https://card-realms.vercel.app
- Repositório de origem: https://github.com/snowLH/card-realms

Esses endereços representam o estado anterior; esta árvore local contém a refatoração ainda não publicada.
