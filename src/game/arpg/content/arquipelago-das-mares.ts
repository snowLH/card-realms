import type {
  ArpgArmorDefinition,
  ArpgWeaponDefinition,
  EnemyDefinition,
} from "../domain/types";
import { ARPG_ASSETS } from "../assets";

export const MARES_WEAPONS: ArpgWeaponDefinition[] = [
  {
    id: "tide-blade",
    name: "Lâmina das Marés",
    kind: "sword",
    rarity: "uncommon",
    element: "water",
    damage: 28,
    attackRateMs: 390,
    range: 84,
    effect: {
      id: "tide-cleave",
      label: "Corte de Maré",
      description: "Cada golpe corpo a corpo causa um segundo corte em área com 35% do dano.",
    },
    description: "Uma lâmina leve moldada para golpes rápidos em passagens inundadas.",
  },
  {
    id: "river-bow",
    name: "Arco Ribeirinho",
    kind: "bow",
    rarity: "rare",
    element: "water",
    damage: 22,
    attackRateMs: 420,
    projectileSpeed: 680,
    range: 660,
    effect: {
      id: "river-pierce",
      label: "Flecha Ribeirinha",
      description: "Os projéteis básicos atravessam inimigos em vez de desaparecer no primeiro acerto.",
    },
    description: "Arco reforçado para disparos longos entre ilhas e passarelas.",
  },
  {
    id: "iara-song-staff",
    name: "Cajado do Canto da Iara",
    kind: "staff",
    rarity: "epic",
    element: "spirit",
    damage: 27,
    attackRateMs: 500,
    projectileSpeed: 560,
    range: 610,
    effect: {
      id: "iara-renewal",
      label: "Eco Restaurador",
      description: "A cada quarto ataque básico, recupera 4 pontos de vida.",
    },
    description: "Relíquia rara inspirada no encanto aquático atribuído à Iara.",
  },
];

export const MARES_ARMORS: ArpgArmorDefinition[] = [
  {
    id: "river-shell-armor",
    name: "Armadura de Conchas",
    kind: "medium",
    rarity: "common",
    maxHpBonus: 24,
    defenseBonus: 6,
    moveSpeedBonus: -2,
    description: "Proteção simples de placas e conchas para travessias molhadas.",
  },
  {
    id: "kelpie-mist-cloak",
    name: "Manto da Névoa do Kelpie",
    kind: "light",
    rarity: "rare",
    maxHpBonus: 16,
    defenseBonus: 4,
    moveSpeedBonus: 10,
    effect: {
      id: "kelpie-step",
      label: "Passo de Névoa",
      description: "Reduz em 20% a recarga do dash.",
    },
    description: "Manto temático inspirado no cavalo-d'água do folclore escocês.",
  },
  {
    id: "ahuizotl-guard-armor",
    name: "Armadura do Ahuízotl",
    kind: "ritual",
    rarity: "epic",
    maxHpBonus: 34,
    defenseBonus: 9,
    moveSpeedBonus: 1,
    effect: {
      id: "ahuizotl-retaliation",
      label: "Cauda Guardiã",
      description: "Ao receber dano, contra-ataca inimigos próximos com um pulso curto.",
    },
    description: "Armadura rara inspirada no Ahuízotl da tradição mexica.",
  },
];

export const MARES_ENEMIES: Record<string, EnemyDefinition> = {
  skirmisher: {
    id: "skirmisher",
    name: "Boto-cor-de-rosa",
    combatRole: "charger",
    maxHp: 68,
    moveSpeed: 122,
    contactDamage: 10,
    rewardXp: 10,
    tint: 0xe795ad,
    radius: 17,
  },
  guardian: {
    id: "guardian",
    name: "Kappa",
    combatRole: "melee",
    maxHp: 104,
    moveSpeed: 78,
    contactDamage: 15,
    rewardXp: 17,
    tint: 0x6ea66a,
    radius: 21,
  },
  elite: {
    id: "elite",
    name: "Kelpie",
    combatRole: "elite",
    maxHp: 255,
    moveSpeed: 104,
    contactDamage: 20,
    rewardXp: 52,
    tint: 0x4b6974,
    radius: 28,
  },
  miniBoss: {
    id: "miniBoss",
    name: "Ahuízotl",
    combatRole: "caster",
    maxHp: 420,
    moveSpeed: 86,
    contactDamage: 25,
    rewardXp: 96,
    tint: 0x496f86,
    radius: 32,
  },
  boss: {
    id: "boss",
    name: "Iara das Profundezas",
    maxHp: 720,
    moveSpeed: 98,
    contactDamage: 27,
    rewardXp: 195,
    tint: 0x61a7c7,
    radius: 35,
  },
};

export const MARES_ROOM_WAVES: readonly (readonly string[])[] = [
  ["skirmisher", "skirmisher", "guardian"],
  ["guardian", "skirmisher", "skirmisher", "guardian"],
  ["guardian", "guardian", "elite"],
  ["skirmisher", "guardian", "miniBoss"],
  ["boss"],
];

export const MARES_ROOM_LOOT_POOLS = [
  [
    { kind: "weapon", id: "tide-blade", label: "Lâmina das Marés" },
    { kind: "weapon", id: "river-bow", label: "Arco Ribeirinho" },
  ],
  [
    { kind: "weapon", id: "tide-blade", label: "Lâmina das Marés" },
    { kind: "weapon", id: "river-bow", label: "Arco Ribeirinho" },
  ],
  [
    { kind: "weapon", id: "iara-song-staff", label: "Cajado do Canto da Iara" },
    { kind: "weapon", id: "river-bow", label: "Arco Ribeirinho" },
  ],
  [
    { kind: "weapon", id: "iara-song-staff", label: "Cajado do Canto da Iara" },
    { kind: "weapon", id: "river-bow", label: "Arco Ribeirinho" },
  ],
] as const;

export const MARES_REGION_META = {
  id: "arquipelago-das-mares",
  name: "Arquipélago das Marés",
  bossName: "Iara das Profundezas",
  background: ARPG_ASSETS.environments.archipelago,
  roomCount: MARES_ROOM_WAVES.length,
};
