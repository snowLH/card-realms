import type { AvatarConfig } from "@/game/save/local-progress";

export const PLAYABLE_LEGEND_IDS = [
  "curupira",
  "iara",
  "boto",
  "kappa",
  "raiju",
  "amarok",
  "kelpie",
  "mapinguari",
  "ahuizotl",
  "ratatoskr",
  "carbunclo",
  "alicanto",
  "yeti",
] as const;

export type PlayableLegendId = (typeof PLAYABLE_LEGEND_IDS)[number];
export type LegendAppearance = Pick<AvatarConfig, "skin" | "hair" | "outfit" | "accent">;

export type PlayableLegend = {
  id: PlayableLegendId;
  name: string;
  epithet: string;
  folklore: string;
  description: string;
  price: number;
  appearance: LegendAppearance;
  signatureAbilityIds: readonly [string, string];
};

/** Original Folklard heroes inspired by folklore across several traditions. */
export const PLAYABLE_LEGENDS: readonly PlayableLegend[] = [
  {
    id: "curupira",
    name: "Curupira",
    epithet: "Guardião da Mata",
    folklore: "Brasil",
    description: "Veloz e resistente; protege a floresta com raízes e flechas encantadas.",
    price: 0,
    appearance: { skin: "copper", hair: "mohawk", outfit: "ranger", accent: "crimson" },
    signatureAbilityIds: ["curupira-root-snare", "curupira-ember-arrow"],
  },
  {
    id: "iara",
    name: "Iara",
    epithet: "Voz das Águas",
    folklore: "Brasil",
    description: "Encanta adversários e abre espaço para contra-atacar com magia líquida.",
    price: 180,
    appearance: { skin: "rose", hair: "waves", outfit: "scholar", accent: "azure" },
    signatureAbilityIds: ["iara-enchanting-song", "iara-living-spring"],
  },
  {
    id: "boto",
    name: "Boto",
    epithet: "Viajante do Rio",
    folklore: "Brasil",
    description: "Um duelista ágil que mistura truques, disparos e ecos do rio.",
    price: 240,
    appearance: { skin: "rose", hair: "short", outfit: "merchant", accent: "crimson" },
    signatureAbilityIds: ["boto-river-whirl", "boto-tidal-trick"],
  },
  {
    id: "kappa",
    name: "Kappa",
    epithet: "Aprendiz do Redemoinho",
    folklore: "Japão",
    description: "Baixinho e esperto; ataca de perto com ondas que empurram os inimigos.",
    price: 220,
    appearance: { skin: "amber", hair: "short", outfit: "ranger", accent: "emerald" },
    signatureAbilityIds: ["kappa-shell-surge", "kappa-river-bind"],
  },
  {
    id: "raiju",
    name: "Raiju",
    epithet: "Faísca da Tempestade",
    folklore: "Japão",
    description: "Corre entre os alvos e descarrega raios em linha reta.",
    price: 360,
    appearance: { skin: "umber", hair: "mohawk", outfit: "traveler", accent: "azure" },
    signatureAbilityIds: ["raiju-thunder-field", "raiju-lightning-fang"],
  },
  {
    id: "amarok",
    name: "Amarok",
    epithet: "Lobo da Noite",
    folklore: "Inuit",
    description: "Um caçador robusto que avança sem recuar e domina o campo de batalha.",
    price: 420,
    appearance: { skin: "umber", hair: "waves", outfit: "traveler", accent: "azure" },
    signatureAbilityIds: ["amarok-moon-howl", "amarok-night-hunt"],
  },
  {
    id: "kelpie",
    name: "Kelpie",
    epithet: "Corcel das Brumas",
    folklore: "Escócia",
    description: "Prende criaturas com correntes de água e atravessa a arena num salto.",
    price: 300,
    appearance: { skin: "copper", hair: "waves", outfit: "scholar", accent: "emerald" },
    signatureAbilityIds: ["kelpie-drowning-reins", "kelpie-mist-call"],
  },
  {
    id: "mapinguari",
    name: "Mapinguari",
    epithet: "Guardião das Profundezas",
    folklore: "Amazônia",
    description: "Aguenta o impacto e esmaga grupos com golpes que fazem a terra tremer.",
    price: 500,
    appearance: { skin: "umber", hair: "waves", outfit: "merchant", accent: "crimson" },
    signatureAbilityIds: ["mapinguari-earth-grip", "mapinguari-forest-crush"],
  },
  {
    id: "ahuizotl",
    name: "Ahuizotl",
    epithet: "Caçador das Margens",
    folklore: "México",
    description: "Embosca alvos isolados com investidas rápidas e tentáculos espirituais.",
    price: 540,
    appearance: { skin: "copper", hair: "short", outfit: "traveler", accent: "azure" },
    signatureAbilityIds: ["ahuizotl-tail-grasp", "ahuizotl-river-ambush"],
  },
  {
    id: "ratatoskr",
    name: "Ratatoskr",
    epithet: "Mensageiro do Freixo",
    folklore: "Nórdico",
    description: "Pequeno e veloz; dispara de longe e some antes da resposta inimiga.",
    price: 380,
    appearance: { skin: "amber", hair: "waves", outfit: "merchant", accent: "crimson" },
    signatureAbilityIds: ["ratatoskr-acorn-shot", "ratatoskr-branch-whirl"],
  },
  {
    id: "carbunclo",
    name: "Carbunclo",
    epithet: "Chama das Montanhas",
    folklore: "Andes",
    description: "Um batedor místico que queima obstáculos e restaura a própria energia.",
    price: 460,
    appearance: { skin: "rose", hair: "mohawk", outfit: "ranger", accent: "crimson" },
    signatureAbilityIds: ["carbunclo-gem-flare", "carbunclo-gem-renewal"],
  },
  {
    id: "alicanto",
    name: "Alicanto",
    epithet: "Ave do Minério",
    folklore: "Chile",
    description: "Enxerga recompensas escondidas e ataca do alto com rajadas brilhantes.",
    price: 500,
    appearance: { skin: "amber", hair: "waves", outfit: "scholar", accent: "gold" },
    signatureAbilityIds: ["alicanto-golden-gale", "alicanto-mineral-mending"],
  },
  {
    id: "yeti",
    name: "Yeti",
    epithet: "Sentinela da Neve",
    folklore: "Himalaia",
    description: "Forte e perseverante; abre caminho com impacto e congelamento.",
    price: 620,
    appearance: { skin: "rose", hair: "waves", outfit: "traveler", accent: "azure" },
    signatureAbilityIds: ["yeti-frozen-roar", "yeti-avalanche-stomp"],
  },
];

