import type { ArpgDungeonCombatCommand, ArpgDungeonCombatState } from "../dungeon/combat-authority";
import type { ArpgVisualEvent } from "../domain/visual-events";

export type ConfirmedCombatResponse = {
  state: ArpgDungeonCombatState;
  revision: number;
};

/** Runs presentation/state reconciliation only after a non-null server response. */
export async function acceptServerConfirmedCombatResponse<T extends ConfirmedCombatResponse>(options: {
  request: () => Promise<T | null>;
  isSceneActive: () => boolean;
  getPreviousState: () => ArpgDungeonCombatState | null;
  command: ArpgDungeonCombatCommand;
  abilityId?: string;
  worldOrigin?: { x: number; y: number };
  applyState: (response: T) => void;
  emit: (event: ArpgVisualEvent) => void;
}): Promise<T | null> {
  const response = await options.request();
  if (!response || !options.isSceneActive()) return null;
  const previous = options.getPreviousState();
  options.applyState(response);
  deriveServerConfirmedVisualEvents({
    previous,
    next: response.state,
    command: options.command,
    revision: response.revision,
    abilityId: options.abilityId,
    worldOrigin: options.worldOrigin,
  }).forEach(options.emit);
  return response;
}

export function deriveServerConfirmedVisualEvents(options: {
  previous: ArpgDungeonCombatState | null;
  next: ArpgDungeonCombatState;
  command: ArpgDungeonCombatCommand;
  revision: number;
  abilityId?: string;
  worldOrigin?: { x: number; y: number };
}): ArpgVisualEvent[] {
  const { previous, next, command, revision, abilityId } = options;
  const origin = options.worldOrigin ?? { x: 0, y: 0 };
  const confirmation = {
    source: "server-confirmed" as const,
    roomId: next.roomId,
    actionId: command.actionId,
    revision,
  };
  const events: ArpgVisualEvent[] = [];

  if (!previous || previous.roomId !== next.roomId) {
    if (next.status === "combat") {
      events.push({ ...confirmation, type: "encounter.started", waveIndex: next.waveIndex });
    }
  } else {
    if (previous.playerX !== next.playerX || previous.playerY !== next.playerY) {
      events.push({
        ...confirmation,
        type: "player.moved",
        from: { x: origin.x + previous.playerX, y: origin.y + previous.playerY },
        to: { x: origin.x + next.playerX, y: origin.y + next.playerY },
      });
    }

    if (next.playerHp < previous.playerHp) {
      events.push({
        ...confirmation,
        type: "player.damaged",
        damage: previous.playerHp - next.playerHp,
        hp: next.playerHp,
        maxHp: next.maxHp,
      });
    }

    for (const enemy of next.enemies) {
      const priorEnemy = previous.enemies.find((candidate) => candidate.id === enemy.id);
      if (!priorEnemy || enemy.hp >= priorEnemy.hp) continue;
      const damage = priorEnemy.hp - enemy.hp;
      const hit = {
        targetId: enemy.id,
        position: { x: origin.x + enemy.x, y: origin.y + enemy.y },
        damage,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        defeated: !enemy.alive,
      };
      events.push({ ...confirmation, type: "enemy.damaged", ...hit });
      if (command.kind === "basic_attack" || command.kind === "ability") {
        events.push({ ...confirmation, type: "attack.hit", ...hit, attackKind: command.kind });
      }
    }

    if (command.kind === "ability" && command.abilitySlot !== undefined && abilityId) {
      const previousCooldown = previous.nextAbilityAtMs[abilityId] ?? 0;
      const nextCooldown = next.nextAbilityAtMs[abilityId] ?? 0;
      if (nextCooldown > previousCooldown) {
        events.push({
          ...confirmation,
          type: "power.cast",
          slot: command.abilitySlot,
          powerId: abilityId,
        position: { x: origin.x + next.playerX, y: origin.y + next.playerY },
        });
      }
    }

    const previousBoss = previous.enemies.find((enemy) => enemy.definitionId === "boss");
    const nextBoss = next.enemies.find((enemy) => enemy.definitionId === "boss");
    if (previousBoss && nextBoss && previousBoss.bossPhase !== nextBoss.bossPhase) {
      events.push({ ...confirmation, type: "boss.phase_changed", phase: nextBoss.bossPhase });
    }

    if (previous.status !== next.status && (next.status === "victory" || next.status === "defeat")) {
      events.push({ ...confirmation, type: "battle.finished", outcome: next.status });
    }
  }

  return events;
}
