import { describe, expect, it } from "vitest";
import { pickGroupMember } from "./group-member";

describe("pickGroupMember", () => {
  it("selects the grouped object when it is the first overlap argument", () => {
    const grouped = { id: "projectile" };
    const player = { id: "player" };
    expect(pickGroupMember((candidate) => candidate === grouped, grouped, player)).toBe(grouped);
  });

  it("selects the grouped object when Phaser reverses the overlap arguments", () => {
    const grouped = { id: "projectile" };
    const player = { id: "player" };
    expect(pickGroupMember((candidate) => candidate === grouped, player, grouped)).toBe(grouped);
  });

  it("rejects an overlap pair with no grouped object", () => {
    const grouped = { id: "projectile" };
    expect(pickGroupMember((candidate) => candidate === grouped, { id: "player" }, { id: "enemy" })).toBeNull();
  });
});
