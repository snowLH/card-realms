# Auditoria técnica — 26 de setembro de 2026

## Resumo executivo

O protótipo é uma aplicação Next.js 16/React 19, mobile-first, com Tailwind CSS 4, componentes shadcn/Radix, animações Framer Motion, motor de batalha TypeScript, Vitest e uma fundação Supabase/Postgres. O ciclo demonstrativo compila, passa nos sete testes existentes e produz build de produção.

A base visual de mapa, arena e refúgio é aproveitável. O maior risco não está na renderização: está no desacoplamento entre o que a interface promete e o que as regras realmente executam. O projeto original usa sete elementos, nomes de criaturas inventados, energia escolhida livremente em vez de comprada como carta, atributos sem efeito e estados de combate declarados mas nunca processados. O banco também descreve sistemas ainda não conectados ao jogo.

## Arquitetura encontrada

- `src/app`: App Router, manifesto PWA, callback de autenticação e uma única rota de batalha.
- `src/components/game`: shell, mapa, coleção, equipe, refúgio e uma arena de batalha de 450 linhas.
- `src/game/catalog.ts`: 25 criaturas, regiões, metadados elementais e geração de ataques em um único arquivo de 789 linhas.
- `src/game/engine.ts`: criação da partida, energia, troca, ataque e IA básica em um único arquivo de 422 linhas.
- `src/lib/game-token.ts`: estado completo da partida serializado em token HMAC.
- `supabase/migrations`: catálogo, contas, equipes, exploração, casas, recompensas, missões e esqueleto de partidas online.
- `public/art`: quatro assets usados e seis versões antigas sem referência no runtime.

## Achados críticos

### Regras e consistência

1. A regra definitiva exige cinco elementos, mas tipos, catálogo, UI, testes, textos e banco usam sete.
2. As energias são escolhidas diretamente de uma reserva conhecida. Não existe baralho, embaralhamento, compra ou mão; portanto elas parecem cartas, mas se comportam como contadores.
3. `defense`, `speed`, efeitos de ataque e a lista de status não afetam o resultado. A interface mostra estatísticas sem verdade mecânica.
4. A troca voluntária encerra o turno corretamente, mas a troca após derrota é automática e escolhe sempre o primeiro sobrevivente. Não existe fase explícita de troca forçada.
5. A IA só procura o ataque de maior dano disponível ou anexa o elemento próprio. Ela não avalia vantagem, chance, sobrevivência, troca ou mão.
6. A partida não possui ação de passar. Um estado sem energia válida pode terminar em erro em vez de avançar.
7. O catálogo gera os mesmos três perfis mecânicos para todas as criaturas do mesmo elemento; nomes diferentes não produzem identidade estratégica.

### Conteúdo e arte

1. A maioria das criaturas é original ou uma mistura genérica “inspirada” em tradições. Isso contradiz o requisito de usar seres reais e preservar seus nomes e características.
2. As 25 criaturas compartilham apenas sete recortes de sprite, escolhidos pelo elemento. Criaturas diferentes aparecem com o mesmo corpo.
3. O mapa, a arena e o refúgio têm uma direção 2D coerente e podem ser preservados. O sprite sheet de criaturas é mais ilustrativo e suavizado que os cenários e precisa ser substituído por uma grade consistente.
4. Seis PNGs antigos não são referenciados e ocupam aproximadamente 18 MB do repositório.

### Estado, saves e backend

1. O progresso local aceita JSON sem validação estrutural e cobre apenas moedas, XP e baús.
2. A batalha é salva no `localStorage`, mas nunca restaurada. O custo de escrita cresce porque o log completo é persistido após cada ação.
3. Recompensas locais não têm ledger/idempotência persistente.
4. O token HMAC impede alteração do estado, mas o conteúdo é Base64 legível: mão, reserva, IA e estado futuro ficam expostos ao cliente.
5. A prevenção de replay é um `Set` em memória. Em múltiplas instâncias/serverless ela não é atômica nem compartilhada.
6. A API de demonstração não autentica nem associa a batalha a um usuário. Ela não deve ser tratada como base segura para PvP.

