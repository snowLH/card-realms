# Folklard — verificação de lançamento (2026-10-08)

## Testes automatizados obrigatórios
- GitHub Actions: executar `npm run verify:deploy` e publicar somente o commit cujo check esteja **success**.
- Vitest cobre: 13 lendas / 26 poderes; equipamento e loot dos três biomas; geração de 1000 seeds; rotas navegáveis; sincronização autoritativa; recuperação de runs; inputs de gamepad; encontros e fases de bosses; limite e transição da dungeon cooperativa; idempotência de ações.
- Verificar esquema e migrações Supabase com o projeto Card Realms correto. Nunca editar banco de outro projeto.
- Testar a autenticação e a persistência com uma conta de teste autorizada, sem expor tokens.

## Smokes interativos indispensáveis antes de ampla divulgação
Estes testes exigem navegador/dispositivos autenticados e **não** são substituídos pelo CI:
1. Desktop: entrar e sair da Guilda, trocar entre as 13 lendas, equipar dois poderes próprios, começar e terminar uma run em cada bioma.
2. Desktop: atacar/mirar, desviar, trocar arma A/B, comprar melhoria com fragmentos, abrir baú e extrair pela saída; atualizar a página e conferir retomada.
3. Celular Android Chrome e iPhone Safari, em paisagem: controles touch, mira automática, dash, áudio (após interação), menus, HUD, orientação, desempenho e retomada pelo PWA.
4. Gamepad: testar diagonais, dead zone, botões segurados, desconexão durante ataque e retomada.
5. Cooperativo: 2, 3 e 4 pessoas com contas distintas autorizadas; avançar todas as salas incluindo especiais, queda/ressurreição, derrotar boss, desconectar e reconectar, verificar loot por participante sem duplicação e timer da expedição.
6. Conectividade degradada: perdas temporárias de conexão e respostas de ações duplicadas; verificar que a recompensa jamais é emitida pelo cliente sem confirmação do servidor.
7. Testar login/logout Google OAuth, persistência de equipamento, progresso, permissão RLS entre contas e funcionamento sem login para visitantes.

## Segurança e desempenho do banco
- Toda tabela exposta mantém RLS; políticas de titularidade usam `(select auth.uid())` quando aplicável.
- Nove funções `SECURITY DEFINER` públicas ainda são intencionalmente acessíveis a usuários autenticados para missões, lobby de raid e mapa. Revisão feita: checam `auth.uid()` e configuram `search_path` vazio. Revisar qualquer alteração de contrato antes de abrir a API a novos usuários.
- Tabelas antigas permanecem isoladas para permitir exportação/recuperação. Não usar `DROP ... CASCADE` durante lançamento.
- Aviso do Auth sobre proteção contra senhas vazadas requer ativação nas configurações do Supabase (não é configurável via ferramenta SQL atual). O login do jogo usa Google OAuth.
- Índices sem tráfego são avisos informativos e não devem ser eliminados sem medir consultas reais.

## Política de publicação
- `vercel.json` desativa publicação automática; liberar manualmente **somente após CI aprovado** e conferir SHA, ambiente production, domínio `card-realms.vercel.app` e status READY.
- Em falhas pós-publicação, promover o deployment anterior validado no painel da Vercel e investigar logs; não reverter o banco à força.
- Registre precisamente testes manuais **não realizados**. Nunca declarar aprovação de multiplayer real ou desempenho mobile sem teste nos aparelhos.
