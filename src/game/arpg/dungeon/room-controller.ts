import type { CombatRoomState } from "./types";

export type CombatRoomSnapshot = {
  state: CombatRoomState;
  waveIndex: number;
  waveCount: number;
  enemiesAlive: number;
  doorsLocked: boolean;
};

export class CombatRoomController {
  private state: CombatRoomState = "idle";
  private waveIndex = -1;
  private enemiesAlive = 0;
  private doorsLocked = false;

  constructor(private readonly waveCount: number, private readonly alreadyCleared = false) {
    if (alreadyCleared) this.state = "cleared";
  }

  enter() {
    if (this.state === "cleared") return this.snapshot();
    if (this.state !== "idle") return this.snapshot();
    this.state = "entering";
    this.doorsLocked = true;
    this.state = "locked";
    return this.snapshot();
  }

  startNextWave(enemyCount: number) {
    if (!this.doorsLocked || this.state === "cleared") throw new Error("Sala não está pronta para iniciar uma onda.");
    if (enemyCount <= 0) throw new Error("Uma onda precisa ter ao menos um inimigo.");
    if (this.waveIndex + 1 >= this.waveCount) throw new Error("Não existem mais ondas nesta sala.");
    this.waveIndex += 1;
    this.state = "spawning";
    this.enemiesAlive = enemyCount;
    this.state = "combat";
    return this.snapshot();
  }

  enemyDefeated() {
    if (this.state !== "combat") return this.snapshot();
    this.enemiesAlive = Math.max(0, this.enemiesAlive - 1);
    if (this.enemiesAlive === 0) this.state = "wave_complete";
    return this.snapshot();
  }

  completeWave() {
    if (this.state !== "wave_complete") throw new Error("A onda ainda não foi concluída.");
    if (this.waveIndex + 1 >= this.waveCount) return this.completeRoom();
    this.state = "locked";
    return this.snapshot();
  }

  completeRoom() {
    this.state = "cleared";
    this.enemiesAlive = 0;
    this.doorsLocked = false;
    return this.snapshot();
  }

  snapshot(): CombatRoomSnapshot {
    return {
      state: this.state,
      waveIndex: this.waveIndex,
      waveCount: this.waveCount,
      enemiesAlive: this.enemiesAlive,
      doorsLocked: this.doorsLocked,
    };
  }
}
