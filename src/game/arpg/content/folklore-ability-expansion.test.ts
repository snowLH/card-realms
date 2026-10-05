import { describe, expect, it } from "vitest";
import { createPvpBattle, getSide, resolveAbility } from "../../battle/engine";
import { ArpgLoadoutSchema } from "../domain/loadout-schema";
import { ArpgRaidLoadoutSchema } from "../raid/schema";
import { DEFAULT_AVATAR_CONFIG } from "../../save/local-progress";
import {
  ARPG_ABILITY_CARD_BY_ID,
  ARPG_ABILITY_CARD_IDS,
  ARPG_ABILITY_CARDS,
} from "./ability-cards";
import { ARPG_FOLKLORE_ABILITY_EXPANSION } from "./folklore-ability-expansion";
import { DEFAULT_ARPG_LOADOUT } from "./mata-encantada";

const EXPECTED_CREATURE_IDS = [
  "boto-cor-de-rosa",
  "cuca",
  "mula-sem-cabeca",
  "matinta-pereira",
  "boiuna",
  "mapinguari",
  "vitoria-regia",
  "alicanto",
  "camahueto",
  "ahuizotl",
  "la-llorona",
  "cadejo",
  "chupacabra",
  "jackalope",
  "jersey-devil",
  "selkie",
  "black-shuck",
  "baba-yaga",
  "leshy",
  "anansi",
  "sasabonsam",
  "impundulu",
  "tokoloshe",
  "oni",
  "jiangshi",
  "huli-jing",
  "tikbalang",
  "manananggal",
  "penanggalan",
  "bunyip",
  "taniwha",
] as const;

const EXPECTED_ABILITY_IDS = [
  "boto-river-current",
  "cuca-echo-cauldron",
  "mula-cinder-stampede",
  "matinta-whistling-mark",
  "boiuna-eddy-snare",
  "mapinguari-hollow-roar",
  "vitoria-regia-moon-bloom",
  "alicanto-mineral-glint",
  "camahueto-hoofbreak",
  "ahuizotl-spring-hand",
  "llorona-river-lament",
  "cadejo-crossroads-pulse",
  "chupacabra-night-quills",
  "jackalope-bramble-bounce",
  "jersey-devil-pine-scream",
  "selkie-breaker-lance",
  "black-shuck-lantern-gaze",
  "baba-yaga-threshold-fence",
  "leshy-forest-circle",
  "anansi-thread-snare",
  "sasabonsam-canopy-strike",
  "impundulu-thunderclap",
  "tokoloshe-low-mist",
  "oni-kanabo-impact",
  "jiangshi-paper-seal",
  "huli-jing-foxfire",
  "tikbalang-hoofbeat",
  "manananggal-shadow-sweep",
  "penanggalan-return-tether",
  "bunyip-billabong-echo",
  "taniwha-place-ward",
] as const;

const CULTURAL_REVIEW_GATED_ABILITY_IDS = [
  "sasabonsam-canopy-strike",
  "manananggal-shadow-sweep",
  "penanggalan-return-tether",
  "bunyip-billabong-echo",
  "taniwha-place-ward",
] as const;

const PRICE_BY_RARITY = {
  common: 80,
  uncommon: 120,
  rare: 180,
  epic: 240,
  legendary: 320,
  mythic: 320,
} as const;

const SUPPORTED_BEHAVIORS = new Set([
  "projectile",
  "piercing-projectile",
  "self-area",
  "targeted-control",
  "renewal",
]);
const SUPPORTED_ELEMENTS = new Set(["fire", "water", "nature", "storm", "spirit"]);

