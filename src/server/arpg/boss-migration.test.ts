import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const PLAYER = "11111111-1111-4111-8111-111111111111";
const ALLY = "22222222-2222-4222-8222-222222222222";
const SPECTATOR = "33333333-3333-4333-8333-333333333333";
const IARA_PLAYER = "66666666-6666-4666-8666-666666666666";
const RUN = "44444444-4444-4444-8444-444444444444";
const ROOM = "55555555-5555-4555-8555-555555555555";
const IARA_RUN = "77777777-7777-4777-8777-777777777777";
let db: PGlite;
const proof = (state: string, hp = 0) => ({ bossId: "king-arthur", participantIds: [PLAYER, ALLY, SPECTATOR], state, hp, enteredAtMs: 1000, stateAtMs: 20000 });
async function runProof(state: string, hp = 0) {
  await db.query("update private.arpg_runs set checkpoint = $1::jsonb where run_id = $2", [JSON.stringify({ serverCombatState: { roomId: "boss-room", bossEncounter: proof(state, hp) } }), RUN]);
}
const restore = () => db.query("select public.record_corrupted_legend_progress($1,$2,null,true) as receipt", [PLAYER, RUN]);

describe("corrupted legend migration on embedded PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema private; create schema auth;
      grant usage on schema private to service_role;
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create table public.profiles(id uuid primary key, avatar_config jsonb);
      create table public.inventory_items(user_id uuid, item_key text, quantity int, metadata jsonb default '{}', updated_at timestamptz default now(), primary key(user_id,item_key));
      create table private.arpg_runs(run_id uuid primary key, user_id uuid, expedition_id text, boss_room_id text, checkpoint jsonb);
      create table public.raid_rooms(id uuid primary key, state jsonb);
      create table public.raid_participants(room_id uuid, user_id uuid);
      create table public.player_arpg_loadouts(user_id uuid primary key, weapon_id text, armor_id text, relic_id text, ability_ids text[], updated_at timestamptz, constraint player_arpg_loadouts_ability_ids_check check(cardinality(ability_ids)=2));
    `);
    await db.query("insert into public.profiles(id) values($1),($2),($3),($4)", [PLAYER, ALLY, SPECTATOR, IARA_PLAYER]);
    await db.exec(readFileSync("supabase/migrations/20261010004944_corrupted_legend_restoration.sql", "utf8"));
    await db.query("insert into private.arpg_runs values($1,$2,'montanhas-runicas','boss-room','{}')", [RUN, PLAYER]);
    await db.query("insert into private.arpg_runs values($1,$2,\'arquipelago-das-mares\',\'boss-room\',\'{}\')", [IARA_RUN, IARA_PLAYER]);
  }, 30000);
  afterAll(async () => db?.close());

  it("migrates existing accounts without inventing purified legends", async () => {
    const rows = await db.query<{ purified_boss_ids: string[]; unlocked_legend_ids: string[] }>("select * from public.player_boss_progress");
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((row) => !row.purified_boss_ids.length && !row.unlocked_legend_ids.length)).toBe(true);
  });
  it("rejects HP zero and incomplete purification, retaining inventory", async () => {
    for (const state of ["COMBAT", "DEFEATED", "PURIFICATION"]) {
      await runProof(state);
      await expect(restore()).rejects.toThrow("purificação ainda não terminou");
    }
    expect((await db.query("select * from public.inventory_items")).rows).toHaveLength(0);
    await runProof("RESTORED", 1);
    await expect(restore()).rejects.toThrow("purificação ainda não terminou");
  });
  it("confirms from stored proof and remains idempotent across reconnect/replay", async () => {
    await runProof("RESTORED");
    const result = await restore();
    expect(result.rows[0]).toMatchObject({ receipt: { confirmed: true, progress: { purifiedBossIds: ["king-arthur"], unlockedLegendIds: ["king-arthur"], seenBossIntroIds: ["king-arthur"] } } });
    await restore(); await restore();
    const items = (await db.query<{ quantity: number }>("select * from public.inventory_items where user_id=$1", [PLAYER])).rows;
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.quantity === 1)).toBe(true);
  });
  it("restores Iara with her own legend and signature abilities", async () => {
    const encounter = { bossId: "deep-iara", participantIds: [IARA_PLAYER], state: "RESTORED", hp: 0, enteredAtMs: 1000, stateAtMs: 20000 };
    await db.query("update private.arpg_runs set checkpoint=$1::jsonb where run_id=$2", [
      JSON.stringify({ serverCombatState: { roomId: "boss-room", bossEncounter: encounter } }),
      IARA_RUN,
    ]);
    const result = await db.query<{ receipt: { progress: { unlockedLegendIds: string[] } } }>(
      "select public.record_corrupted_legend_progress($1,$2,null,true) as receipt",
      [IARA_PLAYER, IARA_RUN],
    );
    expect(result.rows[0].receipt.progress.unlockedLegendIds).toContain("iara");
    const items = (await db.query<{ item_key: string }>(
      "select item_key from public.inventory_items where user_id=$1 order by item_key",
      [IARA_PLAYER],
    )).rows.map((row) => row.item_key);
    expect(items).toEqual(["iara-enchanting-song", "iara-living-spring", "legend-iara"]);
  });

  it("does not trust another user's run or a forged boss ID", async () => {
    await expect(db.query("select public.record_corrupted_legend_progress($1,$2,null,true)", [ALLY, RUN])).rejects.toThrow("não confirmado");
    await db.query("update private.arpg_runs set checkpoint=jsonb_set(checkpoint,'{serverCombatState,bossEncounter,bossId}','\"deep-iara\"') where run_id=$1", [RUN]);
    await expect(restore()).rejects.toThrow("não confirmado");
  });
  it("restores eligible party members while excluding spectators and duplicates", async () => {
    const players = [PLAYER, ALLY, SPECTATOR].map((id, index) => ({ id, contribution: { actions: index === 2 ? 0 : 4, damage: index === 2 ? 0 : 50, healing: 0 } }));
    await db.query("insert into public.raid_rooms values($1,$2)", [ROOM, JSON.stringify({ dungeon: { regionId: "montanhas-runicas" }, bossEncounter: proof("RESTORED"), players })]);
    for (const id of [PLAYER, ALLY, SPECTATOR]) await db.query("insert into public.raid_participants values($1,$2)", [ROOM, id]);
    await db.query("select public.record_corrupted_legend_progress($1,null,$2,true)", [ALLY, ROOM]);
    await db.query("select public.record_corrupted_legend_progress($1,null,$2,true)", [PLAYER, ROOM]);
    const rows = (await db.query<{ user_id: string; unlocked_legend_ids: string[]; seen_boss_intro_ids: string[] }>("select * from public.player_boss_progress")).rows;
    expect(rows.find((row) => row.user_id === ALLY)?.unlocked_legend_ids).toEqual(["king-arthur"]);
    expect(rows.find((row) => row.user_id === SPECTATOR)?.unlocked_legend_ids).toEqual([]);
    expect(rows.find((row) => row.user_id === SPECTATOR)?.seen_boss_intro_ids).toEqual(["king-arthur"]);
    expect((await db.query("select * from public.inventory_items")).rows).toHaveLength(6);
  });
  it("restricts entitlement mutation to the service role and retains loadout checks", async () => {
    const result = await db.query<{ authenticated: boolean; service: boolean }>("select has_function_privilege('authenticated','public.record_corrupted_legend_progress(uuid,uuid,uuid,boolean)','execute') as authenticated, has_function_privilege('service_role','public.record_corrupted_legend_progress(uuid,uuid,uuid,boolean)','execute') as service");
    expect(result.rows[0]).toEqual({ authenticated: false, service: true });
    await expect(db.query("insert into public.player_arpg_loadouts(user_id,ability_ids) values($1,array['forged','unknown'])", [PLAYER])).rejects.toThrow("player_arpg_loadouts_ability_ids_check");
    await db.query("insert into public.player_arpg_loadouts(user_id,ability_ids) values($1,array['arthur-camelot-cut','arthur-round-table-oath'])", [PLAYER]);
    expect((await db.query("select private.legend_signature_ability_ids('king-arthur') as ids")).rows[0]).toEqual({ ids: ["arthur-camelot-cut", "arthur-round-table-oath"] });
  });
});
