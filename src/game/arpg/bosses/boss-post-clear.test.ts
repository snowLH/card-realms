import { describe, expect, it, vi } from "vitest";
import { BossEncounterRuntime } from "./boss-encounter-runtime";
import { BossEncounterCompletion } from "./boss-encounter-completion";
import { createBossEncounter } from "./boss-encounter-controller";
import { isBossInputLocked } from "./cinematic-input-lock";
import { DungeonManager } from "../dungeon/manager";
import { generateDungeon } from "../dungeon/generator";
import { CORRUPTED_LEGEND_BOSSES } from "./registry";
import { BOSS_ROOM_ART } from "./boss-room-art";

const art = vi.hoisted(() => ({ update: vi.fn(), destroy: vi.fn() }));
vi.mock("./boss-presentations", () => ({ createBossPresentation: () => art }));

function visual() {
  const methods = ["setDepth", "setOrigin", "setScrollFactor", "setPosition", "setText", "setFontSize", "clear", "lineStyle", "fillStyle", "fillRect", "strokeRect", "slice", "fillPath", "strokePath", "fillCircle", "strokeCircle", "lineBetween", "save", "translateCanvas", "rotateCanvas", "restore"];
  const object: Record<string, ReturnType<typeof vi.fn>> = { destroy: vi.fn() };
  for (const method of methods) object[method] = vi.fn(() => object);
  return object;
}
function fixture(id = "king-arthur", authoritative = false) {
  const effects = visual(), title = visual();
  const camera = { width: 1280, stopFollow: vi.fn(), startFollow: vi.fn(), centerOn: vi.fn() };
  const scene = { add: { graphics: () => effects, text: () => title }, cameras: { main: camera }, events: { once: vi.fn() }, scene: { isActive: () => true } };
  const actor = { active: true, x: 976, y: 144, setData: vi.fn(() => actor), setVelocity: vi.fn(() => actor), setPosition: vi.fn(() => actor), setVisible: vi.fn(() => actor) };
  const player = { x: 976, y: 892, velocity: { x: 0, y: 0 }, setVelocity: vi.fn((x = 0, y = 0) => { player.velocity = { x, y }; return player; }), setPosition: vi.fn((x: number, y: number) => { player.x = x; player.y = y; return player; }) };
  const bridge = { isServerAuthoritativeCombat: () => authoritative, clearGameplayInput: vi.fn(), markBossIntroSeen: vi.fn(), emitMessage: vi.fn(), persistBossRestoration: vi.fn(async () => true) };
  const options = { scene, actor, player, bridge, snapshot: createBossEncounter(id, 0, ["solo"], 100, BOSS_ROOM_ART[id].thronePosition), arena: { left: 0, top: 0, width: 1952, height: 992 }, reducedMotion: false, legendId: "curupira", audio: null, damagePlayer: vi.fn(), onCleared: vi.fn(), onPurificationVisualFinished: vi.fn() };
  const runtime = new BossEncounterRuntime(options as unknown as ConstructorParameters<typeof BossEncounterRuntime>[0]);
  return { runtime, options, scene, camera, actor, player, bridge, title, effects };
}
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }

describe("post-purification gameplay", () => {
  it.each(CORRUPTED_LEGEND_BOSSES)("$id returns control before a delayed save and completes exactly once", async (definition) => {
    const f = fixture(definition.id);
    let confirm!: (confirmed: boolean) => void;
    f.bridge.persistBossRestoration.mockImplementation(() => new Promise((resolve) => { confirm = resolve; }));
    expect(f.runtime.update(100)).toBe(true);
    expect(f.camera.stopFollow).toHaveBeenCalledOnce();
    f.runtime.update(7000);
    f.runtime.damage(100, 7000);
    f.runtime.update(7000 + definition.purification.defeatedMs);
    expect(f.runtime.lock.locked).toBe(true);
    const restoredAt = 7000 + definition.purification.defeatedMs + definition.purification.durationMs;
    expect(f.runtime.update(restoredAt)).toBe(false);
    expect(f.runtime.snapshot.state).toBe("RESTORED");
    expect(f.runtime.lock.permits("move")).toBe(true);
    expect(f.options.onPurificationVisualFinished).toHaveBeenCalledOnce();
    expect(f.camera.startFollow).toHaveBeenCalledWith(f.player, true, .16, .16);
    expect(f.options.onCleared).not.toHaveBeenCalled();
    f.player.x += 40;
    f.runtime.update(restoredAt + 100);
    expect(f.player.x).toBeGreaterThan(976);
    confirm(true); await flush();
    f.runtime.update(restoredAt + 200); f.runtime.update(restoredAt + 300);
    expect(f.options.onCleared).toHaveBeenCalledOnce();
    expect(f.runtime.snapshot.state).toBe("CLEARED");
    f.runtime.destroy();
  });

  it("save rejection releases input, retains the reward and retries without re-running purification", async () => {
    const f = fixture();
    f.runtime.snapshot.state = "RESTORED";
    f.bridge.persistBossRestoration.mockRejectedValueOnce(new Error("storage unavailable"));
    expect(f.runtime.update(15000)).toBe(false); await flush();
    expect(f.runtime.lock.locked).toBe(false);
    expect(f.options.onCleared).not.toHaveBeenCalled();
    expect(f.bridge.emitMessage).toHaveBeenCalledWith("Não foi possível confirmar o desbloqueio. Tentaremos novamente.");
    f.runtime.update(17000); await flush(); f.runtime.update(17001);
    expect(f.bridge.persistBossRestoration).toHaveBeenCalledTimes(2);
    expect(f.options.onPurificationVisualFinished).toHaveBeenCalledOnce();
    expect(f.options.onCleared).toHaveBeenCalledOnce();
    f.runtime.destroy();
  });

  it("a hung receipt expires, retries and ignores its obsolete late result", async () => {
    const f = fixture();
    let late!: (confirmed: boolean) => void;
    f.bridge.persistBossRestoration.mockImplementationOnce(() => new Promise((resolve) => { late = resolve; }));
    f.runtime.snapshot.state = "RESTORED";
    f.runtime.update(15000); f.runtime.update(27000);
    expect(f.runtime.lock.locked).toBe(false);
    late(true); await flush(); expect(f.runtime.snapshot.state).toBe("RESTORED");
    f.runtime.update(29000); await flush(); f.runtime.update(29001);
    expect(f.options.onCleared).toHaveBeenCalledOnce();
    f.runtime.destroy();
  });

  it("destroy cancels callbacks, releases cinematic input and restores camera exactly once", async () => {
    const f = fixture();
    f.runtime.update(100);
    f.runtime.destroy(); f.runtime.destroy();
    expect(f.runtime.lock.locked).toBe(false);
    expect(f.camera.startFollow).toHaveBeenCalledOnce();
    expect(f.effects.destroy).toHaveBeenCalledOnce(); expect(f.title.destroy).toHaveBeenCalledOnce();
    expect(f.runtime.update(1000)).toBe(false);
    expect(f.options.onCleared).not.toHaveBeenCalled();
  });

  it("online RESTORED releases input without granting a local reward", () => {
    const f = fixture("king-arthur", true);
    f.runtime.snapshot.state = "RESTORED";
    expect(f.runtime.update(15000)).toBe(false);
    expect(f.bridge.persistBossRestoration).not.toHaveBeenCalled();
    expect(f.options.onCleared).not.toHaveBeenCalled();
    f.runtime.destroy();
  });

  it("only the choreography states lock gameplay", () => {
    for (const state of ["RESTORED", "UNLOCK", "CLEARED", "COMBAT", "INACTIVE"] as const) expect(isBossInputLocked(state)).toBe(false);
    for (const state of ["ROOM_ENTERED", "INTRO_LOCK", "AWAKENING", "DEFEATED", "PURIFICATION"] as const) expect(isBossInputLocked(state)).toBe(true);
  });
});

describe("shared completion ownership", () => {
  it.each(CORRUPTED_LEGEND_BOSSES.map((definition, index) => ({ ...definition, regionId: ["mata-encantada", "arquipelago-das-mares", "montanhas-runicas"][index] })))("$id destroys the runtime, clears its room/doors and creates one exit/reward", (definition) => {
    const f = fixture(definition.id);
    // Use the real deterministic room manager, with rendering/persistence ports.
    const graph = generateDungeon({ seed: "post-clear", regionId: definition.regionId });
    const manager = new DungeonManager(graph);
    const roomId = graph.bossRoomId;
    const completion = new BossEncounterCompletion();
    let runtime: BossEncounterRuntime | null = f.runtime;
    let doorsLocked = true, portalCount = 0, rewards = 0;
    const publish = vi.fn();
    const ports = {
      destroyRuntime: () => { runtime?.destroy(); runtime = null; },
      removeActor: () => { f.actor.active = false; },
      clearCombatEffects: vi.fn(),
      restorePlayer: () => { f.player.setVelocity(0, 0); f.camera.startFollow(f.player); },
      grantCombatReward: () => { rewards++; },
      completeRoom: () => { manager.clearRoom(roomId); doorsLocked = false; },
      createExit: () => { portalCount++; }, publish,
    };
    f.runtime.snapshot.state = "RESTORED";
    expect(completion.complete(roomId, f.runtime.snapshot, ports)).toBe(false);
    f.runtime.snapshot.state = "CLEARED";
    expect(completion.complete(roomId, f.runtime.snapshot, ports)).toBe(true);
    expect(completion.complete(roomId, f.runtime.snapshot, ports)).toBe(false);
    expect(runtime).toBeNull(); expect(f.actor.active).toBe(false);
    expect(f.effects.destroy).toHaveBeenCalledOnce(); expect(f.title.destroy).toHaveBeenCalledOnce();
    expect(manager.getRoom(roomId).state).toBe("cleared"); expect(doorsLocked).toBe(false);
    expect(portalCount).toBe(1); expect(rewards).toBe(1); expect(publish).toHaveBeenCalledOnce();
  });
});
