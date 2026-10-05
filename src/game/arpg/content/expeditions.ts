import { ARPG_ASSETS } from "../assets";

export type ArpgExpeditionId = "mata-encantada" | "arquipelago-das-mares" | "montanhas-runicas";

export type ArpgExpeditionDefinition = {
  id: ArpgExpeditionId;
  name: string;
  subtitle: string;
  description: string;
  bossName: string;
  victoryTitle: string;
  roomCount: string;
  elementLabel: string;
  background: string;
  available: boolean;
  folklore: string[];
};

export const ARPG_EXPEDITIONS: ArpgExpeditionDefinition[] = [
  {
    id: "mata-encantada",
    name: "Mata Encantada",
    subtitle: "Floresta viva · Brasil",
    description: "Abra caminho entre espíritos da mata, Mapinguari e o Curupira Ancestral.",
    bossName: "Curupira Ancestral",
    victoryTitle: "Curupira Ancestral derrotado",
    roomCount: "8–12",
    elementLabel: "Natureza / Fogo",
    background: ARPG_ASSETS.environments.mataEncounter,
    available: true,
    folklore: ["Curupira", "Mapinguari", "Boitatá"],
  },
  {
    id: "arquipelago-das-mares",
    name: "Arquipélago das Marés",
    subtitle: "Águas lendárias · Amazônia e águas do mundo",
    description: "Atravesse ilhas inundadas e enfrente criaturas de tradições ligadas a rios, lagos e mares.",
    bossName: "Iara das Profundezas",
    victoryTitle: "Iara das Profundezas derrotada",
    roomCount: "8–12",
    elementLabel: "Água / Espírito",
    background: ARPG_ASSETS.environments.archipelago,
    available: true,
    folklore: ["Iara", "Boto-cor-de-rosa", "Kappa", "Kelpie"],
  },
  {
    id: "montanhas-runicas",
    name: "Montanhas Rúnicas",
    subtitle: "Alturas, minas e tempestades · tradições do mundo",
    description: "Suba passagens geladas e minas luminosas até a caçada final do Amarok.",
    bossName: "Amarok",
    victoryTitle: "Amarok derrotado",
    roomCount: "8–12",
    elementLabel: "Tempestade / Espírito / Natureza",
    background: ARPG_ASSETS.environments.runicMountains,
    available: true,
    folklore: ["Amarok", "Raijū", "Yeti", "Carbunclo", "Alicanto", "Ratatoskr"],
  },
];

export const DEFAULT_ARPG_EXPEDITION_ID: ArpgExpeditionId = "mata-encantada";

export function getArpgExpedition(id: ArpgExpeditionId) {
  return ARPG_EXPEDITIONS.find((expedition) => expedition.id === id)
    ?? ARPG_EXPEDITIONS[0];
}
