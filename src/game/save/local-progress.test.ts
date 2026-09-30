import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_PROGRESS,
  LOCAL_PROGRESS_KEY,
  localProgressKey,
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

  it("migra o save legado para a versão 4 sem perder moedas, XP e tesouros", () => {
    const storage = memoryStorage({
      "card-realms:demo-progress:v1": JSON.stringify({
        coins: 912,
        xp: 77,
        openedTreasures: ["roots", "roots"],
      }),
    });

    expect(loadLocalProgress(storage)).toEqual({
      ...DEFAULT_LOCAL_PROGRESS,
      version: 4,
      coins: 912,
      xp: 77,
      openedTreasures: ["roots"],
    });
  });

  it("normaliza tesouros duplicados antes de persistir", () => {
    const storage = memoryStorage();
    saveLocalProgress(storage, {
      ...DEFAULT_LOCAL_PROGRESS,
      openedTreasures: ["roots", "roots", "mist"],
    });

    expect(JSON.parse(storage.value(LOCAL_PROGRESS_KEY) ?? "{}")).toMatchObject({
      version: 4,
      openedTreasures: ["roots", "mist"],
    });
  });

  it("migra a posição regional de um save v3 quando ela existe", () => {
    const storage = memoryStorage({
      "card-realms:progress:v3": JSON.stringify({
        ...DEFAULT_LOCAL_PROGRESS,
        version: 3,
        mapPositions: { roots: { x: 12, y: 18 } },
      }),
    });

    expect(loadLocalProgress(storage).mapPositions.roots).toEqual({ x: 12, y: 18 });
  });

  it("normaliza áreas e equipamentos duplicados antes de persistir", () => {
    const storage = memoryStorage();
    saveLocalProgress(storage, {
      ...DEFAULT_LOCAL_PROGRESS,
      visitedAreaIds: ["roots-gate", "roots-gate", "roots-inverted"],
      equipmentIds: ["leather", "leather", "guardian-armor"],
    });

    expect(JSON.parse(storage.value(LOCAL_PROGRESS_KEY) ?? "{}")).toMatchObject({
      visitedAreaIds: ["roots-gate", "roots-inverted"],
      equipmentIds: ["leather", "guardian-armor"],
    });
  });

  it("isola o cache de cada conta do progresso do visitante", () => {
    const accountId = "00000000-0000-4000-8000-000000000001";
    const storage = memoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify({
        ...DEFAULT_LOCAL_PROGRESS,
        coins: 9999,
        xp: 9999,
      }),
    });

    expect(loadLocalProgress(storage, accountId)).toEqual(DEFAULT_LOCAL_PROGRESS);

    saveLocalProgress(storage, { ...DEFAULT_LOCAL_PROGRESS, coins: 525 }, accountId);
    expect(JSON.parse(storage.value(localProgressKey(accountId)) ?? "{}")).toMatchObject({
      coins: 525,
      xp: 0,
    });
    expect(JSON.parse(storage.value(LOCAL_PROGRESS_KEY) ?? "{}")).toMatchObject({ coins: 9999 });
  });

  it("inicia uma jornada limpa, sem nível ou equipamentos de demonstração", () => {
    expect(DEFAULT_LOCAL_PROGRESS).toMatchObject({
      coins: 500,
      xp: 0,
      equipmentIds: [],
      energy: { fire: 0, water: 0, nature: 0, storm: 0, spirit: 0 },
    });
  });
});
