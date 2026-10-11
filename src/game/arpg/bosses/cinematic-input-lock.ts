import type { BossState } from "./boss-definition";

export function isBossInputLocked(state?: BossState) {
  // RESTORED means the visual choreography finished. Persistence is a separate
  // confirmation, shared by the solo authority and co-op simulation.
  return state === "ROOM_ENTERED" || state === "INTRO_LOCK" || state === "AWAKENING"
    || state === "DEFEATED" || state === "PURIFICATION";
}
/** A lock has an owner, so ending one cinematic cannot release another lock. */
export class CinematicInputLock {
  private owners = new Set<string>();
  acquire(owner: string, stop: () => void) { this.owners.add(owner); stop(); }
  release(owner: string) { this.owners.delete(owner); }
  get locked() { return this.owners.size > 0; }
  permits(action: "move" | "attack" | "dash" | "ability" | "weapon" | "interact") { return Boolean(action) && !this.locked; }
}