export const PLAYABLE_LEGEND_BY_ID = new Map(PLAYABLE_LEGENDS.map((legend) => [legend.id, legend]));
export const PLAYABLE_LEGEND_ID_SET = new Set<string>(PLAYABLE_LEGEND_IDS);
export const LEGEND_INVENTORY_PREFIX = "legend-";

export function legendInventoryKey(id: PlayableLegendId) {
  return `${LEGEND_INVENTORY_PREFIX}${id}`;
}

export function isPlayableLegendId(value: unknown): value is PlayableLegendId {
  return typeof value === "string" && PLAYABLE_LEGEND_ID_SET.has(value);
}

export function getLegendAppearance(id: PlayableLegendId) {
  const legend = PLAYABLE_LEGEND_BY_ID.get(id)!;
  return { ...legend.appearance, armor: "none" as const, legendId: id };
}

export function getLegendSignatureAbilityIds(id: PlayableLegendId): [string, string] {
  const legend = PLAYABLE_LEGEND_BY_ID.get(id)!;
  return [...legend.signatureAbilityIds];
}

/** Power slots may be reordered, but both must belong to the active legend. */
export function hasExactLegendPowers(abilityIds: readonly string[], id: PlayableLegendId) {
  const legend = PLAYABLE_LEGEND_BY_ID.get(id)!;
  return abilityIds.length === 2
    && new Set(abilityIds).size === 2
    && abilityIds.every((abilityId) => legend.signatureAbilityIds.includes(abilityId));
}
