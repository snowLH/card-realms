import { hasExactLegendPowers } from "@/game/arpg/content/legends";
import { AvatarConfigSchema } from "@/game/save/local-progress";

/** Returns true only when the saved pair is exactly the active Legend's signature pair. */
export function hasMatchingLegendPowerPair(avatarConfig: unknown, abilityIds: unknown) {
  const avatar = AvatarConfigSchema.safeParse(avatarConfig);
  if (!avatar.success || !Array.isArray(abilityIds) || abilityIds.length !== 2) return false;

  const [first, second] = abilityIds;
  if (typeof first !== "string" || typeof second !== "string") return false;
  return hasExactLegendPowers([first, second], avatar.data.legendId);
}
