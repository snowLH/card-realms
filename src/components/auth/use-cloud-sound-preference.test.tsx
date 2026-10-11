// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSoundEnabledSnapshot, setSoundEnabledPreference } from "@/game/arpg/runtime/sound-preference";
import { useCloudSoundPreference } from "./use-cloud-sound-preference";
const cloud={soundEnabled:true,revision:0,updatedAt:null};
beforeEach(()=>{ window.localStorage.clear(); });
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("cloud sound lifecycle",()=>{
  it("preserves guest preference across account login, syncs a user toggle and restores it on logout",async()=>{
    setSoundEnabledPreference(false);
    const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{
      if(init?.method==="PATCH")return Response.json({confirmed:true,snapshot:{...cloud,soundEnabled:JSON.parse(init.body as string).soundEnabled,revision:1},authority:"supabase"});
      return Response.json({snapshot:cloud,authority:"supabase"});
    }); vi.stubGlobal("fetch",fetcher);
    const {rerender}=renderHook(({id}:{id:string|null|undefined})=>useCloudSoundPreference(id),{initialProps:{id:null as string|null|undefined}});
    expect(window.localStorage.getItem("arpg.soundEnabled:guest")).toBe("false");
    rerender({id:"a"}); await waitFor(()=>expect(getSoundEnabledSnapshot()).toBe(true));
    act(()=>setSoundEnabledPreference(false));
    await waitFor(()=>expect(fetcher.mock.calls.some((call)=>call[1]?.method==="PATCH")).toBe(true));
    expect(fetcher.mock.calls.find((call)=>call[1]?.method==="PATCH")?.[1]?.body).toBe(JSON.stringify({soundEnabled:false,expectedRevision:0}));
    rerender({id:null}); expect(getSoundEnabledSnapshot()).toBe(false);
    expect(window.localStorage.getItem("arpg.soundEnabled:guest")).toBe("false");
  });
  it("does not treat an unknown session as guest or apply a late response from a previous account",async()=>{
    window.localStorage.setItem("arpg.soundEnabled:guest","false"); setSoundEnabledPreference(false);
    let finish!:(value:Response)=>void;
    const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})); vi.stubGlobal("fetch",fetcher);
    const {rerender}=renderHook(({id}:{id:string|null|undefined})=>useCloudSoundPreference(id),{initialProps:{id:undefined as string|null|undefined}});
    expect(fetcher).not.toHaveBeenCalled(); rerender({id:"a"}); rerender({id:null});
    await act(async()=>finish(Response.json({snapshot:cloud})));
    expect(getSoundEnabledSnapshot()).toBe(false); expect(window.localStorage.getItem("arpg.soundEnabled:guest")).toBe("false");
  });
});