### Banco e segurança

1. Todas as tabelas públicas têm RLS, o que é um bom ponto de partida.
2. `is_battle_participant` é `SECURITY DEFINER` no schema público e não revoga `EXECUTE` de `PUBLIC`; a orientação atual do Supabase recomenda helpers privilegiados fora de schemas expostos.
3. Há políticas de `INSERT` para partidas, participantes e ações, mas os `GRANT`s finais concedem apenas leitura. Essas políticas são inalcançáveis e induzem manutenção incorreta.
4. O banco permite equipes ativas com menos de seis membros. Apenas o intervalo de slots (1–6) é validado.
5. O catálogo TypeScript e os seeds SQL já divergiram em nomes, descrições e quantidade de criaturas.
6. O banco tem entidades para várias funções não implementadas. Isso aumenta a superfície de manutenção sem integração vertical testada.

### UI, responsividade e performance

1. A responsividade é boa para um protótipo: safe areas, controles de toque, breakpoints e redução de movimento foram considerados.
2. `battle-arena.tsx`, `game-shell.tsx` e `globals.css` acumulam responsabilidades demais. A arena mistura transporte HTTP, máquina de estado visual, animação, IA agendada e layout.
3. Todo o shell é um Client Component; catálogo e várias telas estáticas entram no bundle do cliente.
4. A coleção já usa `content-visibility`, uma boa preparação para listas maiores, mas um catálogo de 400+ entradas precisará virtualização/paginação e dados carregados por fatias.
5. O mapa é uma imagem com botões posicionados. Não existe posição do jogador, rota, colisão ou movimento; qualquer atividade aberta pode ser iniciada de qualquer ponto.
6. Há botões que parecem funcionais (`Nova equipe`, `Decorar`, eventos e notificações) sem comportamento ou estado desabilitado, criando affordances falsas.

## Baseline verificável

No snapshot original importado:

- `npm run typecheck`: passou;
- `npm run lint`: passou;
- `npm test`: 7/7 testes passaram;
- `npm run build`: passou; página inicial estática e rotas dinâmicas de batalha/autenticação foram geradas.

## Direção arquitetural adotada

A evolução será vertical e incremental:

1. separar domínio, conteúdo, batalha, IA, save e UI sem quebrar os pontos de entrada existentes;
2. tornar cinco elementos uma regra única compartilhada por TypeScript, UI e Postgres;
3. transformar energia em cartas com baralho, mão, compra, anexação e descarte;
4. modelar explicitamente fases de turno e troca forçada;
5. executar atributos e efeitos que hoje são apenas decorativos;
6. substituir o catálogo por seres folclóricos reais com procedência e nota de adaptação;
7. trocar o sprite por criatura, sem atrelar arte ao elemento;
8. introduzir save local versionado e validado, mantendo a sincronização remota como fronteira posterior;
9. preparar o caminho para persistência autoritativa de batalha no Supabase antes de PvP.

## Fora desta primeira fatia

- multiplayer, matchmaking e reconexão;
- catálogo completo de 400+ criaturas;
- editor de refúgio, missões e inventário completos;
- migração de produção aplicada sem credenciais/ambiente remoto;
- áudio e pipeline definitivo de animação quadro a quadro.

Esses itens dependem da fundação acima e não devem ser apresentados como concluídos antes de testes entre sessões, contas e dispositivos.

## Estado após a primeira intervenção

