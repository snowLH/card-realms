# Arquitetura da fundação v2

## Princípio

O jogo separa regra, conteúdo, transporte e apresentação. O motor não importa React, Next.js, Supabase ou `localStorage`; ele recebe um estado, uma ação validada e uma fonte de aleatoriedade, e devolve novo estado mais eventos. Isso permite usar as mesmas regras em campanha local, API autoritativa, testes e, futuramente, workers de multiplayer.

## Limites

| Área | Responsabilidade | Não deve conhecer |
| --- | --- | --- |
| `game/domain` | tipos e invariantes estáveis | React, HTTP, banco |
| `game/content` | catálogo declarativo e regiões | estado mutável da partida |
| `game/battle` | máquina de turnos, resolução e IA | interface e persistência |
| `game/player` | schema do snapshot remoto e modo de autoridade | cookies e componentes |
| `game/pvp` | contratos de ação e visibilidade pública da partida | credencial administrativa |
| `game/save` | formatos versionados e migrações | regras internas de combate |
| `app/api/battle` | autenticar/validar ação, aleatoriedade e autoridade | detalhes visuais |
| `app/api/player` | validar sessão e pedir mutações estreitas de progresso | alterar tabelas econômicas diretamente |
| `app/api/pvp` | autenticar, aplicar o motor e expor somente estado visível | confiar em dano, dado ou estado enviado pelo cliente |
| `server/player` | montar o bootstrap remoto no Server Component | renderização |
| `server/pvp` | usar a chave secreta para transações já autorizadas | código cliente |
| `components/game` | interação e apresentação | mutar regras por conta própria |
| `supabase/migrations` | integridade, RLS e persistência compartilhada | lógica de animação |

`src/game/catalog.ts`, `src/game/engine.ts` e `src/game/types.ts` continuam como barrels de compatibilidade. Código novo deve importar os módulos específicos.

## Invariantes obrigatórios

1. `ELEMENTS` contém exatamente cinco valores.
2. `Team<T>` tem seis posições e todo snapshot de batalha no banco tem seis entradas.
3. Anexar energia não encerra o turno, mas há no máximo duas anexações por turno.
4. Atacar, trocar voluntariamente ou passar encerra a ação principal.
5. Uma criatura derrotada exige `forced_switch`; o jogador escolhe a substituta e depois mantém sua ação principal.
6. Toda ação tem identificador e uma ação processada não pode ser reaplicada.
7. Rolagens e avanço da IA são executados na fronteira do servidor.
8. Conteúdo folclórico exige tradição, origem, nota de fonte e nota de adaptação.
9. Em conta online, Postgres é a fonte de verdade; `localStorage` é apenas cache e nunca confirma economia/PVP.
10. A mão, o baralho, `processedActionIds` e IDs internos do adversário não atravessam a API PVP; o cliente recebe somente contagens ocultas e eventos públicos.

## Escala de conteúdo

O catálogo é um array de dados tipados; o motor busca definições por índice (`Map`) e mantém apenas IDs/estado mutável na batalha. Para 400+ entradas, o próximo passo não é aumentar bundles indefinidamente: é publicar um formato de conteúdo validado por schema, gerar índices/tipos no build e entregar coleção/bestiário em páginas ou fatias virtualizadas.

## Persistência do jogador

`page.tsx` carrega um `PlayerBootstrap` no servidor. Há três estados explícitos:

| Fonte | Autoridade | Comportamento |
| --- | --- | --- |
| `local` | save v2 do navegador | visitante sem sessão |
| `supabase` | snapshot e RPCs Postgres | cache local é apenas recuperação visual |
| `supabase-unavailable` | sessão conhecida, backend indisponível | jogo informa que alterações ficaram só no cache |

O snapshot remoto é validado por Zod antes de entrar no Client Component. Viagem, tesouro e equipe ativa passam por funções transacionais que derivam `auth.uid()`; a chave secreta não participa desses fluxos comuns.

## PVP autoritativo

O token cifrado permanece somente no combate demonstrativo contra NPC. O PVP usa outra fronteira:

