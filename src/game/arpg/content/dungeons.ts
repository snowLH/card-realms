import type { ArpgExpeditionId } from "./expeditions";
import {
  MARES_ENEMIES,
  MARES_REGION_META,
  MARES_ROOM_LOOT_POOLS,
  MARES_ROOM_WAVES,
} from "./arquipelago-das-mares";
import {
  createMataRoomPlan,
  MATA_ENEMIES,
  MATA_REGION_META,
  MATA_ROOM_LOOT_POOLS,
} from "./mata-encantada";
import {
  RUNIC_ENEMIES,
  RUNIC_REGION_META,
  RUNIC_ROOM_LOOT_POOLS,
  RUNIC_ROOM_WAVES,
} from "./montanhas-runicas";
import type { EnemyDefinition } from "../domain/types";

export type DungeonLoot = {
  kind: "weapon" | "armor";
  id: string;
  label: string;
};

export type ArpgDungeonRuntimeConfig = {
  id: ArpgExpeditionId;
  sceneKey: string;
  name: string;
  bossName: string;
  background: string;
  enemies: Record<string, EnemyDefinition>;
  roomLootPools: readonly (readonly DungeonLoot[])[];
  createLootPlan: (random?: () => number) => DungeonLoot[];
  createRoomPlan: () => string[][];
  enemyFrames: Partial<Record<string, number>>;
  enemyAtlas?: Partial<Record<string, "folklore-atlas" | "folklore-atlas-2">>;
  enemyAnimations?: Partial<Record<string, "curupira-boss" | "amarok-boss" | "iara-boss" | "sprout-enemy" | "boto-enemy" | "raiju-enemy">>;
  messages: {
    intro: string;
    bossIntro: string;
    miniBossWarning: string;
    phaseTwo: string;
    phaseThree: string;
    bossVolley: string;
    victory: string;
    defeat: string;
  };
  colors: {
    miniBoss: number;
    phase: number;
    phaseTwo: number;
    phaseThree: number;
    projectile: number;
  };
};

function pickLootPlan(
  pools: readonly (readonly DungeonLoot[])[],
  random: () => number = Math.random,
) {
  return pools.map((pool) => {
    const roll = Math.max(0, Math.min(0.999999999, random()));
    return pool[Math.floor(roll * pool.length)];
  });
}


function shuffledRoomPlan(
  waves: readonly (readonly string[])[],
  random: () => number = Math.random,
) {
  const opening = waves.slice(0, 3).map((wave) => [...wave]);
  for (let index = opening.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [opening[index], opening[target]] = [opening[target], opening[index]];
  }
  return [
    ...opening,
    [...waves[3]],
    [...waves[4]],
  ];
}

const MATA_DUNGEON: ArpgDungeonRuntimeConfig = {
  id: "mata-encantada",
  sceneKey: "MataEncantada",
  name: MATA_REGION_META.name,
  bossName: MATA_REGION_META.bossName,
  background: MATA_REGION_META.background,
  enemies: MATA_ENEMIES,
  roomLootPools: MATA_ROOM_LOOT_POOLS,
  createLootPlan: (random) => pickLootPlan(MATA_ROOM_LOOT_POOLS, random),
  createRoomPlan: () => createMataRoomPlan(),
  enemyFrames: { miniBoss: 12, boss: 10 },
  enemyAnimations: { sprout: "sprout-enemy", boss: "curupira-boss" },
  messages: {
    intro: "Mata Encantada iniciada. Derrote a primeira onda.",
    bossIntro: "O Curupira Ancestral entrou na arena.",
    miniBossWarning: "Mapinguari prepara um rugido de impacto.",
    phaseTwo: "Curupira muda os rastros: raízes começam a cercar a arena.",
    phaseThree: "Curupira entra na fase final e passa a atacar de pontos imprevisíveis.",
    bossVolley: "Curupira dispara uma sequência de flechas encantadas.",
    victory: "Curupira Ancestral derrotado. A run foi concluída.",
    defeat: "Você caiu na Mata Encantada.",
  },
  colors: {
    miniBoss: 0xb38b58,
    phase: 0xe6a14e,
    phaseTwo: 0x75a74d,
    phaseThree: 0xd97943,
    projectile: 0xe8bf63,
  },
};

