import { describe, expect, it } from "vitest";
import {
  ARPG_ABILITY_CARDS,
  STARTER_ARPG_ABILITY_IDS,
} from "./content/ability-cards";
import { PLAYABLE_LEGENDS } from "./content/legends";
import {
  MARES_ARMORS,
  MARES_ENEMIES,
  MARES_ROOM_WAVES,
  MARES_WEAPONS,
} from "./content/arquipelago-das-mares";
import {
  ARPG_DUNGEON_CONFIGS,
  createDungeonLootPlan,
  isDungeonLootPlanValid,
} from "./content/dungeons";
import {
  ARPG_ARMORS,
  ARPG_WEAPONS,
  getArmorAbilityCooldownMs,
  getArmorDashCooldownMs,
  getArmorMovingDefenseBonus,
  getArmorRetaliationDamage,
  getWeaponAttackIntervalMs,
  getWeaponAttackProc,
} from "./content/equipment";
import { ARPG_EXPEDITIONS, DEFAULT_ARPG_EXPEDITION_ID } from "./content/expeditions";
import {
  createMataRoomPlan,
  DEFAULT_ARPG_LOADOUT,
  MATA_ARMORS,
  MATA_CARDS,
  MATA_ENEMIES,
  MATA_ROOM_WAVES,
  MATA_WEAPONS,
} from "./content/mata-encantada";
import {
  RUNIC_ARMORS,
  RUNIC_ENEMIES,
  RUNIC_ROOM_WAVES,
  RUNIC_WEAPONS,
} from "./content/montanhas-runicas";
import {
  ARPG_RELICS,
  getRelicAbilityCooldownMs,
  getRelicChestHeal,
  getRelicXpMultiplier,
  STARTER_ARPG_RELIC_ID,
} from "./content/relics";
import { ArpgBridge } from "./runtime/bridge";

