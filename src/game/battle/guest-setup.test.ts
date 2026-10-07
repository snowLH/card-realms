import { describe, expect, it } from "vitest";
import { createEncounterBattle, getSide } from "@/game/engine";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { STARTER_ARPG_ABILITY_IDS } from "@/game/arpg/content/ability-cards";
import { GuestBattleSetupSchema } from "./guest-setup";

const validSetup = {
  avatarConfig: DEFAULT_AVATAR_CONFIG,
  abilityIds: [...STARTER_ARPG_ABILITY_IDS],
};

describe("GuestBattleSetupSchema", () => {
  it("accepts an avatar and exactly two distinct catalog powers", () => {
    expect(GuestBattleSetupSchema.parse(validSetup)).toEqual(validSetup);
  });

  it("stores the parsed guest avatar and powers on the battle side", () => {
    const setup = GuestBattleSetupSchema.parse(validSetup);
    const battle = createEncounterBattle("guest-battle", {
      mode: "wild",
      regionId: "roots",
      opponentId: "wild:boto",
      opponentName: "Boto Encantado",
      playerAvatarConfig: setup.avatarConfig,
      playerAbilityIds: setup.abilityIds,
    }, () => 0.5);

    const player = getSide(battle, "player-one");
    expect(player.avatarConfig).toEqual(setup.avatarConfig);
    expect(player.abilityIds).toEqual(setup.abilityIds);
  });

  it("rejects the wrong number of powers, duplicates, and unknown IDs", () => {
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, abilityIds: [STARTER_ARPG_ABILITY_IDS[0]] }).success).toBe(false);
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, abilityIds: [STARTER_ARPG_ABILITY_IDS[0], STARTER_ARPG_ABILITY_IDS[0]] }).success).toBe(false);
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, abilityIds: [STARTER_ARPG_ABILITY_IDS[0], "unknown-power"] }).success).toBe(false);
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, abilityIds: [...STARTER_ARPG_ABILITY_IDS, "iara-enchanting-song"] }).success).toBe(false);
  });

  it("rejects invalid avatar configuration and extra request fields", () => {
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, avatarConfig: {} }).success).toBe(false);
    expect(GuestBattleSetupSchema.safeParse({ ...validSetup, weaponId: "not-used-in-classic" }).success).toBe(false);
  });
});
