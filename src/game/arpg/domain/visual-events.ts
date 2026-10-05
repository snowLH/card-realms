export type ArpgVisualEventConfirmation = {
  source: "server-confirmed";
  roomId: string;
  actionId: string;
  revision: number;
};

/** Read-only presentation cues emitted after an authoritative combat response is applied. */
export type ArpgVisualEvent = ArpgVisualEventConfirmation & (
  | {
    type: "encounter.started";
    waveIndex: number;
  }
  | {
    type: "player.moved";
    from: { x: number; y: number };
    to: { x: number; y: number };
  }
  | {
    type: "power.cast";
    slot: 0 | 1;
    powerId: string;
    position: { x: number; y: number };
  }
  | {
    type: "attack.hit";
    targetId: string;
    position: { x: number; y: number };
    damage: number;
    hp: number;
    maxHp: number;
    defeated: boolean;
    attackKind: "basic_attack" | "ability";
  }
  | {
    type: "enemy.damaged";
    targetId: string;
    position: { x: number; y: number };
    damage: number;
    hp: number;
    maxHp: number;
    defeated: boolean;
  }
  | {
    type: "player.damaged";
    damage: number;
    hp: number;
    maxHp: number;
  }
  | {
    type: "boss.phase_changed";
    phase: number;
  }
  | {
    type: "battle.finished";
    outcome: "victory" | "defeat";
  }
);
