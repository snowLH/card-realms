import { localProgressKey, saveLocalProgress, type LocalProgress } from "./local-progress";

type CacheSource = "cloud" | "offline";
type CacheMetadata = { source: CacheSource; localRevision: number; updatedAt: number };
type CacheStorage = Pick<Storage, "getItem" | "setItem">;

/** Local revisions describe this cache only; they never authorize rewards. */
export function saveReconciledProgress(storage: CacheStorage, progress: LocalProgress,
  accountId: string | null, source: CacheSource, now = Date.now()) {
  if (!accountId) { saveLocalProgress(storage, progress); return false; }
  let validated = "";
  saveLocalProgress({ setItem: (_key, value) => { validated = value; } }, progress, accountId);
  return saveReconciledValue(storage, localProgressKey(accountId), validated, source, now);
}

/** Also used for equipment choices: an offline-only loadout must not vanish on login. */
export function saveReconciledValue(storage: CacheStorage, key: string, value: string,
  source: CacheSource, now = Date.now()) {
  const previous = storage.getItem(key);
  let metadata: CacheMetadata | null = null;
  try {
    const parsed = JSON.parse(storage.getItem(`${key}:metadata`) ?? "null");
    if (parsed && ["cloud", "offline"].includes(parsed.source) && Number.isSafeInteger(parsed.localRevision)
      && parsed.localRevision >= 0 && Number.isFinite(parsed.updatedAt)) metadata = parsed;
  } catch { /* Older cache is conservatively preserved. */ }
  const changed = previous !== value;
  const conflict = source === "cloud" && metadata?.source !== "cloud" && changed && Boolean(previous);
  if (conflict) {
    // Preserve the offline branch BEFORE replacing it with server-confirmed state.
    const backupsKey = `${key}:offline-backups`;
    let backups: unknown[] = [];
    try { const saved = JSON.parse(storage.getItem(backupsKey) ?? "[]"); if (Array.isArray(saved)) backups = saved; } catch { /* Keep current branch. */ }
    storage.setItem(backupsKey, JSON.stringify([...backups.slice(-2), { savedAt: now, progress: previous }]));
  }
  storage.setItem(key, value);
  const nextMetadata: CacheMetadata = {
    source: changed ? source : metadata?.source ?? source,
    localRevision: Math.max(0, Number.isSafeInteger(metadata?.localRevision) ? metadata!.localRevision : 0) + (changed ? 1 : 0),
    updatedAt: changed ? now : metadata?.updatedAt ?? now,
  };
  storage.setItem(`${key}:metadata`, JSON.stringify(nextMetadata));
  return conflict;
}
