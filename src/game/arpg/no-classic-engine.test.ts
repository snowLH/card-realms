import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Folklard's active code cannot regress to retired TCG modes", () => {
  it("does not ship the old turn-based combat/PvP API or engine", () => {
    for (const path of [
      "src/game/engine.ts",
      "src/game/battle/engine.ts",
      "src/game/raid/engine.ts",
      "src/game/pvp/realtime.ts",
      "src/server/pvp/setup.ts",
      "src/server/raid/setup.ts",
      "src/app/api/pvp/actions/route.ts",
      "src/app/api/pvp/challenges/route.ts",
      "src/server/http-handlers/legacy/battle.ts",
    ]) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(false);
    }
  });
});
