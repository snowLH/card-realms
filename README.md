# Card Realms — Mundo dos Colecionadores

RPG online 2D de cartas colecionáveis para navegador, pensado primeiro para celular. O universo de Aurória reúne criaturas originais inspiradas com cuidado em folclores do mundo, exploração por cliques, equipes fixas de seis cartas e batalhas animadas em arenas de pixel art.

## Regra de identidade consolidada

O projeto mantém os sete tipos originais — sem remover o folclore, as regiões ou as demais mecânicas do prompt mestre:

1. Fogo
2. Água
3. Natureza
4. Elétrico
5. Gelo
6. Sombrio
7. Neutro

Características como luz, magia, espírito, tempestade ou terra aparecem em traços, lore, efeitos e animações, mas não criam tipos adicionais.

## O que já funciona

- mapa-múndi ilustrado em pixel art, com cinco destinos clicáveis e atividades regionais;
- coleção filtrável com 25 criaturas completas nesta etapa e estrutura pronta para a meta de 405;
- equipe de exatamente seis criaturas: uma ativa e cinco substitutas;
- combate contra NPC com vida, troca, sete energias separadas das criaturas, até duas compras e dois vínculos por turno;
- três ataques por criatura, custos de 1–3 energias, D6 sorteado no servidor, falha que consome energia e crítico;
- vantagens elementais, derrotas, troca forçada, histórico e IA básica do guardião;
- arena, mapa, criaturas e refúgio em 2D/pixel art; menus, cartas e efeitos em alta definição;
- layout responsivo para celular, tablet e desktop, áreas de toque grandes, safe areas e manifesto instalável;
- refúgio pessoal visual, coleção, equipe e perfil;
- login por Google e link de e-mail pronto para ser ativado com Supabase;
- progresso demonstrativo persistente no dispositivo e esquema Supabase para progresso permanente;
- motor de combate autoritativo com token assinado, dados criptograficamente seguros e proteção contra reenvio;
- testes automatizados do motor e validações de TypeScript/ESLint.

## Escopo preservado para as próximas etapas

Não estão sendo declarados como prontos: o catálogo completo de 405 criaturas, PvP entre dois dispositivos, chefes cooperativos, visita real a casas, abertura de caixas, decoração editável, áudio completo e eventos automáticos de fim de semana. A base de dados já contém entidades e políticas para equipes, coleção, exploração, casas, amizades, recompensas, missões, eventos e partidas. Essas funções devem ser ligadas em incrementos testáveis, mantendo o objetivo original.

## Executar localmente

Requisitos: Node.js 22 ou superior.

```bash
npm install
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

1. Crie um projeto Supabase.
2. Copie `.env.example` para `.env.local` e informe a URL, a chave publicável e uma chave aleatória longa em `GAME_ACTION_SECRET`.
3. Aplique `supabase/migrations/20260926010000_card_realms_foundation.sql` com a CLI do Supabase ou pelo editor SQL do projeto.
4. Em Authentication, habilite Google e/ou e-mail e cadastre `http://localhost:3000/auth/callback` durante o desenvolvimento.
5. Na publicação, troque `NEXT_PUBLIC_SITE_URL` pelo domínio da Vercel e adicione o callback de produção no Supabase.

O esquema usa RLS em todas as tabelas expostas, permissões explícitas, catálogo público somente para leitura e alterações críticas reservadas ao backend com `service_role`. Nunca coloque `SUPABASE_SECRET_KEY` em código cliente ou em variável `NEXT_PUBLIC_*`.

## Publicar na Vercel

1. Envie este diretório para um repositório GitHub.
2. Importe o repositório na Vercel como projeto Next.js.
3. Cadastre as cinco variáveis descritas em `.env.example`.
4. Faça o primeiro deploy e atualize os URLs permitidos no Supabase.

O projeto não depende de fontes externas no build e usa Geist empacotada localmente.

## Estrutura principal

- `src/game/catalog.ts`: criaturas, regiões, tipos e conteúdo inicial.
- `src/game/engine.ts`: regras puras e testáveis do combate.
- `src/app/api/battle/route.ts`: autoridade do servidor e rolagem do D6.
- `src/components/game/`: mapa, coleção, equipe, arena e refúgio.
- `supabase/migrations/`: banco, segurança, dados iniciais e Realtime.
- `public/art/`: mapas, arenas, criaturas e refúgio em pixel art.

