import { describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { attachArpgSharedDungeon } from "../coop-dungeon/shared-run";
import { ARPG_ROC_RAID_BOSS } from "../raid/content";
import { advanceArpgRaid, applyArpgRaidAction, createArpgRaidState } from "../raid/engine";
import { ArpgRaidStateSchema } from "../raid/schema";
import { confirmBossRestoration, damageBossEncounter } from "./boss-encounter-controller";

const START = 1800000000000;
function enterArena(count: number, seen = false) {
  let raid = attachArpgSharedDungeon(createArpgRaidState("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", Array.from({ length: count }, (_, index) => ({ id: "33333333-3333-4333-8333-33333333333" + index, name: "Lenda " + index, seat: index + 1, loadout: structuredClone(DEFAULT_ARPG_LOADOUT), seenBossIntroIds: seen ? ["king-arthur"] : [] })), ARPG_ROC_RAID_BOSS, START), "montanhas-runicas");
  const dungeon = raid.dungeon!;
  dungeon.roomIndex = dungeon.rooms.length - 2;
  const antechamber = dungeon.rooms[dungeon.roomIndex];
  antechamber.state = "awaiting_exit"; antechamber.enemies = [];
  for (const player of raid.players) { player.x = antechamber.worldWidth - 32; player.y = antechamber.worldHeight / 2; }
  raid = advanceArpgRaid(raid, START + 100).state;
  expect(raid.dungeon!.rooms[raid.dungeon!.roomIndex].type).toBe("boss");
  expect(raid.bossEncounter?.bossId).toBe("king-arthur");
  return raid;
}

describe("shared forgotten legend authority", () => {
  it.each([2, 4])("locks every member of a %i-player party and rejects all offensive inputs", (count) => {
    let raid = enterArena(count);
    const positions = raid.players.map(({ x, y }) => ({ x, y }));
    let sequence = 0;
    for (const player of raid.players) {
      for (const kind of ["input", "attack", "dash", "ability"] as const) {
        const action = kind === "input" ? { kind, actionId: "input-" + sequence++, clientSeq: 1, moveX: 1, moveY: 1, aimX: 1, aimY: 0 } : kind === "ability" ? { kind, actionId: "ability-" + sequence++, slot: 0 as const } : { kind, actionId: kind + sequence++ };
        raid = applyArpgRaidAction(raid, player.id, action, raid.serverTimeMs + 50).state;
      }
    }
    expect(raid.players.map(({ x, y }) => ({ x, y }))).toEqual(positions);
    expect(raid.players.every((player) => player.input.moveX === 0 && player.dashingUntilMs === 0)).toBe(true);
    expect(raid.boss.hp).toBe(raid.boss.maxHp);
    expect(raid.log.some((event) => ["player_attack", "ability_cast", "player_dash"].includes(event.kind))).toBe(false);
  });
  it("requires party votes for a repeat intro and ignores duplicate actions", () => {
    let raid = enterArena(2, true);
    const action = { kind: "skip_intro" as const, actionId: "skip-1" };
    raid = applyArpgRaidAction(raid, raid.players[0].id, action, raid.serverTimeMs + 100).state;
    raid = applyArpgRaidAction(raid, raid.players[0].id, action, raid.serverTimeMs + 100).state;
    expect(raid.bossEncounter!.skipVotes).toHaveLength(1);
    expect(raid.bossEncounter!.introDurationMs).toBe(1800);
    raid = applyArpgRaidAction(raid, raid.players[1].id, { kind: "skip_intro", actionId: "skip-2" }, raid.serverTimeMs + 100).state;
    raid = advanceArpgRaid(raid, raid.serverTimeMs + 700).state;
    expect(raid.bossEncounter!.state).toBe("COMBAT");
  });
  it("resumes one shared purification and waits for a persistence receipt before victory", () => {
    let raid = enterArena(4);
    for (let step = 0; step < 8; step++) raid = advanceArpgRaid(raid, raid.serverTimeMs + 1000).state;
    expect(raid.bossEncounter!.state).toBe("COMBAT");
    const encounter = raid.bossEncounter!;
    damageBossEncounter(encounter, encounter.maxHp * 0.31, raid.serverTimeMs);
    expect(encounter.phase).toBe(2);
    damageBossEncounter(encounter, encounter.maxHp, raid.serverTimeMs);
    expect(encounter.phase).toBe(3);
    expect(encounter.state).toBe("DEFEATED");
    raid.boss.hp = 0;
    for (let step = 0; step < 2; step++) raid = advanceArpgRaid(raid, raid.serverTimeMs + 1000).state;
    expect(raid.status).toBe("active");
    expect(raid.bossEncounter!.state).toBe("PURIFICATION");
    raid = ArpgRaidStateSchema.parse(JSON.parse(JSON.stringify(raid)));
    for (let step = 0; step < 8; step++) raid = advanceArpgRaid(raid, raid.serverTimeMs + 1000).state;
    expect(raid.bossEncounter!.state).toBe("RESTORED");
    expect(raid.status).toBe("active");
    confirmBossRestoration(raid.bossEncounter!, "king-arthur", true, raid.serverTimeMs);
    raid = advanceArpgRaid(raid, raid.serverTimeMs + 50).state;
    expect(raid.status).toBe("victory");
    expect(raid.bossEncounter!.state).toBe("CLEARED");
    expect(raid.log.filter((event) => event.kind === "raid_victory")).toHaveLength(1);
  });
});
