import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_PREFERENCES, playerPreferencesKey, type PlayerPreferences } from "./player-preferences";
import { PreferencesSyncController } from "./preferences-sync-controller";
const snapshot = (revision = 0, soundEnabled = true): PlayerPreferences => ({ ...DEFAULT_PLAYER_PREFERENCES, revision, soundEnabled });
function fixture(accountId = "a") {
  const values = new Map<string,string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => { values.set(key,value); } };
  const remote = { read: vi.fn().mockResolvedValue(snapshot()), write: vi.fn().mockResolvedValue({ confirmed: true, snapshot: snapshot(1,false) }) };
  const apply = vi.fn(); const conflict = vi.fn();
  const create = () => new PreferencesSyncController(storage, accountId, remote, apply, conflict);
  return { storage, remote, apply, conflict, create };
}
describe("account preference reconciliation", () => {
  it("loads the cloud preference without importing the guest/global value", async () => {
    const f = fixture(); f.storage.setItem("arpg.soundEnabled", "false");
    await f.create().start();
    expect(f.apply).toHaveBeenLastCalledWith(true); expect(f.remote.write).not.toHaveBeenCalled();
  });
  it("recovers a pending offline toggle on restart and writes only against its known cloud base", async () => {
    const f = fixture(); f.storage.setItem(playerPreferencesKey("a"), JSON.stringify({ server: snapshot(), value:false,dirty:true }));
    await f.create().start();
    expect(f.remote.write).toHaveBeenCalledExactlyOnceWith(false,0);
    expect(JSON.parse(f.storage.getItem(playerPreferencesKey("a"))!)).toMatchObject({ server: { revision:1 },value:false,dirty:false });
  });
  it("archives a conflicting offline branch before loading the newer device's setting", async () => {
    const f = fixture(); f.storage.setItem(playerPreferencesKey("a"), JSON.stringify({ server: snapshot(),value:false,dirty:true }));
    f.remote.read.mockResolvedValue(snapshot(2)); await f.create().start();
    expect(f.remote.write).not.toHaveBeenCalled(); expect(f.conflict).toHaveBeenCalledOnce();
    expect(JSON.parse(f.storage.getItem(`${playerPreferencesKey("a")}:offline-backups`)!)[0]).toMatchObject({ value:false,dirty:true });
    expect(f.apply).toHaveBeenLastCalledWith(true);
  });
  it("never imports a branch without a known cloud revision", async () => {
    const f = fixture(); f.storage.setItem(playerPreferencesKey("a"), JSON.stringify({ server:null,value:false,dirty:true }));
    await f.create().start(); expect(f.remote.write).not.toHaveBeenCalled(); expect(f.conflict).toHaveBeenCalledOnce();
  });
  it("retains pending settings on network failure, and does not touch another account", async () => {
    const f = fixture(); f.storage.setItem(playerPreferencesKey("b"), "other-account");
    f.remote.read.mockRejectedValue(new Error("offline")); const controller = f.create();
    controller.change(false); await controller.refresh();
    expect(JSON.parse(f.storage.getItem(playerPreferencesKey("a"))!)).toMatchObject({ value:false,dirty:true });
    expect(f.storage.getItem(playerPreferencesKey("b"))).toBe("other-account");
    expect(f.remote.write).not.toHaveBeenCalled();
  });
  it("rejects stale snapshots and ignores responses after an account switch/unmount", async () => {
    const f = fixture(); f.storage.setItem(playerPreferencesKey("a"), JSON.stringify({ server:snapshot(4,false),value:false,dirty:false }));
    await f.create().start(); expect(f.apply).toHaveBeenCalledExactlyOnceWith(false);
    let finish!: (value:PlayerPreferences)=>void;
    f.remote.read.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const controller=f.create(); const task=controller.start(); controller.stop(); finish(snapshot(5)); await task;
    expect(f.apply).toHaveBeenLastCalledWith(false);
  });
  it("retains a newer toggle made while a previous preference write is in flight", async () => {
    const f=fixture(); f.storage.setItem(playerPreferencesKey("a"),JSON.stringify({server:snapshot(),value:false,dirty:true}));
    let finish!: (value:unknown)=>void;
    f.remote.write.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    f.remote.read.mockResolvedValueOnce(snapshot()).mockResolvedValue(snapshot(1,false));
    f.remote.write.mockResolvedValueOnce({confirmed:true,snapshot:snapshot(2,true)});
    const controller=f.create(); const task=controller.start();
    await vi.waitFor(()=>expect(f.remote.write).toHaveBeenCalledOnce()); controller.change(true);
    finish({confirmed:true,snapshot:snapshot(1,false)}); await task;
    expect(f.remote.write).toHaveBeenLastCalledWith(true,1); expect(f.apply).toHaveBeenLastCalledWith(true);
    expect(JSON.parse(f.storage.getItem(playerPreferencesKey("a"))!)).toMatchObject({value:true,dirty:false,server:{revision:2}});
  });
  it("preserves a conflict if the backup cannot be stored", async () => {
    const f=fixture(); const pending={server:snapshot(),value:false,dirty:true};
    f.storage.setItem(playerPreferencesKey("a"),JSON.stringify(pending)); f.remote.read.mockResolvedValue(snapshot(2));
    const failing={...f.storage,setItem:(key:string,value:string)=>{if(key.endsWith(":offline-backups"))throw new Error("quota");f.storage.setItem(key,value);}};
    await new PreferencesSyncController(failing,"a",f.remote,f.apply).start();
    expect(JSON.parse(f.storage.getItem(playerPreferencesKey("a"))!)).toEqual(pending);
    expect(f.apply).toHaveBeenCalledExactlyOnceWith(false);
  });
});
