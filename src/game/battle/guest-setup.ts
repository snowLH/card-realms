import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { hasExactLegendPowers } from "@/game/arpg/content/legends";
import { AvatarConfigSchema } from "@/game/save/local-progress";

const GuestAbilityIdsSchema = z.tuple([z.string().min(1), z.string().min(1)]).superRefine((ids, context) => {
  if (ids[0] === ids[1]) {
    context.addIssue({ code: "custom", message: "Os poderes precisam ser diferentes.", path: [1] });
  }
  ids.forEach((id, index) => {
    if (!ARPG_ABILITY_CARD_BY_ID.has(id)) {
      context.addIssue({ code: "custom", message: "Poder de batalha desconhecido.", path: [index] });
    }
  });
});

export const GuestBattleSetupSchema = z.strictObject({
  avatarConfig: AvatarConfigSchema,
  abilityIds: GuestAbilityIdsSchema,
}).superRefine((setup, context) => {
  if (!hasExactLegendPowers(setup.abilityIds, setup.avatarConfig.legendId)) {
    context.addIssue({
      code: "custom",
      message: "Os dois poderes precisam ser os ataques próprios da Lenda escolhida.",
      path: ["abilityIds"],
    });
  }
});

export type GuestBattleSetup = z.infer<typeof GuestBattleSetupSchema>;
