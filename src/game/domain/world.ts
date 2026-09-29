export type Activity = "explore" | "wild" | "npc" | "treasure" | "sanctuary" | "boss";

export type RegionAreaDefinition = {
  id: string;
  name: string;
  subtitle: string;
  recommendedLevel: string;
  position: { x: number; y: number };
  activity: Activity;
  unlockAfter?: string;
};

export type RegionDefinition = {
  id: string;
  name: string;
  subtitle: string;
  inspiration: string;
  recommendedLevel: string;
  discovered: number;
  totalCreatures: number;
  status: "open" | "locked" | "event";
  mapPosition: { x: number; y: number };
  neighbors: string[];
  activities: Activity[];
  accent: string;
  viewport?: { x: number; y: number; scale: number };
  areas?: RegionAreaDefinition[];
};
