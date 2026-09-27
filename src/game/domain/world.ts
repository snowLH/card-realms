export type Activity = "explore" | "wild" | "npc" | "treasure" | "sanctuary" | "boss";

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
};