1. um jogador autenticado desafia um amigo aceito; ambos precisam de equipe ativa com seis membros;
2. a aceitação monta o estado inicial no servidor, e o Postgres revalida participantes e os seis IDs antes de gravar a sala;
3. cada ação leva `client_action_id` e `expected_version`; o servidor busca o estado íntegro, executa o mesmo motor puro e sorteia os dados;
4. uma função acessível apenas por `service_role` bloqueia a linha, rejeita versão/turno incorretos e reutilização divergente de `client_action_id`, grava ação, estado e eventos na mesma transação e devolve somente retries idênticos como resultado idempotente;
5. as roles `anon` e `authenticated` não têm `SELECT` nas tabelas autoritativas; uma camada de acesso server-only confirma a participação antes de usar a credencial administrativa;
6. Broadcast privado, autenticado explicitamente antes da assinatura, acorda as duas telas; polling periódico recupera eventos perdidos/reconexões;
7. a policy de Broadcast usa `realtime.topic()`, limita a extensão a `broadcast` e autoriza apenas o próprio tópico de jogador ou uma batalha da qual o usuário participa;
8. antes da resposta HTTP, o DTO remove mão/baralho adversários, IDs de replay e IDs de evento derivados da ação.

### Fronteira de dados privados

O JSON integral da batalha precisa existir no Postgres para reconexão e commits atômicos, mas não é um DTO de cliente. Somente o servidor lê `battles.state`, `battle_actions.result`, participantes e eventos persistidos. O cliente acessa `/api/pvp/battles/:id` e `/api/pvp/actions`; ambos autenticam a sessão, verificam associação em `battle_participants` e serializam uma projeção mínima.

Realtime é sinalização, não transporte de estado. O payload de `battle_events` contém somente evento público com ID opaco; a tela sempre reconcilia pelo endpoint HTTP. Postgres Changes foi removido da publication para essa tabela, evitando uma segunda superfície de leitura concorrente ao Broadcast privado.

Essa arquitetura foi homologada em staging em 27 de setembro de 2026: seis migrations aplicadas, duas contas em sessões independentes, duas batalhas completas, reconexão, Realtime, polling, privacidade e idempotência validados contra o Supabase real.

## Topologia de ambientes e propriedade

- A produção existente mantém a ref `lfmbvqixixbhffdpmvhp` durante a reorganização; não se cria uma cópia paralela para substituir silenciosamente a origem.
- Produção e staging devem pertencer à organização `cryo`, controlada pela conta `cryohive11@gmail.com`.
- `henrysoldan@gmail.com` participa da organização de destino somente pelo tempo necessário à transferência e à passagem de controle; depois deve ser removido ou rebaixado.
- O projeto antigo chamado `cryohive` pertence a outro produto e não é recurso, fallback ou capacidade de staging do Folklard. A semelhança com o nome da conta `cryohive11` não altera essa separação.
- Toda mudança de schema segue `staging -> migrations -> testes reais -> homologação -> produção`.
- O projeto Supabase de staging `ywawwhnsvpfeppfcuwzg` usa a branch GitHub dedicada `staging`, mas migrations são aplicadas e auditadas explicitamente pela CLI; a integração GitHub não é fonte de verdade para o histórico do schema.
- Vercel Production continua apontando para produção; Preview recebe credenciais de staging em escopo separado. As variáveis públicas e secretas não podem misturar referências entre ambientes.
- A transferência de organização não é migração regional e não deve alterar a project ref. Mesmo assim, URLs, providers, chaves, RLS, Realtime e deploy são revalidados após o movimento antes de qualquer evolução funcional.

## Harness de homologação

- `supabase/tests/001_online_foundation.test.sql`: 29 asserções estruturais e negativas para schema, grants e RLS.
- `scripts/staging-realtime-probe.mjs`: assinatura válida, negação de tópico alheio e ausência de publicação por cliente.
- `scripts/staging-polling-probe.mjs`: recuperação por consulta periódica quando o evento não é consumido.
- `scripts/staging-idempotency-probe.mjs`: repetição sequencial e concorrente da recompensa de tesouro.
- `scripts/staging-pvp-finish.mjs`: avanço controlado de uma batalha autenticada até o resultado persistido.

Os scripts usam contas descartáveis e variáveis apenas do ambiente; nenhum segredo pertence ao código, à migration ou ao DTO do cliente.
