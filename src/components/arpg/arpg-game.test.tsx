// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArpgHudState } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { createInitialArpgRunCheckpoint } from "@/game/arpg/dungeon/run-checkpoint";
import { ArpgGame } from "./arpg-game";

const createGame = vi.hoisted(() => vi.fn());
vi.mock("@/game/arpg/runtime/create-game", () => ({ createArpgGame: createGame }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

const startPayload = {
  token: "test-run-token", runSeed: "test-run-seed", checkpoint: {},
  persistent: true, resumed: false, revision: 0,
};
const completedRun: ArpgHudState = {
  nowMs: 1000, hp: 0, maxHp: 120, room: 2, roomCount: 8,
  enemiesRemaining: 0, weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
  armorId: DEFAULT_ARPG_LOADOUT.armorId, relicId: DEFAULT_ARPG_LOADOUT.relicId,
  dungeonMap: null, runShards: 0, runMoveSpeedBonus: 0, runBasicDamageMultiplier: 1,
  chestAvailable: false, pendingLoot: null, pendingRoomChoice: null, runLoot: [],
  abilityIds: DEFAULT_ARPG_LOADOUT.abilityIds, dashReadyAt: 0,
  abilityReadyAt: {}, xpEarned: 10, runEnded: true, victory: false,
};
const resultPayload = { persisted: true, reward: { coins: 0, xp: 0, victory: false, items: [] } };
const checkpoint = createInitialArpgRunCheckpoint({
  startRoomId: "room-0", weaponId: DEFAULT_ARPG_LOADOUT.weaponId,
  armorId: DEFAULT_ARPG_LOADOUT.armorId, maxHp: 120,
});

let runtimeBridge: ArpgBridge;
const session = { destroy: vi.fn(), setPaused: vi.fn() };
const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  session.destroy.mockClear();
  session.setPaused.mockClear();
  createGame.mockReset().mockImplementation(async (_host, bridge: ArpgBridge) => {
    runtimeBridge = bridge;
    return session;
  });
  fetchMock.mockReset().mockImplementation(async () => Response.json(startPayload));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.localStorage.clear(); });

async function boot(onRunComplete = vi.fn()) {
  const onExit = vi.fn();
  const rendered = render(<ArpgGame onExit={onExit} onRunComplete={onRunComplete} />);
  await waitFor(() => expect(createGame).toHaveBeenCalledOnce());
  return { ...rendered, onExit, onRunComplete };
}

