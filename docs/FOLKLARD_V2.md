# Folklard V2 — implementação segura

## Objetivo
Reestruturar a experiência roguelite de combate top-down inspirada nos princípios de ritmo, legibilidade e progressão de jogos como Soul Knight, com heróis, arte, habilidades e cenários originais de folclore mundial. Não importar nem republicar assets ou código proprietários de outro jogo.

## Regra de migração
Esta branch preserva `main` e os IDs de banco/saves. Novas funcionalidades só substituem o fluxo antigo após uma vertical slice jogável, testes e avaliação em aparelho real.

## Alterações iniciais realizadas
- Corrigido teste de assets para verificar o conteúdo efetivamente versionado; os PNG originais são arquivados fora do clone e não podem ser exigidos por CI.
- Ajustada a mira automática para ataques móveis/gamepad sem direcional: enquanto atacar sem alvo vivo, mantém a última direção, em vez de apontar para posição arbitrária do mouse.
- Mantidas mira analógica e mira pelo mouse sem interferência.

## Próximas entregas (não implementadas nesta alteração)
1. Extrair do `dungeon-scene.ts` os sistemas de projéteis, ataques, câmera, inimigos e loot.
2. Revisar a economia de armas, poderes de herói e telegraphs para consistência e balanceamento.
3. Produzir tilesets/spritesheets originais consistentes para Mata Encantada, Guilda e chefes.
4. Fazer testes de jogabilidade repetidos em Android/iOS e desktop, especialmente latência de input e clareza de VFX.
5. Homologar servidor autoritativo, Supabase staging, progressão e multiplayer antes de promover a V2.
6. Marcar componentes TCG legado como somente compatibilidade e removê-los apenas depois da migração de saves.

## Critérios de aceite
- `npm run verify:deploy` precisa ficar verde.
- Ao menos uma dungeon totalmente jogável e satisfatória, com loot e extração.
- Sem regressão de saves e persistência autenticada.
- Sem reutilização de material protegido de terceiros.
