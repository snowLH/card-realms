import type { Scene } from "phaser";
import type { ArpgAbilityCardDefinition, ArpgVector } from "../domain/types";
import { FX_ART, WORLD_ART } from "./manifest";
import { authoredImage } from "./runtime-art";

export function purificationParticleFrame(legendId:string){
  return legendId==="curupira"?FX_ART.leaf:legendId==="iara"?FX_ART.waterDrop:legendId==="raiju"?FX_ART.lightningFragment:legendId==="yeti"?FX_ART.snow:FX_ART.memoryFragment;
}

/** Art selection is independent of damage, collision and authority. */
export function abilityArt(card: ArpgAbilityCardDefinition) {
  if (card.id.startsWith("yeti-")) return { projectile:WORLD_ART.ice,impact:FX_ART.iceImpact,area:WORLD_ART.frostZone,particle:FX_ART.snow };
  if (card.id.startsWith("arthur-")) return { projectile: WORLD_ART.blade, impact: FX_ART.swordImpact, area: FX_ART.wardAppear, particle: FX_ART.memoryFragment };
  switch (card.element) {
    case "nature": return { projectile: WORLD_ART.arrow, impact: FX_ART.rootZone, area: FX_ART.rootZone, particle: FX_ART.leaf };
    case "water": return { projectile: WORLD_ART.wave, impact: FX_ART.waterImpact, area: FX_ART.waterZone, particle: FX_ART.waterDrop };
    case "storm": return { projectile: WORLD_ART.lightning, impact: FX_ART.lightningImpact, area: WORLD_ART.lightningZone, particle: FX_ART.lightningFragment };
    case "fire": return { projectile: WORLD_ART.fire, impact: FX_ART.corruptedImpact, area: FX_ART.corruptionBurst, particle: FX_ART.ember };
    default: return { projectile: WORLD_ART.magic, impact: FX_ART.magicImpact, area: FX_ART.purificationRing, particle: FX_ART.magicStar };
  }
}

export function telegraphFrame(regionId: string, shape: "circle" | "rectangle" | "line", danger = false) {
  const base = regionId === "mata-encantada" ? 8 : regionId === "arquipelago-das-mares" ? 16 : 0;
  return base + (shape === "circle" ? 0 : shape === "line" ? 4 : 6) + Number(danger);
}

export function spawnAbilityProjectileArt(scene: Scene, card: ArpgAbilityCardDefinition, direction: ArpgVector, x: number, y: number, speed: number, lifeMs: number) {
  const image = authoredImage(scene, x, y, "world", abilityArt(card).projectile, card.id === "arthur-camelot-cut" ? 90 : 48, 32)
    .setDepth(13).setRotation(Math.atan2(direction.y, direction.x));
  scene.tweens.add({ targets: image, x: x + direction.x * speed * lifeMs / 1000, y: y + direction.y * speed * lifeMs / 1000,
    alpha: { from: 0.6, to: 1 }, duration: lifeMs, ease: "Linear", onComplete: () => image.destroy() });
}

export function spawnAbilityGroundArt(scene: Scene, card: ArpgAbilityCardDefinition, x: number, y: number, radius: number, area = false, reducedMotion = false) {
  const art = abilityArt(card);
  const isWorld = area && (card.element === "storm" || card.id.startsWith("yeti-"));
  const image = authoredImage(scene, x, y, isWorld ? "world" : "fx", area ? art.area : art.impact, radius * 2).setDepth(12);
  const scale = image.scaleX;
  const duration = area ? 440 : 145;
  scene.tweens.add({ targets: image, scale: { from: scale * (reducedMotion ? 1 : 0.68), to: scale },
    alpha: { from: 0.2, to: 0.9 }, duration, ease: "Quad.easeOut",
    onComplete: () => scene.tweens.add({ targets: image, alpha: 0, duration: 350, delay: 100, onComplete: () => image.destroy() }) });
  if (!reducedMotion) {
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3;
      const particle = authoredImage(scene, x, y, "fx", art.particle, 12).setDepth(14);
      scene.tweens.add({ targets: particle, x: x + Math.cos(angle) * radius * 0.7, y: y + Math.sin(angle) * radius * 0.7,
        alpha: 0, duration: 550, onComplete: () => particle.destroy() });
    }
  }
}
