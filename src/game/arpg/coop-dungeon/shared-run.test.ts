import { describe, expect, it } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "../content/mata-encantada";
import { ARPG_ROC_RAID_BOSS } from "../raid/content";
import { advanceArpgRaid, applyArpgRaidAction, createArpgRaidState } from "../raid/engine";
import { ArpgRaidStateSchema } from "../raid/schema";
import { ARPG_RAID_INPUT_STALE_MS, ARPG_RAID_PLAYER_MARGIN } from "../raid/types";
import type { ArpgRaidPlayerSetup } from "../raid/types";
import { ARPG_SHARED_DUNGEON_MIN_DURATION_MS, attachArpgSharedDungeon, planArpgCoopRoomSequence, spawnArpgRaidDungeonWave } from "./shared-run";
import { generateDungeon } from "../dungeon/generator";

const START = 1_800_000_000_000;
const ROOM_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function createPlayers(): ArpgRaidPlayerSetup[] {
  return [1, 2].map((seat) => ({
    id: `${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}-${seat}${seat}${seat}${seat}-4${seat}${seat}${seat}-8${seat}${seat}${seat}-${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}${seat}`,
    name: `Cartógrafa ${seat}`,
    seat,
    loadout: structuredClone(DEFAULT_ARPG_LOADOUT),
  }));
}

function createSharedRun() {
  return attachArpgSharedDungeon(
    createArpgRaidState(ROOM_ID, EVENT_ID, createPlayers(), ARPG_ROC_RAID_BOSS, START),
    "mata-encantada",
  );
}

