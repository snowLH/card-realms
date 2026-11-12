import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const user="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const migration=readFileSync("supabase/migrations/20261011115802_native_player_preferences.sql","utf8");
let db:PGlite;
describe("native preferences migration on PostgreSQL",()=>{
  beforeAll(async()=>{
    db=new PGlite(); await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table public.profiles(id uuid primary key,coins int default 500);
      insert into public.profiles(id) values('${user}'),('${other}');`);
    await db.exec(migration);
  },30000);
  afterAll(async()=>db?.close());
  it("adds no entitlements and preserves existing accounts",async()=>{
    expect((await db.query("select coins from public.profiles")).rows).toEqual([{coins:500},{coins:500}]);
    expect((await db.query("select * from public.player_preferences")).rows).toEqual([]);
  });
  it("serializes revisions, rejects a conflicting stale write and makes repeats idempotent",async()=>{
    await db.exec("set role service_role");
    const write=(revision:number,value:boolean)=>db.query<{receipt:{confirmed:boolean;snapshot:{revision:number;soundEnabled:boolean}}}>("select public.update_player_preferences($1,$2,$3) as receipt",[user,revision,value]);
    expect((await write(0,false)).rows[0].receipt).toMatchObject({confirmed:true,snapshot:{revision:1,soundEnabled:false}});
    expect((await write(0,false)).rows[0].receipt.snapshot.revision).toBe(1);
    expect((await write(0,true)).rows[0].receipt).toMatchObject({confirmed:false,snapshot:{revision:1,soundEnabled:false}});
    expect((await write(1,true)).rows[0].receipt.snapshot.revision).toBe(2);
    await db.exec("reset role"); await db.exec(migration);
    expect((await db.query("select revision from public.player_preferences")).rows[0]).toEqual({revision:2});
  });
  it("enforces owner-only reads and denies client mutation / arbitrary account RPCs",async()=>{
    await db.query("insert into public.player_preferences(user_id) values($1)",[other]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec("set role authenticated");
    expect((await db.query("select user_id from public.player_preferences")).rows).toEqual([{user_id:user}]);
    await expect(db.query("update public.player_preferences set sound_enabled=false")).rejects.toThrow("permission denied");
    await expect(db.query("select public.update_player_preferences($1,0,false)",[other])).rejects.toThrow("permission denied");
    await db.exec("reset role");
    const result=await db.query("select has_function_privilege('anon','public.update_player_preferences(uuid,bigint,boolean)','execute') as anon, has_function_privilege('authenticated','public.update_player_preferences(uuid,bigint,boolean)','execute') as authenticated");
    expect(result.rows[0]).toEqual({anon:false,authenticated:false});
    expect((await db.query("select coins from public.profiles")).rows).toEqual([{coins:500},{coins:500}]);
  });
});
