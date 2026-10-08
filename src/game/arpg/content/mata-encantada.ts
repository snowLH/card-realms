import type {
  ArpgArmorDefinition,
  ArpgLoadout,
  ArpgWeaponDefinition,
  EnemyDefinition,
} from "../domain/types";
import {
  ARPG_ABILITY_CARD_BY_ID,
  STARTER_ARPG_ABILITY_IDS,
} from "./ability-cards";
import { STARTER_ARPG_RELIC_ID } from "./relics";
import { ARPG_ASSETS } from "../assets";

export const MATA_WEAPONS: ArpgWeaponDefinition[] = [
  {
    id: "thorn-guard-blade",
    name: "Lâmina do Guardião dos Espinhos",
    kind: "sword",
    rarity: "rare",
    element: "nature",
    damage: 31,
    attackRateMs: 510,
    range: 90,
    effect: { id: "tide-cleave", label: "Ramos Cortantes", description: "O golpe causa um segundo corte em área com 35% do dano." },
    description: "Uma lâmina viva, mais lenta e eficaz contra grupos.",
  },
  {
    id: "iron-sword",
    name: "Espada de Ferro",
    kind: "sword",
    rarity: "common",
    element: "nature",
    damage: 24,
    attackRateMs: 360,
    range: 78,
    description: "Golpe curto e confiável para o início da expedição.",
  },
  {
    id: "forest-bow",
    name: "Arco da Mata",
    kind: "bow",
    rarity: "rare",
    element: "nature",
    damage: 19,
    attackRateMs: 430,
    projectileSpeed: 640,
    range: 620,
    effect: {
      id: "forest-rhythm",
      label: "Ritmo da Mata",
      description: "Enquanto o jogador está em movimento, ataques básicos recarregam 15% mais rápido.",
    },
    description: "Arco leve que recompensa movimento e distância.",
  },  {
    id: "ritual-staff",
    name: "Cajado Ritual",
    kind: "staff",
    rarity: "uncommon",
    element: "spirit",
    damage: 21,
    attackRateMs: 510,
    projectileSpeed: 520,
    range: 560,
    effect: {
      id: "spirit-echo",
      label: "Eco Espiritual",
      description: "A cada quarto ataque básico, dispara um segundo pulso com 60% do dano.",
    },
    description: "Dispara pulsos espirituais de alcance médio.",
  },
];

export const MATA_ARMORS: ArpgArmorDefinition[] = [
  {
    id: "leather-armor",
    name: "Sem armadura",
    kind: "light",
    rarity: "common",
    maxHpBonus: 0,
    defenseBonus: 0,
    moveSpeedBonus: 0,
    description: "O personagem entra nas masmorras sem equipamento defensivo.",
  },
  {
    id: "forest-guardian-armor",
    name: "Peitoral dos Rastros do Curupira",
    kind: "medium",
    rarity: "rare",
    maxHpBonus: 28,
    defenseBonus: 7,
    moveSpeedBonus: 0,
    effect: {
      id: "curupira-ward",
      label: "Guarda dos Rastros",
      description: "Enquanto o jogador está em movimento, recebe +2 de redução de dano.",
    },
    description: "Peça rara de jogo inspirada nos rastros invertidos e no papel de guardião do Curupira.",
  },  {
    id: "ritual-cloak",
    name: "Manto Ritual",
    kind: "ritual",
    rarity: "uncommon",
    maxHpBonus: 18,
    defenseBonus: 4,
    moveSpeedBonus: 4,
    effect: {
      id: "ritual-focus",
      label: "Foco Ritual",
      description: "Reduz em 10% a recarga das cartas-habilidade equipadas.",
    },
    description: "Tecido preparado para resistir a efeitos sobrenaturais.",
  },
];

export const MATA_CARDS = STARTER_ARPG_ABILITY_IDS.map((id) => {
  const card = ARPG_ABILITY_CARD_BY_ID.get(id);
  if (!card) throw new Error(`Carta inicial ARPG ausente: ${id}`);
  return card;
}) as [
  NonNullable<ReturnType<typeof ARPG_ABILITY_CARD_BY_ID.get>>,
  NonNullable<ReturnType<typeof ARPG_ABILITY_CARD_BY_ID.get>>,
];