| Achado | Tratamento aplicado | Risco restante |
| --- | --- | --- |
| Sete elementos divergentes | Regra central, UI, catálogo e migration reduzidos aos cinco elementos definitivos | Migration ainda não aplicada no ambiente remoto |
| Energia como contador | Baralho de 30 cartas, mão, compra, anexação e descarte | Balanceamento exige sessões de jogo maiores |
| Turno e troca inconsistentes | Máquina de turno com ação principal e fase explícita de troca forçada | Faltam testes de interação da UI em navegador automatizado |
| Atributos/efeitos decorativos | Defesa, velocidade, escudo, crítico e status entram na resolução | Fórmulas ainda são v1 de balanceamento |
| Criaturas inventadas e sprites repetidos | Catálogo substituído por 25 seres reais com proveniência e sprite 5×5 individual | Revisão cultural especializada continua recomendada |
| Save sem validação | Save v2 validado por Zod, migração v1 e recuperação de corrupção | Sincronização remota ainda não conectada |
| Estado de batalha legível | Token cifrado e autenticado por AES-256-GCM | Replay continua local ao processo |
| Helper privilegiado exposto | Nova migration move autorização para schema privado e remove escrita direta de batalha | Precisa de validação em staging Supabase |
| Mapa sem posição | Região atual e viagem por adjacência foram implementadas | Não é ainda um mapa navegável por tiles |

Os detalhes de invariantes e fronteiras resultantes estão em `docs/ARCHITECTURE.md`; o escopo ainda pendente está em `docs/STATUS.md`.

## Segunda intervenção — fundação online e PVP

### Progresso remoto

- Criado um snapshot remoto único e validado para todas as áreas de progresso já modeladas no banco.
- O Server Component decide a fonte de autoridade antes da hidratação; o cliente não infere online/offline por tentativa silenciosa.
- Tabelas econômicas continuam sem escrita ampla do cliente. Viagem, tesouro e equipe ativa usam RPCs estreitas, `auth.uid()`, lock de linha e ledger único.
- O save local permanece como modo visitante/cache; mensagens da interface deixam explícito quando o backend autenticado está indisponível.

### PVP

- A rota stateless contra NPC foi preservada e não foi promovida indevidamente a multiplayer.
- Desafios, snapshot de seis criaturas, sala, ações e eventos passaram a ter persistência própria.
- A confirmação de jogada combina autorização da sessão, motor TypeScript no servidor, dado do servidor, controle de versão e commit transacional restrito a `service_role`.
- Broadcast é usado como sinal de atualização, não como autoridade. Uma consulta ao snapshot persistido reconstrói a tela após evento ou polling.
- A projeção HTTP remove mão/baralho do adversário; o estado integral fica somente no servidor/banco.

### Verificações executadas

- TypeScript e ESLint passaram após as integrações.
- 32 testes cobrem motor, cinco elementos, energia, troca, IA, save, contrato remoto, criação PVP, entradas hostis e ocultação de informação.
- Navegador real: mapa, navegação para Duelos, fallback honesto sem Supabase, breakpoint de 390 px sem overflow, arena com seis criaturas/cinco energias e anexação confirmada pela API.
- A CLI oficial não conseguiu executar `db lint --local` porque não há Postgres Supabase em `127.0.0.1:54322`; não houve tentativa de mascarar essa ausência.

### Riscos abertos

1. SQL/RLS ainda não passou em staging real.
2. PVP ainda não passou pelo critério obrigatório de duas contas em dois navegadores.
3. A arena continua grande e merece extração após estabilizar o transporte PVP.
4. Realtime, reconexão e disputa simultânea precisam de teste de carga/concorrência real.
5. Arte atual é coerente o suficiente para continuar a fundação, mas permanece um sprite sheet gerado; uma revisão humana por criatura e produção quadro a quadro são necessárias antes de tratar o visual como final.

## Terceira intervenção — preparação para homologação real

### Achados de segurança

1. A projeção HTTP escondia mão/baralho, mas `authenticated` ainda possuía `SELECT` direto sobre `battles.state` e `battle_actions.result`. Um participante poderia contornar a rota e obter o estado integral pelo Data API.
2. `processedActionIds` e IDs de log derivados de `client_action_id` ainda atravessavam a resposta e o Broadcast, expondo tokens internos de idempotência.
3. O contrato Zod descartava campos extras. Tentativas de enviar `damage`, `die` ou `winnerId` eram ignoradas em vez de rejeitadas explicitamente.
4. Um retry com o mesmo `client_action_id`, mas payload diferente, recebia o resultado anterior. Isso era idempotente, porém não distinguia repetição legítima de reutilização hostil.
5. As grants de amizade permitiam informar `status` no `INSERT` e alterar colunas amplas no `UPDATE`; a policy não restringia a criação a `pending` nem tornava os participantes imutáveis.
6. A policy de Broadcast consultava a coluna `topic` diretamente e não restringia `extension`; a documentação atual recomenda `realtime.topic()` e filtro explícito de `broadcast`.
7. Os componentes assinavam canal privado sem aguardar `realtime.setAuth()`.

