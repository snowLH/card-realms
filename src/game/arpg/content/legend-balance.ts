import type { ArpgAbilityCardDefinition } from "../domain/types";
import { LEGEND_ABILITY_DEFINITIONS } from "./legend-abilities";

type SignatureId = (typeof LEGEND_ABILITY_DEFINITIONS)[number]["id"];
type SignatureTuning = Readonly<{ damage: number; cooldown: number; radius: number; healing: number }>;

/** A bounded first-pass balance profile for every playable signature skill.
 * Combat is driven by the same definitions in Phaser and on the server.
 * Values here are deliberately modest pending real-user playtesting.
 */
export const SIGNATURE_TUNING = {
  "curupira-root-snare": [1.00, 1.00, 1.08, 1],
  "curupira-ember-arrow": [0.98, 0.97, 1, 1],
  "iara-enchanting-song": [0.98, 0.93, 1.08, 1],
  "iara-living-spring": [1, 1, 1, 1],
  "boto-river-whirl": [0.95, 0.93, 1.08, 1],
  "boto-tidal-trick": [1.03, 1.03, 0.96, 1],
  "kappa-shell-surge": [1.10, 1.04, 0.92, 1],
  "kappa-river-bind": [0.96, 0.94, 1.05, 1],
  "raiju-thunder-field": [1.00, 1.06, 0.92, 1],
  "raiju-lightning-fang": [0.97, 0.90, 1, 1],
  "amarok-moon-howl": [1.07, 1.04, 0.94, 1],
  "amarok-night-hunt": [1.08, 1.12, 0.95, 1],
  "kelpie-drowning-reins": [0.94, 0.96, 1.12, 1],
  "kelpie-mist-call": [1.04, 1.05, 1.05, 1],
  "mapinguari-earth-grip": [1.12, 1.14, 0.92, 1],
  "mapinguari-forest-crush": [1.09, 1.11, 1.04, 1],
  "ahuizotl-tail-grasp": [1.08, 1.04, 0.90, 1],
  "ahuizotl-river-ambush": [1.09, 0.98, 0.94, 1],
  "ratatoskr-acorn-shot": [0.91, 0.84, 1, 1],
  "ratatoskr-branch-whirl": [0.96, 0.92, 0.91, 1],
  "carbunclo-gem-flare": [1.03, 1.03, 1, 1],
  "carbunclo-gem-renewal": [1, 0.94, 1, 0.88],
  "alicanto-golden-gale": [0.94, 0.96, 1.07, 1],
  "alicanto-mineral-mending": [1, 1.09, 1, 1.06],
  "yeti-frozen-roar": [0.95, 1.07, 1.13, 1],
  "yeti-avalanche-stomp": [1.08, 1.04, 1.09, 1],
} as const satisfies Record<SignatureId, readonly [number, number, number, number]>;

export function tuneSignaturePower(power: ArpgAbilityCardDefinition, id: SignatureId): ArpgAbilityCardDefinition {
  const [damage, cooldown, radius, healing] = SIGNATURE_TUNING[id];
  return {
    ...power,
    damage: Math.max(0, Math.round(power.damage * damage)),
    cooldownMs: Math.max(1200, Math.round(power.cooldownMs * cooldown)),
    ...(power.radius === undefined ? {} : { radius: Math.max(1, Math.round(power.radius * radius)) }),
    ...(power.restoreHp === undefined ? {} : { restoreHp: Math.max(0, Math.round(power.restoreHp * healing)) }),
  };
}
