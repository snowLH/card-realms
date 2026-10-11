import type { BossEncounterSnapshot } from "./boss-encounter-controller";

export type BossCompletionPorts = {
  destroyRuntime: () => void;
  removeActor: () => void;
  clearCombatEffects: () => void;
  restorePlayer: () => void;
  grantCombatReward: () => void;
  completeRoom: () => void;
  createExit: () => void;
  publish: () => void;
};

/** Scene ownership ends here, only after the persisted restoration is confirmed.
 * The receipt is per room: retries/repeated authority snapshots cannot pay twice.
 */
export class BossEncounterCompletion {
  private readonly completedRoomIds = new Set<string>();

  complete(roomId: string, encounter: BossEncounterSnapshot, ports: BossCompletionPorts) {
    if (encounter.state !== "CLEARED" || this.completedRoomIds.has(roomId)) return false;
    this.completedRoomIds.add(roomId);
    ports.destroyRuntime();
    ports.removeActor();
    ports.clearCombatEffects();
    ports.restorePlayer();
    ports.grantCombatReward();
    ports.completeRoom();
    ports.createExit();
    ports.publish();
    return true;
  }
}
