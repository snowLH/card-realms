import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_PROGRESS, loadLocalProgress, localProgressKey } from "./local-progress";
import { saveReconciledProgress, saveReconciledValue } from "./save-conflict";

function fixture() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
describe("account cache / cloud conflict policy", () => {
  it("uses server-confirmed economy and preserves the offline branch before replacement", () => {
    const storage = fixture();
    const offline = { ...DEFAULT_LOCAL_PROGRESS, coins: 99999, xp: 88888, purifiedBossIds: ["king-arthur"], unlockedLegendIds: ["king-arthur" as const] };
    saveReconciledProgress(storage, offline, "account-a", "offline", 1);
    expect(saveReconciledProgress(storage, DEFAULT_LOCAL_PROGRESS, "account-a", "cloud", 2)).toBe(true);
    expect(loadLocalProgress(storage, "account-a").coins).toBe(500);
    expect(loadLocalProgress(storage, "account-a").unlockedLegendIds).toEqual([]);
    const backups = JSON.parse(storage.getItem(`${localProgressKey("account-a")}:offline-backups`)!);
    expect(JSON.parse(backups[0].progress)).toMatchObject({ coins: 99999, unlockedLegendIds: ["king-arthur"] });
  });
  it("never imports visitor or other-account rewards", () => {
    const storage = fixture();
    saveReconciledProgress(storage, { ...DEFAULT_LOCAL_PROGRESS, coins: 99999 }, null, "offline");
    saveReconciledProgress(storage, { ...DEFAULT_LOCAL_PROGRESS, coins: 1234 }, "account-a", "cloud");
    saveReconciledProgress(storage, DEFAULT_LOCAL_PROGRESS, "account-b", "cloud");
    expect(loadLocalProgress(storage, "account-b").coins).toBe(500);
    expect(loadLocalProgress(storage).coins).toBe(99999);
    expect(loadLocalProgress(storage, "account-a").coins).toBe(1234);
  });
  it("does not create a conflict on a normal cloud refresh or unchanged offline boot", () => {
    const storage = fixture();
    saveReconciledProgress(storage, DEFAULT_LOCAL_PROGRESS, "account-a", "cloud", 1);
    saveReconciledProgress(storage, DEFAULT_LOCAL_PROGRESS, "account-a", "offline", 2);
    expect(saveReconciledProgress(storage, { ...DEFAULT_LOCAL_PROGRESS, coins: 700 }, "account-a", "cloud", 3)).toBe(false);
    expect(storage.getItem(`${localProgressKey("account-a")}:offline-backups`)).toBeNull();
  });
  it("does not overwrite offline progress if preserving its backup fails", () => {
    const storage = fixture();
    const offline = { ...DEFAULT_LOCAL_PROGRESS, coins: 800 };
    saveReconciledProgress(storage, offline, "account-a", "offline");
    const failing = { ...storage, setItem: (key: string, value: string) => {
      if (key.endsWith(":offline-backups")) throw new Error("quota"); storage.setItem(key, value);
    } };
    expect(() => saveReconciledProgress(failing, DEFAULT_LOCAL_PROGRESS, "account-a", "cloud")).toThrow("quota");
    expect(loadLocalProgress(storage, "account-a").coins).toBe(800);
  });
  it("preserves legacy caches without metadata and offline-only loadout changes", () => {
    const storage = fixture();
    storage.setItem(localProgressKey("account-a"), JSON.stringify({ ...DEFAULT_LOCAL_PROGRESS, coins: 800 }));
    expect(saveReconciledProgress(storage, DEFAULT_LOCAL_PROGRESS, "account-a", "cloud")).toBe(true);
    const key = "card-realms-arpg-loadout-v1:account-a";
    saveReconciledValue(storage, key, '{"weaponId":"wooden-branch"}', "cloud");
    saveReconciledValue(storage, key, '{"weaponId":"other-owned-weapon"}', "offline");
    expect(saveReconciledValue(storage, key, '{"weaponId":"wooden-branch"}', "cloud")).toBe(true);
    expect(JSON.parse(storage.getItem(`${key}:offline-backups`)!)[0].progress).toBe('{"weaponId":"other-owned-weapon"}');
  });
});
