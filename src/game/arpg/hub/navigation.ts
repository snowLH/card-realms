import type { HubDestinationId } from "./content";

export type HubNavigationAction =
  | { kind: "view"; view: "expeditions" | "loadout" | "collection" | "refuge" | "raid" | "village"; toast?: string }
  | { kind: "loadout-focus"; focus: "cards" | "legend" };

export function resolveHubNavigation(destination: HubDestinationId): HubNavigationAction {
  if (destination === "altar") {
    return {
      kind: "view",
      view: "raid",
      toast: "Altar Mítico · calendário do boss semanal.",
    };
  }
  if (destination === "archive") return { kind: "loadout-focus", focus: "cards" };
  if (destination === "avatar") return { kind: "loadout-focus", focus: "legend" };
  if (destination === "merchant") return { kind: "view", view: "village" };
  if (destination === "portal") return { kind: "view", view: "expeditions" };
  return { kind: "view", view: destination };
}
