import type {
  ArpgArmorDefinition,
  ArpgWeaponDefinition,
  EnemyDefinition,
} from "../domain/types";
import { ARPG_ASSETS } from "../assets";

export const RUNIC_WEAPONS: ArpgWeaponDefinition[] = [

  {
    id: "runic-sabre",
    name: "Sabre Rúnico",
    kind: "sword",
    rarity: "common",
    element: "storm",
    damage: 26,
    attackRateMs: 380,
    range: 82,
    description: "Lâmina de expedição adaptada para passagens estreitas e tempestades de altitude.",
  },
  {
    id: "alicanto-bow",
    name: "Arco do Rastro do Alicanto",
    kind: "bow",
    rarity: "rare",
    element: "spirit",
    damage: 23,
    attackRateMs: 410,
    projectileSpeed: 700,
    range: 680,
    effect: {
      id: "forest-rhythm",
      label: "Rastro Luminoso",
      description: "Enquanto o jogador está em movimento, ataques básicos recarregam 15% mais rápido.",
    },
    description: "Adaptação de Card Realms inspirada no brilho mineral atribuído ao Alicanto.",
  },
  {
    id: "raiju-staff",
    name: "Cajado do Raijū",
    kind: "staff",
    rarity: "epic",
    element: "storm",
    damage: 29,
    attackRateMs: 490,
    projectileSpeed: 610,
    range: 620,
    effect: {
      id: "spirit-echo",
      label: "Eco do Trovão",
      description: "A cada quarto ataque básico, dispara um segundo pulso com 60% do dano.",
    },
    description: "Relíquia de jogo inspirada na associação do Raijū com relâmpagos e tempestades.",
  },
  {
    id: "frostfall-sword",
    name: "Espada da Nevasca",
    kind: "sword",
    rarity: "rare",
    element: "water",
    damage: 37,
    attackRateMs: 600,
    range: 94,
    effect: { id: "tide-cleave", label: "Lâmina Congelada", description: "O impacto gera um corte secundário em área com 35% do dano." },
    description: "Uma espada pesada que sacrifica velocidade por ataques amplos.",
  },
];

export const RUNIC_ARMORS: ArpgArmorDefinition[] = [
  {
    id: "highland-coat",
    name: "Casaco das Alturas",
    kind: "light",
    rarity: "common",
    maxHpBonus: 18,
    defenseBonus: 4,
    moveSpeedBonus: 7,
    description: "Proteção simples para travessias frias e terreno irregular.",
  },
  {
    id: "amarok-hunter-armor",
    name: "Couraça da Caçada do Amarok",
    kind: "medium",
    rarity: "rare",
    maxHpBonus: 30,
    defenseBonus: 8,
    moveSpeedBonus: 1,
    effect: {
      id: "curupira-ward",
      label: "Instinto da Caçada",
      description: "Enquanto o jogador está em movimento, recebe +2 de redução de dano.",
    },
    description: "Adaptação de Card Realms inspirada no Amarok e na sobrevivência em regiões árticas.",
  },
  {
    id: "carbunclo-mantle",
    name: "Manto da Gema do Carbunclo",
    kind: "ritual",
    rarity: "epic",
    maxHpBonus: 22,
    defenseBonus: 5,
    moveSpeedBonus: 5,
    effect: {
      id: "ritual-focus",
      label: "Foco da Gema",
      description: "Reduz em 10% a recarga das cartas-habilidade equipadas.",
    },
    description: "Adaptação de Card Realms inspirada no brilho precioso associado ao Carbunclo.",
  },
];

export const RUNIC_ENEMIES: Record<string, EnemyDefinition> = {
  messenger: {
    id: "messenger",
    name: "Ratatoskr",
    combatRole: "ranged",
    maxHp: 62,
    moveSpeed: 138,
    contactDamage: 9,
    rewardXp: 10,
    tint: 0xc39b62,
    radius: 16,
  },
  stormBeast: {
    id: "stormBeast",
    name: "Raijū",
    combatRole: "charger",
    maxHp: 92,
    moveSpeed: 124,
    contactDamage: 14,
    rewardXp: 16,
    tint: 0x8fdcff,
    radius: 18,
  },
  treasureLight: {
    id: "treasureLight",
    name: "Carbunclo",
    combatRole: "caster",
    maxHp: 76,
    moveSpeed: 112,
    contactDamage: 11,
    rewardXp: 14,
    tint: 0xf2d36e,
    radius: 17,
  },
  elite: {
    id: "elite",
    name: "Alicanto",
    combatRole: "elite",
    maxHp: 250,
    moveSpeed: 108,
    contactDamage: 20,
    rewardXp: 54,
    tint: 0xe7cb86,
    radius: 27,
  },
  miniBoss: {
    id: "miniBoss",
    name: "Yeti",
    combatRole: "melee",
    maxHp: 450,
    moveSpeed: 68,
    contactDamage: 27,
    rewardXp: 102,
    tint: 0xd7e5ef,
    radius: 33,
  },
  boss: {
    id: "boss",
    name: "Amarok",
    maxHp: 760,
    moveSpeed: 112,
    contactDamage: 29,
    rewardXp: 210,
    tint: 0x8aa8c0,
    radius: 36,
  },
};

export const RUNIC_ROOM_WAVES: readonly (readonly string[])[] = [
  ["messenger", "stormBeast", "treasureLight"],
  ["stormBeast", "stormBeast", "messenger", "treasureLight"],
  ["stormBeast", "treasureLight", "elite"],
  ["messenger", "stormBeast", "miniBoss"],
  ["boss"],
];

export const RUNIC_ROOM_LOOT_POOLS = [
  [
    { kind: "weapon", id: "runic-sabre", label: "Sabre Rúnico" },
    { kind: "weapon", id: "alicanto-bow", label: "Arco do Rastro do Alicanto" },
  ],
  [
    { kind: "weapon", id: "runic-sabre", label: "Sabre Rúnico" },
    { kind: "weapon", id: "alicanto-bow", label: "Arco do Rastro do Alicanto" },
  ],
  [
    { kind: "weapon", id: "raiju-staff", label: "Cajado do Raijū" },
    { kind: "weapon", id: "alicanto-bow", label: "Arco do Rastro do Alicanto" },
    { kind: "weapon", id: "frostfall-sword", label: "Espada da Nevasca" },
  ],
  [
    { kind: "weapon", id: "raiju-staff", label: "Cajado do Raijū" },
    { kind: "weapon", id: "alicanto-bow", label: "Arco do Rastro do Alicanto" },
  ],
] as const;

export const RUNIC_REGION_META = {
  id: "montanhas-runicas",
  name: "Montanhas Rúnicas",
  bossName: "Amarok",
  background: ARPG_ASSETS.environments.runicMountains,
  roomCount: RUNIC_ROOM_WAVES.length,
};
