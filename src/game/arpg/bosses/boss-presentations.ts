import type { Scene } from "phaser";
import type { BossEncounterSnapshot } from "./boss-encounter-controller";
import { ArthurPresentation } from "./king-arthur/presentation";
export type BossPresentation = { update(encounter: BossEncounterSnapshot, nowMs: number, reducedMotion: boolean, legendId: string): void; destroy(): void };
type Factory = (scene: Scene, origin: { x: number; y: number }, width: number, height: number) => BossPresentation;
const factories: Readonly<Record<string, Factory>> = { "king-arthur": (scene, origin, width, height) => new ArthurPresentation(scene, origin, width, height) };
export function createBossPresentation(id: string, ...args: Parameters<Factory>) { return factories[id]?.(...args) ?? null; }
