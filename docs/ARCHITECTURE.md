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
10. A mão e o baralho do adversário não atravessam a API PVP; o cliente recebe somente contagens ocultas.

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
4. uma função acessível apenas por `service_role` bloqueia a linha, rejeita versão/turno incorretos, grava ação, estado e eventos na mesma transação e devolve o resultado idempotente;
5. Broadcast privado acorda as duas telas; polling periódico recupera eventos perdidos/reconexões;
6. antes da resposta HTTP, a projeção do jogador remove mão e baralho do adversário.

Essa arquitetura está implementada, mas não homologada: ainda requer migration aplicada e um teste real com duas contas/sessões.