describe("fundação ARPG da Mata Encantada", () => {
  it("mantém catálogo de expedições explícito e sem liberar conteúdo incompleto", () => {
    expect(DEFAULT_ARPG_EXPEDITION_ID).toBe("mata-encantada");
    expect(ARPG_EXPEDITIONS.map((item) => item.id)).toEqual([
      "mata-encantada",
      "arquipelago-das-mares",
      "montanhas-runicas",
    ]);
    expect(ARPG_EXPEDITIONS.filter((item) => item.available).map((item) => item.id)).toEqual([
      "mata-encantada",
      "arquipelago-das-mares",
      "montanhas-runicas",
    ]);
  });

  it("mantém uma configuração de runtime para cada expedição disponível", () => {
    const availableIds = ARPG_EXPEDITIONS.filter((item) => item.available).map((item) => item.id);
    expect(Object.keys(ARPG_DUNGEON_CONFIGS).sort()).toEqual([...availableIds].sort());
    for (const id of availableIds) {
      const dungeon = ARPG_DUNGEON_CONFIGS[id];
      expect(dungeon.createRoomPlan()).toHaveLength(5);
      expect(dungeon.enemies.boss).toBeDefined();
      expect(dungeon.roomLootPools).toHaveLength(4);
      expect(dungeon.createLootPlan(() => 0)).toHaveLength(4);
      expect(dungeon.enemyFrames.boss).toBeTypeOf("number");
    }
  });

  it("sorteia loot por sala e valida somente planos pertencentes à dungeon", () => {
    const mataFirst = createDungeonLootPlan("mata-encantada", () => 0);
    const maresAlt = createDungeonLootPlan("arquipelago-das-mares", () => 0.99);
    const runicAlt = createDungeonLootPlan("montanhas-runicas", () => 0.99);
    expect(mataFirst).toHaveLength(4);
    expect(maresAlt).toHaveLength(4);
    expect(runicAlt).toHaveLength(4);
    expect(isDungeonLootPlanValid("mata-encantada", mataFirst.map((item) => item.id))).toBe(true);
    expect(isDungeonLootPlanValid("arquipelago-das-mares", maresAlt.map((item) => item.id))).toBe(true);
    expect(isDungeonLootPlanValid("montanhas-runicas", runicAlt.map((item) => item.id))).toBe(true);
    expect(isDungeonLootPlanValid("mata-encantada", [
      "ahuizotl-guard-armor",
      "ritual-cloak",
      "forest-bow",
      "forest-guardian-armor",
    ])).toBe(false);
  });

  it("mantém o Arquipélago com cinco salas, boss e equipamentos próprios", () => {
    expect(MARES_ROOM_WAVES).toHaveLength(5);
    expect(MARES_ROOM_WAVES.at(-1)).toEqual(["boss"]);
    expect(MARES_ENEMIES.miniBoss.name).toBe("Ahuízotl");
    expect(MARES_ENEMIES.boss.name).toBe("Iara das Profundezas");
    expect(MARES_WEAPONS).toHaveLength(4);
    expect(MARES_ARMORS).toHaveLength(3);
    expect(ARPG_WEAPONS).toHaveLength(12);
    expect(ARPG_ARMORS).toHaveLength(9);
  });

  it("mantém as Montanhas Rúnicas com Amarok, Yeti e loot próprio", () => {
    expect(RUNIC_ROOM_WAVES).toHaveLength(5);
    expect(RUNIC_ROOM_WAVES.at(-1)).toEqual(["boss"]);
    expect(RUNIC_ENEMIES.miniBoss.name).toBe("Yeti");
    expect(RUNIC_ENEMIES.boss.name).toBe("Amarok");
    expect(RUNIC_WEAPONS).toHaveLength(4);
    expect(RUNIC_ARMORS).toHaveLength(3);
    expect(ARPG_DUNGEON_CONFIGS["montanhas-runicas"].enemyAtlas?.miniBoss).toBe("folklore-atlas-2");
  });

  it("declara os papéis de combate por arquétipo e bioma", () => {
    expect([
      MATA_ENEMIES.sprout.combatRole,
      MATA_ENEMIES.shade.combatRole,
      MATA_ENEMIES.thorn.combatRole,
      MATA_ENEMIES.elite.combatRole,
      MATA_ENEMIES.miniBoss.combatRole,
    ]).toEqual(["melee", "ranged", "charger", "elite", "caster"]);
    expect([
      MARES_ENEMIES.skirmisher.combatRole,
      MARES_ENEMIES.guardian.combatRole,
      MARES_ENEMIES.elite.combatRole,
      MARES_ENEMIES.miniBoss.combatRole,
    ]).toEqual(["charger", "melee", "elite", "caster"]);
    expect([
      RUNIC_ENEMIES.messenger.combatRole,
      RUNIC_ENEMIES.stormBeast.combatRole,
      RUNIC_ENEMIES.treasureLight.combatRole,
      RUNIC_ENEMIES.elite.combatRole,
    ]).toEqual(["ranged", "charger", "caster", "elite"]);
  });

  it("mantém o loadout pequeno e legível", () => {
    expect(MATA_CARDS).toHaveLength(2);
    expect(MATA_WEAPONS).toHaveLength(4);
    expect(MATA_ARMORS).toHaveLength(3);
    expect(DEFAULT_ARPG_LOADOUT.weaponId).toBe("forest-bow");
    expect(MATA_WEAPONS[0]?.id).toBe("iron-sword");
    expect(DEFAULT_ARPG_LOADOUT.abilityIds).toHaveLength(2);
    expect(DEFAULT_ARPG_LOADOUT.abilityIds).toEqual([...STARTER_ARPG_ABILITY_IDS]);
  });

  it("mantém efeitos de armas e ignora completamente as armaduras legadas", () => {
    const forestBow = ARPG_WEAPONS.find((item) => item.id === "forest-bow")!;
    const ritualStaff = ARPG_WEAPONS.find((item) => item.id === "ritual-staff")!;
    const tideBlade = ARPG_WEAPONS.find((item) => item.id === "tide-blade")!;
    const riverBow = ARPG_WEAPONS.find((item) => item.id === "river-bow")!;
    const iaraStaff = ARPG_WEAPONS.find((item) => item.id === "iara-song-staff")!;
    const ritualCloak = ARPG_ARMORS.find((item) => item.id === "ritual-cloak")!;
    const kelpieCloak = ARPG_ARMORS.find((item) => item.id === "kelpie-mist-cloak")!;
    const curupiraArmor = ARPG_ARMORS.find((item) => item.id === "forest-guardian-armor")!;
    const ahuizotlArmor = ARPG_ARMORS.find((item) => item.id === "ahuizotl-guard-armor")!;
    expect(getWeaponAttackIntervalMs(forestBow, false)).toBe(430);
    expect(getWeaponAttackIntervalMs(forestBow, true)).toBe(366);
    expect(getArmorAbilityCooldownMs(ritualCloak, 10_000)).toBe(10_000);
    expect(getArmorDashCooldownMs(kelpieCloak, 820)).toBe(820);
    expect(getArmorMovingDefenseBonus(curupiraArmor, false)).toBe(0);
    expect(getArmorMovingDefenseBonus(curupiraArmor, true)).toBe(0);
    expect(getWeaponAttackProc(tideBlade, 1).cleaveMultiplier).toBe(0.35);
    expect(getWeaponAttackProc(riverBow, 1).piercing).toBe(true);
    expect(getWeaponAttackProc(ritualStaff, 3).echoMultiplier).toBe(0);
    expect(getWeaponAttackProc(ritualStaff, 4).echoMultiplier).toBe(0.6);
    expect(getWeaponAttackProc(iaraStaff, 4).restoreHp).toBe(4);
    expect(getArmorRetaliationDamage(ahuizotlArmor)).toBe(0);
    expect(ARPG_WEAPONS.filter((item) => item.rarity !== "common").every((item) => item.effect)).toBe(true);
    expect(ARPG_WEAPONS.filter((item) => item.rarity === "common").every((item) => !item.effect)).toBe(true);
  });

  it("offers three new biome weapons with distinct high-impact cadence", () => {
    for (const id of ["thorn-guard-blade", "coral-ward-bow", "frostfall-sword"]) {
      const weapon = ARPG_WEAPONS.find((item) => item.id === id);
      expect(weapon?.damage).toBeGreaterThan(24);
      expect(weapon?.attackRateMs).toBeGreaterThan(490);
      expect(weapon?.effect).toBeDefined();
      expect(Object.values(ARPG_DUNGEON_CONFIGS).some((dungeon) =>
        dungeon.roomLootPools.flat().some((loot) => loot.id === id))).toBe(true);
    }
    expect(new Set(ARPG_WEAPONS.map((weapon) => weapon.id)).size).toBe(ARPG_WEAPONS.length);
  });

  it("mantém uma relíquia equipada e três opções com efeitos distintos", () => {
    expect(ARPG_RELICS).toHaveLength(3);
    expect(new Set(ARPG_RELICS.map((relic) => relic.id)).size).toBe(3);
    expect(DEFAULT_ARPG_LOADOUT.relicId).toBe(STARTER_ARPG_RELIC_ID);
    const starter = ARPG_RELICS.find((relic) => relic.id === STARTER_ARPG_RELIC_ID)!;
    const curupira = ARPG_RELICS.find((relic) => relic.id === "curupira-track-talisman")!;
    const iara = ARPG_RELICS.find((relic) => relic.id === "iara-shell-charm")!;
    expect(getRelicXpMultiplier(starter)).toBe(1.1);
    expect(getRelicChestHeal(curupira)).toBe(10);
    expect(getRelicAbilityCooldownMs(iara, 10_000)).toBe(8_800);
    expect(ARPG_RELICS.filter((relic) => relic.acquisition.source === "dungeon-clear")).toHaveLength(2);
  });

  it("entrega exatamente dois ataques próprios com cada Lenda", () => {
    expect(ARPG_ABILITY_CARDS).toHaveLength(PLAYABLE_LEGENDS.length * 2);
    expect(new Set(ARPG_ABILITY_CARDS.map((card) => card.id)).size).toBe(ARPG_ABILITY_CARDS.length);
    expect(STARTER_ARPG_ABILITY_IDS).toEqual(["curupira-root-snare", "curupira-ember-arrow"]);
    expect(ARPG_ABILITY_CARDS.filter((card) => card.acquisition.source === "starter").map((card) => card.id).sort())
      .toEqual([...STARTER_ARPG_ABILITY_IDS].sort());
    expect(ARPG_ABILITY_CARDS.every((card) => !card.purchasable && card.purchasePrice === null)).toBe(true);
    for (const legend of PLAYABLE_LEGENDS) {
      expect(ARPG_ABILITY_CARDS
        .filter((card) => card.creatureId === legend.id)
        .map((card) => card.id)
        .sort())
        .toEqual([...legend.signatureAbilityIds].sort());
    }
  });

  it("vincula poderes às Lendas e deixa armas e relíquias nas masmorras", () => {
    expect(ARPG_ABILITY_CARDS.every((card) => ["starter", "legend"].includes(card.acquisition.source))).toBe(true);
    expect(Object.values(ARPG_DUNGEON_CONFIGS).every((dungeon) => !("cardDrops" in dungeon))).toBe(true);
    expect(ARPG_RELICS.every((relic) => relic.acquisition.source === "dungeon-clear" || relic.id === STARTER_ARPG_RELIC_ID)).toBe(true);
  });

  it("fecha a vertical slice com elite, mini boss e boss na quinta sala", () => {
    const roomPlan = createMataRoomPlan(() => 0.5);
    expect(roomPlan).toHaveLength(5);
    expect(roomPlan.at(-1)).toEqual(["boss"]);
    expect(MATA_ROOM_WAVES).toHaveLength(5);
    expect(MATA_ROOM_WAVES.flat()).toContain("elite");
    expect(MATA_ROOM_WAVES.flat()).toContain("miniBoss");
    expect(MATA_ENEMIES.miniBoss.name).toBe("Mapinguari");
    expect(MATA_ROOM_WAVES.at(-1)).toEqual(["boss"]);
    expect(MATA_ENEMIES.boss.name).toBe("Curupira Ancestral");
  });
  it("consome comandos de toque apenas uma vez", () => {
    const bridge = new ArpgBridge();
    bridge.queueDash();
    bridge.queueAbility(1);

    expect(bridge.consumeDash()).toBe(true);
    expect(bridge.consumeDash()).toBe(false);
    expect(bridge.consumeAbility(1)).toBe(true);
    expect(bridge.consumeAbility(1)).toBe(false);
  });

  it("limita o joystick virtual sem alocar um novo snapshot a cada leitura", () => {
    const bridge = new ArpgBridge();
    const inputReference = bridge.getInput();
    bridge.setMove(5, -3);
    expect(bridge.getInput()).toBe(inputReference);
    expect(inputReference).toMatchObject({ moveX: 1, moveY: -1 });
    bridge.setMove(0, 0);
    expect(inputReference).toMatchObject({ moveX: 0, moveY: 0 });
  });
});