### Correções aplicadas

- Migration de hardening revoga todo acesso de cliente às tabelas autoritativas e remove `battle_events` de Postgres Changes; somente Broadcast privado permanece como sinal.
- Rotas PVP usam uma camada server-only que confirma `battle_participants` antes de consultar o estado com a chave secreta.
- Projeção serializada zera IDs processados, substitui IDs de log e mantém mão/baralho adversários apenas como contagens.
- Eventos gravados recebem UUIDs gerados no servidor antes de chegar ao banco/Realtime.
- Contratos de desafio/ação agora são estritos; dano, dado, vitória ou identidade enviados fora do contrato retornam erro.
- Retry idêntico continua retornando o resultado anterior; mesmo ID com ação/payload divergente é rejeitado na rota e novamente dentro da transação SQL.
- Amizades usam grants por coluna, criação exclusivamente `pending`, aceite/bloqueio pelo destinatário e índice único não direcional.
- Policy Realtime usa `realtime.topic()`, `extension = 'broadcast'` e associação real ao jogador/batalha.
- Foram adicionados índices para chaves estrangeiras e caminhos de autorização que não estavam cobertos.
- `supabase/tests/001_online_foundation.test.sql` adiciona 29 asserções pgTAP negativas e estruturais.

### Evidência e limite

`npm run typecheck`, `npm run lint` e 32/32 testes Vitest passaram após as correções. O schema Realtime do projeto Supabase acessível foi consultado somente para leitura e confirmou PostgreSQL 17.6, `realtime.topic()`, `realtime.messages.extension` e `realtime.broadcast_changes(...)` compatíveis com a migration.

Isso ainda não é homologação. A tentativa de criar `Card Realms Staging` falhou pelo limite de projetos gratuitos; a conta tem `Card Realms` e `cryohive` ativos, além de `snowLH's Project` pausado, e Branching exigiu Pro. Nenhuma migration foi aplicada aos projetos existentes e nenhum item remoto foi marcado PASS. A retomada e a matriz obrigatória estão documentadas em `docs/SUPABASE_STAGING.md` e `docs/STATUS.md`.

## Quarta intervenção — preflight de propriedade Supabase

O plano de ambientes foi reorganizado sem mutar recursos remotos. O projeto `Card Realms` ativo foi inventariado, a integração com Vercel/GitHub foi verificada e os bloqueios oficiais de transferência foram checados. O painel confirmou: origem Free saudável em `sa-east-1`, um único Owner (`henrysoldan@gmail.com`), ausência de GitHub Integration do Supabase, ausência de integração Supabase–Vercel, ausência de Log Drains, Edge Functions e secrets próprios.

O banco legado tem 20 tabelas públicas com RLS, 34 índices, 96 constraints, 36 policies e 10 eventos de trigger, mas não possui histórico no painel de migrations. O Advisor ainda detecta `EXECUTE` amplo sobre duas funções públicas `SECURITY DEFINER`; a migration local de hardening corrige a fronteira, porém não foi aplicada em produção durante esta etapa.

A transferência não foi executada. O seletor oferece somente `snowLH's Org`, e não a organização de `laurabvieira25`; o operador precisa primeiro ser convidado para o destino. O plano Free também não possui backup do provedor, e o dump lógico oficial exige a senha do banco. Essa senha não será solicitada em chat nem substituída silenciosamente. O procedimento, o snapshot sanitizado e os critérios de pós-transferência estão em `docs/SUPABASE_TRANSFER.md`.
