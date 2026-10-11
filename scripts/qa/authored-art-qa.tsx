"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArpgRaidArena} from "../../src/components/arpg/arpg-raid-arena";
import {createArpgRaidState,advanceArpgRaid,applyArpgRaidAction} from "../../src/game/arpg/raid/engine";
import type {ArpgRaidAction,ArpgRaidState} from "../../src/game/arpg/raid/types";
import {ARPG_ROC_RAID_BOSS} from "../../src/game/arpg/raid/content";
import {DEFAULT_ARPG_LOADOUT} from "../../src/game/arpg/content/mata-encantada";
import {attachArpgSharedDungeon} from "../../src/game/arpg/coop-dungeon/shared-run";
import {ARPG_RAID_PLAYER_MARGIN} from "../../src/game/arpg/raid/types";
import {damageBossEncounter,confirmBossRestoration} from "../../src/game/arpg/bosses/boss-encounter-controller";
import {EMPTY_BOSS_PROGRESS,restoreBossProgress} from "../../src/game/arpg/bosses/boss-unlocks";
import type {ArpgExpeditionId} from "../../src/game/arpg/content/expeditions";
import {DEFAULT_LOCAL_PROGRESS,localProgressKey,saveLocalProgress} from "../../src/game/save/local-progress";
const roomId="11111111-1111-4111-8111-111111111111";
const eventId="22222222-2222-4222-8222-222222222222";
let state:ArpgRaidState;
let version=1;
let originalTransport:typeof fetch;
let progress=structuredClone(EMPTY_BOSS_PROGRESS);
function reset(region:ArpgExpeditionId){
  state=attachArpgSharedDungeon(createArpgRaidState(roomId,eventId,[
    {id:"qa-a",name:"Arthur",seat:1,loadout:{...DEFAULT_ARPG_LOADOUT,abilityIds:["arthur-camelot-cut","arthur-round-table-oath"]},seenBossIntroIds:[]},
    {id:"qa-b",name:"Iara",seat:2,loadout:{...DEFAULT_ARPG_LOADOUT,abilityIds:["iara-enchanting-song","iara-living-spring"]},seenBossIntroIds:[]},
  ],ARPG_ROC_RAID_BOSS,Date.now()),region);
  version++;
}
function advance(){
  // Presentation fixture only: keep both spectators alive while QA inspects
  // long cinematic sequences. Inputs, boss transitions and damage stay real.
  state.players.forEach(player=>{player.hp=player.maxHp;player.alive=true;player.downedUntilMs=0;});
  state=advanceArpgRaid(state,Date.now()).state;version++;
}
function enterBoss(){
  const dungeon=state.dungeon!;
  dungeon.rooms.slice(0,-1).forEach(room=>{room.state="cleared";room.enemies=[];});
  dungeon.roomIndex=dungeon.rooms.length-2;
  const corridor=dungeon.rooms[dungeon.roomIndex];corridor.state="awaiting_exit";
  state.players.forEach(player=>{player.x=corridor.worldWidth-ARPG_RAID_PLAYER_MARGIN;player.y=corridor.worldHeight/2;});
  advance();
}
const transport:typeof fetch=async(input,options)=>{
  const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
  if(url===`/api/arpg/raids/rooms/${roomId}`){
    advance();
    return Response.json({room:{id:roomId,status:state.status,version},event:{id:eventId,title:"Simulação visual local",boss_creature_id:"roc"},state,participants:state.players.map(p=>({id:p.id,presenceStatus:"online"})),bossProgress:progress});
  }
  if(url==="/api/arpg/raids/actions"){
    const body=JSON.parse(String(options?.body));
    if(body.roomId===roomId){
      const action={...body,kind:body.action} as ArpgRaidAction;
      try{state=applyArpgRaidAction(state,"qa-a",action,Date.now()).state;version++;return Response.json({state,version});}
      catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});}
    }
  }
  return originalTransport(input,options);
};
export default function AuthoredArtQa(){
  const router=useRouter();
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    reset("montanhas-runicas");
    const key=localProgressKey("qa-a"),backup=localStorage.getItem(key);
    saveLocalProgress(localStorage,{...DEFAULT_LOCAL_PROGRESS,avatar:{...DEFAULT_LOCAL_PROGRESS.avatar,legendId:"king-arthur",favoriteLegendId:"king-arthur"}},"qa-a");
    originalTransport=window.fetch;window.fetch=transport;
    const qaWindow=window as Window & {__authoredArtCoopQA?:()=>ArpgRaidState};
    qaWindow.__authoredArtCoopQA=()=>structuredClone(state);
    const timer=window.setTimeout(()=>setReady(true),0);
    return()=>{window.clearTimeout(timer);window.fetch=originalTransport;delete qaWindow.__authoredArtCoopQA;if(backup===null)localStorage.removeItem(key);else localStorage.setItem(key,backup);};
  },[]);
  return <main style={{padding:8}}>
    <p>SIMULAÇÃO LOCAL DE QA · duas lendas protegidas · engine real · sem servidor/banco</p>
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>reset("mata-encantada")}>Mata</button>
      <button onClick={()=>reset("arquipelago-das-mares")}>Marés</button>
      <button onClick={()=>reset("montanhas-runicas")}>Montanhas</button>
      <button onClick={enterBoss}>Entrar no boss</button>
      <button onClick={()=>{const boss=state.bossEncounter;if(boss){boss.guardUntilMs=0;boss.weakUntilMs=0;damageBossEncounter(boss,boss.hp-boss.maxHp*(boss.phase===1?.6:.25),state.serverTimeMs);}}}>Avançar fase</button>
      <button onClick={()=>{if(state.bossEncounter)damageBossEncounter(state.bossEncounter,999999,state.serverTimeMs);}}>HP zero</button>
      <button onClick={()=>{const boss=state.bossEncounter;if(boss?.state==="RESTORED"){progress=restoreBossProgress(progress,boss);confirmBossRestoration(boss,boss.bossId,true,state.serverTimeMs);}}}>Confirmar restauração local</button>
    </div>
    {ready?<ArpgRaidArena roomId={roomId} playerId="qa-a" onClose={()=>router.push("/")}/>:<p>Preparando QA…</p>}
  </main>;
}