export const MATA_ENEMIES: Record<string, EnemyDefinition> = {
  sprout: {
    id: "sprout",
    name: "Broto Enraivecido",
    combatRole: "melee",
    maxHp: 54,
    moveSpeed: 92,
    contactDamage: 9,
    rewardXp: 8,
    tint: 0x78a95d,
    radius: 16,
  },
  shade: {
    id: "shade",
    name: "Sombra da Mata",
    combatRole: "ranged",
    maxHp: 72,
    moveSpeed: 118,
    contactDamage: 12,
    rewardXp: 11,
    tint: 0x6c4f76,
    radius: 18,
  },
  thorn: {
    id: "thorn",
    name: "Espinho Vivo",
    combatRole: "charger",
    maxHp: 90,
    moveSpeed: 76,
    contactDamage: 14,
    rewardXp: 14,
    tint: 0x4f7d43,
    radius: 20,
  },
  elite: {
    id: "elite",
    name: "Guardião Corrompido",
    combatRole: "elite",
    maxHp: 240,
    moveSpeed: 84,
    contactDamage: 20,
    rewardXp: 48,
    tint: 0xc16b43,
    radius: 27,
  },
  miniBoss: {
    id: "miniBoss",
    name: "Mapinguari",
    combatRole: "caster",
    maxHp: 390,
    moveSpeed: 72,
    contactDamage: 24,
    rewardXp: 90,
    tint: 0x9d754b,
    radius: 31,
  },
  boss: {
    id: "boss",
    name: "Curupira Ancestral",
    maxHp: 540,
    moveSpeed: 90,
    contactDamage: 18,
    rewardXp: 180,
    tint: 0xe28241,
    radius: 34,
  },
};
export const MATA_ROOM_WAVES: readonly (readonly string[])[] = [
  ["sprout", "sprout", "shade"],
  ["sprout", "thorn", "shade", "shade"],
  ["thorn", "thorn", "elite"],
  ["sprout", "shade", "miniBoss"],
  ["boss"],
];

export function createMataRoomPlan(random: () => number = Math.random) {
  const earlyRooms = MATA_ROOM_WAVES.slice(0, 3).map((wave) => [...wave]);
  for (let index = earlyRooms.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [earlyRooms[index], earlyRooms[target]] = [earlyRooms[target], earlyRooms[index]];
  }
  return [
    ...earlyRooms,
    [...MATA_ROOM_WAVES[3]],
    [...MATA_ROOM_WAVES[4]],
  ];
}

export const MATA_ROOM_LOOT_POOLS = [
  [
    { kind: "weapon", id: "ritual-staff", label: "Cajado Ritual" },
    { kind: "weapon", id: "iron-sword", label: "Espada de Ferro" },
  ],
  [
    { kind: "weapon", id: "iron-sword", label: "Espada de Ferro" },
    { kind: "weapon", id: "ritual-staff", label: "Cajado Ritual" },
  ],
  [
    { kind: "weapon", id: "forest-bow", label: "Arco da Mata" },
    { kind: "weapon", id: "ritual-staff", label: "Cajado Ritual" },
    { kind: "weapon", id: "thorn-guard-blade", label: "Lâmina do Guardião dos Espinhos" },
  ],
  [
    { kind: "weapon", id: "forest-bow", label: "Arco da Mata" },
    { kind: "weapon", id: "ritual-staff", label: "Cajado Ritual" },
  ],
] as const;

export const DEFAULT_ARPG_LOADOUT: ArpgLoadout = {
  weaponId: MATA_WEAPONS[1].id,
  armorId: MATA_ARMORS[0].id,
  relicId: STARTER_ARPG_RELIC_ID,
  abilityIds: [MATA_CARDS[0].id, MATA_CARDS[1].id],
};

export const MATA_REGION_META = {
  id: "mata-encantada",
  name: "Mata Encantada",
  bossName: "Curupira Ancestral",
  background: ARPG_ASSETS.environments.mataEncounter,
  roomCount: MATA_ROOM_WAVES.length,
};
