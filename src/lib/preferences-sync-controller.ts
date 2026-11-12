import { z } from "zod";
import { PlayerPreferencesSchema, playerPreferencesKey, type PlayerPreferences } from "./player-preferences";

const CacheSchema = z.object({ server: PlayerPreferencesSchema.nullable(), value: z.boolean(), dirty: z.boolean() }).strict();
type Cache = z.infer<typeof CacheSchema>;
type StoragePort = Pick<Storage, "getItem" | "setItem">;
type Remote = {
  read: () => Promise<PlayerPreferences>;
  write: (soundEnabled: boolean, expectedRevision: number) => Promise<{ confirmed: boolean; snapshot: PlayerPreferences }>;
};

/** Only non-economic preferences may replay offline changes with a known cloud base. */
export class PreferencesSyncController {
  private cache: Cache | null = null;
  private disposed = false;
  private busy = false;
  private requested = false;
  private readonly key: string;
  constructor(private readonly storage: StoragePort, accountId: string, private readonly remote: Remote,
    private readonly apply: (soundEnabled: boolean) => void, private readonly onConflict = () => {}) {
    this.key = playerPreferencesKey(accountId);
    try {
      const result = CacheSchema.safeParse(JSON.parse(storage.getItem(this.key) ?? "null"));
      if (result.success) this.cache = result.data;
    } catch { /* A malformed cache never authorizes a write. */ }
  }
  async start() {
    if (this.cache) this.apply(this.cache.value);
    await this.refresh();
  }
  stop() { this.disposed = true; }
  change(value: boolean) {
    if (this.disposed || this.cache?.value === value) return;
    this.cache = { server: this.cache?.server ?? null, value, dirty: true };
    this.persist();
    void this.refresh();
  }
  private persist() { if (this.cache) this.storage.setItem(this.key, JSON.stringify(this.cache)); }
  private archive() {
    let saved: unknown[] = [];
    try { const value = JSON.parse(this.storage.getItem(`${this.key}:offline-backups`) ?? "[]"); if (Array.isArray(value)) saved = value; } catch { /* Preserve current intent. */ }
    // If storage is full, throw before replacing a pending local choice.
    this.storage.setItem(`${this.key}:offline-backups`, JSON.stringify([...saved.slice(-2), this.cache]));
    this.onConflict();
  }
  private receive(snapshot: PlayerPreferences, confirmed = false) {
    if (this.cache?.server && snapshot.revision < this.cache.server.revision) return false;
    const pending = this.cache?.dirty && this.cache.value !== snapshot.soundEnabled;
    if (pending && !confirmed && this.cache?.server?.revision !== snapshot.revision) {
      this.archive();
      this.cache = { server: snapshot, value: snapshot.soundEnabled, dirty: false };
    } else {
      this.cache = { server: snapshot, value: pending ? this.cache!.value : snapshot.soundEnabled, dirty: Boolean(pending) };
    }
    this.persist();
    this.apply(this.cache.value);
    return true;
  }
  async refresh() {
    if (this.disposed) return;
    if (this.busy) { this.requested = true; return; }
    this.busy = true;
    try {
      do {
        this.requested = false;
        const snapshot = PlayerPreferencesSchema.parse(await this.remote.read());
        if (this.disposed || !this.receive(snapshot)) return;
        // Never import guest preferences or a pending branch with no known cloud base.
        if (this.cache?.dirty && this.cache.server) {
          const desired = this.cache.value;
          const receipt = await this.remote.write(desired, this.cache.server.revision);
          if (this.disposed) return;
          const result = PlayerPreferencesSchema.parse(receipt.snapshot);
          if (result.revision < this.cache.server.revision) return;
          if (!receipt.confirmed) this.receive(result);
          else if (this.cache.value === desired) {
            this.cache = { server: result, value: result.soundEnabled, dirty: false };
            this.persist(); this.apply(result.soundEnabled);
          } else {
            // A newer local toggle occurred in flight; retain it against the confirmed base.
            this.receive(result, true); this.requested = true;
          }
        }
      } while (this.requested && !this.disposed);
    } catch { /* Network/schema/quota failure retains the pending account-specific branch. */ }
    finally { this.busy = false; }
  }
}
