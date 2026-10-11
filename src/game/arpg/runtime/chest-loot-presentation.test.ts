import { describe, expect, it } from "vitest";
import {
  CHEST_LOOT_RARITY_PRESENTATION,
  claimChestLootVisualSlot,
  findChestLootLandingPoint,
  getChestLootVisualDetails,
} from "./chest-loot-presentation";
import { buildDungeonNavigation } from "../dungeon/navigation";
import { generateDungeon } from "../dungeon/generator";
import { buildDungeonPixelLayout } from "../dungeon/layout";
import { gridCellKey, worldToGridCell } from "../navigation/grid-path";

describe("chest loot presentation", () => {
  it("uses the assigned weapon silhouette and its declared rarity", () => {
    expect(getChestLootVisualDetails({ kind: "weapon", id: "raiju-staff", label: "Cajado do Raijū" }))
      .toMatchObject({
        silhouette: "staff",
        rarity: "epic",
        textureKey: "folklard-external-weapons-bennyboi-hack",
        frame: 67,
        tint: 0xffec8d,
      });
  });

  it("keeps rarity feedback defined across the full rarity union", () => {
    expect(Object.keys(CHEST_LOOT_RARITY_PRESENTATION)).toEqual([
      "common", "uncommon", "rare", "epic", "legendary", "mythic",
    ]);
    expect(CHEST_LOOT_RARITY_PRESENTATION.common).toMatchObject({ color: 0xd8cba5, sparkleCount: 3, noteCount: 2, noteDurationMs: 180 });
    expect(CHEST_LOOT_RARITY_PRESENTATION.uncommon).toMatchObject({ color: 0x8fc56b, sparkleCount: 6, outlineCount: 1, noteCount: 3, noteDurationMs: 240 });
    expect(CHEST_LOOT_RARITY_PRESENTATION.rare).toMatchObject({ color: 0x6ca4cc, sparkleCount: 10, outlineCount: 2, noteCount: 4, noteDurationMs: 340 });
    expect(CHEST_LOOT_RARITY_PRESENTATION.epic.sparkleCount).toBeGreaterThan(CHEST_LOOT_RARITY_PRESENTATION.rare.sparkleCount);
  });

  it("claims one visible loot visual per presentation", () => {
    const slot = { claimed: false };
    expect(claimChestLootVisualSlot(slot)).toBe(true);
    expect(claimChestLootVisualSlot(slot)).toBe(false);
    expect(slot.claimed).toBe(true);
  });

  it("uses a walkable same-room landing and tries the two lateral fallback cells", () => {
    const navigation = {
      tileSize: 24,
      originX: 0,
      originY: 0,
      walkable: new Set(["2,3", "1,3"]),
      roomIdByCell: new Map([["2,3", "room-a"], ["1,3", "room-a"]]),
    };
    expect(findChestLootLandingPoint(navigation, "room-a", { x: 48, y: 48 }))
      .toEqual({ x: 48, y: 72 });
    navigation.walkable.delete("2,3");
    expect(findChestLootLandingPoint(navigation, "room-a", { x: 48, y: 48 }))
      .toEqual({ x: 16, y: 72 });
    expect(findChestLootLandingPoint(navigation, "room-b", { x: 48, y: 48 })).toBeNull();
  });

  it("falls back to the nearest safe cell in the room when the three preferred cells are blocked", () => {
    const navigation = {
      tileSize: 24,
      originX: 0,
      originY: 0,
      walkable: new Set(["4,3"]),
      roomIdByCell: new Map([["4,3", "room-a"]]),
    };
    expect(findChestLootLandingPoint(navigation, "room-a", { x: 48, y: 48 }))
      .toEqual({ x: 96, y: 72 });
    expect(findChestLootLandingPoint(navigation, "room-b", { x: 48, y: 48 })).toBeNull();
  });

  it("finds an in-room floor spot across generated biome templates and seeds", () => {
    const regions = ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const;
    for (const regionId of regions) {
      for (let index = 0; index < 16; index += 1) {
        const graph = generateDungeon({ seed: `chest-landing-${regionId}-${index}`, regionId });
        const layout = buildDungeonPixelLayout(graph);
        const navigation = buildDungeonNavigation(graph, layout);
        for (const room of Object.values(graph.rooms)) {
          const roomLayout = layout.rooms[room.id];
          const landing = findChestLootLandingPoint(navigation, room.id, {
            x: roomLayout.centerX,
            y: roomLayout.centerY + 78,
          });
          expect(landing, `${regionId} seed ${index} room ${room.id}`).not.toBeNull();
          const cell = worldToGridCell(landing!, navigation);
          const key = gridCellKey(cell.x, cell.y);
          expect(navigation.walkable.has(key), `${regionId} seed ${index} walkable ${key}`).toBe(true);
          expect(navigation.roomIdByCell?.get(key), `${regionId} seed ${index} room ${key}`).toBe(room.id);
        }
      }
    }
  });
});