const MARES_DUNGEON: ArpgDungeonRuntimeConfig = {
  id: "arquipelago-das-mares",
  sceneKey: "ArquipelagoDasMares",
  name: MARES_REGION_META.name,
  bossName: MARES_REGION_META.bossName,
  background: MARES_REGION_META.background,
  enemies: MARES_ENEMIES,
  roomLootPools: MARES_ROOM_LOOT_POOLS,
  createLootPlan: (random) => pickLootPlan(MARES_ROOM_LOOT_POOLS, random),
  createRoomPlan: () => shuffledRoomPlan(MARES_ROOM_WAVES),
  enemyFrames: { skirmisher: 6, guardian: 8, elite: 7, miniBoss: 9, boss: 5 },
  enemyAnimations: { skirmisher: "boto-enemy", boss: "iara-boss" },
  messages: {
    intro: "Arquipélago das Marés iniciado. Atravesse a primeira ilha.",
    bossIntro: "O canto da Iara ecoa pela arena inundada.",
    miniBossWarning: "Ahuízotl golpeia a água e prepara uma onda de impacto.",
    phaseTwo: "O canto da Iara se intensifica e correntes começam a fechar a arena.",
    phaseThree: "Iara mergulha nas sombras d'água e reaparece em pontos imprevisíveis.",
    bossVolley: "Iara lança uma sequência de ondas encantadas.",
    victory: "Iara das Profundezas derrotada. A expedição foi concluída.",
    defeat: "Você foi vencido pelas correntes do Arquipélago das Marés.",
  },
  colors: { miniBoss: 0x4c91a8, phase: 0x63c4d8, phaseTwo: 0x4a97c4, phaseThree: 0x8a72ca, projectile: 0x7ed8ec },
};

const RUNIC_DUNGEON: ArpgDungeonRuntimeConfig = {
  id: "montanhas-runicas",
  sceneKey: "MontanhasRunicas",
  name: RUNIC_REGION_META.name,
  bossName: RUNIC_REGION_META.bossName,
  background: RUNIC_REGION_META.background,
  enemies: RUNIC_ENEMIES,
  roomLootPools: RUNIC_ROOM_LOOT_POOLS,
  createLootPlan: (random) => pickLootPlan(RUNIC_ROOM_LOOT_POOLS, random),
  createRoomPlan: () => shuffledRoomPlan(RUNIC_ROOM_WAVES),
  enemyFrames: { messenger: 14, stormBeast: 16, treasureLight: 24, elite: 11, miniBoss: 13, boss: 14 },
  enemyAtlas: { messenger: "folklore-atlas-2", elite: "folklore-atlas-2", miniBoss: "folklore-atlas-2" },
  enemyAnimations: { stormBeast: "raiju-enemy", boss: "amarok-boss" },
  messages: {
    intro: "Montanhas Rúnicas iniciadas. Suba pelas passagens antes que a tempestade feche o caminho.",
    bossIntro: "Um uivo atravessa o cume: Amarok iniciou a caçada.",
    miniBossWarning: "Yeti golpeia o chão e prepara um impacto de altitude.",
    phaseTwo: "Amarok acelera a caçada e começa a fechar as rotas de fuga.",
    phaseThree: "Amarok entra na fase final e avança em investidas imprevisíveis.",
    bossVolley: "Amarok lança estilhaços de gelo e vento pela arena.",
    victory: "Amarok derrotado. A travessia das Montanhas Rúnicas foi concluída.",
    defeat: "A caçada terminou nas Montanhas Rúnicas.",
  },
  colors: { miniBoss: 0xc7d9e8, phase: 0x88b8d8, phaseTwo: 0x79c4ee, phaseThree: 0xb7a2f0, projectile: 0xa8e4ff },
};

export const ARPG_DUNGEON_CONFIGS: Record<ArpgExpeditionId, ArpgDungeonRuntimeConfig> = {
  "mata-encantada": MATA_DUNGEON,
  "arquipelago-das-mares": MARES_DUNGEON,
  "montanhas-runicas": RUNIC_DUNGEON,
};

export function createDungeonLootPlan(
  expeditionId: ArpgExpeditionId,
  random: () => number = Math.random,
) {
  return ARPG_DUNGEON_CONFIGS[expeditionId].createLootPlan(random);
}

export function isDungeonLootPlanValid(expeditionId: ArpgExpeditionId, itemIds: readonly string[]) {
  const dungeon = ARPG_DUNGEON_CONFIGS[expeditionId];
  return itemIds.length === dungeon.roomLootPools.length
    && itemIds.every((id, index) => dungeon.roomLootPools[index].some((item) => item.id === id));
}

export function resolveDungeonLootPlan(
  expeditionId: ArpgExpeditionId,
  itemIds?: readonly string[],
) {
  const dungeon = ARPG_DUNGEON_CONFIGS[expeditionId];
  if (!itemIds) return dungeon.createLootPlan();
  if (!isDungeonLootPlanValid(expeditionId, itemIds)) throw new Error("Plano de loot ARPG inválido.");
  return itemIds.map((id, index) => dungeon.roomLootPools[index].find((item) => item.id === id)!);
}