describe("shared ARPG co-op dungeon", () => {
  it.each(["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"] as const)(
    "visits all generated rooms in %s before the final boss",
    (regionId) => {
      for (let index = 0; index < 20; index += 1) {
        const graph = generateDungeon({ seed: `coop-graph-${regionId}-${index}`, regionId, minRooms: 8, maxRooms: 12 });
        const rooms = planArpgCoopRoomSequence(graph);
        expect(rooms).toHaveLength(Object.keys(graph.rooms).length);
        expect(rooms[0].id).toBe(graph.startRoomId);
        expect(rooms.at(-1)?.id).toBe(graph.bossRoomId);
        expect(new Set(rooms.map((room) => room.id)).size).toBe(rooms.length);
        expect(rooms.some((room) => room.type === "treasure")).toBe(true);
        expect(rooms.some((room) => room.type === "event")).toBe(true);
        expect(rooms.some((room) => room.type === "elite")).toBe(true);
      }
    },
  );

  it("persists one deterministic 8-room route for all party members", () => {
    const first = createSharedRun();
    const second = createSharedRun();
    const parsed = ArpgRaidStateSchema.parse(first);
    expect(parsed.dungeon?.seed).toBe(second.dungeon?.seed);
    expect(parsed.dungeon?.rooms.map((room) => room.id)).toEqual(second.dungeon?.rooms.map((room) => room.id));
    expect(parsed.dungeon?.rooms.length).toBe(8);
    expect(parsed.maxDurationMs).toBeGreaterThanOrEqual(ARPG_SHARED_DUNGEON_MIN_DURATION_MS);
    expect(parsed.dungeon?.rooms.at(-1)?.type).toBe("boss");
    const activeRoom = parsed.dungeon!.rooms[parsed.dungeon!.roomIndex];
    if (activeRoom.type === "combat" || activeRoom.type === "elite") {
      expect(activeRoom.enemies.length).toBeGreaterThan(0);
    } else {
      expect(activeRoom.enemies).toEqual([]);
      expect(activeRoom.state).toBe("awaiting_exit");
    }
    expect(parsed.dungeon?.rooms.filter((room) => !["start", "combat", "elite", "boss"].includes(room.type))
      .every((room) => room.enemies.length === 0 && room.waves.length === 0)).toBe(true);
    expect(parsed.players.every((player) => player.x < parsed.dungeon!.rooms[parsed.dungeon!.roomIndex].worldWidth)).toBe(true);
  });

  it("opens a physical corridor after combat and waits for the whole living party to cross", () => {
    let state = createSharedRun();
    let dungeon = state.dungeon!;
    let room = dungeon.rooms[dungeon.roomIndex];
    room.type = "combat";
    room.waves = [["sprout"]];
    spawnArpgRaidDungeonWave(dungeon, room, 0, state.players.length, START);

    state.players[0].x = room.roomWidth - 55;
    state.players[0].y = room.worldHeight / 2;
    state.players[0].input = { moveX: 1, moveY: 0, aimX: 1, aimY: 0 };
    state = advanceArpgRaid(state, START + 250).state;
    expect(state.players[0].x).toBe(room.roomWidth - ARPG_RAID_PLAYER_MARGIN);
    expect(state.dungeon?.rooms[state.dungeon.roomIndex].state).toBe("combat");

    dungeon = state.dungeon!;
    room = dungeon.rooms[dungeon.roomIndex];
    const target = room.enemies[0]!;
    room.enemies = [target];
    target.hp = 1;
    target.maxHp = 1;
    target.x = state.players[0].x + 24;
    target.y = state.players[0].y;
    state.players[0].input = { moveX: 0, moveY: 0, aimX: 1, aimY: 0 };

    const baseMs = state.serverTimeMs;
    const attacked = applyArpgRaidAction(state, state.players[0].id, {
      kind: "attack",
      actionId: "attack-one",
    }, baseMs);

    expect(attacked.events.some((event) => event.kind === "dungeon_enemy_defeated")).toBe(true);
    expect(attacked.state.dungeon?.rooms[attacked.state.dungeon.roomIndex].state).toBe("awaiting_exit");
    expect(ArpgRaidStateSchema.safeParse(attacked.state).success).toBe(true);

    const timerOnly = advanceArpgRaid(attacked.state, baseMs + 2_000).state;
    expect(timerOnly.dungeon?.roomIndex).toBe(dungeon.roomIndex);

    const currentRoom = timerOnly.dungeon!.rooms[dungeon.roomIndex];
    const centerY = currentRoom.worldHeight / 2;
    const exitX = currentRoom.roomWidth + currentRoom.corridorWidth - ARPG_RAID_PLAYER_MARGIN;
    timerOnly.players[0].x = currentRoom.roomWidth - 100;
    timerOnly.players[0].y = centerY;
    timerOnly.players[0].input = { moveX: 1, moveY: 0, aimX: 1, aimY: 0 };
    timerOnly.players[1].x = currentRoom.roomWidth - 100;
    timerOnly.players[1].y = centerY;

    const enteredCorridor = advanceArpgRaid(timerOnly, timerOnly.serverTimeMs + 500).state;
    expect(enteredCorridor.players[0].x).toBeGreaterThan(currentRoom.roomWidth);
    expect(enteredCorridor.dungeon?.roomIndex).toBe(dungeon.roomIndex);

    enteredCorridor.players[0].x = exitX;
    enteredCorridor.players[0].input = { moveX: 0, moveY: 0, aimX: 1, aimY: 0 };
    const waitingForParty = advanceArpgRaid(enteredCorridor, enteredCorridor.serverTimeMs + 250).state;
    expect(waitingForParty.dungeon?.roomIndex).toBe(dungeon.roomIndex);

    waitingForParty.players[1].input = { moveX: 1, moveY: 0, aimX: 1, aimY: 0 };
    waitingForParty.players[1].lastInputAtMs = waitingForParty.serverTimeMs;
    const stillInCorridor = advanceArpgRaid(waitingForParty, waitingForParty.serverTimeMs + 750).state;
    expect(stillInCorridor.dungeon?.roomIndex).toBe(dungeon.roomIndex);

    const nextAdvance = advanceArpgRaid(stillInCorridor, stillInCorridor.serverTimeMs + 1_000);
    expect(nextAdvance.state.dungeon?.roomIndex).toBe(dungeon.roomIndex + 1);
    expect(nextAdvance.events.some((event) => event.kind === "dungeon_room_entered")).toBe(true);
    expect(ArpgRaidStateSchema.safeParse(nextAdvance.state).success).toBe(true);
  });

  it("does not turn special rooms into fallback combat waves", () => {
    const state = createSharedRun();
    const dungeon = state.dungeon!;
    const room = dungeon.rooms[dungeon.roomIndex];
    room.type = "rest";
    room.waves = [["sprout"]];

    spawnArpgRaidDungeonWave(dungeon, room, 0, state.players.length, START);

    expect(room.enemies).toEqual([]);
    expect(room.state).toBe("awaiting_exit");
    expect(room.nextRoomAtMs).toBeNull();
    expect(ArpgRaidStateSchema.safeParse(state).success).toBe(true);
  });

  it("stops stale movement after a connection gap and resumes on fresh input", () => {
    let state = createSharedRun();
    const player = state.players[0];
    player.input = { moveX: 1, moveY: 0, aimX: 1, aimY: 0 };
    player.lastInputAtMs = state.serverTimeMs - ARPG_RAID_INPUT_STALE_MS - 1;
    const before = player.x;

    state = advanceArpgRaid(state, state.serverTimeMs + 250).state;
    expect(state.players[0].x).toBe(before);
    expect(state.players[0].input.moveX).toBe(0);

    const refreshed = applyArpgRaidAction(state, state.players[0].id, {
      kind: "input",
      actionId: "input-after-reconnect",
      moveX: 1,
      moveY: 0,
      aimX: 1,
      aimY: 0,
    }, state.serverTimeMs + 50).state;
    const resumed = advanceArpgRaid(refreshed, refreshed.serverTimeMs + 250).state;
    expect(resumed.players[0].x).toBeGreaterThan(refreshed.players[0].x);
  });

  it("upgrades saved dungeon timers but not standalone boss raid timers", () => {
    const older = createSharedRun();
    older.maxDurationMs = 6 * 60_000;
    expect(advanceArpgRaid(older, START + 50).state.maxDurationMs).toBe(ARPG_SHARED_DUNGEON_MIN_DURATION_MS);
    const bossOnly = createArpgRaidState(ROOM_ID, EVENT_ID, createPlayers(), ARPG_ROC_RAID_BOSS, START);
    expect(advanceArpgRaid(bossOnly, START + 50).state.maxDurationMs).toBe(6 * 60_000);
  });

  it("migrates a saved timer-complete room to a traversable open corridor", () => {
    const legacyState = structuredClone(createSharedRun());
    const legacyRooms = legacyState.dungeon!.rooms as unknown as Array<Record<string, unknown>>;
    for (const room of legacyRooms) {
      const roomWidth = Number(room.roomWidth);
      room.worldWidth = roomWidth;
      delete room.roomWidth;
      delete room.corridorWidth;
    }
    const currentRoom = legacyRooms[legacyState.dungeon!.roomIndex]!;
    currentRoom.state = "wave_complete";
    currentRoom.nextRoomAtMs = START + 1_500;

    const migrated = ArpgRaidStateSchema.parse(legacyState);
    const parsedRoom = migrated.dungeon!.rooms[migrated.dungeon!.roomIndex];
    expect(parsedRoom.state).toBe("awaiting_exit");
    expect(parsedRoom.corridorWidth).toBeGreaterThan(0);
    expect(parsedRoom.worldWidth).toBe(parsedRoom.roomWidth + parsedRoom.corridorWidth);
    expect(parsedRoom.nextRoomAtMs).toBeNull();
  });
});
