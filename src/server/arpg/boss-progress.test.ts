import { afterEach, describe, expect, it, vi } from "vitest";
import { recordStoredBossProgress } from "./boss-progress";
import { EMPTY_BOSS_PROGRESS } from "@/game/arpg/bosses/boss-unlocks";
vi.mock("server-only", () => ({}));
afterEach(() => vi.useRealTimers());
const scope = { playerId: "eligible", runId: "stored-authority-run" };

describe("restoration receipt availability", () => {
  it("returns an unconfirmed receipt after a DB timeout so RESTORED can still be synchronized", async () => {
    vi.useFakeTimers();
    const rpc = vi.fn(() => new Promise(() => {}));
    const pending = recordStoredBossProgress({ rpc } as unknown as Parameters<typeof recordStoredBossProgress>[0], scope, true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await pending).toMatchObject({ confirmed: false, error: expect.stringContaining("Tentaremos novamente") });
  });
  it("retries safely after a rejected request and accepts only a validated server receipt", async () => {
    const rpc = vi.fn().mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce({ data: { confirmed: true, progress: EMPTY_BOSS_PROGRESS }, error: null });
    const admin = { rpc } as unknown as Parameters<typeof recordStoredBossProgress>[0];
    expect(await recordStoredBossProgress(admin, scope, true)).toMatchObject({ confirmed: false });
    expect(await recordStoredBossProgress(admin, scope, true)).toMatchObject({ confirmed: true, progress: EMPTY_BOSS_PROGRESS });
    expect(rpc).toHaveBeenLastCalledWith("record_corrupted_legend_progress", { target_player_id: "eligible", target_run_id: "stored-authority-run", target_room_id: null, target_restore: true });
  });
});