describe("folklore ability expansion", () => {
  it("covers the 31 roster entities and exposes every card in the central catalog", () => {
    expect(ARPG_FOLKLORE_ABILITY_EXPANSION).toHaveLength(31);
    expect(ARPG_FOLKLORE_ABILITY_EXPANSION.map((card) => card.creatureId)).toEqual(EXPECTED_CREATURE_IDS);
    expect(new Set(ARPG_FOLKLORE_ABILITY_EXPANSION.map((card) => card.creatureId)).size).toBe(31);
    expect(ARPG_ABILITY_CARDS).toHaveLength(44);
    expect(ARPG_ABILITY_CARD_BY_ID.size).toBe(44);
    expect(ARPG_ABILITY_CARD_IDS.size).toBe(44);
    expect(ARPG_FOLKLORE_ABILITY_EXPANSION.filter((card) => card.purchasable)).toHaveLength(26);
    expect(ARPG_FOLKLORE_ABILITY_EXPANSION.filter((card) => !card.purchasable).map((card) => card.id))
      .toEqual(CULTURAL_REVIEW_GATED_ABILITY_IDS);
    for (const card of ARPG_FOLKLORE_ABILITY_EXPANSION) {
      expect(ARPG_ABILITY_CARD_IDS.has(card.id)).toBe(true);
      expect(ARPG_ABILITY_CARD_BY_ID.get(card.id)).toBe(card);
    }
  });

  it("has 31 unique, stable ability IDs with no collisions in the existing catalog", () => {
    const abilityIds = ARPG_FOLKLORE_ABILITY_EXPANSION.map((card) => card.id);
    expect(abilityIds).toEqual(EXPECTED_ABILITY_IDS);
    expect(new Set(abilityIds).size).toBe(31);
    expect(new Set(ARPG_ABILITY_CARDS.map((card) => card.id)).size).toBe(44);
  });

  it("accepts two expansion abilities through the existing loadout schema", () => {
    const abilityIds = ARPG_FOLKLORE_ABILITY_EXPANSION.slice(0, 2).map((card) => card.id) as [string, string];
    const result = ArpgLoadoutSchema.safeParse({ ...DEFAULT_ARPG_LOADOUT, abilityIds });
    const raidResult = ArpgRaidLoadoutSchema.safeParse({
      weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
      armorId: DEFAULT_ARPG_LOADOUT.armorId,
      relicId: DEFAULT_ARPG_LOADOUT.relicId,
      abilityIds,
    });

    expect(result.success).toBe(true);
    expect(raidResult.success).toBe(true);
    if (result.success) expect(result.data.abilityIds).toEqual(abilityIds);
  });

  it("resolves an expansion ability through the existing PvP combat engine", () => {
    const abilityIds = ARPG_FOLKLORE_ABILITY_EXPANSION.slice(0, 2).map((card) => card.id);
    const state = createPvpBattle("folklore-expansion-pvp", {
      id: "player-one",
      name: "Avatar A",
      avatarConfig: DEFAULT_AVATAR_CONFIG,
      abilityIds,
    }, {
      id: "player-two",
      name: "Avatar B",
      avatarConfig: DEFAULT_AVATAR_CONFIG,
      abilityIds,
    }, () => 0);
    const activePlayer = getSide(state, state.turn.sideId);
    const result = resolveAbility(state, activePlayer.id, 0, 6, 100, "folklore-expansion-pvp-action");

    expect(result.events[0]).toMatchObject({ kind: "ability_used", abilityId: abilityIds[0] });
  });

  it("uses supported behaviors, valid combat fields, and the rarity price schedule", () => {
    for (const card of ARPG_FOLKLORE_ABILITY_EXPANSION) {
      expect(card.name.trim().length).toBeGreaterThan(0);
      expect(card.description.trim().length).toBeGreaterThan(0);
      expect(SUPPORTED_ELEMENTS.has(card.element)).toBe(true);
      expect(SUPPORTED_BEHAVIORS.has(card.behavior)).toBe(true);
      if ((CULTURAL_REVIEW_GATED_ABILITY_IDS as readonly string[]).includes(card.id)) {
        expect(card.purchasable).toBe(false);
        expect(card.purchasePrice).toBeNull();
        expect(card.acquisition).toEqual({ source: "lobby-shop", label: "Aguardando revisão cultural" });
      } else {
        expect(card.purchasable).toBe(true);
        expect(card.purchasePrice).toBe(PRICE_BY_RARITY[card.rarity]);
        expect(card.acquisition).toEqual({ source: "lobby-shop", label: "Loja do lobby" });
      }
      expect(Number.isInteger(card.cooldownMs) && card.cooldownMs >= 3000 && card.cooldownMs <= 12000).toBe(true);
      expect(Number.isInteger(card.damage) && card.damage >= 0 && card.damage <= 100).toBe(true);

      if (card.behavior === "renewal") {
        expect(card.damage).toBe(0);
        expect(Number.isInteger(card.restoreHp) && (card.restoreHp ?? 0) > 0).toBe(true);
      } else {
        expect(card.damage).toBeGreaterThan(0);
        expect(card.restoreHp).toBeUndefined();
      }

      if (card.behavior === "projectile" || card.behavior === "piercing-projectile") {
        expect(Number.isFinite(card.projectileSpeed) && (card.projectileSpeed ?? 0) >= 500).toBe(true);
      } else if (card.behavior === "self-area" || card.behavior === "targeted-control") {
        expect(Number.isFinite(card.radius) && (card.radius ?? 0) >= 100 && (card.radius ?? 0) <= 200).toBe(true);
      }

      if (card.behavior === "targeted-control" || (card.behavior === "self-area" && card.kind === "control")) {
        expect(Number.isInteger(card.durationMs) && (card.durationMs ?? 0) > 0).toBe(true);
      }
    }
  });
});
