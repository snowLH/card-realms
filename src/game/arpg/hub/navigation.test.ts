import { describe, expect, it } from "vitest";
import { resolveHubNavigation } from "./navigation";

describe("navegação física da Guilda", () => {
  it("leva o Altar Mítico ao boss semanal", () => {
    expect(resolveHubNavigation("altar")).toEqual({
      kind: "view",
      view: "raid",
      toast: "Altar Mítico · calendário do boss semanal.",
    });
  });

  it("abre loja de poderes e ateliê, mantendo Mercador e Portal nos sistemas próprios", () => {
    expect(resolveHubNavigation("archive")).toEqual({ kind: "loadout-focus", focus: "cards" });
    expect(resolveHubNavigation("avatar")).toEqual({ kind: "loadout-focus", focus: "avatar" });
    expect(resolveHubNavigation("merchant")).toEqual({ kind: "view", view: "village" });
    expect(resolveHubNavigation("portal")).toEqual({ kind: "view", view: "expeditions" });
  });
});
