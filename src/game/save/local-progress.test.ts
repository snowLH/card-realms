import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_PROGRESS,
  LOCAL_PROGRESS_KEY,
  loadLocalProgress,
  saveLocalProgress,
} from "./local-progress";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    value: (key: string) => values.get(key),
  };
}

describe("save local versionado", () => {
  it("recusa dados corrompidos e volta ao estado seguro", () => {
    const storage = memoryStorage({ [LOCAL_PROGRESS_KEY]: '{"coins":-99}' });
    expect(loadLocalProgress(storage)).toEqual(DEFAULT_LOCAL_PROGRESS);
  });

  it("migra o save legado para a versão 2", () => {
    const storage = memoryStorage({
      "card-realms:demo-progress:v1": JSON.stringify({
        coins: 912,
        xp: 77,
        openedTreasures: ["roots", "roots"],
      }),
    });

    expect(loadLocalProgress(storage)).toEqual({
      version: 2,
      coins: 912,
      xp: 77,
      openedTreasures: ["roots"],
      playerRegionId: "roots",
    });
  });

  it("normaliza tesouros duplicados antes de persistir", () => {
    const storage = memoryStorage();
    saveLocalProgress(storage, {
      ...DEFAULT_LOCAL_PROGRESS,
      openedTreasures: ["roots", "roots", "mist"],
    });

    expect(JSON.parse(storage.value(LOCAL_PROGRESS_KEY) ?? "{}")).toMatchObject({
      version: 2,
      openedTreasures: ["roots", "mist"],
    });
  });
});