describe("ARPG run completion and recovery", () => {
  it("starts offline without any server request and grants only the local completion reward", async () => {
    fetchMock.mockRejectedValue(new TypeError("No internet"));
    const onComplete = vi.fn();
    render(<ArpgGame onExit={vi.fn()} onRunComplete={onComplete} sessionMode="offline" />);
    await waitFor(() => expect(createGame).toHaveBeenCalledOnce());
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => runtimeBridge.emitRunCheckpoint(checkpoint));
    act(() => runtimeBridge.emitRunEnd({ ...completedRun, hp: 50, victory: true }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onComplete.mock.calls[0][1]).toMatchObject({ persisted: false, reward: { victory: true, coins: 60, xp: 120 } });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => runtimeBridge.emitRunEnd({ ...completedRun, victory: true }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
  it("pauses after a lost checkpoint and prevents subsequent queued actions from using an obsolete revision", async () => {
    await boot();
    runtimeBridge.setMove(1, 0);
    runtimeBridge.setAttack(true);
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    act(() => runtimeBridge.emitRunCheckpoint(checkpoint));
    const encounter = runtimeBridge.submitEncounterCommand("room-1", {
      actionId: "after-checkpoint", kind: "sync", playerX: 0, playerY: 0, aimX: 1, aimY: 0,
    }).catch((error: unknown) => error);
    await act(async () => pending.reject(new Error("Conexão perdida ao salvar.")));
    expect(await encounter).toBeInstanceOf(Error);
    expect(await screen.findByRole("alert")).toHaveTextContent("Conexão perdida ao salvar.");
    expect(session.setPaused).toHaveBeenLastCalledWith(true);
    expect(runtimeBridge.getInput()).toMatchObject({ moveX: 0, moveY: 0, attack: false });
    expect(screen.queryByRole("button", { name: /^Retomar$/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: "Escape" });
    expect(session.setPaused).toHaveBeenLastCalledWith(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reopens the server checkpoint after a save failure and destroys the divergent scene", async () => {
    await boot();
    fetchMock.mockRejectedValueOnce(new Error("A confirmação do checkpoint foi perdida."));
    act(() => runtimeBridge.emitRunCheckpoint(checkpoint));
    const recover = await screen.findByRole("button", { name: "Reabrir checkpoint" });
    fetchMock.mockResolvedValueOnce(Response.json({
      ...startPayload, resumed: true, checkpoint, revision: 1,
    }));
    fireEvent.click(recover);
    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(2));
    expect(session.destroy).toHaveBeenCalledOnce();
    expect(createGame.mock.calls[1][6]).toEqual(checkpoint);
    expect(screen.queryByRole("button", { name: "Reabrir checkpoint" })).not.toBeInTheDocument();
  });

  it("does not complete a persistent run when its final checkpoint failed", async () => {
    const view = await boot();
    fetchMock.mockRejectedValueOnce(new Error("Falha no checkpoint final."));
    act(() => {
      runtimeBridge.emitRunCheckpoint(checkpoint);
      runtimeBridge.emitRunEnd(completedRun);
    });
    expect(await screen.findByRole("button", { name: "Reabrir checkpoint" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Tentar registrar novamente" })).not.toBeInTheDocument();
    expect(view.onRunComplete).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).action))
      .toEqual(["start", "checkpoint"]);
  });

  it("allows an unsuccessful persistent completion to be retried without inventing a local reward", async () => {
    const view = await boot();
    fetchMock.mockRejectedValueOnce(new Error("Conexão interrompida."))
      .mockResolvedValueOnce(Response.json(resultPayload));
    act(() => runtimeBridge.emitRunEnd(completedRun));
    const retry = await screen.findByRole("button", { name: "Tentar registrar novamente" });
    expect(screen.getByText("Conexão interrompida.")).toBeVisible();
    expect(view.onRunComplete).not.toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(view.onRunComplete).toHaveBeenCalledOnce());
    expect(view.onRunComplete).toHaveBeenCalledWith(completedRun, resultPayload);
    const completions = fetchMock.mock.calls.slice(1).map(([, options]) => JSON.parse(options.body));
    expect(completions).toEqual([
      { action: "complete", token: startPayload.token, victory: false },
      { action: "complete", token: startPayload.token, victory: false },
    ]);
  });

  it("keeps result exits disabled while the server is recording the outcome", async () => {
    const view = await boot();
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    act(() => runtimeBridge.emitRunEnd(completedRun));
    await screen.findByText("Validando extração...");
    expect(screen.getByRole("button", { name: "Registrando resultado..." })).toBeDisabled();
    for (const exit of screen.getAllByRole("button", { name: "Voltar à Guilda" })) {
      expect(exit).toBeDisabled();
      fireEvent.click(exit);
    }
    expect(view.onExit).not.toHaveBeenCalled();
    await act(async () => pending.resolve(Response.json(resultPayload)));
    expect(screen.getAllByRole("button", { name: "Voltar à Guilda" }).every((b) => !b.hasAttribute("disabled"))).toBe(true);
  });

  it("starts a fresh expedition after a recorded defeat and destroys the previous scene", async () => {
    await boot();
    fetchMock.mockResolvedValueOnce(Response.json(resultPayload));
    act(() => runtimeBridge.emitRunEnd(completedRun));
    fireEvent.click(await screen.findByRole("button", { name: "Tentar outra vez" }));
    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(2));
    expect(session.destroy).toHaveBeenCalledOnce();
    expect(screen.queryByText("FIM DA EXPEDIÇÃO")).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ action: "start" });
  });

  it("delivers a run result once when the scene repeats its end event", async () => {
    const view = await boot();
    fetchMock.mockResolvedValueOnce(Response.json(resultPayload));
    act(() => { runtimeBridge.emitRunEnd(completedRun); runtimeBridge.emitRunEnd(completedRun); });
    await waitFor(() => expect(view.onRunComplete).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reactivate authoritative combat after unmounting during boot", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const spy = vi.spyOn(ArpgBridge.prototype, "setServerAuthoritativeCombat");
    const view = render(<ArpgGame onExit={vi.fn()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => pending.resolve(Response.json(startPayload)));
    expect(createGame).not.toHaveBeenCalled();
    expect((spy.mock.contexts[0] as ArpgBridge).isServerAuthoritativeCombat()).toBe(false);
    spy.mockRestore();
  });
});
