# Folklard — contrato de gameplay atual

## Experiência principal
- Apenas o ARPG top-down e o modo cooperativo ARPG são promovidos como modos jogáveis.
- A Guilda é o hub; personagens folclóricos têm dois poderes de assinatura e armas trocáveis.
- Os sistemas de dungeons procedurais, extração, checkpoints, progressão e boss foram mantidos.
- Targeting foi extraído de `dungeon-scene.ts` para `runtime/combat-targeting.ts` e tem testes de alcance, oclusão, joystick e mouse.
- O antigo PvP por cartas, arena por turnos e tabuleiros cosméticos foram desligados das rotas de navegação.

## Legado e segurança
- IDs históricos de save, tabelas e APIs legadas permanecem temporariamente no repositório para não corromper contas antigas ou invalidar referências do banco. Não reutilizar esses módulos nas novas funcionalidades. Fazer uma retirada física apenas com verificação de dependências, testes e migração auditada.
- Não criar branches paralelas. A distribuição usa `main`, com validação automatizada.
- Arte não será alterada nesta etapa: a preparação visual da Guilda, das dungeons e dos personagens fica separada para ChatGPT Work. Nenhum asset ou código proprietário de outros jogos deve ser copiado.

## Verificações ainda necessárias
- `npm run verify:deploy` aprovado no CI para o commit final.
- Teste manual de combate e multiplayer em navegador e celular reais.
- Verificação de saves e SQL/RLS em Supabase de staging antes de apagar dados ou mudar migrações.
