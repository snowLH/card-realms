import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import type { BossParticipant } from "./boss-definition";
import { advanceArthurCombat } from "./king-arthur/combat";
type CombatStrategy = (encounter: BossEncounterSnapshot, nowMs: number, previousMs: number, players: readonly BossParticipant[], arena: { width: number; height: number }) => void;
const strategies: Readonly<Record<string, CombatStrategy>> = { "king-arthur": advanceArthurCombat };
export const hasBossCombatStrategy = (id: string) => Boolean(strategies[id]);
export function advanceBossCombat(...args: Parameters<CombatStrategy>) { strategies[args[0].bossId]?.(...args); }
