import { beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({claims:vi.fn(),from:vi.fn(),rpc:vi.fn(),configured:true,admin:true}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({auth:{getClaims:state.claims},from:state.from})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:state.rpc})}));
vi.mock("@/lib/supabase/env",()=>({isSupabaseConfigured:()=>state.configured,isSupabaseAdminConfigured:()=>state.admin}));
import { GET, PATCH } from "./player-preferences";
const id="11111111-1111-4111-8111-111111111111";
const snapshot={soundEnabled:false,revision:2,updatedAt:"2026-10-11T10:00:00Z"};
const request=(body:unknown,origin="http://localhost")=>new Request("http://localhost/api/player/progress?handler=preferences",{method:"PATCH",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{
  vi.clearAllMocks();state.configured=true;state.admin=true;
  state.claims.mockResolvedValue({data:{claims:{sub:id}},error:null});
  state.rpc.mockResolvedValue({data:{confirmed:true,snapshot},error:null});
  state.from.mockImplementation(()=>{
    const q={select:()=>q,eq:vi.fn(()=>q),maybeSingle:async()=>({data:{sound_enabled:false,revision:2,updated_at:snapshot.updatedAt},error:null})};return q;
  });
});
describe("preference HTTP authority",()=>{
  it("reads complete account preferences without caching private data",async()=>{
    const response=await GET();expect(await response.json()).toMatchObject({snapshot,authority:"supabase"});
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.from).toHaveBeenCalledWith("player_preferences");
  });
  it("derives the mutation owner from verified claims and rejects reward/account fields",async()=>{
    expect((await PATCH(request({soundEnabled:false,expectedRevision:1}))).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("update_player_preferences",{target_user_id:id,expected_revision:1,target_sound_enabled:false});
    expect((await PATCH(request({soundEnabled:false,expectedRevision:1,userId:"other",coins:99999}))).status).toBe(400);
    expect(state.rpc).toHaveBeenCalledOnce();
  });
  it("returns an authoritative conflict and does not invent success on an unavailable migration",async()=>{
    state.rpc.mockResolvedValueOnce({data:{confirmed:false,snapshot},error:null});
    const response=await PATCH(request({soundEnabled:true,expectedRevision:0}));
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({confirmed:false,snapshot});
    state.rpc.mockResolvedValueOnce({data:null,error:{code:"PGRST202"}});
    expect((await PATCH(request({soundEnabled:true,expectedRevision:0}))).status).toBe(503);
  });
  it("rejects cross-site requests and requires both authentication and server authority",async()=>{
    expect((await PATCH(request({soundEnabled:false,expectedRevision:0},"https://other.example"))).status).toBe(403);
    state.claims.mockResolvedValue({data:null,error:{code:"no-session"}});
    expect((await GET()).status).toBe(401);expect((await PATCH(request({soundEnabled:false,expectedRevision:0}))).status).toBe(401);
    state.claims.mockResolvedValue({data:{claims:{sub:id}},error:null});state.admin=false;
    expect((await PATCH(request({soundEnabled:false,expectedRevision:0}))).status).toBe(503);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
